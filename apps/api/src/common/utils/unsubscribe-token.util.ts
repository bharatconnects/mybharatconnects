import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stateless, non-expiring HMAC token for one-click email unsubscribe links.
 * Deliberately doesn't expire like password-reset tokens — an unsubscribe
 * link in an old email must still work.
 */
export function generateUnsubscribeToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex');
}

export function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string,
): boolean {
  const expected = generateUnsubscribeToken(userId, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const tokenBuf = Buffer.from(token, 'hex');
  return (
    expectedBuf.length === tokenBuf.length &&
    timingSafeEqual(expectedBuf, tokenBuf)
  );
}
