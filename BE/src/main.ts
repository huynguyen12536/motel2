import { MasterPrismaService } from "./infrastructure/database/master/master-prisma.service.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import type { Type } from "@nestjs/common";
import { SafeExceptionFilter } from "./saas/safe-exception.filter.js";
import { createApp } from "./infrastructure/http/app.js";
import { env } from "./config/env.js";
import { logger } from "../logger/index.js";
import { notFoundHandler, errorHandler } from "./infrastructure/http/middleware/error-handler.js";
export async function createApplication(rootModule: Type = AppModule) {
  const express = createApp({ nest: true, pingDatabase: () => master.ping() });
  const app = await NestFactory.create(rootModule, new ExpressAdapter(express), {
    bodyParser: false,
    logger: {
      log: (message: unknown) => logger.info({ context: "Nest" }, String(message)),
      error: () => logger.error({ context: "Nest" }, "Nest application error"),
      warn: (message: unknown) => logger.warn({ context: "Nest" }, String(message)),
    },
  });
  const master = app.get(MasterPrismaService);
  app.setGlobalPrefix(env.API_PREFIX);
  app.useGlobalFilters(new SafeExceptionFilter());
  if (env.SWAGGER_ENABLED) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(env.APP_NAME)
        .setVersion("1.0")
        .setDescription(
          "Multi-tenant API: guarded provisioning, tenant sessions and isolated database routing. Live provisioning is disabled by default.",
        )
        .addBearerAuth()
        .addApiKey({ type: "apiKey", in: "header", name: "X-Platform-Admin-Key" }, "platform-admin")
        .build(),
    );
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }
  app.enableShutdownHooks();
  await app.init();
  express.use(notFoundHandler);
  express.use(errorHandler);
  return app;
}
export async function bootstrap() {
  const app = await createApplication();
  await app.listen(env.APP_PORT ?? env.PORT, "0.0.0.0");
  return app;
}
