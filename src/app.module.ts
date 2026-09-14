import { Module } from '@nestjs/common';
import { CLOCK } from './application/ports/clock.js';
import { HealthController } from './controllers/health.controller.js';
import { ReplayClock } from './infrastructure/clock/replay-clock.js';
import { ENV, loadEnv, type Env } from './infrastructure/config/env.js';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [
    { provide: ENV, useFactory: loadEnv },
    { provide: CLOCK, useFactory: (env: Env) => new ReplayClock(env.SNAPSHOT_NOW), inject: [ENV] },
  ],
})
export class AppModule {}
