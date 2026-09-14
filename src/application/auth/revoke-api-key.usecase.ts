import { Inject, Injectable } from '@nestjs/common';
import { API_KEYS_REPOSITORY, type ApiKeysRepository } from '../ports/api-keys.repository.js';
import { CLOCK, type Clock } from '../ports/clock.js';
import type { Principal } from '../principal.js';

@Injectable()
export class RevokeApiKeyUseCase {
  constructor(
    @Inject(API_KEYS_REPOSITORY) private readonly apiKeys: ApiKeysRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(principal: Principal): Promise<void> {
    await this.apiKeys.revoke(principal, principal.apiKeyId, this.clock.now());
  }
}
