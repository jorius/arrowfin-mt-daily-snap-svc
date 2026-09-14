# Trader Daily Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Trader Daily Snapshot feature end to end: a tenant-scoped NestJS API + Socket.IO stream (track A) and a Next.js widget (track B), against the approved design.

**Architecture:** Backend layered as `controllers/` (delivery), `application/` (use cases + ports), `services/` (pure business rules), `infrastructure/` (Prisma, config, seed). Every repository port method that touches tenant data takes a `TenantContext` first. Frontend is App Router pages + TanStack Query hooks + one socket hook that invalidates the snapshot query on every fill.

**Tech Stack:** NestJS 12 (ESM, `.js` import suffixes), Prisma 7.10 with `@prisma/adapter-pg`, PostgreSQL 18, Socket.IO 4, vitest 4, Next.js 16.3 App Router, React 19, Tailwind 4, TanStack Query 5, socket.io-client 4.

**Spec:** `docs/superpowers/specs/2026-09-14-trader-daily-snapshot-design.md` (read it first; §5.2 and §5.3 are the contracts both tracks build against).

**Budget note:** this plan is compressed for a 2-hour assessment window. Core code is given in full; UI components are specified by structure and behaviour. Track A and track B run in parallel in their own repositories.

## Global Constraints

- Backend is ESM: every relative import ends in `.js` (`./app.module.js`), even for `.ts` sources. `tsconfig.json` uses `module: nodenext`.
- Prisma 7: the client is generated to `src/infrastructure/prisma/generated/` (gitignored); import `PrismaClient` from `./generated/client.js`. The datasource URL lives in `prisma.config.ts`, not in the schema. Construct the client with `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
- Prisma `Decimal` columns come back as `Decimal` objects; convert with `Number(value)` at the repository boundary. Application and services only see `number`.
- Dataset CSVs are never written into either repository. The seed reads `DATASET_DIR` (default `../dataset`). The pre-commit hook rejects `*.csv` and `.env`.
- Commit messages: infinitive verb, capital first letter, no prefix ("Add position ledger service"). Commits are GPG-signed by repo config. If signing fails (`gpg failed to sign the data`), do **not** pass `--no-gpg-sign`, do not amend or rebase: keep working, retry the commit at the next checkpoint, and report it. Never rebase.
- "Now" comes from the `Clock` port (replay clock starting at `SNAPSHOT_NOW`), never from `new Date()` inside application or services code.
- No PII (names, email, phone, dob, ssn, address, notes, audit_notes, balances) in log lines or in WebSocket payloads.
- Next.js 16: read `node_modules/next/dist/docs/01-app/01-getting-started/` (project structure, server and client components, fetching data, route handlers) before writing frontend code.

---

# Track A — Backend (`arrowfin-mt-daily-snap-svc`)

Already done by the scaffold: `prisma/schema.prisma`, migration `init` applied to the dev DB, generated client, `prisma.config.ts`, `.env` (local, ignored), `.env.example`, `railway.json`, package scripts (`build`, `seed`, `prisma:*`), `src/main.ts` (CORS + ValidationPipe), `README.md`, `SECURITY.md`.

### Task A1: Env config, clock, health endpoint

**Files:**
- Create: `src/infrastructure/config/env.ts`
- Create: `src/infrastructure/clock/replay-clock.ts`
- Create: `src/application/ports/clock.ts`
- Create: `src/controllers/health.controller.ts`
- Modify: `src/app.module.ts`, `src/main.ts`
- Delete: `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts`, `test/app.e2e-spec.ts`
- Test: `src/infrastructure/clock/replay-clock.spec.ts`

**Interfaces:**
- Produces `Env` and `loadEnv(): Env`, token `ENV = Symbol('ENV')`.
- Produces `Clock { now(): Date }`, token `CLOCK = Symbol('CLOCK')`, class `ReplayClock`.

- [ ] **Step 1: Write the failing clock test**

```ts
// src/infrastructure/clock/replay-clock.spec.ts
import { ReplayClock } from './replay-clock.js';

describe('ReplayClock', () => {
  it('starts at the configured instant and advances with real time', () => {
    let real = 1_000_000;
    const clock = new ReplayClock(new Date('2026-08-25T14:30:00Z'), () => real);
    expect(clock.now().toISOString()).toBe('2026-08-25T14:30:00.000Z');
    real += 5_000;
    expect(clock.now().toISOString()).toBe('2026-08-25T14:30:05.000Z');
  });
  it('falls back to real time when no start is configured', () => {
    const clock = new ReplayClock(null, () => 1_700_000_000_000);
    expect(clock.now().getTime()).toBe(1_700_000_000_000);
  });
});
```

- [ ] **Step 2: Run it, expect failure** — `npx vitest run src/infrastructure/clock` → module not found.

- [ ] **Step 3: Implement**

```ts
// src/application/ports/clock.ts
export const CLOCK = Symbol('CLOCK');
export interface Clock {
  now(): Date;
}
```

```ts
// src/infrastructure/clock/replay-clock.ts
import type { Clock } from '../../application/ports/clock.js';

/** Starts at `start` and advances with wall-clock time, so simulated fills stay inside the replayed session. */
export class ReplayClock implements Clock {
  private readonly bootRealMs: number;
  constructor(
    private readonly start: Date | null,
    private readonly realNowMs: () => number = () => Date.now(),
  ) {
    this.bootRealMs = realNowMs();
  }
  now(): Date {
    if (!this.start) return new Date(this.realNowMs());
    return new Date(this.start.getTime() + (this.realNowMs() - this.bootRealMs));
  }
}
```

```ts
// src/infrastructure/config/env.ts
export const ENV = Symbol('ENV');

export interface Env {
  readonly NODE_ENV: string;
  readonly DATABASE_URL: string;
  readonly PORT: number;
  readonly CORS_ORIGIN: string;
  readonly SNAPSHOT_NOW: Date | null;
  readonly API_KEY_TTL_HOURS: number;
  readonly DEV_FILLS_ENABLED: boolean;
  readonly DEV_TRADER_SECRET: string | undefined;
  readonly DATASET_DIR: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

function intOr(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const snapshotNow = source.SNAPSHOT_NOW ?? '2026-08-25T14:30:00Z';
  const parsed = snapshotNow === '' ? null : new Date(snapshotNow);
  if (parsed && Number.isNaN(parsed.getTime())) throw new Error('SNAPSHOT_NOW must be ISO 8601');
  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: required('DATABASE_URL'),
    PORT: intOr('PORT', 3001),
    CORS_ORIGIN: source.CORS_ORIGIN ?? 'http://localhost:3000',
    SNAPSHOT_NOW: parsed,
    API_KEY_TTL_HOURS: intOr('API_KEY_TTL_HOURS', 12),
    DEV_FILLS_ENABLED: source.DEV_FILLS_ENABLED === 'true' && nodeEnv !== 'production',
    DEV_TRADER_SECRET: source.DEV_TRADER_SECRET || undefined,
    DATASET_DIR: source.DATASET_DIR ?? '../dataset',
  };
}
```

`src/controllers/health.controller.ts`: `@Controller('health')` with `@Get()` returning `{ status: 'ok' }`.

`src/app.module.ts`: `imports: []`, `controllers: [HealthController]`, providers `{ provide: ENV, useFactory: loadEnv }` and `{ provide: CLOCK, useFactory: (env: Env) => new ReplayClock(env.SNAPSHOT_NOW), inject: [ENV] }`. Keep a single `AppModule` for the assessment (note this in the README architecture section is already done).

`src/main.ts`: read `PORT`/`CORS_ORIGIN` through `app.get<Env>(ENV)` instead of `process.env`.

- [ ] **Step 4: Run** — `npx vitest run` → clock tests pass; `npx tsc -p tsconfig.build.json --noEmit` clean; `npm run start:dev` briefly and `curl localhost:3001/health` → `{"status":"ok"}`.

- [ ] **Step 5: Commit** — `Add env config, replay clock and health endpoint`

### Task A2: Seed loader

**Files:**
- Create: `src/infrastructure/seed/load-dataset.ts`
- Create: `src/services/secret-hasher.service.ts` (needed by the seed; tested in A5)

**Interfaces:**
- Produces `SecretHasherService.hash(secret): Promise<string>` / `verify(secret, encoded): Promise<boolean>` / `dummyHash: string` (see A5 for the code — implement it here, test it in A5).

- [ ] **Step 1: Implement the loader**

```ts
// src/infrastructure/seed/load-dataset.ts  (run with: npm run seed)
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client.js';
import { SecretHasherService } from '../../services/secret-hasher.service.js';

