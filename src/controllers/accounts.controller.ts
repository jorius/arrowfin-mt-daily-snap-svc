import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { Principal } from '../application/principal.js';
import { GetAccountSnapshotUseCase } from '../application/snapshot/get-account-snapshot.usecase.js';
import { ListAccountsUseCase } from '../application/snapshot/list-accounts.usecase.js';
import { CurrentPrincipal } from './decorators/principal.decorator.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

/** Every route is scoped to the authenticated principal; the account id in the path is only a filter within it. */
@Controller()
@UseGuards(ApiKeyGuard)
export class AccountsController {
  constructor(
    private readonly listAccounts: ListAccountsUseCase,
    private readonly getSnapshot: GetAccountSnapshotUseCase,
  ) {}

  @Get('me/accounts')
  list(@CurrentPrincipal() principal: Principal) {
    return this.listAccounts.execute(principal);
  }

  @Get('accounts/:accountId/snapshot')
  snapshot(@CurrentPrincipal() principal: Principal, @Param('accountId') accountId: string) {
    return this.getSnapshot.execute(principal, accountId);
  }
}
