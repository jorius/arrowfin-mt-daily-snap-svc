import type { GetAccountSnapshotUseCase } from '../application/snapshot/get-account-snapshot.usecase.js';
import type { ListAccountsUseCase } from '../application/snapshot/list-accounts.usecase.js';
import { AccountsController } from './accounts.controller.js';

const principal = { traderId: 'T-005', brokerId: 'BRK-SMPT', apiKeyId: 'k1' };

describe('AccountsController', () => {
  it('passes the principal, never a client-supplied tenant, to the use cases', async () => {
    const listAccounts = { execute: vi.fn(async () => ({ accounts: [] })) };
    const getSnapshot = { execute: vi.fn(async () => ({ ok: true })) };
    const controller = new AccountsController(
      listAccounts as unknown as ListAccountsUseCase,
      getSnapshot as unknown as GetAccountSnapshotUseCase,
    );
    await controller.list(principal);
    await controller.snapshot(principal, 'ACC-1006');
    expect(listAccounts.execute).toHaveBeenCalledWith(principal);
    expect(getSnapshot.execute).toHaveBeenCalledWith(principal, 'ACC-1006');
  });
});
