import type { TenantContext } from '../tenant-context.js';

export const API_KEYS_REPOSITORY = Symbol('API_KEYS_REPOSITORY');

export interface ApiKeyRecord {
  id: string;
  traderId: string;
  brokerId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ApiKeysRepository {
  create(input: { traderId: string; brokerId: string; keyHash: string; keyPrefix: string; expiresAt: Date }): Promise<ApiKeyRecord>;
  /** Active = not revoked and not expired at `now`. */
  findActiveByHash(keyHash: string, now: Date): Promise<ApiKeyRecord | null>;
  revoke(ctx: TenantContext, apiKeyId: string, at: Date): Promise<void>;
  touch(apiKeyId: string, at: Date): Promise<void>;
}
