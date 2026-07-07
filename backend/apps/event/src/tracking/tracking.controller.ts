import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import { TRACKING_PATTERNS, ListTracksDto } from '@app/contracts';
import { TrackingService } from './tracking.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @MessagePattern(TRACKING_PATTERNS.LIST)
  list(@Payload() dto: ListTracksDto) {
    return this.tracking.list(dto);
  }

  @MessagePattern(TRACKING_PATTERNS.GET)
  get(@Payload() data: { ownerId: string; id: string }) {
    return this.tracking.get(data.ownerId, data.id);
  }
}
