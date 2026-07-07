import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, makeHealthController } from '@app/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { StreamConsumer } from './stream.consumer';
import { TelegramSender } from './telegram.sender';
import { SnapshotStore } from './snapshot.store';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [EventController, makeHealthController('notification')],
  providers: [EventService, StreamConsumer, TelegramSender, SnapshotStore],
})
export class AppModule {}
