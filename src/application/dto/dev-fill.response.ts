import { ApiProperty } from '@nestjs/swagger';

export class FillResponse {
  @ApiProperty({ example: 'FIL-DEV-1789401186536' })
  id!: string;

  @ApiProperty({ example: 'ACC-1006' })
  accountId!: string;

  @ApiProperty({ example: 'MES' })
  symbol!: string;

  @ApiProperty({ example: 'BUY', enum: ['BUY', 'SELL'] })
  side!: 'BUY' | 'SELL';

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 5643.25 })
  price!: number;

  @ApiProperty({ example: '2026-08-25T14:30:55.074Z', description: 'Stamped with the replay clock so it lands inside the replayed session.' })
  filledAt!: string;

  @ApiProperty({ example: 1.4 })
  commissionUsd!: number;
}

export class DevFillResponse {
  @ApiProperty({ type: FillResponse })
  fill!: FillResponse;
}
