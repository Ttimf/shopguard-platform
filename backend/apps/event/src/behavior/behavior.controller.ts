import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import { BEHAVIOR_PATTERNS, ListBehaviorDto } from '@app/contracts';
import { BehaviorService } from './behavior.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class BehaviorController {
  constructor(private readonly behavior: BehaviorService) {}

  @MessagePattern(BEHAVIOR_PATTERNS.LIST)
  list(@Payload() dto: ListBehaviorDto) {
    return this.behavior.list(dto);
  }

  @MessagePattern(BEHAVIOR_PATTERNS.GET)
  get(@Payload() data: { ownerId: string; id: string }) {
    return this.behavior.get(data.ownerId, data.id);
  }
}
