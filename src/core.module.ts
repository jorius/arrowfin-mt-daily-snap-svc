import { Module } from '@nestjs/common';
import { AuthenticateApiKeyUseCase } from './application/auth/authenticate-api-key.usecase.js';
import { IssueApiKeyUseCase } from './application/auth/issue-api-key.usecase.js';
import { RevokeApiKeyUseCase } from './application/auth/revoke-api-key.usecase.js';
import { ACCOUNTS_REPOSITORY } from './application/ports/accounts.repository.js';
import { API_KEYS_REPOSITORY } from './application/ports/api-keys.repository.js';
import { CLOCK } from './application/ports/clock.js';
import { FILL_PUBLISHER } from './application/ports/fill-publisher.js';
import { CREDENTIALS_REPOSITORY } from './application/ports/credentials.repository.js';
import { FILLS_REPOSITORY } from './application/ports/fills.repository.js';
import { MARKET_PRICES_REPOSITORY } from './application/ports/market-prices.repository.js';
import { GetAccountSnapshotUseCase } from './application/snapshot/get-account-snapshot.usecase.js';
import { ListAccountsUseCase } from './application/snapshot/list-accounts.usecase.js';
import { AccountsController } from './controllers/accounts.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { ApiKeyGuard } from './controllers/guards/api-key.guard.js';
import { HealthController } from './controllers/health.controller.js';
import { SnapshotGateway } from './controllers/snapshot.gateway.js';
import { ReplayClock } from './infrastructure/clock/replay-clock.js';
import { ENV, loadEnv, type Env } from './infrastructure/config/env.js';
import { PrismaAccountsRepository } from './infrastructure/prisma/prisma-accounts.repository.js';
import { PrismaApiKeysRepository } from './infrastructure/prisma/prisma-api-keys.repository.js';
import { PrismaCredentialsRepository } from './infrastructure/prisma/prisma-credentials.repository.js';
import { PrismaFillsRepository } from './infrastructure/prisma/prisma-fills.repository.js';
import { PrismaMarketPricesRepository } from './infrastructure/prisma/prisma-market-prices.repository.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';
import { ApiKeyService } from './services/api-key.service.js';
import { PnlService } from './services/pnl.service.js';
import { PositionLedgerService } from './services/position-ledger.service.js';
import { RiskService } from './services/risk.service.js';
import { SecretHasherService } from './services/secret-hasher.service.js';
import { SessionClockService } from './services/session-clock.service.js';

@Module({
  exports: [ENV, CLOCK, PrismaService, FILL_PUBLISHER, AuthenticateApiKeyUseCase, ListAccountsUseCase],
  controllers: [HealthController, AuthController, AccountsController],
  providers: [
    { provide: ENV, useFactory: loadEnv },
    { provide: CLOCK, useFactory: (env: Env) => new ReplayClock(env.SNAPSHOT_NOW), inject: [ENV] },
    PrismaService,
    { provide: ACCOUNTS_REPOSITORY, useClass: PrismaAccountsRepository },
    { provide: FILLS_REPOSITORY, useClass: PrismaFillsRepository },
    { provide: MARKET_PRICES_REPOSITORY, useClass: PrismaMarketPricesRepository },
    { provide: CREDENTIALS_REPOSITORY, useClass: PrismaCredentialsRepository },
    { provide: API_KEYS_REPOSITORY, useClass: PrismaApiKeysRepository },
    SessionClockService,
    PositionLedgerService,
    PnlService,
    RiskService,
    SecretHasherService,
    ApiKeyService,
    GetAccountSnapshotUseCase,
    ListAccountsUseCase,
    IssueApiKeyUseCase,
    AuthenticateApiKeyUseCase,
    RevokeApiKeyUseCase,
    ApiKeyGuard,
    SnapshotGateway,
    { provide: FILL_PUBLISHER, useExisting: SnapshotGateway },
  ],
})
export class CoreModule {}
