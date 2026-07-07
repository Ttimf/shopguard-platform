import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import { CAMERA_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  GatewayUser,
} from '../auth/jwt-auth.guard';
import { S3Service } from './s3.service';

const ALLOWED = ['image/jpeg', 'image/png'];

@Controller()
@UseGuards(JwtAuthGuard)
@Roles('OWNER')
export class BlacklistController {
  constructor(
    @Inject('CAMERA') private readonly camera: ClientProxy,
    private readonly s3: S3Service,
  ) {}

  @Post('stores/:storeId/blacklist')
  @UseInterceptors(FileInterceptor('photo'))
  async create(
    @CurrentUser() user: GatewayUser,
    @Param('storeId') storeId: string,
    @Body('name') name: string,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Укажите имя');
    }
    if (!photo || !ALLOWED.includes(photo.mimetype)) {
      throw new BadRequestException('Нужно фото JPEG или PNG');
    }
    const photoKey = await this.s3.uploadPhoto(
      storeId,
      photo.buffer,
      photo.mimetype,
    );
    return rpc(
      this.camera.send(CAMERA_PATTERNS.BLACKLIST_CREATE, {
        ownerId: user.id,
        storeId,
        name: name.trim(),
        photoKey,
      }),
    );
  }

  @Get('stores/:storeId/blacklist')
  list(@CurrentUser() user: GatewayUser, @Param('storeId') storeId: string) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.BLACKLIST_LIST, {
        ownerId: user.id,
        storeId,
      }),
    );
  }

  @Delete('blacklist/:id')
  remove(@CurrentUser() user: GatewayUser, @Param('id') id: string) {
    return rpc(
      this.camera.send(CAMERA_PATTERNS.BLACKLIST_DELETE, {
        ownerId: user.id,
        id,
      }),
    );
  }
}
