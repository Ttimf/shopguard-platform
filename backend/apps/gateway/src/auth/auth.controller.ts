import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@app/contracts';
import { rpc } from '../rpc.util';
import { RegisterHttpDto, LoginHttpDto, RefreshHttpDto } from './dto';
import { JwtAuthGuard, CurrentUser, GatewayUser } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject('AUTH') private readonly auth: ClientProxy) {}

  @Post('register')
  register(@Body() dto: RegisterHttpDto) {
    return rpc(this.auth.send(AUTH_PATTERNS.REGISTER, dto));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginHttpDto) {
    return rpc(this.auth.send(AUTH_PATTERNS.LOGIN, dto));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshHttpDto) {
    return rpc(this.auth.send(AUTH_PATTERNS.REFRESH, dto));
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshHttpDto) {
    return rpc(this.auth.send(AUTH_PATTERNS.LOGOUT, dto));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: GatewayUser) {
    return rpc(this.auth.send(AUTH_PATTERNS.ME, { userId: user.id }));
  }
}
