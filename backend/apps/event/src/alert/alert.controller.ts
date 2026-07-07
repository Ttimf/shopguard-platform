import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import { ALERT_PATTERNS, ListAlertsDto } from '@app/contracts';
import { AlertService } from './alert.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class AlertController {
  constructor(private readonly alerts: AlertService) {}

  @MessagePattern(ALERT_PATTERNS.LIST)
  list(@Payload() dto: ListAlertsDto) {
    return this.alerts.list(dto);
  }

  @MessagePattern(ALERT_PATTERNS.GET)
  get(@Payload() data: { ownerId: string; id: string }) {
    return this.alerts.get(data.ownerId, data.id);
  }
}
