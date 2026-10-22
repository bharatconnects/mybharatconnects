import { registerDecorator, ValidationOptions } from 'class-validator';

// Characters a person may type around the digits ("+91 98765-43210",
// "(415) 555.0100"). Anything else, such as letters, is rejected outright.
const ALLOWED_CHARS = /^[+\d\s().-]+$/;

/**
 * True for an empty value (phone fields are optional) or a phone number of
 * 7-15 digits with an optional leading "+" (the E.164 maximum is 15).
 */
export function isValidPhone(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!ALLOWED_CHARS.test(trimmed)) return false;
  // "+" is only meaningful as the very first character.
  if (trimmed.lastIndexOf('+') > 0) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function IsPhone(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPhone',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'phone must be a valid phone number (7 to 15 digits, optional leading +, no letters)',
        ...options,
      },
      validator: {
        validate: (value: unknown) => isValidPhone(value),
      },
    });
  };
}
