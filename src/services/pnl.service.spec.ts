import { PnlService } from './pnl.service.js';

const svc = new PnlService();

describe('PnlService', () => {
  it('computes unrealized for long and short', () => {
    expect(svc.unrealized({ symbol: 'MES', netQty: 5, avgPrice: 5640.1 }, 5642.25, 5)).toBeCloseTo(53.75);
    expect(svc.unrealized({ symbol: 'MCL', netQty: -3, avgPrice: 73.5 }, 74.18, 100)).toBeCloseTo(-204);
  });

  it('computes signed notional', () => {
    expect(svc.notional({ symbol: 'MES', netQty: 5, avgPrice: 0 }, 5642.25, 5)).toBeCloseTo(141056.25);
    expect(svc.notional({ symbol: 'MCL', netQty: -3, avgPrice: 0 }, 74.18, 100)).toBeCloseTo(-22254);
  });
});