const datasetDir = resolve(process.cwd(), process.env.DATASET_DIR ?? '../dataset');
const read = <T>(file: string): T[] =>
  parse(readFileSync(resolve(datasetDir, file)), { columns: true, skip_empty_lines: true }) as T[];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const hasher = new SecretHasherService();

async function main() {
  const brokers = read<Record<string, string>>('brokers.csv');
  const instruments = read<Record<string, string>>('instruments.csv');
  const prices = read<Record<string, string>>('market_prices.csv');
  const traders = read<Record<string, string>>('traders.csv');
  const accounts = read<Record<string, string>>('accounts.csv');
  const fills = read<Record<string, string>>('fills.csv');

  await prisma.$transaction(async (tx) => {
    await tx.fill.deleteMany(); await tx.apiKey.deleteMany(); await tx.traderCredential.deleteMany();
    await tx.account.deleteMany(); await tx.trader.deleteMany(); await tx.marketPrice.deleteMany();
    await tx.instrument.deleteMany(); await tx.broker.deleteMany();

    await tx.broker.createMany({ data: brokers.map((b) => ({
      id: b.id, name: b.name, type: b.type as 'retail' | 'prop', whiteLabelName: b.white_label_name,
      apiKeyHash: b.api_key_hash, createdAt: new Date(b.created_at) })) });
    await tx.instrument.createMany({ data: instruments.map((i) => ({
      symbol: i.symbol, description: i.description, exchange: i.exchange, pointValueUsd: i.point_value_usd,
      tickSize: i.tick_size, tickValueUsd: i.tick_value_usd, initialMarginUsd: i.initial_margin_usd,
      maintenanceMarginUsd: i.maintenance_margin_usd })) });
    await tx.marketPrice.createMany({ data: prices.map((p) => ({ symbol: p.symbol, markPrice: p.mark_price, asOf: new Date(p.as_of) })) });
    await tx.trader.createMany({ data: traders.map((t) => ({
      id: t.id, brokerId: t.broker_id, firstName: t.first_name, lastName: t.last_name, email: t.email, phone: t.phone,
      dob: new Date(t.dob), ssnLast4: t.ssn_last4, addressLine1: t.address_line1, city: t.city, state: t.state || null,
      postalCode: t.postal_code, kycStatus: t.kyc_status as 'verified' | 'pending' | 'suspended',
      notes: t.notes || null, auditNotes: t.audit_notes || null, createdAt: new Date(t.created_at) })) });

    const brokerOfTrader = new Map(traders.map((t) => [t.id, t.broker_id]));
    await tx.account.createMany({ data: accounts.map((a) => ({
      id: a.id, traderId: a.trader_id, brokerId: brokerOfTrader.get(a.trader_id)!, accountNumber: a.account_number,
      accountType: a.account_type as 'funded' | 'demo' | 'eval' | 'pro' | 'pro_plus', balance: a.balance || '0',
      buyingPower: a.buying_power || '0', maxPositionSize: Number.parseInt(a.max_position_size, 10),
      status: a.status as 'active' | 'restricted' | 'closed', createdAt: new Date(a.created_at) })) });

    const brokerOfAccount = new Map(accounts.map((a) => [a.id, brokerOfTrader.get(a.trader_id)!]));
    await tx.fill.createMany({ data: fills.map((f) => ({
      id: f.id, accountId: f.account_id, brokerId: brokerOfAccount.get(f.account_id)!, instrumentSymbol: f.instrument_symbol,
      side: f.side as 'BUY' | 'SELL', quantity: Number.parseInt(f.quantity, 10), price: f.price, filledAt: new Date(f.filled_at),
      orderId: f.order_id, liquidity: f.liquidity as 'maker' | 'taker', commissionUsd: f.commission_usd })) });
  });

  // Credentials: shared demo secret when DEV_TRADER_SECRET is set, otherwise random per trader.
  const shared = process.env.DEV_TRADER_SECRET || undefined;
  const generated: Record<string, string> = {};
  for (const t of traders) {
    const secret = shared ?? randomBytes(24).toString('base64url');
    if (!shared) generated[t.id] = secret;
    await prisma.traderCredential.create({ data: { traderId: t.id, secretHash: await hasher.hash(secret) } });
  }
  if (!shared) {
    mkdirSync(resolve(process.cwd(), '.local'), { recursive: true });
    const out = resolve(process.cwd(), '.local/trader-secrets.json');
    writeFileSync(out, JSON.stringify(generated, null, 2), { mode: 0o600 });
    console.log(`trader secrets written to ${out} (gitignored, mode 600)`);
  } else {
    console.log('all traders seeded with DEV_TRADER_SECRET');
  }
  console.log({ brokers: brokers.length, instruments: instruments.length, prices: prices.length,
    traders: traders.length, accounts: accounts.length, fills: fills.length });
}

main().finally(() => prisma.$disconnect());
```

Prisma accepts numeric strings for `Decimal` columns; pass the CSV strings through unchanged.

- [ ] **Step 2: Run** — `npm run seed` → counts `{ brokers: 3, instruments: 8, prices: 8, traders: 14, accounts: 18, fills: 687 }`; verify with `psql "$DATABASE_URL" -Atc "select broker_id, count(*) from fills group by 1"` → BRK-ARWP 245, BRK-SMPT 187, BRK-MRDN 255 (sum 687).

- [ ] **Step 3: Commit** — `Add dataset seed loader with trader credentials` (the hook will refuse any CSV; `.local/` is ignored).

### Task A3: Pure services — session clock, position ledger, P&L, risk (TDD)

**Files:**
- Create: `src/services/session-clock.service.ts` + `.spec.ts`
- Create: `src/services/position-ledger.service.ts` + `.spec.ts`
- Create: `src/services/pnl.service.ts`
- Create: `src/services/risk.service.ts` + `.spec.ts`

**Interfaces (produced):**

```ts
export interface SessionBounds { open: Date; close: Date }
export class SessionClockService { sessionFor(instant: Date): SessionBounds }

