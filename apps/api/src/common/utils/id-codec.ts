import { Types } from 'mongoose';

// The frontend must never see a raw MongoDB ObjectId — every id in every API
// response is re-encoded here, and every id the frontend sends back
// (route params, query, body) is decoded back to the real ObjectId before it
// reaches a controller. Both directions are wired once, globally:
//   - encodeIdsDeep() runs inside TransformInterceptor on every response.
//   - decodeIdsDeep() runs inside IdDecodePipe, a global pipe that runs
//     before the app's ValidationPipe on every @Param/@Query/@Body.
// No individual schema, DTO, or controller needs to change for this.
//
// The encoding is a reversible base64url re-packing of the ObjectId's raw
// bytes — not a secret, just not-recognizably-Mongo. A fixed, unusual-in-
// normal-text prefix (never valid base64url) is what makes decoding
// unambiguous: only strings this codec actually produced get decoded, so an
// arbitrary user-supplied string (a password, a note) can never be
// misinterpreted as an id.
const ID_PREFIX = '~';
const HEX24 = /^[0-9a-fA-F]{24}$/;

export function encodeId(hex: string): string {
  return ID_PREFIX + Buffer.from(hex, 'hex').toString('base64url');
}

export function decodeId(value: string): string {
  if (!value.startsWith(ID_PREFIX)) return value;
  try {
    const hex = Buffer.from(value.slice(ID_PREFIX.length), 'base64url').toString('hex');
    return HEX24.test(hex) ? hex : value;
  } catch {
    return value;
  }
}

function toPlainObject(value: object): object {
  const maybeDoc = value as { toObject?: () => object };
  return typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : value;
}

// Walks any response payload (Mongoose document, plain object, array, or
// primitive) and re-encodes every ObjectId it finds — as a real ObjectId
// instance, or as a 24-hex-char string (populated refs, sub-document _ids,
// anything already stringified) — regardless of field name or nesting depth.
export function encodeIdsDeep(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Types.ObjectId) return encodeId(value.toString());
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(encodeIdsDeep);
  if (typeof value === 'string') return HEX24.test(value) ? encodeId(value) : value;
  if (typeof value === 'object') {
    const plain = toPlainObject(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(plain)) {
      out[k] = encodeIdsDeep(v);
    }
    return out;
  }
  return value;
}

// Walks incoming request data (params/query/body) and decodes every encoded
// id back to its real ObjectId hex string — anything that isn't one of our
// encoded ids (including a literal caseNumber like "BB-2026-00015") passes
// through untouched.
export function decodeIdsDeep(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(decodeIdsDeep);
  if (typeof value === 'string') return decodeId(value);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decodeIdsDeep(v);
    }
    return out;
  }
  return value;
}
