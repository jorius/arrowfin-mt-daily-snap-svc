export const ENV = Symbol('ENV');

/** Socket.IO heartbeat settings (milliseconds). */
export interface WsOptions {
  /** How often the server pings each client. */
  readonly pingIntervalMs: number;
  /** How long a client may stay silent after a ping before it is dropped. */
  readonly pingTimeoutMs: number;
  /** How long a handshake may take before the server gives up. */
  readonly connectTimeoutMs: number;
}

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
  /** WS_PING_INTERVAL_MS, default 25000. */
  readonly WS_PING_INTERVAL_MS: number;
  /** WS_PING_TIMEOUT_MS, default 20000. */
  readonly WS_PING_TIMEOUT_MS: number;
  /** WS_CONNECT_TIMEOUT_MS, default 45000. */
  readonly WS_CONNECT_TIMEOUT_MS: number;
  /** Serves /docs and /docs-json. Defaults to true; always false in production. */
  readonly SWAGGER_ENABLED: boolean;
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

function positiveIntOr(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const n = intOr(source, name, fallback);
  if (n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

/**
 * Parsed on its own so the gateway decorator can read the heartbeat settings at
 * import time without requiring the rest of the environment (DATABASE_URL, …).
 */
export function loadWsOptions(source: NodeJS.ProcessEnv = process.env): WsOptions {
  return {
    pingIntervalMs: positiveIntOr(source, 'WS_PING_INTERVAL_MS', 25_000),
    pingTimeoutMs: positiveIntOr(source, 'WS_PING_TIMEOUT_MS', 20_000),
    connectTimeoutMs: positiveIntOr(source, 'WS_CONNECT_TIMEOUT_MS', 45_000),
  };
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const snapshotNow = source.SNAPSHOT_NOW ?? '2026-08-25T14:30:00Z';
  const parsed = snapshotNow === '' ? null : new Date(snapshotNow);
  if (parsed && Number.isNaN(parsed.getTime())) {
    throw new Error('SNAPSHOT_NOW must be an ISO 8601 instant');
  }
  const ws = loadWsOptions(source);
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
    WS_PING_INTERVAL_MS: ws.pingIntervalMs,
    WS_PING_TIMEOUT_MS: ws.pingTimeoutMs,
    WS_CONNECT_TIMEOUT_MS: ws.connectTimeoutMs,
    SWAGGER_ENABLED: (source.SWAGGER_ENABLED ?? 'true') !== 'false' && nodeEnv !== 'production',
  };
}
