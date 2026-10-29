import { jwtVerify } from 'jose';
import { unauthorized } from '../errors.js';
import { type KeySource, mapJwtError, parseBearer } from './bearer.js';

/** Google's OIDC signing keys, used for Pub/Sub push authentication tokens. */
export const GOOGLE_OIDC_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export interface PubSubPushVerifierOptions {
  keys: KeySource;
  /** The audience configured on the push subscription (by default the push endpoint URL). */
  audience: string;
  /** The service account the push subscription signs its tokens as. */
  serviceAccountEmail: string;
}

export type PubSubPushVerifier = (authorizationHeader: string | undefined) => Promise<void>;

/**
 * Verifies the OIDC token that an authenticated Pub/Sub push subscription attaches to each
 * request. Without this check anyone could post fake purchase notifications to the endpoint.
 * Google's libraries check signature, aud and exp; iss, email and email_verified are ours.
 */
export function createPubSubPushVerifier(options: PubSubPushVerifierOptions): PubSubPushVerifier {
  const expectedEmail = options.serviceAccountEmail.toLowerCase();
  return async (header) => {
    const token = parseBearer(header);
    try {
      const { payload } = await jwtVerify(token, options.keys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: options.audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'email'],
        clockTolerance: 30,
      });
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      // Google documents email_verified as a boolean but has shown it as a string in samples.
      const verified = payload.email_verified === true || payload.email_verified === 'true';
      if (email !== expectedEmail || !verified) throw unauthorized();
    } catch (err) {
      throw mapJwtError(err);
    }
  };
}
