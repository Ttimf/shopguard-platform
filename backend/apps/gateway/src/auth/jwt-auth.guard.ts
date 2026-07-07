import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface GatewayUser {
  id: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext): GatewayUser =>
    ctx.switchToHttp().getRequest().user,
);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Проверяет access-токен локально (gateway знает секрет). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Требуется авторизация');
    }
    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7), {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('Токен недействителен');
    }
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return true;
  }
}
