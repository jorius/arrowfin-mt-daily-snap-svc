import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountsResponse } from '../application/dto/accounts.response.js';
import { ErrorResponse } from '../application/dto/error.response.js';
import type { SnapshotDto } from '../application/dto/snapshot.dto.js';
import { SnapshotResponse } from '../application/dto/snapshot.response.js';
import type { Principal } from '../application/principal.js';
import { GetAccountSnapshotUseCase } from '../application/snapshot/get-account-snapshot.usecase.js';
import { ListAccountsUseCase } from '../application/snapshot/list-accounts.usecase.js';
import { CurrentPrincipal } from './decorators/principal.decorator.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

/** Every route is scoped to the authenticated principal; the account id in the path is only a filter within it. */
@ApiTags('Accounts')
@ApiBearerAuth('api-key')
@Controller()
@UseGuards(ApiKeyGuard)
export class AccountsController {
  constructor(
    private readonly listAccounts: ListAccountsUseCase,
    private readonly getSnapshot: GetAccountSnapshotUseCase,
  ) {}

  @Get('me/accounts')
  @ApiOperation({ summary: "List the caller's accounts inside their tenant." })
  @ApiOkResponse({ type: AccountsResponse })
  @ApiUnauthorizedResponse({ type: ErrorResponse })
  list(@CurrentPrincipal() principal: Principal): Promise<AccountsResponse> {
    return this.listAccounts.execute(principal);
  }

  @Get('accounts/:accountId/snapshot')
  @ApiOperation({
    summary: "Daily snapshot for one of the caller's accounts.",
    description:
      'Open positions (average-cost replay of every fill), realized and unrealized P&L for the Globex session that contains the server clock, and the risk score. ' +
      'The account id in the path is only a filter within the authenticated principal: the query is keyed on (id, broker_id, trader_id) from the API key. ' +
      'An account that belongs to another trader or another tenant returns 404, the same as a non-existent id, so ids cannot be enumerated.',
  })
  @ApiParam({ name: 'accountId', example: 'ACC-1006' })
  @ApiOkResponse({ type: SnapshotResponse })
  @ApiUnauthorizedResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "Not the caller's account (foreign trader, foreign tenant, or non-existent)." })
  snapshot(@CurrentPrincipal() principal: Principal, @Param('accountId') accountId: string): Promise<SnapshotDto> {
    return this.getSnapshot.execute(principal, accountId);
  }
}