export interface LedgerFill { symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; commissionUsd: number; filledAt: Date; pointValue: number }
export interface OpenPosition { symbol: string; netQty: number; avgPrice: number }   // netQty > 0 long, < 0 short
export interface LedgerResult { positions: OpenPosition[]; realizedInWindow: number; commissionsInWindow: number; fillsInWindow: number }
export class PositionLedgerService { replay(fills: LedgerFill[], window: { from: Date; to: Date }): LedgerResult }

export class PnlService {
  unrealized(p: OpenPosition, markPrice: number, pointValue: number): number  // (mark - avg) * netQty * pointValue
  notional(p: OpenPosition, markPrice: number, pointValue: number): number    // netQty * mark * pointValue
}
export type RiskLevel = 'LOW' | 'ELEVATED' | 'HIGH';
export class RiskService { score(notional: number, balance: number): number; level(score: number): RiskLevel }
```

- [ ] **Step 1: Session clock tests**

```ts
import { SessionClockService } from './session-clock.service.js';
const svc = new SessionClockService();
describe('SessionClockService', () => {
  it('maps the dataset cut to the session that opened the previous evening (CDT)', () => {
    const s = svc.sessionFor(new Date('2026-08-25T14:30:00Z'));
    expect(s.open.toISOString()).toBe('2026-08-24T22:00:00.000Z');
    expect(s.close.toISOString()).toBe('2026-08-25T21:00:00.000Z');
  });
  it('starts a new session at 17:00 Chicago', () => {
    expect(svc.sessionFor(new Date('2026-08-24T22:41:07Z')).open.toISOString()).toBe('2026-08-24T22:00:00.000Z');
    expect(svc.sessionFor(new Date('2026-08-24T21:59:59Z')).open.toISOString()).toBe('2026-08-23T22:00:00.000Z');
  });
  it('uses the winter offset (CST) in January', () => {
    expect(svc.sessionFor(new Date('2026-01-15T12:00:00Z')).open.toISOString()).toBe('2026-01-14T23:00:00.000Z');
  });
});
```

- [ ] **Step 2: Implement the session clock**

```ts
import { Injectable } from '@nestjs/common';

export interface SessionBounds { open: Date; close: Date }

const CHICAGO = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function chicagoWall(instant: Date) {
  const p = Object.fromEntries(CHICAGO.formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

/** Offset (minutes) between Chicago wall time and UTC at `instant`: -300 in CDT, -360 in CST. */
function chicagoOffsetMinutes(instant: Date): number {
  const w = chicagoWall(instant);
  const asIfUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asIfUtc - instant.getTime()) / 60_000);
}

@Injectable()
export class SessionClockService {
  /** CME Globex: opens 17:00 America/Chicago, closes 16:00 the next day. */
  sessionFor(instant: Date): SessionBounds {
    const w = chicagoWall(instant);
    let openWall = Date.UTC(w.y, w.m - 1, w.d, 17, 0, 0);
    if (w.h < 17) openWall -= 24 * 3_600_000;
    const open = new Date(openWall - chicagoOffsetMinutes(instant) * 60_000);
    return { open, close: new Date(open.getTime() + 23 * 3_600_000) };
  }
}
```

- [ ] **Step 3: Ledger tests**

```ts
import { PositionLedgerService, type LedgerFill } from './position-ledger.service.js';
const svc = new PositionLedgerService();
const W = { from: new Date('2026-08-24T22:00:00Z'), to: new Date('2026-08-25T14:30:00Z') };
const at = (iso: string) => new Date(iso);
const f = (o: Partial<LedgerFill>): LedgerFill => ({ symbol: 'MES', side: 'BUY', quantity: 1, price: 100, commissionUsd: 0, filledAt: at('2026-08-25T01:00:00Z'), pointValue: 5, ...o });

describe('PositionLedgerService', () => {
  it('averages same-direction fills', () => {
    const r = svc.replay([f({ quantity: 2, price: 100 }), f({ quantity: 2, price: 110 })], W);
    expect(r.positions).toEqual([{ symbol: 'MES', netQty: 4, avgPrice: 105 }]);
    expect(r.realizedInWindow).toBe(0);
  });
  it('realizes on partial close and keeps the average', () => {
    const r = svc.replay([f({ quantity: 4, price: 105 }), f({ side: 'SELL', quantity: 2, price: 110 })], W);
    expect(r.positions).toEqual([{ symbol: 'MES', netQty: 2, avgPrice: 105 }]);
    expect(r.realizedInWindow).toBe(50); // (110-105) * 2 * 5
  });
  it('handles shorts', () => {
    const r = svc.replay([f({ side: 'SELL', quantity: 3, price: 100, pointValue: 10 }), f({ quantity: 3, price: 90, pointValue: 10 })], W);
    expect(r.positions).toEqual([]);
    expect(r.realizedInWindow).toBe(300);
  });
  it('flips through flat and opens the remainder at the fill price', () => {
    const r = svc.replay([f({ quantity: 2, price: 100, pointValue: 1 }), f({ side: 'SELL', quantity: 5, price: 120, pointValue: 1 })], W);
    expect(r.positions).toEqual([{ symbol: 'MES', netQty: -3, avgPrice: 120 }]);
    expect(r.realizedInWindow).toBe(40);
  });
  it('counts positions from before the window but not their realized P&L or commissions', () => {
    const r = svc.replay([
      f({ quantity: 2, price: 100, commissionUsd: 1.4, filledAt: at('2026-08-21T10:00:00Z') }),
      f({ side: 'SELL', quantity: 1, price: 110, commissionUsd: 0.7, filledAt: at('2026-08-21T11:00:00Z') }),
      f({ side: 'SELL', quantity: 1, price: 120, commissionUsd: 0.7 }),
    ], W);
    expect(r.positions).toEqual([]);
    expect(r.realizedInWindow).toBe(100); // only the in-window close: (120-100)*1*5
    expect(r.commissionsInWindow).toBeCloseTo(0.7);
    expect(r.fillsInWindow).toBe(1);
  });
});
```

- [ ] **Step 4: Implement the ledger**

```ts
import { Injectable } from '@nestjs/common';

export interface LedgerFill { symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; commissionUsd: number; filledAt: Date; pointValue: number }
export interface OpenPosition { symbol: string; netQty: number; avgPrice: number }
export interface LedgerResult { positions: OpenPosition[]; realizedInWindow: number; commissionsInWindow: number; fillsInWindow: number }

