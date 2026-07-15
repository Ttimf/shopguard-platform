import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcHttpExceptionFilter } from '@app/common';
import {
  CAMERA_PATTERNS,
  ConfigListDto,
  CreateBlacklistDto,
  CreateCameraDto,
  CreateStoreDto,
  SetBehaviorDto,
  SetModelDto,
  SetTelegramDto,
  SetZonesDto,
  UpdateCameraDto,
} from '@app/contracts';
import { StoreService } from './store.service';
import { CameraService } from './camera.service';
import { BlacklistService } from './blacklist.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class CameraController {
  constructor(
    private readonly stores: StoreService,
    private readonly cameras: CameraService,
    private readonly blacklist: BlacklistService,
  ) {}

  @MessagePattern(CAMERA_PATTERNS.STORE_CREATE)
  createStore(@Payload() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.STORE_LIST)
  listStores(@Payload() data: { ownerId: string }) {
    return this.stores.list(data.ownerId);
  }

  @MessagePattern(CAMERA_PATTERNS.STORE_SET_TELEGRAM)
  setTelegram(@Payload() dto: SetTelegramDto) {
    return this.stores.setTelegram(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.STORE_SET_MODEL)
  setModel(@Payload() dto: SetModelDto) {
    return this.stores.setModel(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.MODELS_LIST)
  listModels() {
    return this.stores.listModels();
  }

  @MessagePattern(CAMERA_PATTERNS.CREATE)
  createCamera(@Payload() dto: CreateCameraDto) {
    return this.cameras.create(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.LIST)
  listCameras(@Payload() data: { ownerId: string; storeId: string }) {
    return this.cameras.list(data.ownerId, data.storeId);
  }

  @MessagePattern(CAMERA_PATTERNS.LIST_ALL)
  listAllCameras(@Payload() data: { ownerId: string }) {
    return this.cameras.listAll(data.ownerId);
  }

  @MessagePattern(CAMERA_PATTERNS.GET)
  getCamera(@Payload() data: { ownerId: string; cameraId: string }) {
    return this.cameras.get(data.ownerId, data.cameraId);
  }

  @MessagePattern(CAMERA_PATTERNS.UPDATE)
  updateCamera(@Payload() dto: UpdateCameraDto) {
    return this.cameras.update(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.DELETE)
  deleteCamera(@Payload() data: { ownerId: string; cameraId: string }) {
    return this.cameras.remove(data.ownerId, data.cameraId);
  }

  @MessagePattern(CAMERA_PATTERNS.TEST)
  testCamera(@Payload() data: { ownerId: string; cameraId: string }) {
    return this.cameras.testCamera(data.ownerId, data.cameraId);
  }

  @MessagePattern(CAMERA_PATTERNS.SNAPSHOT)
  snapshot(@Payload() data: { ownerId: string; cameraId: string }) {
    return this.cameras.snapshot(data.ownerId, data.cameraId);
  }

  @MessagePattern(CAMERA_PATTERNS.ZONES_SET)
  setZones(@Payload() dto: SetZonesDto) {
    return this.cameras.setZones(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.BEHAVIOR_SET)
  setBehavior(@Payload() dto: SetBehaviorDto) {
    return this.cameras.setBehavior(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.CONFIG_LIST)
  configList(@Payload() data?: ConfigListDto) {
    return this.cameras.configList(data?.workerId);
  }

  @MessagePattern(CAMERA_PATTERNS.BLACKLIST_CREATE)
  createBlacklist(@Payload() dto: CreateBlacklistDto) {
    return this.blacklist.create(dto);
  }

  @MessagePattern(CAMERA_PATTERNS.BLACKLIST_LIST)
  listBlacklist(@Payload() data: { ownerId: string; storeId: string }) {
    return this.blacklist.list(data.ownerId, data.storeId);
  }

  @MessagePattern(CAMERA_PATTERNS.BLACKLIST_DELETE)
  deleteBlacklist(@Payload() data: { ownerId: string; id: string }) {
    return this.blacklist.remove(data.ownerId, data.id);
  }

  @MessagePattern(CAMERA_PATTERNS.BLACKLIST_CONFIG)
  blacklistConfig() {
    return this.blacklist.config();
  }
}
