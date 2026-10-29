import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import type { KeySource } from '../../src/auth/bearer.js';

export interface SignOptions {
  /** Seconds since the epoch. */
  issuedAt?: number;
  expiresAt?: number;
  kid?: string;
}

/** A local token issuer standing in for the player identity provider or Google's OIDC signer. */
export interface TestIssuer {
  keys: KeySource;
  sign(claims: JWTPayload, options?: SignOptions): Promise<string>;
}

export async function createTestIssuer(kid: string): Promise<TestIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  return {
    keys: createLocalJWKSet({ keys: [jwk] }),
    async sign(claims, options = {}) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: options.kid ?? kid, typ: 'JWT' })
        .setIssuedAt(options.issuedAt ?? now)
        .setExpirationTime(options.expiresAt ?? now + 3600)
        .sign(privateKey);
    },
  };
}

/** Builds an unsigned token by hand, for tests of tokens that no correct signer would produce. */
export function unsignedToken(header: object, payload: object, signature = ''): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode(header)}.${encode(payload)}.${signature}`;
}
