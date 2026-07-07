import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { makeHealthController } from '@app/common';
import { AuthController } from './auth/auth.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import {
  StoresController,
  CamerasController,
  ModelsController,
} from './cameras/cameras.controller';
import { BlacklistController } from './blacklist/blacklist.controller';
import { S3Service } from './blacklist/s3.service';
import { EventsController } from './events/events.controller';
import { EngineEventsController } from './events/engine-events.controller';
import { TracksController } from './tracking/tracks.controller';
import { BehaviorController } from './behavior/behavior.controller';
import { PurchaseController } from './purchase/purchase.controller';
import { AlertDecisionsController } from './alert/alert.controller';
import { AlertsGateway } from './alerts/alerts.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ClientsModule.register([
      {
        name: 'AUTH',
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      },
      {
        name: 'CAMERA',
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      },
      {
        name: 'NOTIFICATION',
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      },
      {
        name: 'EVENT',
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      },
    ]),
  ],
  controllers: [
    AuthController,
    StoresController,
    CamerasController,
    ModelsController,
    BlacklistController,
    EventsController,
    EngineEventsController,
    TracksController,
    BehaviorController,
    PurchaseController,
    AlertDecisionsController,
    makeHealthController('gateway'),
  ],
  providers: [JwtAuthGuard, S3Service, AlertsGateway],
})
export class AppModule {}
