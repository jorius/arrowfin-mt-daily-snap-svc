export const CREDENTIALS_REPOSITORY = Symbol('CREDENTIALS_REPOSITORY');

export interface CredentialRecord {
  traderId: string;
  brokerId: string;
  secretHash: string;
  kycStatus: 'verified' | 'pending' | 'suspended';
  portalName: string;
}

/** Pre-authentication lookup: there is no tenant yet, so this port has no TenantContext. */
export interface CredentialsRepository {
  findByTraderId(traderId: string): Promise<CredentialRecord | null>;
}
