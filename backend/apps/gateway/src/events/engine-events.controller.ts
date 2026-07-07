import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientProxy } from '@nestjs/microservices';
import { EVENT_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';

class EventsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() cameraId?: string;
  @IsOptional() @IsString() eventType?: string;
  @IsOptional() @IsString() modelVersion?: string;
  @IsOptional() @IsString() from?: string; // ISO
  @IsOptional() @IsString() to?: string; // ISO

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/** Event Engine: обобщённый лог событий (отдельно от алертов). */
@Controller('events')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class EngineEventsController {
  constructor(@Inject('EVENT') private readonly event: ClientProxy) {}

  @Get()
  list(@CurrentUser() user: GatewayUser, @Query() q: EventsQueryDto) {
    return rpc(
      this.event.send(EVENT_PATTERNS.LIST, { ownerId: user.id, ...q }),
    );
  }

  @Get(':id')
  get(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.event.send(EVENT_PATTERNS.GET, { ownerId: user.id, id }),
    );
  }
}
