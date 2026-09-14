import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Principal } from '../../application/principal.js';
import type { AuthenticatedRequest } from '../guards/api-key.guard.js';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) throw new Error('CurrentPrincipal used on a route without ApiKeyGuard');
    return request.principal;
  },
);
