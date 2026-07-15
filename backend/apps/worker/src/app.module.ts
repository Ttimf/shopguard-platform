import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, makeHealthController } from '@app/common';
import { WorkerController } from './worker.controller';
import { WorkerManagerService } from './worker-manager.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [WorkerController, makeHealthController('worker')],
  providers: [WorkerManagerService],
})
export class AppModule {}
