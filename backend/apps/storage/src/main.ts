import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

bootstrapService(AppModule, {
  name: 'storage',
  port: Number(process.env.PORT ?? 3005),
  microservice: true,
});
