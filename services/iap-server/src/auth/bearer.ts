import { errors, type JWTVerifyGetKey } from 'jose';
import { AppError, unauthorized } from '../errors.js';

export type KeySource = JWTVerifyGetKey;

export function parseBearer(header: string | undefined): string {
  if (header === undefined) throw unauthorized();
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
  if (!match?.[1] || match[1].length > 8192) throw unauthorized();
  return match[1];
}

/**
 * Maps a jose failure to an API error. A bad token is the caller's problem (401). Failing to
 * fetch the issuer's signing keys is ours (503), so clients do not throw away a valid session.
 */
export function mapJwtError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (
    err instanceof errors.JWKSTimeout ||
    err instanceof errors.JWKSInvalid ||
    // jose raises a plain JOSEError when the key set endpoint answers with a non-200 or bad JSON.
    (err instanceof errors.JOSEError && err.code === 'ERR_JOSE_GENERIC') ||
    (err instanceof TypeError && /fetch/i.test(err.message))
  ) {
    return new AppError(503, 'auth_unavailable', 'Session verification is temporarily unavailable.', true);
  }
  return unauthorized();
}
