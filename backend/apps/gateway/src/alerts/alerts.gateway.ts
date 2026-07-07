import {
  Inject,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { ALERTS_CHANNEL, CAMERA_PATTERNS, StoreView } from '@app/contracts';

interface ClientInfo {
  userId: string;
  storeIds: Set<string>;
}

/**
 * WebSocket-раздача живых тревог (путь /ws/alerts).
 * Клиент подключается с ?token=<access>, затем шлёт {event:'subscribe',data:{storeId}}.
 * Тревоги приходят из Redis-канала ALERTS_CHANNEL (публикует notification-service).
 */
@WebSocketGateway({ path: '/ws/alerts' })
export class AlertsGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private sub!: Redis;
  private readonly clients = new Map<WebSocket, ClientInfo>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject('CAMERA') private readonly camera: ClientProxy,
  ) {}

  onModuleInit() {
    this.sub = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    this.sub.subscribe(ALERTS_CHANNEL);
    this.sub.on('message', (_channel, message) => this.broadcast(message));
  }

  onModuleDestroy() {
    this.sub?.disconnect();
  }

  async handleConnection(client: WebSocket, req: IncomingMessage) {
    const token = new URL(req.url ?? '', 'http://localhost').searchParams.get(
      'token',
    );
    try {
      const payload = await this.jwt.verifyAsync(token ?? '', {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      this.clients.set(client, { userId: payload.sub, storeIds: new Set() });
    } catch {
      client.close(4001, 'unauthorized');
    }
  }

  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: { storeId: string },
  ) {
    const info = this.clients.get(client);
    if (!info || !data?.storeId) return;
    const stores = await firstValueFrom(
      this.camera.send<StoreView[]>(CAMERA_PATTERNS.STORE_LIST, {
        ownerId: info.userId,
      }),
    );
    if (stores.some((s) => s.id === data.storeId)) {
      info.storeIds.add(data.storeId);
      this.emit(client, 'subscribed', { storeId: data.storeId });
    } else {
      this.emit(client, 'error', { message: 'Нет доступа к магазину' });
    }
  }

  private broadcast(message: string) {
    let payload: { storeId: string; event: unknown };
    try {
      payload = JSON.parse(message);
    } catch {
      return;
    }
    for (const [client, info] of this.clients) {
      if (info.storeIds.has(payload.storeId) && client.readyState === client.OPEN) {
        this.emit(client, 'alert', payload.event);
      }
    }
  }

  private emit(client: WebSocket, event: string, data: unknown) {
    client.send(JSON.stringify({ event, data }));
  }
}
