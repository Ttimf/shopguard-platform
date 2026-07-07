import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

bootstrapService(AppModule, {
  name: 'auth',
  port: Number(process.env.PORT ?? 3001),
  microservice: true,
});
