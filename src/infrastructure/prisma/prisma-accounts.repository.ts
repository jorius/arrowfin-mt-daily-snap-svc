import { Injectable } from '@nestjs/common';
import type { AccountRecord, AccountSummary, AccountsRepository } from '../../application/ports/accounts.repository.js';
import type { TenantContext } from '../../application/tenant-context.js';
import { PrismaService } from './prisma.service.js';

/**
 * Every query spells the tenant AND the owner in its WHERE, and runs inside the
 * tenant transaction (row-level security) as a second, independent layer.
 */
@Injectable()
export class PrismaAccountsRepository implements AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForTrader(ctx: TenantContext): Promise<AccountSummary[]> {
    return this.prisma.forTenant(ctx, (tx) =>
      tx.account.findMany({
        where: { brokerId: ctx.brokerId, traderId: ctx.traderId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, accountNumber: true, accountType: true, status: true },
      }),
    );
  }

  async findOwned(ctx: TenantContext, accountId: string): Promise<AccountRecord | null> {
    const row = await this.prisma.forTenant(ctx, (tx) =>
      tx.account.findFirst({
        where: { id: accountId, brokerId: ctx.brokerId, traderId: ctx.traderId },
        select: { id: true, accountNumber: true, accountType: true, status: true, balance: true },
      }),
    );
    return row ? { ...row, balance: Number(row.balance) } : null;
  }
}
