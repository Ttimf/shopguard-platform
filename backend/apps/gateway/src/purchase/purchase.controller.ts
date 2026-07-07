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
import { PURCHASE_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';

class PurchaseQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() checkoutId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  minConfidence?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  maxConfidence?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  limit?: number;
}

/** Purchase Matching Engine: сопоставления AI ↔ чек. */
@Controller('purchases')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class PurchaseController {
  constructor(@Inject('EVENT') private readonly event: ClientProxy) {}

  @Get()
  list(@CurrentUser() user: GatewayUser, @Query() q: PurchaseQueryDto) {
    return rpc(
      this.event.send(PURCHASE_PATTERNS.LIST, { ownerId: user.id, ...q }),
    );
  }

  @Get(':id')
  get(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.event.send(PURCHASE_PATTERNS.GET, { ownerId: user.id, id }),
    );
  }
}