/** Average-cost ledger. Fills must be ordered by filledAt. */
@Injectable()
export class PositionLedgerService {
  replay(fills: LedgerFill[], window: { from: Date; to: Date }): LedgerResult {
    const book = new Map<string, { qty: number; avg: number }>();
    let realized = 0, commissions = 0, count = 0;
    for (const fill of fills) {
      const inWindow = fill.filledAt >= window.from && fill.filledAt <= window.to;
      if (inWindow) { commissions += fill.commissionUsd; count += 1; }
      const pos = book.get(fill.symbol) ?? { qty: 0, avg: 0 };
      const signed = fill.side === 'BUY' ? fill.quantity : -fill.quantity;
      if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signed)) {
        const total = Math.abs(pos.qty) + Math.abs(signed);
        pos.avg = (pos.avg * Math.abs(pos.qty) + fill.price * Math.abs(signed)) / total;
        pos.qty += signed;
      } else {
        const closeQty = Math.min(Math.abs(pos.qty), Math.abs(signed));
        const pnl = (fill.price - pos.avg) * closeQty * fill.pointValue * Math.sign(pos.qty);
        if (inWindow) realized += pnl;
        const remainder = Math.abs(signed) - closeQty;
        pos.qty += signed;
        if (pos.qty === 0) pos.avg = 0;
        else if (remainder > 0) pos.avg = fill.price; // flipped: remainder opened at this price
      }
      book.set(fill.symbol, pos);
    }
    const positions = [...book.entries()].filter(([, p]) => p.qty !== 0)
      .map(([symbol, p]) => ({ symbol, netQty: p.qty, avgPrice: p.avg }));
    return { positions, realizedInWindow: realized, commissionsInWindow: commissions, fillsInWindow: count };
  }
}
```

- [ ] **Step 5: Risk tests + implementation**

```ts
// risk.service.spec.ts
import { RiskService } from './risk.service.js';
const svc = new RiskService();
describe('RiskService', () => {
  it('applies min(100, |notional| / balance * 100)', () => { expect(svc.score(25_000, 100_000)).toBe(25); expect(svc.score(-25_000, 100_000)).toBe(25); });
  it('caps at 100', () => expect(svc.score(500_000, 100_000)).toBe(100));
  it('scores 100 when exposed with no balance and 0 when flat', () => { expect(svc.score(1_000, 0)).toBe(100); expect(svc.score(0, 0)).toBe(0); });
  it('levels', () => { expect(svc.level(75)).toBe('ELEVATED'); expect(svc.level(75.01)).toBe('HIGH'); expect(svc.level(50)).toBe('LOW'); });
});
```

```ts
// risk.service.ts
import { Injectable } from '@nestjs/common';
export type RiskLevel = 'LOW' | 'ELEVATED' | 'HIGH';
@Injectable()
export class RiskService {
  score(notional: number, balance: number): number {
    if (balance <= 0) return notional === 0 ? 0 : 100;
    return Math.round(Math.min(100, (Math.abs(notional) / balance) * 100) * 100) / 100;
  }
  level(score: number): RiskLevel { return score > 75 ? 'HIGH' : score > 50 ? 'ELEVATED' : 'LOW'; }
}
```

```ts
// pnl.service.ts
import { Injectable } from '@nestjs/common';
import type { OpenPosition } from './position-ledger.service.js';
@Injectable()
export class PnlService {
  unrealized(p: OpenPosition, markPrice: number, pointValue: number): number { return (markPrice - p.avgPrice) * p.netQty * pointValue; }
  notional(p: OpenPosition, markPrice: number, pointValue: number): number { return p.netQty * markPrice * pointValue; }
}
```

- [ ] **Step 6: Run** — `npx vitest run src/services` → all green.
- [ ] **Step 7: Commit** — `Add session clock, position ledger, P&L and risk services`

### Task A4: Application layer — tenant context, ports, DTOs, snapshot use cases (TDD with in-memory repos)

**Files:**
- Create: `src/application/tenant-context.ts`, `src/application/principal.ts`
- Create: `src/application/ports/accounts.repository.ts`, `fills.repository.ts`, `market-prices.repository.ts`, `fill-publisher.ts`
- Create: `src/application/dto/snapshot.dto.ts`
- Create: `src/application/snapshot/get-account-snapshot.usecase.ts` + `.spec.ts`
- Create: `src/application/snapshot/list-accounts.usecase.ts`

**Interfaces (produced):**

```ts
export interface TenantContext { readonly brokerId: string; readonly traderId: string }
export interface Principal extends TenantContext { readonly apiKeyId: string }

export const ACCOUNTS_REPOSITORY = Symbol('ACCOUNTS_REPOSITORY');
export interface AccountSummary { id: string; accountNumber: string; accountType: string; status: string }
export interface AccountRecord extends AccountSummary { balance: number }
export interface AccountsRepository {
  listForTrader(ctx: TenantContext): Promise<AccountSummary[]>;
  findOwned(ctx: TenantContext, accountId: string): Promise<AccountRecord | null>;
}

export const FILLS_REPOSITORY = Symbol('FILLS_REPOSITORY');
export interface FillRecord { id: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; filledAt: Date; commissionUsd: number }
export interface FillsRepository { listForAccountUpTo(ctx: TenantContext, accountId: string, upTo: Date): Promise<FillRecord[]> }

export const MARKET_PRICES_REPOSITORY = Symbol('MARKET_PRICES_REPOSITORY');
export interface InstrumentMark { symbol: string; description: string; pointValue: number; markPrice: number; asOf: Date }
/** Reference data, not tenant data: the only tenant-free port besides credentials. */
export interface MarketPricesRepository { marksFor(symbols: string[]): Promise<Map<string, InstrumentMark>> }

export const FILL_PUBLISHER = Symbol('FILL_PUBLISHER');
export interface FillEvent { id: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; filledAt: string }
export interface FillPublisher { publish(target: { brokerId: string; accountId: string }, event: FillEvent): void }

// snapshot.dto.ts — mirrors spec §5.2
export interface PositionDto { symbol: string; description: string; side: 'LONG' | 'SHORT'; netQty: number; avgPrice: number; markPrice: number; pointValue: number; notional: number; unrealizedPnl: number }
export interface SnapshotDto {
  asOf: string; session: { open: string; close: string };
  account: { id: string; accountNumber: string; accountType: string; status: string; balance: number };
  positions: PositionDto[];
  pnl: { realizedToday: number; commissionsToday: number; unrealized: number; dayTotal: number };
  risk: { score: number; level: 'LOW' | 'ELEVATED' | 'HIGH'; notional: number; balance: number };
  fillsToday: number; lastFillId: string | null;
}
```

- [ ] **Step 1: Use-case test with in-memory fakes** (`get-account-snapshot.usecase.spec.ts`)

Fakes: `accounts.findOwned` returns the record only when `ctx.brokerId === 'BRK-SMPT' && ctx.traderId === 'T-005' && accountId === 'ACC-1006'`; `fills.listForAccountUpTo` returns two MES buys (2 @ 5640 and 3 @ 5640.1667, commissions 1.40 and 2.10, inside the session) — note the ledger must receive `pointValue` from marks; `marks.marksFor` returns MES → `{ pointValue: 5, markPrice: 5642.25, description: 'Micro E-mini S&P 500' }`; clock returns `2026-08-25T14:30:00Z`.

Assertions:
- `execute({ brokerId: 'BRK-SMPT', traderId: 'T-005' }, 'ACC-1006')` → one LONG position `netQty 5`, `risk.level` `'LOW'` for balance 150 000 (notional 141 056.25 → score 94.04 → actually `'HIGH'`; assert `score` `toBeCloseTo(94.04, 2)` and level `'HIGH'`), `pnl.commissionsToday` `toBeCloseTo(3.5)`, `fillsToday` 2, `lastFillId` equals the last fill id, `session.open` `'2026-08-24T22:00:00.000Z'`.
- `execute({ brokerId: 'BRK-MRDN', traderId: 'T-009' }, 'ACC-1006')` → rejects with `NotFoundException` (cross-tenant: same account id, other tenant).
- `execute(ctx, 'ACC-1014')` where fakes return the account but no fills → `positions []`, `risk.score 0`, `lastFillId null`.

- [ ] **Step 2: Implement `GetAccountSnapshotUseCase`**

```ts
@Injectable()
export class GetAccountSnapshotUseCase {
  constructor(
    @Inject(ACCOUNTS_REPOSITORY) private readonly accounts: AccountsRepository,
    @Inject(FILLS_REPOSITORY) private readonly fills: FillsRepository,
    @Inject(MARKET_PRICES_REPOSITORY) private readonly marks: MarketPricesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly ledger: PositionLedgerService,
    private readonly pnl: PnlService,
    private readonly risk: RiskService,
    private readonly sessions: SessionClockService,
  ) {}

