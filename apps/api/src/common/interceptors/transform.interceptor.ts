import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { encodeIdsDeep } from '../utils/id-codec';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        // Every MongoDB ObjectId in the payload — top-level, nested,
        // populated ref, sub-document _id — is re-encoded here so the
        // frontend never sees a raw database id. See id-codec.ts.
        data: encodeIdsDeep(data) as T,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
