import { loadEnv, loadWsOptions } from './env.js';

const base = { DATABASE_URL: 'postgresql://x' };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({ ...base });
    expect(env.PORT).toBe(3001);
    expect(env.SNAPSHOT_NOW?.toISOString()).toBe('2026-08-25T14:30:00.000Z');
    expect(env.DEV_FILLS_ENABLED).toBe(false);
    expect(env.API_KEY_TTL_HOURS).toBe(12);
  });

  it('never enables dev fills in production', () => {
    expect(loadEnv({ ...base, DEV_FILLS_ENABLED: 'true' }).DEV_FILLS_ENABLED).toBe(true);
    expect(
      loadEnv({ ...base, DEV_FILLS_ENABLED: 'true', NODE_ENV: 'production' }).DEV_FILLS_ENABLED,
    ).toBe(false);
  });

  it('fails fast without a database url', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('applies the WebSocket heartbeat defaults', () => {
    const env = loadEnv({ ...base });
    expect(env.WS_PING_INTERVAL_MS).toBe(25_000);
    expect(env.WS_PING_TIMEOUT_MS).toBe(20_000);
    expect(env.WS_CONNECT_TIMEOUT_MS).toBe(45_000);
  });

  it('reads the WebSocket heartbeat from the environment', () => {
    const env = loadEnv({
      ...base,
      WS_PING_INTERVAL_MS: '5000',
      WS_PING_TIMEOUT_MS: '4000',
      WS_CONNECT_TIMEOUT_MS: '9000',
    });
    expect(env.WS_PING_INTERVAL_MS).toBe(5000);
    expect(env.WS_PING_TIMEOUT_MS).toBe(4000);
    expect(env.WS_CONNECT_TIMEOUT_MS).toBe(9000);
  });
});

describe('loadWsOptions', () => {
  it('does not require the rest of the environment', () => {
    expect(loadWsOptions({})).toEqual({
      pingIntervalMs: 25_000,
      pingTimeoutMs: 20_000,
      connectTimeoutMs: 45_000,
    });
  });

  it('rejects a non-numeric or non-positive value', () => {
    expect(() => loadWsOptions({ WS_PING_INTERVAL_MS: 'soon' })).toThrow(/WS_PING_INTERVAL_MS/);
    expect(() => loadWsOptions({ WS_PING_TIMEOUT_MS: '0' })).toThrow(/positive/);
    expect(() => loadWsOptions({ WS_CONNECT_TIMEOUT_MS: '-1' })).toThrow(/positive/);
  });
});
