import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

bootstrapService(AppModule, {
  name: 'notification',
  port: Number(process.env.PORT ?? 3004),
  microservice: true,
});
