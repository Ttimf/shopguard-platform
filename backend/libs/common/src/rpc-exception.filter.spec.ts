import {
  ConflictException,
  UnauthorizedException,
  ArgumentsHost,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RpcHttpExceptionFilter } from './rpc-exception.filter';

describe('RpcHttpExceptionFilter', () => {
  const filter = new RpcHttpExceptionFilter();
  const host = {} as ArgumentsHost;

  const err = async (ex: unknown) => {
    try {
      await firstValueFrom(filter.catch(ex, host));
      throw new Error('не выбросил');
    } catch (e) {
      return e as { statusCode: number; message: string };
    }
  };

  it('сохраняет статус HttpException (401)', async () => {
    const e = await err(new UnauthorizedException('Неверный пароль'));
    expect(e.statusCode).toBe(401);
    expect(e.message).toBe('Неверный пароль');
  });

  it('сохраняет статус 409', async () => {
    expect((await err(new ConflictException('дубль'))).statusCode).toBe(409);
  });

  it('обычная ошибка → 500', async () => {
    expect((await err(new Error('boom'))).statusCode).toBe(500);
  });
});
