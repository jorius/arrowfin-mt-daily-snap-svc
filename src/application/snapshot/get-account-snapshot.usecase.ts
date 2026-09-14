import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PnlService } from '../../services/pnl.service.js';
import { PositionLedgerService, type LedgerFill } from '../../services/position-ledger.service.js';
import { RiskService } from '../../services/risk.service.js';
import { SessionClockService } from '../../services/session-clock.service.js';
import type { PositionDto, SnapshotDto } from '../dto/snapshot.dto.js';
import { ACCOUNTS_REPOSITORY, type AccountsRepository } from '../ports/accounts.repository.js';
import { CLOCK, type Clock } from '../ports/clock.js';
import { FILLS_REPOSITORY, type FillsRepository } from '../ports/fills.repository.js';
import { MARKET_PRICES_REPOSITORY, type MarketPricesRepository } from '../ports/market-prices.repository.js';
import type { TenantContext } from '../tenant-context.js';

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
    // 404 rather than 403: a caller must not learn that an account exists in another tenant.
    if (!account) throw new NotFoundException('Account not found');

    const now = this.clock.now();
    const session = this.sessions.sessionFor(now);
    const fills = await this.fills.listForAccountUpTo(ctx, accountId, now);
    const marks = await this.marks.marksFor([...new Set(fills.map((f) => f.symbol))]);

    const ledgerFills: LedgerFill[] = fills.map((f) => ({
      ...f,
      pointValue: marks.get(f.symbol)?.pointValue ?? 0,
    }));
    const result = this.ledger.replay(ledgerFills, { from: session.open, to: now });

    const positions: PositionDto[] = result.positions.map((p) => {
      const m = marks.get(p.symbol);
      const markPrice = m?.markPrice ?? 0;
      const pointValue = m?.pointValue ?? 0;
      return {
        symbol: p.symbol,
        description: m?.description ?? p.symbol,
        side: p.netQty > 0 ? 'LONG' : 'SHORT',
        netQty: p.netQty,
        avgPrice: p.avgPrice,
        markPrice,
        pointValue,
        notional: this.pnl.notional(p, markPrice, pointValue),
        unrealizedPnl: this.pnl.unrealized(p, markPrice, pointValue),
      };
    });

    const unrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const notional = positions.reduce((s, p) => s + p.notional, 0);
    const realizedToday = result.realizedInWindow - result.commissionsInWindow;
    const score = this.risk.score(notional, account.balance);

    return {
      asOf: now.toISOString(),
      session: { open: session.open.toISOString(), close: session.close.toISOString() },
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        status: account.status,
        balance: account.balance,
      },
      positions,
      pnl: {
        realizedToday,
        commissionsToday: result.commissionsInWindow,
        unrealized,
        dayTotal: realizedToday + unrealized,
      },
      risk: { score, level: this.risk.level(score), notional, balance: account.balance },
      fillsToday: result.fillsInWindow,
      lastFillId: fills.at(-1)?.id ?? null,
    };
  }
}