  async execute(ctx: TenantContext, accountId: string): Promise<SnapshotDto> {
    const account = await this.accounts.findOwned(ctx, accountId);
    if (!account) throw new NotFoundException('Account not found'); // 404, not 403: no existence leak
    const now = this.clock.now();
    const session = this.sessions.sessionFor(now);
    const fills = await this.fills.listForAccountUpTo(ctx, accountId, now);
    const marks = await this.marks.marksFor([...new Set(fills.map((f) => f.symbol))]);
    const ledgerFills: LedgerFill[] = fills.map((f) => ({ ...f, pointValue: marks.get(f.symbol)?.pointValue ?? 0 }));
    const result = this.ledger.replay(ledgerFills, { from: session.open, to: now });
    const positions: PositionDto[] = result.positions.map((p) => {
      const m = marks.get(p.symbol)!;
      return { symbol: p.symbol, description: m.description, side: p.netQty > 0 ? 'LONG' : 'SHORT', netQty: p.netQty,
        avgPrice: p.avgPrice, markPrice: m.markPrice, pointValue: m.pointValue,
        notional: this.pnl.notional(p, m.markPrice, m.pointValue), unrealizedPnl: this.pnl.unrealized(p, m.markPrice, m.pointValue) };
    });
    const unrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const notional = positions.reduce((s, p) => s + p.notional, 0);
    const realizedToday = result.realizedInWindow - result.commissionsInWindow;
    const score = this.risk.score(notional, account.balance);
    return {
      asOf: now.toISOString(), session: { open: session.open.toISOString(), close: session.close.toISOString() },
      account: { id: account.id, accountNumber: account.accountNumber, accountType: account.accountType, status: account.status, balance: account.balance },
      positions, pnl: { realizedToday, commissionsToday: result.commissionsInWindow, unrealized, dayTotal: realizedToday + unrealized },
      risk: { score, level: this.risk.level(score), notional, balance: account.balance },
      fillsToday: result.fillsInWindow, lastFillId: fills.at(-1)?.id ?? null,
    };
  }
}
```

`ListAccountsUseCase.execute(ctx)` → `{ accounts: await this.accounts.listForTrader(ctx) }`.

- [ ] **Step 3: Run** — `npx vitest run src/application` green. **Commit** — `Add snapshot use cases with tenant-scoped ports`

### Task A5: Auth — secret hasher, API-key service, use cases, guard (TDD)

**Files:**
- Create: `src/services/secret-hasher.service.spec.ts` (implementation exists from A2), `src/services/api-key.service.ts` + `.spec.ts`
- Create: `src/application/ports/credentials.repository.ts`, `src/application/ports/api-keys.repository.ts`
- Create: `src/application/auth/issue-api-key.usecase.ts` + `.spec.ts`, `authenticate-api-key.usecase.ts`, `revoke-api-key.usecase.ts`
- Create: `src/controllers/guards/api-key.guard.ts` + `.spec.ts`, `src/controllers/decorators/principal.decorator.ts`
- Create: `src/application/dto/auth.dto.ts`

**Interfaces (produced):**

```ts
export class SecretHasherService {
  readonly dummyHash: string;                       // hash of a random secret, computed once at construction (sync scrypt)
  hash(secret: string): Promise<string>;            // "scrypt$16384$8$1$<salt>$<hash>" base64url parts, 64-byte key
  verify(secret: string, encoded: string): Promise<boolean>; // timingSafeEqual; false on malformed
}
export class ApiKeyService {
  generate(): { apiKey: string; keyHash: string; keyPrefix: string }; // apiKey = 'afk_' + base64url(32 bytes); keyHash = sha256 hex; keyPrefix = apiKey.slice(0, 11)
  hash(apiKey: string): string;
}
export const CREDENTIALS_REPOSITORY = Symbol('CREDENTIALS_REPOSITORY');
export interface CredentialRecord { traderId: string; brokerId: string; secretHash: string; kycStatus: 'verified' | 'pending' | 'suspended'; portalName: string }
export interface CredentialsRepository { findByTraderId(traderId: string): Promise<CredentialRecord | null> } // pre-auth: no tenant yet
export const API_KEYS_REPOSITORY = Symbol('API_KEYS_REPOSITORY');
export interface ApiKeyRecord { id: string; traderId: string; brokerId: string; expiresAt: Date; revokedAt: Date | null }
export interface ApiKeysRepository {
  create(input: { traderId: string; brokerId: string; keyHash: string; keyPrefix: string; expiresAt: Date }): Promise<ApiKeyRecord>;
  findActiveByHash(keyHash: string, now: Date): Promise<ApiKeyRecord | null>;   // revokedAt null AND expiresAt > now
  revoke(ctx: TenantContext, apiKeyId: string, at: Date): Promise<void>;
  touch(apiKeyId: string, at: Date): Promise<void>;
}
export interface IssueApiKeyResult { apiKey: string; expiresAt: string; principal: { traderId: string; brokerId: string }; portalName: string }
export class IssueApiKeyUseCase { execute(input: { traderId: string; secret: string }): Promise<IssueApiKeyResult> } // UnauthorizedException('Invalid credentials') / ForbiddenException('Trader suspended')
export class AuthenticateApiKeyUseCase { execute(apiKey: string): Promise<Principal | null> }
export class RevokeApiKeyUseCase { execute(principal: Principal): Promise<void> }
```

Guard: `ApiKeyGuard implements CanActivate` — reads `Authorization`, requires `Bearer afk_…`, calls `AuthenticateApiKeyUseCase`, sets `request.principal`, throws `UnauthorizedException` otherwise. Decorator `@CurrentPrincipal()` returns `request.principal`. `IssueApiKeyDto { @IsString() @Length(1, 32) traderId; @IsString() @Length(8, 256) secret }`.

- [ ] **Step 1: Tests** — hasher: `verify(hash('x')) === true`, wrong secret false, malformed false, two hashes of the same secret differ (salt). Api-key service: key starts with `afk_`, length ≥ 47, hash is 64 hex chars, `hash(apiKey) === keyHash`. Issue use case with fakes: valid → result with `principal.brokerId` taken from the credential record, not from input; unknown trader → `UnauthorizedException` **and** `hasher.verify` was still called once (dummy compare); suspended → `ForbiddenException`; stored `keyHash` never equals the plaintext. Guard: missing header → `UnauthorizedException`; valid → `request.principal` set.
- [ ] **Step 2: Implement** (scrypt via `node:crypto` `scrypt`/`scryptSync`, `timingSafeEqual`, `randomBytes`, `createHash('sha256')`). In `IssueApiKeyUseCase`, `expiresAt = new Date(clock.now().getTime() + env.API_KEY_TTL_HOURS * 3_600_000)` — inject `ENV` and `CLOCK`. `AuthenticateApiKeyUseCase`: hash → `findActiveByHash(hash, clock.now())` → `touch` (fire-and-forget, errors swallowed) → `{ traderId, brokerId, apiKeyId: id }`.
- [ ] **Step 3: Run + Commit** — `Add API-key authentication with scrypt secrets`

### Task A6: Prisma infrastructure — service and tenant-scoped repositories

**Files:**
- Create: `src/infrastructure/prisma/prisma.service.ts`
- Create: `src/infrastructure/prisma/prisma-accounts.repository.ts`, `prisma-fills.repository.ts`, `prisma-market-prices.repository.ts`, `prisma-credentials.repository.ts`, `prisma-api-keys.repository.ts`
- Modify: `src/app.module.ts` (bind every port token to its Prisma implementation; register services and use cases)

```ts
// prisma.service.ts
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import { ENV, type Env } from '../config/env.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) { super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) }); }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

