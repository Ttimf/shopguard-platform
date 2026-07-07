import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@app/common';
import {
  RegisterDto,
  LoginDto,
  AuthResult,
  AuthUser,
} from '@app/contracts';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email уже зарегистрирован');
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name ?? null,
        role: 'OWNER', // первый вход — владелец; охранников создаёт владелец
      },
    });
    return this.result(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    if (user.isBlocked) throw new ForbiddenException('Пользователь заблокирован');
    return this.result(user);
  }

  refresh(refreshToken: string) {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string) {
    await this.tokens.revoke(refreshToken);
    return { message: 'Выход выполнен' };
  }

  async me(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthUser['role'],
    };
  }

  private async result(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  }): Promise<AuthResult> {
    const pair = await this.tokens.issue(user.id, user.role);
    return {
      ...pair,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as AuthUser['role'],
      },
    };
  }
}
