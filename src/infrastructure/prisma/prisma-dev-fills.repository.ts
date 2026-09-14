import { Injectable } from '@nestjs/common';
import type { DevFillsRepository, NewFill } from '../../application/ports/dev-fills.repository.js';
import type { FillRecord } from '../../application/ports/fills.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaDevFillsRepository implements DevFillsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountTenant(accountId: string): Promise<{ brokerId: string } | null> {
    return this.prisma.account.findUnique({ where: { id: accountId }, select: { brokerId: true } });
  }

  async instrumentExists(symbol: string): Promise<boolean> {
    return (await this.prisma.instrument.count({ where: { symbol } })) > 0;
  }

  async insert(fill: NewFill): Promise<FillRecord> {
    const row = await this.prisma.fill.create({
      data: {
        id: fill.id,
        accountId: fill.accountId,
        brokerId: fill.brokerId,
        instrumentSymbol: fill.symbol,
        side: fill.side,
        quantity: fill.quantity,
        price: fill.price,
        filledAt: fill.filledAt,
        orderId: fill.orderId,
        liquidity: fill.liquidity,
        commissionUsd: fill.commissionUsd,
      },
    });
    return {
      id: row.id,
      accountId: row.accountId,
      symbol: row.instrumentSymbol,
      side: row.side,
      quantity: row.quantity,
      price: Number(row.price),
      filledAt: row.filledAt,
      commissionUsd: Number(row.commissionUsd),
    };
  }
}
