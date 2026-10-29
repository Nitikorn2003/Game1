import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Catalog } from '../src/catalog.js';
import { loadConfig, parseTrustProxy } from '../src/config.js';
import { classifyError } from '../src/play/play-api.js';
import { tokenFingerprint } from '../src/logging.js';
import { Harness, purchaseNotification, TEST_CATALOG, voidedNotification } from './support/harness.js';

let h: Harness;

beforeAll(async () => {
  h = await Harness.start();
});
afterAll(async () => {
  await h.stop();
});
beforeEach(async () => {
  await h.reset();
});

describe('secrets in logs', () => {
  it('never writes purchase tokens, session tokens or push tokens to the logs', async () => {
    const token = await h.buy('player-a', 'gems_100');
    const session = await h.playerToken('player-a');
    const pushToken = await h.pushToken();
    h.fake.failNext('consume', 503);

    await h.call('POST', '/v1/games/game1/purchases/google-play', {
      authorization: `Bearer ${session}`,
      body: { productId: 'gems_100', purchaseToken: token },
    });
    await h.verify('player-b', 'gems_100', token);
    await h.call('POST', '/v1/rtdn/google-play', {
      authorization: `Bearer ${pushToken}`,
      body: h.pushEnvelope(purchaseNotification(token)),
    });
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });
    await h.push(voidedNotification(token));

    const logs = h.logs.text();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).toContain(tokenFingerprint(token));
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(session);
    expect(logs).not.toContain(pushToken);
    const stored = await h.pool.query<{ detail: unknown; purchase_token_hash: string }>('SELECT * FROM play_purchase_events');
    expect(JSON.stringify(stored.rows)).not.toContain(token);
  });
});

describe('request hardening', () => {
  it('does not leak internal error details', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.pool.query('ALTER TABLE wallet_ledger RENAME TO wallet_ledger_moved');
    try {
      const res = await h.verify('player-a', 'gems_100', token);
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/wallet_ledger|relation|SQL|stack/i);
    } finally {
      await h.pool.query('ALTER TABLE wallet_ledger_moved RENAME TO wallet_ledger');
    }
  });

  it('refuses oversized bodies', async () => {
    const res = await h.call('POST', '/v1/games/game1/purchases/google-play', {
      playerId: 'player-a',
      body: { productId: 'gems_100', purchaseToken: 'a'.repeat(70 * 1024) },
    });
    expect(res.status).toBe(413);
  });

  it('rate-limits purchase verification per player', async () => {
    await h.reset({ verifyRateLimitPerMinute: 5 });
    const token = await h.buy('player-a', 'gems_100');

    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await h.verify('player-a', 'gems_100', token)).status);
    const other = await h.verify('player-b', 'gems_100', token);

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
    expect(other.status).toBe(403); // a different player has a separate allowance
  });
});

describe('Google Play Developer API error handling', () => {
  const httpError = (status: number) => Object.assign(new Error('http'), { response: { status } });

  it.each([
    ['get', 400, 'invalid_token'],
    ['get', 404, 'invalid_token'],
    ['get', 410, 'invalid_token'],
    ['get', 401, 'auth_config'],
    ['get', 403, 'auth_config'],
    ['get', 429, 'transient'],
    ['get', 500, 'transient'],
    ['get', 503, 'transient'],
    ['consume', 400, 'conflict'],
    ['consume', 409, 'conflict'],
    ['consume', 404, 'invalid_token'],
    ['acknowledge', 400, 'conflict'],
    ['refund', 400, 'conflict'],
  ] as const)('classifies %s HTTP %i as %s', (op, status, kind) => {
    expect(classifyError(op, httpError(status)).kind).toBe(kind);
  });

  it('treats network errors without a response as transient', () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { code: 'TimeoutError', config: {} });
    expect(classifyError('get', timeout).kind).toBe('transient');
  });

  it('treats a failure before any request was sent (no credentials) as a configuration problem', () => {
    expect(classifyError('get', new Error('Could not load the default credentials.')).kind).toBe('auth_config');
  });

  it('never copies the client library message, which can contain the purchase token', () => {
    const err = Object.assign(new Error('request to https://x/tokens/SECRET-TOKEN failed'), { config: {} });
    expect(classifyError('get', err).message).not.toContain('SECRET-TOKEN');
  });
});

