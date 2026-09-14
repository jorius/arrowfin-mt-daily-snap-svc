import type { FillRecord } from './fills.repository.js';

export const DEV_FILLS_REPOSITORY = Symbol('DEV_FILLS_REPOSITORY');

export interface NewFill {
  id: string;
  accountId: string;
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  filledAt: Date;
  orderId: string;
  liquidity: 'maker' | 'taker';
  commissionUsd: number;
}

/**
 * Development-only port. `findAccountTenant` is the single unscoped read in the
 * codebase: the simulator has no principal, so it resolves the tenant FROM the
 * account row and never from the request. Registered only by DevFillsModule.
 */
export interface DevFillsRepository {
  findAccountTenant(accountId: string): Promise<{ brokerId: string } | null>;
  instrumentExists(symbol: string): Promise<boolean>;
  insert(fill: NewFill): Promise<FillRecord>;
}
