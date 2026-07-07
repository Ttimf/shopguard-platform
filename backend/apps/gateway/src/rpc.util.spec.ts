import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { rpc } from './rpc.util';

describe('rpc()', () => {
  it('возвращает значение при успехе', async () => {
    await expect(rpc(of({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it('сохраняет HTTP-статус из ошибки микросервиса', async () => {
    const err = { statusCode: 401, message: 'Неверный пароль' };
    await expect(rpc(throwError(() => err))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('неизвестная ошибка → 500', async () => {
    await expect(
      rpc(throwError(() => new Error('boom'))),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      rpc(throwError(() => ({ message: 'no code' }))),
    ).rejects.toMatchObject({ status: 500 });
  });
});
