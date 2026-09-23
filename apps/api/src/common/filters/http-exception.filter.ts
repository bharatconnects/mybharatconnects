import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface UniformErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, errors, errorName } = this.extract(exception, status);

    // Log every error so devs can diagnose 4xx as easily as 5xx.
    // 5xx = stack trace (real bug); 4xx = single warn line (expected client errors).
    const method = request.method;
    const url = request.url;
    if (status >= 500) {
      this.logger.error(
        `${method} ${url} → ${status} ${STATUS_TEXT[status] ?? ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${method} ${url} → ${status} ${STATUS_TEXT[status] ?? ''}${message ? ' :: ' + message : ''}`,
      );
    }

    const body: UniformErrorResponse = {
      success: false,
      statusCode: status,
      error: errorName,
      message,
      ...(errors && errors.length > 1 ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private extract(
    exception: unknown,
    status: number,
  ): { message: string; errors?: string[]; errorName: string } {
    const fallbackName = STATUS_TEXT[status] ?? 'Error';

    if (!(exception instanceof HttpException)) {
      return {
        message:
          exception instanceof Error
            ? exception.message || 'Internal server error'
            : 'Internal server error',
        errorName: fallbackName,
      };
    }

    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return { message: raw, errorName: fallbackName };
    }

    if (raw && typeof raw === 'object') {
      const obj = raw as { message?: unknown; error?: unknown };
      const errorName =
        typeof obj.error === 'string' ? obj.error : fallbackName;

      if (Array.isArray(obj.message)) {
        const arr = obj.message.map((m) => String(m));
        return { message: arr[0] ?? fallbackName, errors: arr, errorName };
      }
      if (typeof obj.message === 'string') {
        return { message: obj.message, errorName };
      }
      return { message: exception.message || fallbackName, errorName };
    }

    return { message: exception.message || fallbackName, errorName: fallbackName };
  }
}
