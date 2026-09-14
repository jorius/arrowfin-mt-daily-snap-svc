import { Module } from '@nestjs/common';
import { DevFillsModule } from './controllers/dev/dev-fills.module.js';
import { CoreModule } from './core.module.js';
import { loadEnv } from './infrastructure/config/env.js';

const env = loadEnv();

@Module({
  // The dev simulator is a module that is simply not registered outside development.
  imports: [CoreModule, ...(env.DEV_FILLS_ENABLED ? [DevFillsModule] : [])],
})
export class AppModule {}
