import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorBody {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}

export function extractApiError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): { message: string; errors?: string[]; statusCode?: number } {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ApiErrorBody> | null;
    if (body && typeof body.message === 'string') {
      return {
        message: body.message,
        errors: body.errors,
        statusCode: body.statusCode ?? err.status,
      };
    }
    if (err.status === 0) {
      return { message: 'Cannot reach the server. Check your network.', statusCode: 0 };
    }
    return { message: err.statusText || fallback, statusCode: err.status };
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return { message: String((err as { message: unknown }).message) || fallback };
  }
  return { message: fallback };
}
