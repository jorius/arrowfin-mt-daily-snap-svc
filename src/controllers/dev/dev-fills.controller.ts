import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SimulateFillUseCase } from '../../application/dev/simulate-fill.usecase.js';
import { DevFillDto } from './dev-fill.dto.js';

/** Exists only when DevFillsModule is registered (never in production). */
@Controller('dev')
export class DevFillsController {
  constructor(private readonly simulate: SimulateFillUseCase) {}

  @Post('fills')
  @HttpCode(201)
  async create(@Body() dto: DevFillDto) {
    const fill = await this.simulate.execute({
      accountId: dto.account_id,
      symbol: dto.instrument_symbol,
      side: dto.side,
      quantity: dto.quantity,
      price: dto.price,
      commissionUsd: dto.commission_usd,
    });
    return { fill };
  }
}
