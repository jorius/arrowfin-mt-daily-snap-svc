import type { TenantContext } from './tenant-context.js';

/** The authenticated caller, resolved from an API-key row and nothing else. */
export interface Principal extends TenantContext {
  readonly apiKeyId: string;
}
