import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: any;
  let tokens: any;
  let auth: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    tokens = {
      issue: jest
        .fn()
        .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    };
    auth = new AuthService(prisma, tokens);
  });

  it('register: дубль email → 409', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1' });
    await expect(
      auth.register({ email: 'x@x.com', password: 'secret1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('register: успех → токены + пользователь', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: '1',
      email: 'x@x.com',
      name: null,
      role: 'OWNER',
    });
    const res = await auth.register({ email: 'x@x.com', password: 'secret1' });
    expect(res.accessToken).toBe('a');
    expect(res.user.role).toBe('OWNER');
    expect(tokens.issue).toHaveBeenCalledWith('1', 'OWNER');
  });

  it('login: неверный пароль → 401', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'x@x.com',
      passwordHash: await bcrypt.hash('correct', 8),
      isBlocked: false,
      role: 'OWNER',
      name: null,
    });
    await expect(
      auth.login({ email: 'x@x.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login: несуществующий email → 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      auth.login({ email: 'no@x.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login: заблокированный пользователь → 403', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'x@x.com',
      passwordHash: await bcrypt.hash('correct', 8),
      isBlocked: true,
      role: 'OWNER',
      name: null,
    });
    await expect(
      auth.login({ email: 'x@x.com', password: 'correct' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
