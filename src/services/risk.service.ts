import { Injectable } from '@nestjs/common';

export type RiskLevel = 'LOW' | 'ELEVATED' | 'HIGH';

@Injectable()
export class RiskService {
  /** min(100, |notional| / balance * 100); an exposed account with no balance scores 100. */
  score(notional: number, balance: number): number {
    if (balance <= 0) return notional === 0 ? 0 : 100;
    return Math.round(Math.min(100, (Math.abs(notional) / balance) * 100) * 100) / 100;
  }

  level(score: number): RiskLevel {
    return score > 75 ? 'HIGH' : score > 50 ? 'ELEVATED' : 'LOW';
  }
}
