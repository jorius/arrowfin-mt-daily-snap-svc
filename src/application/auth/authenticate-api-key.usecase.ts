import { Inject, Injectable } from '@nestjs/common';
import { ApiKeyService, API_KEY_PREFIX } from '../../services/api-key.service.js';
import { API_KEYS_REPOSITORY, type ApiKeysRepository } from '../ports/api-keys.repository.js';
import { CLOCK, type Clock } from '../ports/clock.js';
import type { Principal } from '../principal.js';

@Injectable()
export class AuthenticateApiKeyUseCase {
  constructor(
    @Inject(API_KEYS_REPOSITORY) private readonly apiKeys: ApiKeysRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly keys: ApiKeyService,
  ) {}

  /** Resolves the principal from the key row only; returns null for anything invalid. */
  async execute(apiKey: string): Promise<Principal | null> {
    if (!apiKey.startsWith(API_KEY_PREFIX)) return null;
    const now = this.clock.now();
    const record = await this.apiKeys.findActiveByHash(this.keys.hash(apiKey), now);
    if (!record) return null;
    void this.apiKeys.touch(record.id, now).catch(() => undefined);
    return { traderId: record.traderId, brokerId: record.brokerId, apiKeyId: record.id };
  }
}
