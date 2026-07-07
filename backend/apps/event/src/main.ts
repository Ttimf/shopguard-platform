import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

bootstrapService(AppModule, {
  name: 'event',
  port: Number(process.env.PORT ?? 3006),
  microservice: true,
});
