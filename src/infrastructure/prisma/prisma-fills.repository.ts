import { Injectable } from '@nestjs/common';
import type { FillRecord, FillsRepository } from '../../application/ports/fills.repository.js';
import type { TenantContext } from '../../application/tenant-context.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaFillsRepository implements FillsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Served by the (broker_id, account_id, filled_at) index: tenant first, then
   * account, then time. Runs inside the tenant transaction (row-level security).
   */
  async listForAccountUpTo(ctx: TenantContext, accountId: string, upTo: Date): Promise<FillRecord[]> {
    const rows = await this.prisma.forTenant(ctx, (tx) =>
      tx.fill.findMany({
        where: { brokerId: ctx.brokerId, accountId, filledAt: { lte: upTo } },
        orderBy: [{ filledAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          accountId: true,
          instrumentSymbol: true,
          side: true,
          quantity: true,
          price: true,
          filledAt: true,
          commissionUsd: true,
        },
      }),
    );
    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      symbol: r.instrumentSymbol,
      side: r.side,
      quantity: r.quantity,
      price: Number(r.price),
      filledAt: r.filledAt,
      commissionUsd: Number(r.commissionUsd),
    }));
  }
}
