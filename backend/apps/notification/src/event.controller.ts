import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import {
  NOTIFICATION_PATTERNS,
  ListEventsDto,
  UpdateEventStatusDto,
} from '@app/contracts';
import { EventService } from './event.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class EventController {
  constructor(private readonly events: EventService) {}

  @MessagePattern(NOTIFICATION_PATTERNS.EVENTS_LIST)
  list(@Payload() dto: ListEventsDto) {
    return this.events.list(dto);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.EVENT_STATUS)
  updateStatus(@Payload() dto: UpdateEventStatusDto) {
    return this.events.updateStatus(dto);
  }
}