Every tenant repository method spells the tenant in `where`:

```ts
// prisma-accounts.repository.ts (shape; others follow the same pattern)
findOwned(ctx, accountId) → this.prisma.account.findFirst({ where: { id: accountId, brokerId: ctx.brokerId, traderId: ctx.traderId }, select: { id, accountNumber, accountType, status, balance } }) → map balance: Number(balance)
listForTrader(ctx) → findMany({ where: { brokerId: ctx.brokerId, traderId: ctx.traderId }, orderBy: { createdAt: 'asc' }, select: { id, accountNumber, accountType, status } })
// prisma-fills.repository.ts
listForAccountUpTo(ctx, accountId, upTo) → findMany({ where: { brokerId: ctx.brokerId, accountId, filledAt: { lte: upTo } }, orderBy: [{ filledAt: 'asc' }, { id: 'asc' }], select: { id, accountId, instrumentSymbol, side, quantity, price, filledAt, commissionUsd } }) → map symbol: instrumentSymbol, price: Number, commissionUsd: Number
// prisma-market-prices.repository.ts
marksFor(symbols) → instrument.findMany({ where: { symbol: { in: symbols } }, include: { marketPrice: true } }) → Map(symbol → { description, pointValue: Number(pointValueUsd), markPrice: Number(marketPrice.markPrice), asOf })
// prisma-credentials.repository.ts
findByTraderId(id) → trader.findUnique({ where: { id }, select: { id, brokerId, kycStatus, credential: { select: { secretHash } }, broker: { select: { whiteLabelName } } } }) → null if no credential
// prisma-api-keys.repository.ts
create → apiKey.create; findActiveByHash(hash, now) → findFirst({ where: { keyHash: hash, revokedAt: null, expiresAt: { gt: now } } }); revoke(ctx, id, at) → updateMany({ where: { id, brokerId: ctx.brokerId, traderId: ctx.traderId }, data: { revokedAt: at } }); touch → update lastUsedAt
```

Never `select` name/email/phone/dob/ssn/address/notes/audit_notes anywhere in these repositories.

- [ ] **Step 1: Implement, then** `npx tsc -p tsconfig.build.json --noEmit` clean. **Commit** — `Add Prisma service and tenant-scoped repositories`

### Task A7: HTTP controllers

**Files:**
- Create: `src/controllers/auth.controller.ts`, `src/controllers/accounts.controller.ts`
- Modify: `src/app.module.ts`
- Test: `src/controllers/accounts.controller.spec.ts` (guard behaviour via `Test.createTestingModule` + supertest **or** a direct unit test of the guard with a fake context — the guard spec in A5 already covers 401; here assert the controller delegates `principal` and `accountId` to the use case)

Routes exactly as spec §5.2: `POST /auth/api/key` (201), `DELETE /auth/api/key` (`@UseGuards(ApiKeyGuard)`, `@HttpCode(204)`), `GET /me/accounts`, `GET /accounts/:accountId/snapshot` (both guarded; `@CurrentPrincipal() principal`). Controllers contain no logic beyond delegation.

- [ ] **Step 1: Implement + run the server**

```bash
npm run start:dev &
SECRET=$(node -e "console.log(require('./.local/trader-secrets.json')['T-005'])")
KEY=$(curl -s -X POST localhost:3001/auth/api/key -H 'content-type: application/json' -d "{\"traderId\":\"T-005\",\"secret\":\"$SECRET\"}" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).apiKey))")
curl -s localhost:3001/me/accounts -H "authorization: Bearer $KEY"                 # ACC-1006, ACC-1007
curl -s localhost:3001/accounts/ACC-1006/snapshot -H "authorization: Bearer $KEY"  # MES long 5, risk HIGH
curl -s -o /dev/null -w '%{http_code}\n' localhost:3001/accounts/ACC-1011/snapshot -H "authorization: Bearer $KEY"  # 404 (Meridian account)
curl -s -o /dev/null -w '%{http_code}\n' localhost:3001/accounts/ACC-1006/snapshot                                    # 401
```

- [ ] **Step 2: Commit** — `Add auth and accounts controllers`

### Task A8: Socket.IO gateway with handshake authentication

**Files:**
- Create: `src/controllers/snapshot.gateway.ts`
- Modify: `src/app.module.ts` (provide gateway; bind `FILL_PUBLISHER` to it via `useExisting`)

```ts
import { Injectable, Logger } from '@nestjs/common';
import { type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthenticateApiKeyUseCase } from '../application/auth/authenticate-api-key.usecase.js';
import { ListAccountsUseCase } from '../application/snapshot/list-accounts.usecase.js';
import type { FillEvent, FillPublisher } from '../application/ports/fill-publisher.js';

export const room = (brokerId: string, accountId: string) => `broker:${brokerId}:account:${accountId}`;

@Injectable()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' } })
export class SnapshotGateway implements OnGatewayInit, FillPublisher {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(SnapshotGateway.name);
  constructor(private readonly authenticate: AuthenticateApiKeyUseCase, private readonly listAccounts: ListAccountsUseCase) {}

  afterInit(server: Server) {
    // Tenant scoping happens here, once, before the connection is accepted. There is no subscribe message.
    server.use(async (socket: Socket, next) => {
      const apiKey = typeof socket.handshake.auth?.apiKey === 'string' ? socket.handshake.auth.apiKey : null;
      const principal = apiKey ? await this.authenticate.execute(apiKey) : null;
      if (!principal) return next(new Error('unauthorized'));
      const { accounts } = await this.listAccounts.execute(principal);
      socket.data.principal = principal;
      for (const a of accounts) await socket.join(room(principal.brokerId, a.id));
      this.log.log(`socket connected trader=${principal.traderId} broker=${principal.brokerId} rooms=${accounts.length}`);
      next();
    });
  }

  publish(target: { brokerId: string; accountId: string }, event: FillEvent) {
    this.server.to(room(target.brokerId, target.accountId)).emit('fill', event);
  }
}
```

