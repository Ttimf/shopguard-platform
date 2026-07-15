import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import {
  WORKER_PATTERNS,
  RegisterWorkerDto,
  WorkerHeartbeatDto,
} from '@app/contracts';
import { WorkerManagerService } from './worker-manager.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class WorkerController {
  constructor(private readonly workers: WorkerManagerService) {}

  @MessagePattern(WORKER_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterWorkerDto) {
    return this.workers.register(dto);
  }

  @MessagePattern(WORKER_PATTERNS.HEARTBEAT)
  heartbeat(@Payload() dto: WorkerHeartbeatDto) {
    return this.workers.heartbeat(dto);
  }
}
