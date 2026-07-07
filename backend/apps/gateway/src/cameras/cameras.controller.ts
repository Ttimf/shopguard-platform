import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import { CAMERA_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';
import {
  CreateCameraHttpDto,
  CreateCameraBodyDto,
  CreateStoreHttpDto,
  SetBehaviorHttpDto,
  SetModelHttpDto,
  SetTelegramHttpDto,
  SetZonesHttpDto,
  UpdateCameraHttpDto,
} from './dto';

@Controller('models')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class ModelsController {
  constructor(@Inject('CAMERA') private readonly camera: ClientProxy) {}

  @Get()
  list() {
    return rpc(this.camera.send(CAMERA_PATTERNS.MODELS_LIST, {}));
  }
}

@Controller('stores')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class StoresController {
  constructor(@Inject('CAMERA') private readonly camera: ClientProxy) {}

  @Post()
  create(@CurrentUser() user: GatewayUser, @Body() dto: CreateStoreHttpDto) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.STORE_CREATE, {
        ownerId: user.id,
        ...dto,
      }),
    );
  }

  @Get()
  list(@CurrentUser() user: GatewayUser) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.STORE_LIST, { ownerId: user.id }),
    );
  }

  @Patch(':storeId/telegram')
  setTelegram(
    @CurrentUser() user: GatewayUser,
    @Param('storeId') storeId: string,
    @Body() dto: SetTelegramHttpDto,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.STORE_SET_TELEGRAM, {
        ownerId: user.id,
        storeId,
        chatId: dto.chatId ?? null,
      }),
    );
  }

  @Patch(':storeId/model')
  setModel(
    @CurrentUser() user: GatewayUser,
    @Param('storeId') storeId: string,
    @Body() dto: SetModelHttpDto,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.STORE_SET_MODEL, {
        ownerId: user.id,
        storeId,
        model: dto.model || null,
      }),
    );
  }

  @Post(':storeId/cameras')
  createCamera(
    @CurrentUser() user: GatewayUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateCameraHttpDto,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.CREATE, {
        ownerId: user.id,
        storeId,
        ...dto,
      }),
    );
  }

  @Get(':storeId/cameras')
  listCameras(
    @CurrentUser() user: GatewayUser,
    @Param('storeId') storeId: string,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.LIST, { ownerId: user.id, storeId }),
    );
  }
}

@Controller('cameras')
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class CamerasController {
  constructor(@Inject('CAMERA') private readonly camera: ClientProxy) {}

  @Get()
  listAll(@CurrentUser() user: GatewayUser) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.LIST_ALL, { ownerId: user.id }),
    );
  }

  @Post()
  create(@CurrentUser() user: GatewayUser, @Body() dto: CreateCameraBodyDto) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.CREATE, { ownerId: user.id, ...dto }),
    );
  }

  @Get(':id')
  get(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.GET, {
        ownerId: user.id,
        cameraId: id,
      }),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: GatewayUser,
    @Param('id') id: string,
    @Body() dto: UpdateCameraHttpDto,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.UPDATE, {
        ownerId: user.id,
        cameraId: id,
        ...dto,
      }),
    );
  }

  @Post(':id/test')
  test(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.TEST, {
        ownerId: user.id,
        cameraId: id,
      }),
    );
  }

  @Get(':id/snapshot')
  async snapshot(
    @CurrentUser() user: GatewayUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { image } = await rpc<{ image: string }>(
      this.camera.send(CAMERA_PATTERNS.SNAPSHOT, {
        ownerId: user.id,
        cameraId: id,
      }),
    );
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(Buffer.from(image, 'base64'));
  }

  @Delete(':id')
  remove(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.DELETE, {
        ownerId: user.id,
        cameraId: id,
      }),
    );
  }

  @Put(':id/zones')
  setZones(
    @CurrentUser() user: GatewayUser,
    @Param('id') id: string,
    @Body() dto: SetZonesHttpDto,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.ZONES_SET, {
        ownerId: user.id,
        cameraId: id,
        zones: dto.zones,
      }),
    );
  }

  @Put(':id/behavior')
  setBehavior(
    @CurrentUser() user: GatewayUser,
    @Param('id') id: string,
    @Body() dto: SetBehaviorHttpDto,
  ) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.BEHAVIOR_SET, {
        ownerId: user.id,
        cameraId: id,
        ...dto,
      }),
    );
  }
}
