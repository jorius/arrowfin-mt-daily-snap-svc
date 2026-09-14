import { SessionClockService } from './session-clock.service.js';

const svc = new SessionClockService();

describe('SessionClockService', () => {
  it('maps the dataset cut to the session that opened the previous evening (CDT)', () => {
    const s = svc.sessionFor(new Date('2026-08-25T14:30:00Z'));
    expect(s.open.toISOString()).toBe('2026-08-24T22:00:00.000Z');
    expect(s.close.toISOString()).toBe('2026-08-25T21:00:00.000Z');
  });

  it('starts a new session at 17:00 Chicago', () => {
    expect(svc.sessionFor(new Date('2026-08-24T22:41:07Z')).open.toISOString()).toBe(
      '2026-08-24T22:00:00.000Z',
    );
    expect(svc.sessionFor(new Date('2026-08-24T21:59:59Z')).open.toISOString()).toBe(
      '2026-08-23T22:00:00.000Z',
    );
  });

  it('uses the winter offset (CST) in January', () => {
    expect(svc.sessionFor(new Date('2026-01-15T12:00:00Z')).open.toISOString()).toBe(
      '2026-01-14T23:00:00.000Z',
    );
  });
});
