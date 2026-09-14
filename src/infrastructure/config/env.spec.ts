import { loadEnv } from './env.js';

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
});
