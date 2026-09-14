export const ENV = Symbol('ENV');

export interface Env {
  readonly NODE_ENV: string;
  readonly DATABASE_URL: string;
  readonly PORT: number;
  readonly CORS_ORIGIN: string;
  /** Instant treated as "now"; null means real time. */
  readonly SNAPSHOT_NOW: Date | null;
  readonly API_KEY_TTL_HOURS: number;
  /** Always false in production, whatever the variable says. */
  readonly DEV_FILLS_ENABLED: boolean;
  readonly DEV_TRADER_SECRET: string | undefined;
  readonly DATASET_DIR: string;
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const v = source[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

function intOr(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const v = source[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const snapshotNow = source.SNAPSHOT_NOW ?? '2026-08-25T14:30:00Z';
  const parsed = snapshotNow === '' ? null : new Date(snapshotNow);
  if (parsed && Number.isNaN(parsed.getTime())) {
    throw new Error('SNAPSHOT_NOW must be an ISO 8601 instant');
  }
  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: required(source, 'DATABASE_URL'),
    PORT: intOr(source, 'PORT', 3001),
    CORS_ORIGIN: source.CORS_ORIGIN ?? 'http://localhost:3000',
    SNAPSHOT_NOW: parsed,
    API_KEY_TTL_HOURS: intOr(source, 'API_KEY_TTL_HOURS', 12),
    DEV_FILLS_ENABLED: source.DEV_FILLS_ENABLED === 'true' && nodeEnv !== 'production',
    DEV_TRADER_SECRET: source.DEV_TRADER_SECRET || undefined,
    DATASET_DIR: source.DATASET_DIR ?? '../dataset',
  };
}
