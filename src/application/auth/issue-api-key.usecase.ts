import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ENV, type Env } from '../../infrastructure/config/env.js';
import { ApiKeyService } from '../../services/api-key.service.js';
import { SecretHasherService } from '../../services/secret-hasher.service.js';
import type { IssueApiKeyResult } from '../dto/auth.dto.js';
import { API_KEYS_REPOSITORY, type ApiKeysRepository } from '../ports/api-keys.repository.js';
import { CLOCK, type Clock } from '../ports/clock.js';
import { CREDENTIALS_REPOSITORY, type CredentialsRepository } from '../ports/credentials.repository.js';

@Injectable()
export class IssueApiKeyUseCase {
  constructor(
    @Inject(CREDENTIALS_REPOSITORY) private readonly credentials: CredentialsRepository,
    @Inject(API_KEYS_REPOSITORY) private readonly apiKeys: ApiKeysRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
    private readonly hasher: SecretHasherService,
    private readonly keys: ApiKeyService,
  ) {}

  async execute(input: { traderId: string; secret: string }): Promise<IssueApiKeyResult> {
    const record = await this.credentials.findByTraderId(input.traderId);
    // Always run one scrypt verification so an unknown trader id costs the same time as a wrong secret.
    const valid = await this.hasher.verify(input.secret, record?.secretHash ?? this.hasher.dummyHash);
    if (!record || !valid) throw new UnauthorizedException('Invalid credentials');
    if (record.kycStatus === 'suspended') throw new ForbiddenException('Trader suspended');

    const { apiKey, keyHash, keyPrefix } = this.keys.generate();
    const expiresAt = new Date(this.clock.now().getTime() + this.env.API_KEY_TTL_HOURS * 3_600_000);
    // brokerId comes from the trader row, never from the request.
    await this.apiKeys.create({ traderId: record.traderId, brokerId: record.brokerId, keyHash, keyPrefix, expiresAt });

    return {
      apiKey,
      expiresAt: expiresAt.toISOString(),
      principal: { traderId: record.traderId, brokerId: record.brokerId },
      portalName: record.portalName,
    };
  }
}
