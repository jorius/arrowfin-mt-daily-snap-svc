import type { TenantContext } from '../tenant-context.js';

export const ACCOUNTS_REPOSITORY = Symbol('ACCOUNTS_REPOSITORY');

export interface AccountSummary {
  id: string;
  accountNumber: string;
  accountType: string;
  status: string;
}

export interface AccountRecord extends AccountSummary {
  balance: number;
}

export interface AccountsRepository {
  listForTrader(ctx: TenantContext): Promise<AccountSummary[]>;
  /** Only returns the account when it belongs to the context's broker AND trader. */
  findOwned(ctx: TenantContext, accountId: string): Promise<AccountRecord | null>;
}
