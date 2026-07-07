import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

interface BootstrapOptions {
  name: string;
  port: number;
  /** Подключать ли Redis-микросервис (для сервисов, кроме gateway). */
  microservice?: boolean;
  /** Донастройка приложения перед listen (например, WebSocket-адаптер). */
  configure?: (app: INestApplication) => void | Promise<void>;
}

/**
 * Единый запуск сервиса: HTTP (health) + опционально Redis-микросервис.
 * Убирает дублирование main.ts по сервисам.
 */
export async function bootstrapService(
  AppModule: any,
  opts: BootstrapOptions,
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  if (opts.microservice) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.REDIS,
      options: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    });
    await app.startAllMicroservices();
  }

  if (opts.configure) await opts.configure(app);

  await app.listen(opts.port, '0.0.0.0');
  new Logger(opts.name).log(`${opts.name} запущен на порту ${opts.port}`);
  return app;
}
