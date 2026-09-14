import { NotFoundException } from '@nestjs/common';
import { PnlService } from '../../services/pnl.service.js';
import { PositionLedgerService } from '../../services/position-ledger.service.js';
import { RiskService } from '../../services/risk.service.js';
import { SessionClockService } from '../../services/session-clock.service.js';
import type { AccountsRepository } from '../ports/accounts.repository.js';
import type { FillRecord, FillsRepository } from '../ports/fills.repository.js';
import type { MarketPricesRepository } from '../ports/market-prices.repository.js';
import type { TenantContext } from '../tenant-context.js';
import { GetAccountSnapshotUseCase } from './get-account-snapshot.usecase.js';

const SUMMIT: TenantContext = { brokerId: 'BRK-SMPT', traderId: 'T-005' };
const MERIDIAN: TenantContext = { brokerId: 'BRK-MRDN', traderId: 'T-009' };

const fillsOf: Record<string, FillRecord[]> = {
  'ACC-1006': [
    { id: 'FIL-1', accountId: 'ACC-1006', symbol: 'MES', side: 'BUY', quantity: 2, price: 5640, filledAt: new Date('2026-08-25T01:00:00Z'), commissionUsd: 1.4 },
    { id: 'FIL-2', accountId: 'ACC-1006', symbol: 'MES', side: 'BUY', quantity: 3, price: 5640.1667, filledAt: new Date('2026-08-25T02:00:00Z'), commissionUsd: 2.1 },
  ],
  'ACC-1014': [],
};

const accounts: AccountsRepository = {
  listForTrader: async () => [],
  findOwned: async (ctx, accountId) => {
    if (ctx.brokerId !== 'BRK-SMPT' || ctx.traderId !== 'T-005') return null;
    if (accountId === 'ACC-1006') return { id: 'ACC-1006', accountNumber: 'SMT-200001', accountType: 'pro_plus', status: 'active', balance: 150_000 };
    if (accountId === 'ACC-1014') return { id: 'ACC-1014', accountNumber: 'X', accountType: 'funded', status: 'active', balance: 25_000 };
    return null;
  },
};
const fills: FillsRepository = { listForAccountUpTo: async (_ctx, accountId) => fillsOf[accountId] ?? [] };
const marks: MarketPricesRepository = {
  marksFor: async () => new Map([['MES', { symbol: 'MES', description: 'Micro E-mini S&P 500', pointValue: 5, markPrice: 5642.25, asOf: new Date() }]]),
};
const clock = { now: () => new Date('2026-08-25T14:30:00Z') };

const useCase = new GetAccountSnapshotUseCase(
  accounts, fills, marks, clock,
  new PositionLedgerService(), new PnlService(), new RiskService(), new SessionClockService(),
);

describe('GetAccountSnapshotUseCase', () => {
  it('builds the snapshot for an account the caller owns', async () => {
    const s = await useCase.execute(SUMMIT, 'ACC-1006');
    expect(s.session.open).toBe('2026-08-24T22:00:00.000Z');
    expect(s.positions).toHaveLength(1);
    expect(s.positions[0]).toMatchObject({ symbol: 'MES', side: 'LONG', netQty: 5, markPrice: 5642.25 });
    expect(s.positions[0]!.avgPrice).toBeCloseTo(5640.1, 3);
    expect(s.pnl.commissionsToday).toBeCloseTo(3.5);
    expect(s.pnl.realizedToday).toBeCloseTo(-3.5);
    expect(s.risk.score).toBeCloseTo(94.04, 2);
    expect(s.risk.level).toBe('HIGH');
    expect(s.fillsToday).toBe(2);
    expect(s.lastFillId).toBe('FIL-2');
  });

  it('returns 404 for an account of another tenant, even with a valid account id', async () => {
    await expect(useCase.execute(MERIDIAN, 'ACC-1006')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty snapshot for an account without fills', async () => {
    const s = await useCase.execute(SUMMIT, 'ACC-1014');
    expect(s.positions).toEqual([]);
    expect(s.risk).toMatchObject({ score: 0, level: 'LOW', notional: 0 });
    expect(s.lastFillId).toBeNull();
    expect(s.fillsToday).toBe(0);
  });
});
