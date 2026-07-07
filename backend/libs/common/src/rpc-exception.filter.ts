import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

/**
 * Ловит любые исключения в микросервисе и передаёт клиенту (gateway)
 * структуру { statusCode, message }, чтобы сохранить HTTP-статус
 * (иначе всё превращается в 500).
 */
@Catch()
export class RpcHttpExceptionFilter implements RpcExceptionFilter {
  catch(exception: any, _host: ArgumentsHost): Observable<any> {
    const statusCode =
      typeof exception?.getStatus === 'function'
        ? exception.getStatus()
        : (exception?.statusCode ?? 500);
    const message = exception?.message ?? 'Ошибка сервиса';
    return throwError(() => ({ statusCode, message }));
  }
}
