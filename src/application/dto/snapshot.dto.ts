import type { RiskLevel } from '../../services/risk.service.js';

export interface PositionDto {
  symbol: string;
  description: string;
  side: 'LONG' | 'SHORT';
  netQty: number;
  avgPrice: number;
  markPrice: number;
  pointValue: number;
  notional: number;
  unrealizedPnl: number;
}

export interface SnapshotDto {
  asOf: string;
  session: { open: string; close: string };
  account: { id: string; accountNumber: string; accountType: string; status: string; balance: number };
  positions: PositionDto[];
  pnl: { realizedToday: number; commissionsToday: number; unrealized: number; dayTotal: number };
  risk: { score: number; level: RiskLevel; notional: number; balance: number };
  fillsToday: number;
  lastFillId: string | null;
}
