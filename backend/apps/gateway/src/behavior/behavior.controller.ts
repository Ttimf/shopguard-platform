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
import { BEHAVIOR_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';

class BehaviorQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() behaviorType?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  minRiskScore?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  maxRiskScore?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  limit?: number;
}

/** Behavior Engine: сессии поведения покупателей. */
@Controller('behavior')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class BehaviorController {
  constructor(@Inject('EVENT') private readonly event: ClientProxy) {}

  @Get()
  list(@CurrentUser() user: GatewayUser, @Query() q: BehaviorQueryDto) {
    return rpc(
      this.event.send(BEHAVIOR_PATTERNS.LIST, {
        ownerId: user.id,
        storeId: q.storeId,
        behaviorType: q.behaviorType,
        minRiskScore: q.minRiskScore,
        maxRiskScore: q.maxRiskScore,
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
      this.event.send(BEHAVIOR_PATTERNS.GET, { ownerId: user.id, id }),
    );
  }
}
