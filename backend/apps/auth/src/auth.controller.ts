import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  RegisterDto,
  LoginDto,
} from '@app/contracts';
import { RpcHttpExceptionFilter } from '@app/common';
import { AuthService } from './auth.service';

@Controller()
@UseFilters(new RpcHttpExceptionFilter())
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() data: { refreshToken: string }) {
    return this.auth.refresh(data.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() data: { refreshToken: string }) {
    return this.auth.logout(data.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.ME)
  me(@Payload() data: { userId: string }) {
    return this.auth.me(data.userId);
  }
}
