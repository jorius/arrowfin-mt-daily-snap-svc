import { Logger, Module } from '@nestjs/common';
import { SimulateFillUseCase } from '../../application/dev/simulate-fill.usecase.js';
import { DEV_FILLS_REPOSITORY } from '../../application/ports/dev-fills.repository.js';
import { CoreModule } from '../../core.module.js';
import { PrismaDevFillsRepository } from '../../infrastructure/prisma/prisma-dev-fills.repository.js';
import { DevFillsController } from './dev-fills.controller.js';

/**
 * Registered by AppModule only when DEV_FILLS_ENABLED=true and NODE_ENV is not
 * production (see infrastructure/config/env.ts). Otherwise POST /dev/fills does
 * not exist: there is no guard to misconfigure.
 */
@Module({
  imports: [CoreModule],
  controllers: [DevFillsController],
  providers: [SimulateFillUseCase, { provide: DEV_FILLS_REPOSITORY, useClass: PrismaDevFillsRepository }],
})
export class DevFillsModule {
  constructor() {
    new Logger(DevFillsModule.name).warn('POST /dev/fills is registered (development only)');
  }
}
