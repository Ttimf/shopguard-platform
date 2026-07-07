import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

bootstrapService(AppModule, {
  name: 'user',
  port: Number(process.env.PORT ?? 3002),
  microservice: true,
});
