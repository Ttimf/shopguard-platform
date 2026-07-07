import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientProxy } from '@nestjs/microservices';
import { TRACKING_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';

class TracksQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() cameraId?: string;
  @IsOptional() @IsString() trackingId?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/** Tracking Engine: маршруты людей между камерами. */
@Controller('tracks')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class TracksController {
  constructor(@Inject('EVENT') private readonly event: ClientProxy) {}

  @Get()
  list(@CurrentUser() user: GatewayUser, @Query() q: TracksQueryDto) {
    return rpc(
      this.event.send(TRACKING_PATTERNS.LIST, {
        ownerId: user.id,
        storeId: q.storeId,
        cameraId: q.cameraId,
        trackingId: q.trackingId,
        active: q.active === undefined ? undefined : q.active === 'true',
        from: q.from,
        to: q.to,
        limit: q.limit,
      }),
    );
  }

  @Get(':id')
  get(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.event.send(TRACKING_PATTERNS.GET, { ownerId: user.id, id }),
    );
  }
}
