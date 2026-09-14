import { PositionLedgerService, type LedgerFill } from './position-ledger.service.js';

const svc = new PositionLedgerService();
const W = { from: new Date('2026-08-24T22:00:00Z'), to: new Date('2026-08-25T14:30:00Z') };
const at = (iso: string) => new Date(iso);
const f = (o: Partial<LedgerFill>): LedgerFill => ({
  symbol: 'MES',
  side: 'BUY',
  quantity: 1,
  price: 100,
  commissionUsd: 0,
  filledAt: at('2026-08-25T01:00:00Z'),
  pointValue: 5,
  ...o,
});

describe('PositionLedgerService', () => {
  it('averages same-direction fills', () => {
    const r = svc.replay([f({ quantity: 2, price: 100 }), f({ quantity: 2, price: 110 })], W);
    expect(r.positions).toEqual([{ symbol: 'MES', netQty: 4, avgPrice: 105 }]);
    expect(r.realizedInWindow).toBe(0);
  });

  it('realizes on partial close and keeps the average', () => {
    const r = svc.replay(
      [f({ quantity: 4, price: 105 }), f({ side: 'SELL', quantity: 2, price: 110 })],
      W,
    );
    expect(r.positions).toEqual([{ symbol: 'MES', netQty: 2, avgPrice: 105 }]);
    expect(r.realizedInWindow).toBe(50); // (110 - 105) * 2 * 5
  });

  it('handles shorts', () => {
    const r = svc.replay(
      [
        f({ side: 'SELL', quantity: 3, price: 100, pointValue: 10 }),
        f({ quantity: 3, price: 90, pointValue: 10 }),
      ],
      W,
    );
    expect(r.positions).toEqual([]);
    expect(r.realizedInWindow).toBe(300);
  });

  it('flips through flat and opens the remainder at the fill price', () => {
    const r = svc.replay(
      [f({ quantity: 2, price: 100, pointValue: 1 }), f({ side: 'SELL', quantity: 5, price: 120, pointValue: 1 })],
      W,
    );
    expect(r.positions).toEqual([{ symbol: 'MES', netQty: -3, avgPrice: 120 }]);
    expect(r.realizedInWindow).toBe(40);
  });

  it('treats fills sharing an order id as ordinary fills', () => {
    const r = svc.replay(
      [f({ quantity: 5, price: 5610.5 }), f({ quantity: 5, price: 5610.5 }), f({ side: 'SELL', quantity: 10, price: 5611.5 })],
      W,
    );
    expect(r.positions).toEqual([]);
    expect(r.realizedInWindow).toBe(50); // 1 point * 10 * 5
  });

  it('counts positions from before the window but not their realized P&L or commissions', () => {
    const r = svc.replay(
      [
        f({ quantity: 2, price: 100, commissionUsd: 1.4, filledAt: at('2026-08-21T10:00:00Z') }),
        f({ side: 'SELL', quantity: 1, price: 110, commissionUsd: 0.7, filledAt: at('2026-08-21T11:00:00Z') }),
        f({ side: 'SELL', quantity: 1, price: 120, commissionUsd: 0.7 }),
      ],
      W,
    );
    expect(r.positions).toEqual([]);
    expect(r.realizedInWindow).toBe(100); // only the in-window close: (120 - 100) * 1 * 5
    expect(r.commissionsInWindow).toBeCloseTo(0.7);
    expect(r.fillsInWindow).toBe(1);
  });
});
