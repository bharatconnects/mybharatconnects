let counter = 0;

export const v4 = (): string => {
  counter += 1;
  const hex = counter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
};

export const v1 = v4;
export const v3 = v4;
export const v5 = v4;
export const NIL = '00000000-0000-0000-0000-000000000000';
export const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
export const parse = (s: string): Uint8Array => new Uint8Array(16);
export const stringify = (_buf: Uint8Array): string => v4();
export const validate = (s: string): boolean => typeof s === 'string';
export const version = (_s: string): number => 4;
