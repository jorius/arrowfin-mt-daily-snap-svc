import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticateApiKeyUseCase } from '../../application/auth/authenticate-api-key.usecase.js';
import type { Principal } from '../../application/principal.js';

export type AuthenticatedRequest = Request & { principal?: Principal };

/** Resolves the principal from `Authorization: Bearer afk_…`; nothing else in the request can influence it. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateApiKeyUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const apiKey = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const principal = apiKey ? await this.authenticate.execute(apiKey) : null;
    if (!principal) throw new UnauthorizedException('Missing or invalid API key');
    request.principal = principal;
    return true;
  }
}
