import { Injectable, PipeTransform } from '@nestjs/common';
import { decodeIdsDeep } from '../utils/id-codec';

// Global pipe, registered before the app's ValidationPipe (see main.ts) —
// decodes every id the frontend sends back (route params, query, body) from
// its opaque encoded form to the real MongoDB ObjectId, before it reaches
// any DTO validation or controller. See id-codec.ts for the encode side.
@Injectable()
export class IdDecodePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return decodeIdsDeep(value);
  }
}