describe('configuration', () => {
  const base = {
    DATABASE_URL: 'postgres://localhost/iap',
    IAP_CATALOG_PATH: '/etc/iap/catalog.json',
    AUTH_JWKS_URL: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    AUTH_ISSUER: 'https://securetoken.google.com/game1-prod',
    AUTH_AUDIENCE: 'game1-prod',
    RTDN_PUSH_AUDIENCE: 'https://iap.example.com/v1/rtdn/google-play',
    RTDN_PUSH_SERVICE_ACCOUNT: 'rtdn-push@game1-prod.iam.gserviceaccount.com',
  };

  it('defaults to the safe policy', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      NODE_ENV: 'production',
      ALLOW_TEST_PURCHASES: false,
      REJECTED_PURCHASE_POLICY: 'hold',
      REQUIRE_OBFUSCATED_ACCOUNT_ID: false,
      AUTH_AUDIENCE: ['game1-prod'],
    });
  });

  it('requires https endpoints in production', () => {
    expect(() => loadConfig({ ...base, AUTH_JWKS_URL: 'http://keys.example.com/jwks' })).toThrow('https');
    expect(() => loadConfig({ ...base, RTDN_PUSH_AUDIENCE: 'http://iap.example.com/push' })).toThrow('https');
    expect(() => loadConfig({ ...base, NODE_ENV: 'development', AUTH_JWKS_URL: 'http://localhost/jwks' })).not.toThrow();
  });

  it('only deletes Firebase accounts in the project that issues the player tokens', () => {
    expect(loadConfig({ ...base, FIREBASE_PROJECT_ID: 'game1-prod' }).FIREBASE_PROJECT_ID).toBe('game1-prod');
    expect(() => loadConfig({ ...base, FIREBASE_PROJECT_ID: 'other-project' })).toThrow('AUTH_ISSUER');
    expect(() => loadConfig({ ...base, FIREBASE_PROJECT_ID: 'Bad_Id' })).toThrow();
  });

  it('rejects missing and invalid settings', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: undefined })).toThrow();
    expect(() => loadConfig({ ...base, RTDN_PUSH_SERVICE_ACCOUNT: 'not-an-email' })).toThrow();
    expect(() => loadConfig({ ...base, ALLOW_TEST_PURCHASES: 'yes' })).toThrow();
    expect(() => loadConfig({ ...base, DATABASE_POOL_MAX: '1' })).toThrow();
  });

  it('parses the trusted proxy setting', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('10.0.0.0/8, 127.0.0.1')).toEqual(['10.0.0.0/8', '127.0.0.1']);
  });
});

describe('catalog validation', () => {
  const game = TEST_CATALOG.games[0]!;

  it('accepts the example catalog', () => {
    expect(Catalog.parse(TEST_CATALOG).games).toHaveLength(2);
  });

  it.each([
    ['duplicate game ids', { games: [game, { ...game, packageName: 'com.example.other' }] }],
    ['duplicate package names', { games: [game, { ...game, gameId: 'other' }] }],
    ['duplicate product ids', { games: [{ ...game, products: [game.products[0], game.products[0]] }] }],
    ['an invalid product id', { games: [{ ...game, products: [{ productId: 'Gems 100', type: 'consumable', grants: { gems: 1 } }] }] }],
    ['a zero grant', { games: [{ ...game, products: [{ productId: 'gems', type: 'consumable', grants: { gems: 0 } }] }] }],
    ['an empty grant', { games: [{ ...game, products: [{ productId: 'gems', type: 'consumable', grants: {} }] }] }],
    ['an unknown product type', { games: [{ ...game, products: [{ productId: 'vip', type: 'subscription' }] }] }],
    ['an invalid package name', { games: [{ ...game, packageName: 'not a package' }] }],
  ])('rejects %s', (_label, catalog) => {
    expect(() => Catalog.parse(catalog)).toThrow();
  });
});
