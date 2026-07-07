import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NOTIFICATION_PATTERNS, EventView } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';
import { S3Service } from '../blacklist/s3.service';
import { UpdateStatusHttpDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class EventsController {
  constructor(
    @Inject('NOTIFICATION') private readonly notification: ClientProxy,
    private readonly s3: S3Service,
  ) {}

  @Get('stores/:storeId/events')
  async list(
    @CurrentUser() user: GatewayUser,
    @Param('storeId') storeId: string,
    @Query('status') status?: string,
  ) {
    const events = await rpc<EventView[]>(
      this.notification.send(NOTIFICATION_PATTERNS.EVENTS_LIST, {
        ownerId: user.id,
        storeId,
        status,
      }),
    );
    return Promise.all(events.map((e) => this.withUrls(e)));
  }

  @Patch('events/:id/status')
  async updateStatus(
    @CurrentUser() user: GatewayUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusHttpDto,
  ) {
    const event = await rpc<EventView>(
      this.notification.send(NOTIFICATION_PATTERNS.EVENT_STATUS, {
        ownerId: user.id,
        eventId: id,
        status: dto.status,
      }),
    );
    return this.withUrls(event);
  }

  /** Добавляет временные ссылки на снимок/клип. */
  private async withUrls(e: EventView) {
    return {
      ...e,
      snapshotUrl: e.snapshotKey ? await this.s3.presign(e.snapshotKey) : null,
      clipUrl: e.clipKey ? await this.s3.presign(e.clipKey) : null,
    };
  }
}
