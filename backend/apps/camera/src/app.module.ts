import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, makeHealthController, EventBus } from '@app/common';
import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';
import { StoreService } from './store.service';
import { CryptoService } from './crypto.service';
import { BlacklistService } from './blacklist.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [CameraController, makeHealthController('camera')],
  providers: [
    CameraService,
    StoreService,
    CryptoService,
    BlacklistService,
    EventBus,
  ],
})
export class AppModule {}
