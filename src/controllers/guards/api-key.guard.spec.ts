import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { AuthenticateApiKeyUseCase } from '../../application/auth/authenticate-api-key.usecase.js';
import { ApiKeyGuard } from './api-key.guard.js';

const principal = { traderId: 'T-005', brokerId: 'BRK-SMPT', apiKeyId: 'k1' };
const authenticate = { execute: async (key: string) => (key === 'afk_valid' ? principal : null) } as AuthenticateApiKeyUseCase;
const guard = new ApiKeyGuard(authenticate);
const ctx = (authorization?: string) => {
  const request: { headers: Record<string, string | undefined>; principal?: unknown } = { headers: { authorization } };
  return { context: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext, request };
};

describe('ApiKeyGuard', () => {
  it('rejects a missing header', async () => {
    await expect(guard.canActivate(ctx().context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects an unknown key', async () => {
    await expect(guard.canActivate(ctx('Bearer afk_nope').context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('attaches the principal for a valid key', async () => {
    const { context, request } = ctx('Bearer afk_valid');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual(principal);
  });
});
