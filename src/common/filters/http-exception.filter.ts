import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

function prismaError(exception: unknown) {
  const error = exception as { code?: unknown; meta?: { target?: unknown; modelName?: unknown; cause?: unknown } };
  const code = typeof error.code === 'string' ? error.code : undefined;
  if (!code?.startsWith('P')) return null;

  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(', ')
    : typeof error.meta?.target === 'string'
      ? error.meta.target
      : undefined;
  const model = typeof error.meta?.modelName === 'string' ? error.meta.modelName : 'record';

  const messages: Record<string, { status: number; message: string }> = {
    P2002: { status: HttpStatus.CONFLICT, message: target ? `A ${model} with this ${target} already exists` : `${model} already exists` },
    P2003: { status: HttpStatus.BAD_REQUEST, message: 'The selected related record does not exist or cannot be linked' },
    P2011: { status: HttpStatus.BAD_REQUEST, message: 'A required value is missing' },
    P2014: { status: HttpStatus.BAD_REQUEST, message: 'This change would violate a required relationship' },
    P2022: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database schema is out of sync with the API' },
    P2025: { status: HttpStatus.NOT_FOUND, message: `${model} was not found` },
  };

  return messages[code] || { status: HttpStatus.BAD_REQUEST, message: 'The database rejected this request' };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const prisma = prismaError(exception);
    const status = prisma?.status ?? (exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = prisma?.message ?? (exception instanceof HttpException ? exception.getResponse() : 'Internal server error');
    const message =
      typeof payload === 'string'
        ? payload
        : Array.isArray((payload as { message?: unknown }).message)
          ? ((payload as { message: string[] }).message).join(', ')
          : ((payload as { message?: string }).message ?? 'Unexpected error');

    if (!(exception instanceof HttpException)) {
      const error = exception instanceof Error ? exception.stack || exception.message : String(exception);
      this.logger.error(error);
    }

    response.status(status).json({
      success: false,
      error: message,
    });
  }
}
