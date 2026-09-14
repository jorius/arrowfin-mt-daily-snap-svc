import { Injectable } from '@nestjs/common';
import type { ApiKeyRecord, ApiKeysRepository } from '../../application/ports/api-keys.repository.js';
import type { TenantContext } from '../../application/tenant-context.js';
import { PrismaService } from './prisma.service.js';

const RECORD = { id: true, traderId: true, brokerId: true, expiresAt: true, revokedAt: true } as const;

@Injectable()
export class PrismaApiKeysRepository implements ApiKeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: { traderId: string; brokerId: string; keyHash: string; keyPrefix: string; expiresAt: Date }): Promise<ApiKeyRecord> {
    return this.prisma.apiKey.create({ data: input, select: RECORD });
  }

  findActiveByHash(keyHash: string, now: Date): Promise<ApiKeyRecord | null> {
    return this.prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null, expiresAt: { gt: now } },
      select: RECORD,
    });
  }

  /** Tenant-scoped in the WHERE and by row-level security. */
  async revoke(ctx: TenantContext, apiKeyId: string, at: Date): Promise<void> {
    await this.prisma.forTenant(ctx, (tx) =>
      tx.apiKey.updateMany({
        where: { id: apiKeyId, brokerId: ctx.brokerId, traderId: ctx.traderId, revokedAt: null },
        data: { revokedAt: at },
      }),
    );
  }

  async touch(apiKeyId: string, at: Date): Promise<void> {
    await this.prisma.apiKey.update({ where: { id: apiKeyId }, data: { lastUsedAt: at } });
  }
}
