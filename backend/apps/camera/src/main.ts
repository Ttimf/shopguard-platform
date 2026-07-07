import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

bootstrapService(AppModule, {
  name: 'camera',
  port: Number(process.env.PORT ?? 3003),
  microservice: true,
});
