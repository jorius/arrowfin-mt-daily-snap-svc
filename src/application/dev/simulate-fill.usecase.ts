import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, type Clock } from '../ports/clock.js';
import { DEV_FILLS_REPOSITORY, type DevFillsRepository } from '../ports/dev-fills.repository.js';
import { FILL_PUBLISHER, type FillPublisher } from '../ports/fill-publisher.js';
import type { FillRecord } from '../ports/fills.repository.js';

export interface SimulateFillInput {
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commissionUsd: number;
}

/** Inserts a fill stamped with the replay clock and pushes it to that account's room only. */
@Injectable()
export class SimulateFillUseCase {
  constructor(
    @Inject(DEV_FILLS_REPOSITORY) private readonly fills: DevFillsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILL_PUBLISHER) private readonly publisher: FillPublisher,
  ) {}

  async execute(input: SimulateFillInput): Promise<FillRecord> {
    const tenant = await this.fills.findAccountTenant(input.accountId);
    if (!tenant) throw new NotFoundException('Account not found');
    if (!(await this.fills.instrumentExists(input.symbol))) {
      throw new BadRequestException(`Unknown instrument ${input.symbol}`);
    }
    const stamp = Date.now();
    const fill = await this.fills.insert({
      id: `FIL-DEV-${stamp}`,
      accountId: input.accountId,
      brokerId: tenant.brokerId, // from the account row, never from the request
      symbol: input.symbol,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      filledAt: this.clock.now(),
      orderId: `ORD-DEV-${stamp}`,
      liquidity: 'taker',
      commissionUsd: input.commissionUsd,
    });
    this.publisher.publish(
      { brokerId: tenant.brokerId, accountId: fill.accountId },
      {
        id: fill.id,
        accountId: fill.accountId,
        symbol: fill.symbol,
        side: fill.side,
        quantity: fill.quantity,
        price: fill.price,
        filledAt: fill.filledAt.toISOString(),
      },
    );
    return fill;
  }
}