- [ ] **Step 1: Verify with a throwaway client** (`node -e` with `socket.io-client` from the frontend's node_modules or `npx -y socket.io-client` — do not add it to the backend): connect with a valid key → `connect` fires; connect with `auth: { apiKey: 'afk_bogus' }` → `connect_error` with message `unauthorized`.
- [ ] **Step 2: Commit** — `Add tenant-scoped Socket.IO gateway`

### Task A9: Development-only fill simulator

**Files:**
- Create: `src/controllers/dev/dev-fills.module.ts`, `dev-fills.controller.ts`, `dev-fill.dto.ts`
- Create: `src/application/dev/simulate-fill.usecase.ts`, `src/application/ports/dev-fills.repository.ts`, `src/infrastructure/prisma/prisma-dev-fills.repository.ts`
- Modify: `src/app.module.ts`

`DevFillDto` (snake_case per `simulate-fills.md`): `@IsString() account_id`, `@IsString() instrument_symbol`, `@IsIn(['BUY','SELL']) side`, `@IsInt() @Min(1) quantity`, `@IsNumber() @IsPositive() price`, `@IsNumber() @Min(0) commission_usd`.

`DevFillsRepository { findAccountTenant(accountId): Promise<{ brokerId: string } | null>; insert(fill): Promise<FillRecord> }` — the **only** unscoped read in the codebase, confined to the dev module and documented as such.

`SimulateFillUseCase.execute(dto)`: account → 404 if unknown; `filledAt = clock.now()`; `id = 'FIL-DEV-' + Date.now()`; `orderId = 'ORD-DEV-' + Date.now()`; `liquidity = 'taker'`; insert with `brokerId` from the account row; `publisher.publish({ brokerId, accountId }, event)`; return the fill.

Conditional registration in `app.module.ts`:

```ts
const env = loadEnv();
@Module({ imports: [...(env.DEV_FILLS_ENABLED ? [DevFillsModule] : [])], ... })
```

`DEV_FILLS_ENABLED` is already `false` whenever `NODE_ENV === 'production'` (see `loadEnv`). Log one line at boot when the module is registered.

- [ ] **Step 1: Verify end to end** — with the server running and a socket client connected as T-005, `curl -X POST localhost:3001/dev/fills -H 'content-type: application/json' -d '{"account_id":"ACC-1006","instrument_symbol":"MES","side":"BUY","quantity":2,"price":5643.25,"commission_usd":1.40}'` → the client prints the `fill` event; a client connected as T-009 (Meridian) prints nothing; the snapshot for ACC-1006 now shows `netQty 7`.
- [ ] **Step 2: Commit** — `Add development-only fill simulator`

### Task A10: Quality gate

- [ ] `npm run lint` clean (fix or justify every oxlint finding), `npm test` green, `npm run build` succeeds, `node dist/main.js` boots with the `.env`.
- [ ] Grep guard: `grep -rn "firstName\|lastName\|email\|ssnLast4\|notes" src --include=*.ts | grep -v seed | grep -v generated` returns nothing outside the seed.
- [ ] Commit — `Pass lint, tests and build`

### Task A11 (timeboxed 30 min, only if A1–A10 are done before 11:35): Row-level security

- Migration `prisma/migrations/<ts>_row_level_security/migration.sql` (create with `npx prisma migrate dev --create-only --name row_level_security`, then edit): for `traders`, `accounts`, `fills`, `api_keys`: `ALTER TABLE t ENABLE ROW LEVEL SECURITY; ALTER TABLE t FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON t USING (broker_id = current_setting('app.broker_id', true));` plus a `BYPASSRLS`-free note. The seed and credential lookup run outside a tenant, so they must run with `app.broker_id` unset → add `CREATE POLICY seed_bypass ON t USING (current_setting('app.role', true) = 'seed')` and have the seed and the credentials repository execute `SELECT set_config('app.role','seed',true)` inside a transaction.
- `PrismaService.forTenant(ctx, fn)` wraps `$transaction(async (tx) => { await tx.$executeRawUnsafe(\`SELECT set_config('app.broker_id', $1, true)\`, ctx.brokerId); return fn(tx); })` — tenant repositories use it.
- Test: with `app.broker_id` set to BRK-MRDN, `SELECT count(*) FROM fills WHERE account_id = 'ACC-1006'` returns 0.
- Commit — `Add row-level security policies keyed on the tenant`

---

# Track B — Frontend (`arrowfin-mt-daily-snap-fe`)

Already done by the scaffold: Next.js 16.3 + Tailwind 4 + TanStack Query + socket.io-client installed, `.env.local` with `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` = `http://localhost:3001`, `netlify.toml`, `README.md`, `SECURITY.md`. Read `node_modules/next/dist/docs/01-app/01-getting-started/` first.

### Task B1: Foundation — types, env, auth store, API client, socket factory, providers, layout

**Files:**
- Create: `types/api.ts`, `lib/env.ts`, `lib/auth.ts`, `lib/api.ts`, `lib/socket.ts`, `lib/format.ts`, `app/providers.tsx`
- Modify: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Delete: `public/*.svg` boilerplate

**Interfaces (produced):**

```ts
// types/api.ts — mirror of backend spec §5.2/§5.3
export interface AccountSummary { id: string; accountNumber: string; accountType: string; status: string }
export interface PositionDto { symbol: string; description: string; side: 'LONG' | 'SHORT'; netQty: number; avgPrice: number; markPrice: number; pointValue: number; notional: number; unrealizedPnl: number }
export interface SnapshotDto { asOf: string; session: { open: string; close: string }; account: { id: string; accountNumber: string; accountType: string; status: string; balance: number }; positions: PositionDto[]; pnl: { realizedToday: number; commissionsToday: number; unrealized: number; dayTotal: number }; risk: { score: number; level: 'LOW' | 'ELEVATED' | 'HIGH'; notional: number; balance: number }; fillsToday: number; lastFillId: string | null }
export interface FillEvent { id: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; filledAt: string }
export interface Session { apiKey: string; expiresAt: string; principal: { traderId: string; brokerId: string }; portalName: string }

// lib/auth.ts — sessionStorage key 'arrowfin.session'; all functions guard `typeof window === 'undefined'`
export function getSession(): Session | null; export function setSession(s: Session): void; export function clearSession(): void;
// lib/api.ts
export class ApiError extends Error { constructor(public status: number, message: string) }
export async function apiFetch<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T>  // adds Bearer when auth !== false; throws ApiError; 204 → undefined
// lib/socket.ts
export function createSocket(apiKey: string): Socket  // io(WS_URL, { auth: { apiKey }, transports: ['websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelayMax: 5000 })
// lib/format.ts
export const money: (n: number) => string  // USD, 2 dp, sign
export const price: (n: number) => string  // up to 5 dp, trailing zeros trimmed
export const qty: (n: number) => string
```

`app/providers.tsx` (`'use client'`): `QueryClientProvider` with a `QueryClient` created in `useState` (`defaultOptions.queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 0 }`).

`app/layout.tsx`: `<html lang="en" className="dark">`, body `bg-zinc-950 text-zinc-100 antialiased`, wraps children in `Providers`; metadata title "Trader Daily Snapshot". `globals.css` keeps the Tailwind import; add `body { font-feature-settings: "tnum" }`.

`app/page.tsx` (`'use client'`): on mount `router.replace(getSession() ? '/snapshot' : '/login')`, renders a neutral "Loading…" line.

- [ ] Implement, `npm run lint`, `npm run build`. Commit — `Add API client, session store, socket factory and providers`

### Task B2: Login page

**Files:** `app/login/page.tsx` (`'use client'`)

Form with `traderId` (placeholder `T-005`) and `secret` (password input), submit → `apiFetch<Session>('/auth/api/key', { method: 'POST', auth: false, body: JSON.stringify({ traderId, secret }) })` → `setSession` → `router.replace('/snapshot')`. Errors: 401 → "Invalid trader id or secret"; 403 → "This trader is suspended"; network → "Backend unreachable". Disable the button while pending. Layout: centered card `max-w-sm`, `bg-zinc-900 border border-zinc-800 rounded-xl p-6`, title "ArrowFin · Trader Portal", monospace input for the id, `autoComplete="off"` on the secret is **not** used (password managers should work) — `autoComplete="current-password"`.

- [ ] Verify against the running backend (T-005 + secret from `.local/trader-secrets.json` in the backend repo). Commit — `Add login page`

### Task B3: Data hooks

**Files:** `hooks/useAccounts.ts`, `hooks/useSnapshot.ts`, `hooks/useFillStream.ts`

```ts
export function useAccounts() // useQuery({ queryKey: ['accounts'], queryFn: () => apiFetch<{ accounts: AccountSummary[] }>('/me/accounts') })
export function useSnapshot(accountId: string | null) // useQuery({ queryKey: ['snapshot', accountId], queryFn: () => apiFetch<SnapshotDto>(`/accounts/${accountId}/snapshot`), enabled: !!accountId })

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'stale' | 'unauthorized';
export interface FillStream { status: StreamStatus; lastEvent: FillEvent | null; lastEventAt: string | null }
export function useFillStream(accountId: string | null): FillStream
```

`useFillStream` behaviour (one effect keyed on the API key):
1. `createSocket(apiKey)`; status `connecting`.
2. `connect` → `live`; if this is a reconnect (a `disconnect` was seen) → `queryClient.invalidateQueries({ queryKey: ['snapshot'] })` so numbers are refreshed after the gap.
3. `disconnect` → `reconnecting`; start a 5 s timer → `stale` if still disconnected.
4. `fill` (FillEvent) → set `lastEvent`; if `event.accountId === accountId` → `invalidateQueries({ queryKey: ['snapshot', accountId] })`.
5. `connect_error` with `err.message === 'unauthorized'` → `unauthorized`, `socket.disconnect()`, `clearSession()`.
6. Cleanup: clear the timer, `socket.removeAllListeners()`, `socket.disconnect()`.

Any `ApiError` with status 401 from the queries → `clearSession()` and `router.replace('/login')` (handle in the page, see B4).

- [ ] Commit — `Add snapshot, accounts and fill-stream hooks`

### Task B4: Snapshot page and widget components

**Files:**
- `app/snapshot/page.tsx` (`'use client'`)
- `components/snapshot/SnapshotWidget.tsx`, `PositionsTable.tsx`, `PnlCards.tsx`, `RiskGauge.tsx`, `HighRiskBanner.tsx`, `ConnectionBadge.tsx`, `SnapshotSkeleton.tsx`, `ErrorState.tsx`, `EmptyState.tsx`, `AccountSelector.tsx`

Page: redirect to `/login` when no session; header bar with `portalName`, `principal.traderId` (monospace), a "Sign out" button (`DELETE /auth/api/key` best-effort, then `clearSession`, `router.replace('/login')`); `useAccounts` → `AccountSelector` (default: first account with status `active`, else first); `<SnapshotWidget accountId={selected} />`. On `ApiError 401` from any hook → sign out.

`SnapshotWidget({ accountId })`: `useSnapshot(accountId)` + `useFillStream(accountId)`. States: `isPending` → `SnapshotSkeleton`; `isError` → `ErrorState` with retry (`refetch`); data with `positions.length === 0` → `EmptyState` ("No open positions in this session") but still show P&L cards, the risk gauge and the badge. Layout: `grid gap-4 lg:grid-cols-[2fr_1fr]`: left = `PnlCards` + `PositionsTable`; right = `RiskGauge` + session info (open/close, `asOf`, `fillsToday`, `lastFillId`). `HighRiskBanner` renders above everything when `risk.score > 75`. `ConnectionBadge status` sits in the widget header; when `stale`, numbers get `opacity-60` and the badge reads "Disconnected — figures may be stale" (never pretend to be live).

`RiskGauge({ score, level })`: horizontal bar 0–100 with the score, colour `emerald` (LOW) / `amber` (ELEVATED) / `rose` (HIGH); HIGH adds `ring-2 ring-rose-500 animate-pulse` and `aria-live="assertive"` text "High risk: NN%".

`HighRiskBanner`: full-width `bg-rose-600 text-white font-semibold` with a pulsing dot and copy "HIGH RISK — exposure is NN% of account balance", `role="alert"`.

`PnlCards`: four tiles (Realized today, Unrealized, Commissions today, Day total) with `tabular-nums`, green/red by sign.

`PositionsTable`: columns Symbol, Side, Qty, Avg price, Mark, Notional, Unrealized; `SHORT` rows tinted; sticky header; `overflow-x-auto`.

Styling: dark, dense, "trading terminal" — `bg-zinc-900` cards, `border-zinc-800`, `text-zinc-400` labels, `font-mono` for ids and prices, 12–14 px type.

- [ ] Verify live: open `/snapshot` as T-005, run the backend curl from A9 → the table updates and the badge stays `live`; stop the backend → badge `reconnecting` then `stale`; start it → `live` and numbers refresh. Log in as T-009 (Meridian) and confirm ACC-1006 fills never appear.
- [ ] `npm run lint && npm run build` clean. Commit — `Add snapshot page and widget components`

### Task B5: README reconnect answer + SECURITY notes

- Fill the "Reconnect behaviour" section of `README.md` from the actual hook: what is detected, what is refetched, what `lastFillId` allows, and the honest limit (between `disconnect` and the `stale` timer the last numbers are shown with the badge as the only signal; a fill that arrives during the gap is caught by the reconnect refetch, not by the event).
- Fill the drafted parts of `SECURITY.md` with file references.
- Commit — `Document reconnect behaviour and client-side security notes`

---

## Self-review

- Spec coverage: §3 schema (done in scaffold), §3.2 index (schema comment + README), §3.3 RLS (A11), §4.1–4.3 (A5, A6, A7, A8), §5.1 (A3, A4), §5.2 (A7, A9), §5.3 (A8), §6 (B1–B4), §7 tests (A1, A3, A4, A5, A7), §8 docs (skeletons exist; content in B5 and the main session), §9 deploy (stretch, main session).
- Requirements from the PDF: tenant-scoped endpoint with failing cross-tenant access → A4 test + A7 curl; explainable index → schema + README; test for the snapshot logic → A3 + A4.
- Type consistency: `FillRecord.symbol` (not `instrumentSymbol`) is what `LedgerFill` and the use case consume; `FillEvent.filledAt` is an ISO string on both sides; `SnapshotDto` is identical in `application/dto/snapshot.dto.ts` and `types/api.ts`.
