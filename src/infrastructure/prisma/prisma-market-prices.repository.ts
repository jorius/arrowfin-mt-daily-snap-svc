import { Injectable } from '@nestjs/common';
import type { InstrumentMark, MarketPricesRepository } from '../../application/ports/market-prices.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaMarketPricesRepository implements MarketPricesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async marksFor(symbols: string[]): Promise<Map<string, InstrumentMark>> {
    if (symbols.length === 0) return new Map();
    const rows = await this.prisma.instrument.findMany({
      where: { symbol: { in: symbols } },
      include: { marketPrice: true },
    });
    const marks = new Map<string, InstrumentMark>();
    for (const r of rows) {
      if (!r.marketPrice) continue;
      marks.set(r.symbol, {
        symbol: r.symbol,
        description: r.description,
        pointValue: Number(r.pointValueUsd),
        markPrice: Number(r.marketPrice.markPrice),
        asOf: r.marketPrice.asOf,
      });
    }
    return marks;
  }
}
