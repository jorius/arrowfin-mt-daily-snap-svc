import type { TenantContext } from '../tenant-context.js';

export const FILLS_REPOSITORY = Symbol('FILLS_REPOSITORY');

export interface FillRecord {
  id: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  filledAt: Date;
  commissionUsd: number;
}

export interface FillsRepository {
  /** All fills of one account of the context's broker up to `upTo`, ordered by filledAt then id. */
  listForAccountUpTo(ctx: TenantContext, accountId: string, upTo: Date): Promise<FillRecord[]>;
}
