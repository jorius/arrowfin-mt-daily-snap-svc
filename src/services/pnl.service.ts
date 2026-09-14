import { Injectable } from '@nestjs/common';
import type { OpenPosition } from './position-ledger.service.js';

@Injectable()
export class PnlService {
  /** (mark - avg) * netQty * pointValue; the signed netQty handles shorts. */
  unrealized(p: OpenPosition, markPrice: number, pointValue: number): number {
    return (markPrice - p.avgPrice) * p.netQty * pointValue;
  }

  /** Signed notional exposure at the mark. */
  notional(p: OpenPosition, markPrice: number, pointValue: number): number {
    return p.netQty * markPrice * pointValue;
  }
}
