import { WsAdapter } from '@nestjs/platform-ws';
import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';

// API Gateway: единая точка входа (REST + WebSocket /ws/alerts).
bootstrapService(AppModule, {
  name: 'gateway',
  port: Number(process.env.PORT ?? 8080),
  configure: (app) => {
    app.useWebSocketAdapter(new WsAdapter(app));
  },
});
