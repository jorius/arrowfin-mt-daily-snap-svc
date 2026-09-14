import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsPositive, IsString, Length, Min } from 'class-validator';

/** Shape from dataset/simulate-fills.md (snake_case on purpose). */
export class DevFillDto {
  @ApiProperty({ example: 'ACC-1006', description: 'Its broker_id is taken from the account row, never from this body.' })
  @IsString()
  @Length(1, 32)
  account_id!: string;

  @ApiProperty({ example: 'MES' })
  @IsString()
  @Length(1, 8)
  instrument_symbol!: string;

  @ApiProperty({ example: 'BUY', enum: ['BUY', 'SELL'] })
  @IsIn(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 5643.25 })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiProperty({ example: 1.4, minimum: 0 })
  @IsNumber()
  @Min(0)
  commission_usd!: number;
}
