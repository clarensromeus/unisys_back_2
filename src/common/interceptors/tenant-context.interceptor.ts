import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextUser, runWithRequestUser } from '../utils/request-context.util';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: RequestContextUser }>();

    return new Observable((subscriber) => (
      runWithRequestUser(request.user, () => {
        const subscription = next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });

        return () => subscription.unsubscribe();
      })
    ));
  }
}
