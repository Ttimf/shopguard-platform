import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

// WorkerManager: приём регистрации и heartbeat от ai-detection-узлов (Redis).
bootstrapService(AppModule, {
  name: 'worker',
  port: Number(process.env.PORT ?? 3007),
  microservice: true,
});
