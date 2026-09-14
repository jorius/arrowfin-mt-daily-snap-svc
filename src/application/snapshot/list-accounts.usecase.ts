import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTS_REPOSITORY, type AccountSummary, type AccountsRepository } from '../ports/accounts.repository.js';
import type { TenantContext } from '../tenant-context.js';

@Injectable()
export class ListAccountsUseCase {
  constructor(@Inject(ACCOUNTS_REPOSITORY) private readonly accounts: AccountsRepository) {}

  async execute(ctx: TenantContext): Promise<{ accounts: AccountSummary[] }> {
    return { accounts: await this.accounts.listForTrader(ctx) };
  }
}
