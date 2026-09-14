import 'dotenv/config';
import { createRequire } from 'node:module';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ENV, type Env } from './infrastructure/config/env.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);
  app.enableCors({ origin: env.CORS_ORIGIN });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  // Same kill-switch pattern as the dev fills module: never in production, whatever the flag says.
  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('ArrowFin Trader Daily Snapshot API')
      .setVersion(version)
      .setDescription(
        "Open positions, day P&L and a risk score for a trader's account, plus a tenant-scoped fill stream over Socket.IO. " +
          'broker_id is the tenant key: every route is scoped to the authenticated trader and their tenant, and an account id in a path is only a filter inside that scope.',
      )
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'afk_<opaque>' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
  }

  await app.listen(env.PORT);
}
await bootstrap();
