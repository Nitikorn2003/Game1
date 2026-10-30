import { createRemoteJWKSet, jwtVerify } from 'jose';
import { unauthorized } from '../errors.js';
import { type KeySource, mapJwtError, parseBearer } from './bearer.js';

export interface Player {
  playerId: string;
}

export interface PlayerAuthenticator {
  authenticate(authorizationHeader: string | undefined): Promise<Player>;
}

export interface JwtPlayerAuthOptions {
  keys: KeySource;
  issuer: string;
  audience: string[];
}

/**
 * Verifies player session tokens issued by an OIDC provider such as Firebase Authentication.
 * The player id is the token's `sub` claim and is never taken from the request body.
 */
export function createJwtPlayerAuthenticator(options: JwtPlayerAuthOptions): PlayerAuthenticator {
  return {
    async authenticate(header) {
      const token = parseBearer(header);
      try {
        const { payload } = await jwtVerify(token, options.keys, {
          issuer: options.issuer,
          audience: options.audience,
          algorithms: ['RS256', 'ES256'],
          requiredClaims: ['sub', 'exp', 'iat'],
          maxTokenAge: '24h',
          clockTolerance: 30,
        });
        const sub = payload.sub;
        if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) throw unauthorized();
        return { playerId: sub };
      } catch (err) {
        throw mapJwtError(err);
      }
    },
  };
}

export function remoteKeys(jwksUrl: string): KeySource {
  return createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 5000, cooldownDuration: 30_000 });
}
