/**
 * Loads the assessment dataset from DATASET_DIR (outside the repository) into
 * PostgreSQL and creates one credential per trader.
 *
 *   npm run seed
 *
 * The CSVs are production-grade data: they are read at run time only and never
 * committed. Trader secrets are written to .local/trader-secrets.json (ignored,
 * mode 600) unless DEV_TRADER_SECRET is set, in which case every trader shares it.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client.js';
import { SecretHasherService } from '../../services/secret-hasher.service.js';

type Row = Record<string, string>;

const datasetDir = resolve(process.cwd(), process.env.DATASET_DIR ?? '../dataset');
const read = (file: string): Row[] =>
  parse(readFileSync(resolve(datasetDir, file)), { columns: true, skip_empty_lines: true }) as Row[];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const hasher = new SecretHasherService();

async function main() {
  const brokers = read('brokers.csv');
  const instruments = read('instruments.csv');
  const prices = read('market_prices.csv');
  const traders = read('traders.csv');
  const accounts = read('accounts.csv');
  const fills = read('fills.csv');

  const brokerOfTrader = new Map(traders.map((t) => [t.id!, t.broker_id!]));
  const brokerOfAccount = new Map(accounts.map((a) => [a.id!, brokerOfTrader.get(a.trader_id!)!]));

  await prisma.$transaction(async (tx) => {
    await tx.fill.deleteMany();
    await tx.apiKey.deleteMany();
    await tx.traderCredential.deleteMany();
    await tx.account.deleteMany();
    await tx.trader.deleteMany();
    await tx.marketPrice.deleteMany();
    await tx.instrument.deleteMany();
    await tx.broker.deleteMany();

    await tx.broker.createMany({
      data: brokers.map((b) => ({
        id: b.id!,
        name: b.name!,
        type: b.type as 'retail' | 'prop',
        whiteLabelName: b.white_label_name!,
        apiKeyHash: b.api_key_hash!,
        createdAt: new Date(b.created_at!),
      })),
    });
    await tx.instrument.createMany({
      data: instruments.map((i) => ({
        symbol: i.symbol!,
        description: i.description!,
        exchange: i.exchange!,
        pointValueUsd: i.point_value_usd!,
        tickSize: i.tick_size!,
        tickValueUsd: i.tick_value_usd!,
        initialMarginUsd: i.initial_margin_usd!,
        maintenanceMarginUsd: i.maintenance_margin_usd!,
      })),
    });
    await tx.marketPrice.createMany({
      data: prices.map((p) => ({ symbol: p.symbol!, markPrice: p.mark_price!, asOf: new Date(p.as_of!) })),
    });
    await tx.trader.createMany({
      data: traders.map((t) => ({
        id: t.id!,
        brokerId: t.broker_id!,
        firstName: t.first_name!,
        lastName: t.last_name!,
        email: t.email!,
        phone: t.phone!,
        dob: new Date(t.dob!),
        ssnLast4: t.ssn_last4!,
        addressLine1: t.address_line1!,
        city: t.city!,
        state: t.state || null,
        postalCode: t.postal_code!,
        kycStatus: t.kyc_status as 'verified' | 'pending' | 'suspended',
        notes: t.notes || null,
        auditNotes: t.audit_notes || null,
        createdAt: new Date(t.created_at!),
      })),
    });
    await tx.account.createMany({
      data: accounts.map((a) => ({
        id: a.id!,
        traderId: a.trader_id!,
        brokerId: brokerOfTrader.get(a.trader_id!)!,
        accountNumber: a.account_number!,
        accountType: a.account_type as 'funded' | 'demo' | 'eval' | 'pro' | 'pro_plus',
        balance: a.balance || '0',
        buyingPower: a.buying_power || '0',
        maxPositionSize: Number.parseInt(a.max_position_size!, 10),
        status: a.status as 'active' | 'restricted' | 'closed',
        createdAt: new Date(a.created_at!),
      })),
    });
    await tx.fill.createMany({
      data: fills.map((f) => ({
        id: f.id!,
        accountId: f.account_id!,
        brokerId: brokerOfAccount.get(f.account_id!)!,
        instrumentSymbol: f.instrument_symbol!,
        side: f.side as 'BUY' | 'SELL',
        quantity: Number.parseInt(f.quantity!, 10),
        price: f.price!,
        filledAt: new Date(f.filled_at!),
        orderId: f.order_id!,
        liquidity: f.liquidity as 'maker' | 'taker',
        commissionUsd: f.commission_usd!,
      })),
    });
  });

  const shared = process.env.DEV_TRADER_SECRET || undefined;
  const generated: Record<string, string> = {};
  for (const t of traders) {
    const secret = shared ?? randomBytes(24).toString('base64url');
    if (!shared) generated[t.id!] = secret;
    await prisma.traderCredential.create({ data: { traderId: t.id!, secretHash: await hasher.hash(secret) } });
  }
  if (shared) {
    console.log('all traders seeded with DEV_TRADER_SECRET');
  } else {
    mkdirSync(resolve(process.cwd(), '.local'), { recursive: true });
    const out = resolve(process.cwd(), '.local/trader-secrets.json');
    writeFileSync(out, JSON.stringify(generated, null, 2), { mode: 0o600 });
    console.log(`trader secrets written to ${out} (gitignored, mode 600)`);
  }
  console.log({
    brokers: brokers.length,
    instruments: instruments.length,
    prices: prices.length,
    traders: traders.length,
    accounts: accounts.length,
    fills: fills.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
