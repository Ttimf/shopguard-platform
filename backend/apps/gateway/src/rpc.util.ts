import { HttpException, HttpStatus } from '@nestjs/common';
import { catchError, firstValueFrom, Observable, throwError } from 'rxjs';

/**
 * Ждём ответ микросервиса и превращаем его ошибку в HTTP-исключение
 * (микросервис возвращает { status, message }).
 */
export function rpc<T>(obs: Observable<T>): Promise<T> {
  return firstValueFrom(
    obs.pipe(
      catchError((err) => {
        const raw = err?.statusCode ?? err?.status;
        const status = Number.isInteger(raw)
          ? raw
          : HttpStatus.INTERNAL_SERVER_ERROR;
        const message = err?.message ?? 'Ошибка сервиса';
        return throwError(() => new HttpException(message, status));
      }),
    ),
  );
}
