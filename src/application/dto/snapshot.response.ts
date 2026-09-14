import { ApiProperty } from '@nestjs/swagger';

export class PositionResponse {
  @ApiProperty({ example: 'MES' })
  symbol!: string;

  @ApiProperty({ example: 'Micro E-mini S&P 500' })
  description!: string;

  @ApiProperty({ example: 'LONG', enum: ['LONG', 'SHORT'] })
  side!: 'LONG' | 'SHORT';

  @ApiProperty({ example: 5, description: 'Signed net quantity: positive long, negative short.' })
  netQty!: number;

  @ApiProperty({ example: 5628.25, description: 'Average-cost entry price of the open quantity.' })
  avgPrice!: number;

  @ApiProperty({ example: 5642.25, description: 'Current mark from market_prices.' })
  markPrice!: number;

  @ApiProperty({ example: 5, description: 'USD per index point for one contract (differs between MES and ES).' })
  pointValue!: number;

  @ApiProperty({ example: 141056.25, description: 'netQty × mark × pointValue, signed.' })
  notional!: number;

  @ApiProperty({ example: 350, description: '(mark − avgPrice) × netQty × pointValue.' })
  unrealizedPnl!: number;
}

export class PnlResponse {
  @ApiProperty({ example: 138.55, description: "Realized on closes inside today's session, net of commissions." })
  realizedToday!: number;

  @ApiProperty({ example: 7.7, description: "Commissions on today's fills (per contract, per side)." })
  commissionsToday!: number;

  @ApiProperty({ example: 350 })
  unrealized!: number;

  @ApiProperty({ example: 488.55, description: 'realizedToday + unrealized.' })
  dayTotal!: number;
}

export class RiskResponse {
  @ApiProperty({ example: 94.04, minimum: 0, maximum: 100, description: 'min(100, |notional| / balance × 100); a zero balance with exposure scores 100.' })
  score!: number;

  @ApiProperty({ example: 'HIGH', enum: ['LOW', 'ELEVATED', 'HIGH'], description: 'HIGH above 75, ELEVATED above 50.' })
  level!: 'LOW' | 'ELEVATED' | 'HIGH';

  @ApiProperty({ example: 141056.25, description: 'Sum of signed position notionals.' })
  notional!: number;

  @ApiProperty({ example: 150000 })
  balance!: number;
}

export class SessionResponse {
  @ApiProperty({ example: '2026-08-24T22:00:00.000Z', description: 'Globex open (17:00 America/Chicago) of the session that contains asOf.' })
  open!: string;

  @ApiProperty({ example: '2026-08-25T21:00:00.000Z' })
  close!: string;
}

export class SnapshotAccountResponse {
  @ApiProperty({ example: 'ACC-1006' })
  id!: string;

  @ApiProperty({ example: 'SMT-200001' })
  accountNumber!: string;

  @ApiProperty({ example: 'pro_plus' })
  accountType!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: 150000, description: "The caller's own balance; regulated data, returned only here." })
  balance!: number;
}

export class SnapshotResponse {
  @ApiProperty({ example: '2026-08-25T14:30:00.000Z', description: 'The instant the snapshot was computed for (replay clock).' })
  asOf!: string;

  @ApiProperty({ type: SessionResponse })
  session!: SessionResponse;

  @ApiProperty({ type: SnapshotAccountResponse })
  account!: SnapshotAccountResponse;

  @ApiProperty({ type: [PositionResponse], description: 'Open positions only; flat instruments are omitted.' })
  positions!: PositionResponse[];

  @ApiProperty({ type: PnlResponse })
  pnl!: PnlResponse;

  @ApiProperty({ type: RiskResponse })
  risk!: RiskResponse;

  @ApiProperty({ example: 5, description: "Fills inside today's session." })
  fillsToday!: number;

  @ApiProperty({ example: 'FIL-500662', nullable: true, description: 'Id of the latest fill considered; lets a client detect a gap after a reconnect.' })
  lastFillId!: string | null;
}
