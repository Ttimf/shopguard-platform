import { Controller, Get } from '@nestjs/common';

/** Health-check для каждого сервиса (Docker/K8s). */
export function makeHealthController(serviceName: string) {
  @Controller('health')
  class HealthController {
    @Get()
    check() {
      return {
        service: serviceName,
        status: 'ok',
        time: new Date().toISOString(),
      };
    }
  }
  return HealthController;
}
