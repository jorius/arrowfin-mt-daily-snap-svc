/** Every tenant-bearing data access names the tenant explicitly through this object. */
export interface TenantContext {
  readonly brokerId: string;
  readonly traderId: string;
}
