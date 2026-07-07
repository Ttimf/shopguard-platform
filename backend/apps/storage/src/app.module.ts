import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { makeHealthController } from '@app/common';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [makeHealthController('storage')],
})
export class AppModule {}
