import type { Clock } from '../application/ports/clock.js';

describe('SnapshotGateway', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('greets an admitted socket with the configured heartbeat and nothing else', async () => {
    vi.resetModules();
    vi.stubEnv('WS_PING_INTERVAL_MS', '1234');
    vi.stubEnv('WS_PING_TIMEOUT_MS', '2345');
    vi.stubEnv('WS_CONNECT_TIMEOUT_MS', '3456');
    const { SnapshotGateway, WS_OPTIONS } = await import('./snapshot.gateway.js');
    expect(WS_OPTIONS).toEqual({ pingIntervalMs: 1234, pingTimeoutMs: 2345, connectTimeoutMs: 3456 });

    const clock: Clock = { now: () => new Date('2026-08-25T14:30:00Z') };
    const gateway = new SnapshotGateway({} as never, {} as never, clock);
    const emit = vi.fn();
    const socket = {
      emit,
      conn: { transport: { name: 'websocket' } },
      rooms: new Set(['own-socket-id', 'broker:BRK-SMPT:account:ACC-1006', 'broker:BRK-SMPT:account:ACC-1007']),
    };

    gateway.handleConnection(socket as never);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('hello', {
      serverTime: '2026-08-25T14:30:00.000Z',
      pingIntervalMs: 1234,
      pingTimeoutMs: 2345,
      connectTimeoutMs: 3456,
      transport: 'websocket',
      rooms: 2,
    });
  });
});
