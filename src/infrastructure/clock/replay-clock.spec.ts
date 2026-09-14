import { ReplayClock } from './replay-clock.js';

describe('ReplayClock', () => {
  it('starts at the configured instant and advances with real time', () => {
    let real = 1_000_000;
    const clock = new ReplayClock(new Date('2026-08-25T14:30:00Z'), () => real);
    expect(clock.now().toISOString()).toBe('2026-08-25T14:30:00.000Z');
    real += 5_000;
    expect(clock.now().toISOString()).toBe('2026-08-25T14:30:05.000Z');
  });

  it('falls back to real time when no start is configured', () => {
    const clock = new ReplayClock(null, () => 1_700_000_000_000);
    expect(clock.now().getTime()).toBe(1_700_000_000_000);
  });
});
