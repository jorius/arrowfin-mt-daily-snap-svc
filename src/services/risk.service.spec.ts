import { RiskService } from './risk.service.js';

const svc = new RiskService();

describe('RiskService', () => {
  it('applies min(100, |notional| / balance * 100)', () => {
    expect(svc.score(25_000, 100_000)).toBe(25);
    expect(svc.score(-25_000, 100_000)).toBe(25);
  });

  it('caps at 100', () => {
    expect(svc.score(500_000, 100_000)).toBe(100);
  });

  it('scores 100 when exposed with no balance and 0 when flat', () => {
    expect(svc.score(1_000, 0)).toBe(100);
    expect(svc.score(0, 0)).toBe(0);
  });

  it('levels', () => {
    expect(svc.level(75)).toBe('ELEVATED');
    expect(svc.level(75.01)).toBe('HIGH');
    expect(svc.level(50)).toBe('LOW');
  });
});
