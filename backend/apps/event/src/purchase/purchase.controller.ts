import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import { PURCHASE_PATTERNS, ListPurchasesDto } from '@app/contracts';
import { PurchaseService } from './purchase.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class PurchaseController {
  constructor(private readonly purchase: PurchaseService) {}

  @MessagePattern(PURCHASE_PATTERNS.LIST)
  list(@Payload() dto: ListPurchasesDto) {
    return this.purchase.list(dto);
  }

  @MessagePattern(PURCHASE_PATTERNS.GET)
  get(@Payload() data: { ownerId: string; id: string }) {
    return this.purchase.get(data.ownerId, data.id);
  }
}
