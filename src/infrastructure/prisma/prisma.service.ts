import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import type { TenantContext } from '../../application/tenant-context.js';
import { ENV, type Env } from '../config/env.js';
import { PrismaClient, type Prisma } from './generated/client.js';

export type TenantTx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `fn` in a transaction as the non-superuser role `arrowfin_tenant` with
   * `app.broker_id` set, so Postgres row-level security (migration
   * row_level_security) hides every other tenant's rows even if a query inside
   * forgets its `WHERE broker_id = ?`. Requires the connection role to be able
   * to `SET ROLE arrowfin_tenant` (a superuser or a member of the role).
   */
  forTenant<T>(ctx: TenantContext, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE arrowfin_tenant');
      await tx.$queryRaw`SELECT set_config('app.broker_id', ${ctx.brokerId}, true)`;
      return fn(tx);
    });
  }
}
