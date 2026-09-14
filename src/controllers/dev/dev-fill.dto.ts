import { IsIn, IsInt, IsNumber, IsPositive, IsString, Length, Min } from 'class-validator';

/** Shape from dataset/simulate-fills.md (snake_case on purpose). */
export class DevFillDto {
  @IsString()
  @Length(1, 32)
  account_id!: string;

  @IsString()
  @Length(1, 8)
  instrument_symbol!: string;

  @IsIn(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsNumber()
  @Min(0)
  commission_usd!: number;
}
