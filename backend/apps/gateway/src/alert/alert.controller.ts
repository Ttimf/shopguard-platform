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
import { ALERT_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';

class AlertsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() alertType?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  limit?: number;
}

/** Alert Engine: финальные тревоги (решения). */
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class AlertDecisionsController {
  constructor(@Inject('EVENT') private readonly event: ClientProxy) {}

  @Get()
  list(@CurrentUser() user: GatewayUser, @Query() q: AlertsQueryDto) {
    return rpc(
      this.event.send(ALERT_PATTERNS.LIST, { ownerId: user.id, ...q }),
    );
  }

  @Get(':id')
  get(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.event.send(ALERT_PATTERNS.GET, { ownerId: user.id, id }),
    );
  }
}
