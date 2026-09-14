import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SimulateFillUseCase } from '../../application/dev/simulate-fill.usecase.js';
import { DevFillResponse } from '../../application/dto/dev-fill.response.js';
import { ErrorResponse } from '../../application/dto/error.response.js';
import { DevFillDto } from './dev-fill.dto.js';

/** Exists only when DevFillsModule is registered (never in production). */
@ApiTags('Dev')
@Controller('dev')
export class DevFillsController {
  constructor(private readonly simulate: SimulateFillUseCase) {}

  @Post('fills')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Simulate a fill and push it to the account\'s WebSocket room (development only).',
    description:
      'Registered only when DEV_FILLS_ENABLED=true and NODE_ENV is not production; in production this route does not exist. ' +
      "The fill's broker_id comes from the account row, never from the body, and the event is emitted only to that account's room. Body shape follows dataset/simulate-fills.md (snake_case).",
  })
  @ApiCreatedResponse({ type: DevFillResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'Validation failed or unknown instrument.' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'Unknown account.' })
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
