import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload?.success === true) return payload;
        const message = payload?.message ?? 'OK';
        const data = payload?.data ?? payload;
        return { success: true, data, message };
      }),
    );
  }
}
