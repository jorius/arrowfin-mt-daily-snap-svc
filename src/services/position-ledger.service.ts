import { Injectable } from '@nestjs/common';

export interface LedgerFill {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commissionUsd: number;
  filledAt: Date;
  pointValue: number;
}

/** netQty > 0 is long, < 0 is short. */
export interface OpenPosition {
  symbol: string;
  netQty: number;
  avgPrice: number;
}

export interface LedgerResult {
  positions: OpenPosition[];
  realizedInWindow: number;
  commissionsInWindow: number;
  fillsInWindow: number;
}

/**
 * Average-cost position ledger. Fills must be ordered by filledAt.
 * Realized P&L is attributed to the closing fill and only counted inside the window.
 */
@Injectable()
export class PositionLedgerService {
  replay(fills: LedgerFill[], window: { from: Date; to: Date }): LedgerResult {
    const book = new Map<string, { qty: number; avg: number }>();
    let realized = 0;
    let commissions = 0;
    let count = 0;

    for (const fill of fills) {
      const inWindow = fill.filledAt >= window.from && fill.filledAt <= window.to;
      if (inWindow) {
        commissions += fill.commissionUsd;
        count += 1;
      }
      const pos = book.get(fill.symbol) ?? { qty: 0, avg: 0 };
      const signed = fill.side === 'BUY' ? fill.quantity : -fill.quantity;

      if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signed)) {
        const total = Math.abs(pos.qty) + Math.abs(signed);
        pos.avg = (pos.avg * Math.abs(pos.qty) + fill.price * Math.abs(signed)) / total;
        pos.qty += signed;
      } else {
        const closeQty = Math.min(Math.abs(pos.qty), Math.abs(signed));
        const pnl = (fill.price - pos.avg) * closeQty * fill.pointValue * Math.sign(pos.qty);
        if (inWindow) realized += pnl;
        const remainder = Math.abs(signed) - closeQty;
        pos.qty += signed;
        if (pos.qty === 0) pos.avg = 0;
        else if (remainder > 0) pos.avg = fill.price; // flipped through flat
      }
      book.set(fill.symbol, pos);
    }

    const positions = [...book.entries()]
      .filter(([, p]) => p.qty !== 0)
      .map(([symbol, p]) => ({ symbol, netQty: p.qty, avgPrice: p.avg }));
    return { positions, realizedInWindow: realized, commissionsInWindow: commissions, fillsInWindow: count };
  }
}
