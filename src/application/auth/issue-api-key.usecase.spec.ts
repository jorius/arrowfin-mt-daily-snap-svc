import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Env } from '../../infrastructure/config/env.js';
import { ApiKeyService } from '../../services/api-key.service.js';
import { SecretHasherService } from '../../services/secret-hasher.service.js';
import type { ApiKeyRecord, ApiKeysRepository } from '../ports/api-keys.repository.js';
import type { CredentialRecord, CredentialsRepository } from '../ports/credentials.repository.js';
import { IssueApiKeyUseCase } from './issue-api-key.usecase.js';

const hasher = new SecretHasherService();
const env = { API_KEY_TTL_HOURS: 12 } as Env;
const clock = { now: () => new Date('2026-08-25T14:30:00Z') };

async function setup() {
  const records: Record<string, CredentialRecord> = {
    'T-005': { traderId: 'T-005', brokerId: 'BRK-SMPT', secretHash: await hasher.hash('summit-secret'), kycStatus: 'verified', portalName: 'Summit Trader Portal' },
    'T-008': { traderId: 'T-008', brokerId: 'BRK-SMPT', secretHash: await hasher.hash('ryan-secret'), kycStatus: 'suspended', portalName: 'Summit Trader Portal' },
  };
  const verify = vi.spyOn(hasher, 'verify');
  verify.mockClear();
  const created: Parameters<ApiKeysRepository['create']>[0][] = [];
  const credentials: CredentialsRepository = { findByTraderId: async (id) => records[id] ?? null };
  const apiKeys: ApiKeysRepository = {
    create: async (input) => { created.push(input); return { id: 'k1', traderId: input.traderId, brokerId: input.brokerId, expiresAt: input.expiresAt, revokedAt: null } satisfies ApiKeyRecord; },
    findActiveByHash: async () => null,
    revoke: async () => undefined,
    touch: async () => undefined,
  };
  const useCase = new IssueApiKeyUseCase(credentials, apiKeys, clock, env, hasher, new ApiKeyService());
  return { useCase, created, verify };
}

describe('IssueApiKeyUseCase', () => {
  it('issues a key whose tenant comes from the credential record', async () => {
    const { useCase, created } = await setup();
    const result = await useCase.execute({ traderId: 'T-005', secret: 'summit-secret' });
    expect(result.apiKey.startsWith('afk_')).toBe(true);
    expect(result.principal).toEqual({ traderId: 'T-005', brokerId: 'BRK-SMPT' });
    expect(result.expiresAt).toBe('2026-08-26T02:30:00.000Z');
    expect(created[0]!.brokerId).toBe('BRK-SMPT');
    expect(created[0]!.keyHash).not.toBe(result.apiKey);
    expect(created[0]!.keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong secret', async () => {
    const { useCase } = await setup();
    await expect(useCase.execute({ traderId: 'T-005', secret: 'nope' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still runs a hash comparison for an unknown trader id', async () => {
    const { useCase, verify } = await setup();
    await expect(useCase.execute({ traderId: 'T-999', secret: 'whatever' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('refuses suspended traders after verifying the secret', async () => {
    const { useCase } = await setup();
    await expect(useCase.execute({ traderId: 'T-008', secret: 'ryan-secret' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
