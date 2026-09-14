import type { Clock } from '../../application/ports/clock.js';

/**
 * Starts at `start` and advances with wall-clock time, so simulated fills stay
 * inside the replayed session and always carry increasing timestamps.
 */
export class ReplayClock implements Clock {
  private readonly bootRealMs: number;

  constructor(
    private readonly start: Date | null,
    private readonly realNowMs: () => number = () => Date.now(),
  ) {
    this.bootRealMs = realNowMs();
  }

  now(): Date {
    if (!this.start) return new Date(this.realNowMs());
    return new Date(this.start.getTime() + (this.realNowMs() - this.bootRealMs));
  }
}
