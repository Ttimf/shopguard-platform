import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import { EVENT_PATTERNS, ListEngineEventsDto } from '@app/contracts';
import { EventStore } from './event.store';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class EventController {
  constructor(private readonly store: EventStore) {}

  @MessagePattern(EVENT_PATTERNS.LIST)
  list(@Payload() dto: ListEngineEventsDto) {
    return this.store.list(dto);
  }

  @MessagePattern(EVENT_PATTERNS.GET)
  get(@Payload() data: { ownerId: string; id: string }) {
    return this.store.get(data.ownerId, data.id);
  }
}
