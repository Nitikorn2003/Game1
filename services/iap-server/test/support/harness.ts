import { randomBytes } from 'node:crypto';
import { auth } from '@googleapis/androidpublisher';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { createJwtPlayerAuthenticator } from '../../src/auth/player-auth.js';
import { createPubSubPushVerifier } from '../../src/auth/pubsub-auth.js';
import { Catalog } from '../../src/catalog.js';
import type { Pool } from '../../src/db/pool.js';
import type { Logger } from '../../src/logging.js';
import { createGooglePlayDeveloperApi, type PlayDeveloperApi } from '../../src/play/play-api.js';
import type { PurchasePolicy } from '../../src/purchases/evaluate.js';
import type { PurchaseRow } from '../../src/purchases/repository.js';
import { PurchaseService } from '../../src/purchases/service.js';
import { createLogger } from '../../src/server.js';
import { createTestDatabase, truncateAll } from './db.js';
import { FAKE_ACCESS_TOKEN, FakePlayApi, type FakePurchase } from './fake-play-api.js';
import { createTestIssuer, type TestIssuer } from './keys.js';

export const TEST_CATALOG = {
  games: [
    {
      gameId: 'game1',
      packageName: 'com.example.game1',
      products: [
        { productId: 'gems_100', type: 'consumable', grants: { gems: 100 } },
        { productId: 'starter_pack', type: 'consumable', grants: { gems: 500, coins: 1000 } },
        { productId: 'remove_ads', type: 'non_consumable', entitlement: 'remove_ads' },
      ],
    },
    {
      gameId: 'game2',
      packageName: 'com.example.game2',
      products: [{ productId: 'gems_100', type: 'consumable', grants: { gems: 100 } }],
    },
  ],
};

export const GAME1_PACKAGE = 'com.example.game1';
export const GAME2_PACKAGE = 'com.example.game2';
export const PLAYER_ISSUER = 'https://auth.test.example';
export const PLAYER_AUDIENCE = 'game1-test';
export const PUSH_AUDIENCE = 'https://iap.test.example/v1/rtdn/google-play';
export const PUSH_SERVICE_ACCOUNT = 'rtdn-push@game1-test.iam.gserviceaccount.com';
export const TEST_SUBSCRIPTION = 'projects/game1-test/subscriptions/play-rtdn-push';

/** Test default: license-tester purchases are accepted, rejected purchases are held. */
export const DEFAULT_POLICY: PurchasePolicy = {
  requireObfuscatedAccountId: false,
  allowTestPurchases: true,
  rejectedPurchasePolicy: 'hold',
};

export const ONE_TIME_PRODUCT_PURCHASED = 1;
export const ONE_TIME_PRODUCT_CANCELED = 2;

export function newPurchaseToken(): string {
  return `tok.${randomBytes(48).toString('base64url')}`;
}

/** Real time plus an offset, so leases and retry delays can be fast-forwarded. */
export class TestClock {
  private offsetMs = 0;
  readonly now = (): Date => new Date(Date.now() + this.offsetMs);
  advance(ms: number): void {
    this.offsetMs += ms;
  }
  reset(): void {
    this.offsetMs = 0;
  }
}

/** Collects every structured log line the server writes. */
export class LogCapture {
  readonly lines: string[] = [];
  readonly stream = { write: (line: string) => void this.lines.push(line) };
  entries(): { level: number; msg?: string; [key: string]: unknown }[] {
    return this.lines.map((line) => JSON.parse(line) as { level: number; msg?: string });
  }
  messages(minLevel = 0): string[] {
    return this.entries()
      .filter((e) => e.level >= minLevel)
      .map((e) => e.msg ?? '');
  }
  text(): string {
    return this.lines.join('\n');
  }
  clear(): void {
    this.lines.length = 0;
  }
}

export const LOG_WARN = 40;
export const LOG_ERROR = 50;

export interface HarnessOptions {
  policy?: Partial<PurchasePolicy>;
  verifyRateLimitPerMinute?: number;
  playTimeoutMs?: number;
  rtdnExpectedSubscription?: string;
}

export interface ApiResponse {
  status: number;
  body: any;
}

export interface LedgerRow {
  id: number;
  player_id: string;
  currency: string;
  delta: number;
  reason: string;
  idempotency_key: string;
  purchase_id: number | null;
}

export function purchaseNotification(
  purchaseToken: string,
  opts: { type?: number; packageName?: string; sku?: string } = {},
): object {
  return {
    version: '1.0',
    packageName: opts.packageName ?? GAME1_PACKAGE,
    eventTimeMillis: String(Date.now()),
    oneTimeProductNotification: {
      version: '1.0',
      notificationType: opts.type ?? ONE_TIME_PRODUCT_PURCHASED,
      purchaseToken,
      sku: opts.sku ?? 'gems_100',
    },
  };
}

export function voidedNotification(
  purchaseToken: string,
  opts: { orderId?: string; refundType?: number; productType?: number; packageName?: string; eventTimeMillis?: number } = {},
): object {
  return {
    version: '1.0',
    packageName: opts.packageName ?? GAME1_PACKAGE,
    eventTimeMillis: String(opts.eventTimeMillis ?? Date.now()),
    voidedPurchaseNotification: {
      purchaseToken,
      orderId: opts.orderId ?? 'GPA.0000-0000-0000-00000',
      productType: opts.productType ?? 2,
      refundType: opts.refundType ?? 1,
    },
  };
}

/**
 * The whole server wired as in production (Fastify app, purchase service, PostgreSQL, the
 * official Google client library) except that Google's servers are the local FakePlayApi and
 * tokens are signed by local test keys.
 */
export class Harness {
  readonly fake = new FakePlayApi();
  readonly clock = new TestClock();
  readonly logs = new LogCapture();
  readonly catalog = Catalog.parse(TEST_CATALOG);
  pool!: Pool;
  play!: PlayDeveloperApi;
  service!: PurchaseService;
  app!: FastifyInstance;
  logger!: Logger;
  playerIssuer!: TestIssuer;
  googleIssuer!: TestIssuer;
  private options: HarnessOptions = {};
  private messageSeq = 0;

  static async start(options: HarnessOptions = {}): Promise<Harness> {
    const h = new Harness();
    h.pool = await createTestDatabase();
    await h.fake.start();
    h.playerIssuer = await createTestIssuer('player-key-1');
    h.googleIssuer = await createTestIssuer('google-key-1');
    await h.configure(options);
    return h;
  }

  /** Builds a fresh service and HTTP app, as a newly started server process would. */
  async configure(options: HarnessOptions = this.options): Promise<void> {
    if (this.app) await this.app.close();
    this.options = options;
    const logger = createLogger({ LOG_LEVEL: 'debug' }, this.logs.stream);
    this.logger = logger;
    this.play = this.createPlayApi(options.playTimeoutMs);
    this.service = this.createService();
    this.app = await buildApp({
      pool: this.pool,
      catalog: this.catalog,
      purchases: this.service,
      playerAuth: createJwtPlayerAuthenticator({
        keys: this.playerIssuer.keys,
        issuer: PLAYER_ISSUER,
        audience: [PLAYER_AUDIENCE],
      }),
      verifyPubSubPush: createPubSubPushVerifier({
        keys: this.googleIssuer.keys,
        audience: PUSH_AUDIENCE,
        serviceAccountEmail: PUSH_SERVICE_ACCOUNT,
      }),
      ...(options.rtdnExpectedSubscription ? { rtdnExpectedSubscription: options.rtdnExpectedSubscription } : {}),
      verifyRateLimitPerMinute: options.verifyRateLimitPerMinute ?? 10_000,
      logger,
    });
    await this.app.ready();
  }

  /** The official androidpublisher client, pointed at the fake and holding a fake access token. */
  createPlayApi(timeoutMs = 2000): PlayDeveloperApi {
    const client = new auth.OAuth2();
    client.setCredentials({ access_token: FAKE_ACCESS_TOKEN, expiry_date: Date.now() + 24 * 3600_000 });
    return createGooglePlayDeveloperApi({ auth: client, rootUrl: this.fake.url, timeoutMs });
  }

  createService(overrides: { policy?: Partial<PurchasePolicy>; play?: PlayDeveloperApi; pool?: Pool } = {}): PurchaseService {
    return new PurchaseService({
      pool: overrides.pool ?? this.pool,
      catalog: this.catalog,
      play: overrides.play ?? this.play,
      logger: this.logger,
      policy: { ...DEFAULT_POLICY, ...this.options.policy, ...overrides.policy },
      now: this.clock.now,
    });
  }

  async reset(options: HarnessOptions = {}): Promise<void> {
    await truncateAll(this.pool);
    this.fake.reset();
    this.clock.reset();
    this.logs.clear();
    await this.configure(options);
  }

  async stop(): Promise<void> {
    await this.app?.close();
    await this.pool?.end();
    await this.fake.stop();
  }

  // -------------------------------------------------------------------------
  // HTTP API, as the game client and Pub/Sub call it
  // -------------------------------------------------------------------------

  playerToken(playerId: string): Promise<string> {
    return this.playerIssuer.sign({ iss: PLAYER_ISSUER, aud: PLAYER_AUDIENCE, sub: playerId });
  }

  async call(
    method: 'GET' | 'POST',
    url: string,
    opts: { playerId?: string; authorization?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<ApiResponse> {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.authorization !== undefined) headers.authorization = opts.authorization;
    else if (opts.playerId !== undefined) headers.authorization = `Bearer ${await this.playerToken(opts.playerId)}`;
    const res = await this.app.inject({
      method,
      url,
      headers,
      ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
    });
    let body: unknown = res.body;
    try {
      body = JSON.parse(res.body);
    } catch {
      // not JSON
    }
    return { status: res.statusCode, body };
  }

  verify(playerId: string, productId: string, purchaseToken: string, gameId = 'game1'): Promise<ApiResponse> {
    return this.call('POST', `/v1/games/${gameId}/purchases/google-play`, {
      playerId,
      body: { productId, purchaseToken },
    });
  }

  async billingAccount(playerId: string, gameId = 'game1'): Promise<string> {
    const res = await this.call('POST', `/v1/games/${gameId}/billing/account`, { playerId });
    if (res.status !== 200) throw new Error(`billing account failed: ${res.status} ${JSON.stringify(res.body)}`);
    return (res.body as { obfuscatedAccountId: string }).obfuscatedAccountId;
  }

  async wallet(playerId: string, gameId = 'game1'): Promise<{ balances: Record<string, number>; entitlements: string[] }> {
    const res = await this.call('GET', `/v1/games/${gameId}/wallet`, { playerId });
    if (res.status !== 200) throw new Error(`wallet failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { balances: Record<string, number>; entitlements: string[] };
  }

  /**
   * A player completes the Google Play purchase flow with a license tester account. Google
   * now holds a purchase that carries the player's obfuscated account id.
   */
  async buy(playerId: string, productId: string, init: Partial<FakePurchase> = {}, gameId = 'game1'): Promise<string> {
    const game = this.catalog.gameById(gameId);
    if (!game) throw new Error(`unknown game ${gameId}`);
    const obfuscatedAccountId = await this.billingAccount(playerId, gameId);
    const token = newPurchaseToken();
    this.fake.addPurchase(token, { productId, packageName: game.packageName, obfuscatedAccountId, ...init });
    return token;
  }

  pushToken(claims: Record<string, unknown> = {}, options: { issuedAt?: number; expiresAt?: number } = {}): Promise<string> {
    return this.googleIssuer.sign(
      {
        iss: 'https://accounts.google.com',
        aud: PUSH_AUDIENCE,
        azp: '112233445566778899000',
        sub: '112233445566778899000',
        email: PUSH_SERVICE_ACCOUNT,
        email_verified: true,
        ...claims,
      },
      options,
    );
  }

  pushEnvelope(notification: unknown, opts: { messageId?: string; subscription?: string; rawData?: string } = {}): object {
    return {
      message: {
        data: opts.rawData ?? Buffer.from(JSON.stringify(notification)).toString('base64'),
        messageId: opts.messageId ?? `msg-${++this.messageSeq}`,
        publishTime: new Date().toISOString(),
        attributes: {},
      },
      subscription: opts.subscription ?? TEST_SUBSCRIPTION,
    };
  }

  /** Delivers a developer notification the way an authenticated Pub/Sub push subscription does. */
  async push(
    notification: unknown,
    opts: { messageId?: string; authorization?: string; subscription?: string; rawData?: string } = {},
  ): Promise<ApiResponse> {
    const authorization = opts.authorization ?? `Bearer ${await this.pushToken()}`;
    return this.call('POST', '/v1/rtdn/google-play', { authorization, body: this.pushEnvelope(notification, opts) });
  }

  // -------------------------------------------------------------------------
  // Database inspection
  // -------------------------------------------------------------------------

  async purchaseRow(purchaseToken: string, packageName = GAME1_PACKAGE): Promise<PurchaseRow | undefined> {
    const res = await this.pool.query<PurchaseRow>(
      'SELECT * FROM play_purchases WHERE package_name = $1 AND purchase_token = $2',
      [packageName, purchaseToken],
    );
    return res.rows[0];
  }

  async ledger(playerId?: string): Promise<LedgerRow[]> {
    const res = await this.pool.query<LedgerRow>(
      `SELECT id, player_id, currency, delta, reason, idempotency_key, purchase_id FROM wallet_ledger
       ${playerId ? 'WHERE player_id = $1' : ''} ORDER BY id`,
      playerId ? [playerId] : [],
    );
    return res.rows;
  }

  async balances(playerId: string, gameId = 'game1'): Promise<Record<string, number>> {
    const res = await this.pool.query<{ currency: string; balance: number }>(
      'SELECT currency, balance FROM wallet_balances WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId],
    );
    return Object.fromEntries(res.rows.map((r) => [r.currency, r.balance]));
  }

  async events(purchaseId: number): Promise<string[]> {
    const res = await this.pool.query<{ event: string }>(
      'SELECT event FROM play_purchase_events WHERE purchase_id = $1 ORDER BY id',
      [purchaseId],
    );
    return res.rows.map((r) => r.event);
  }

  async waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!(await check())) {
      if (Date.now() > deadline) throw new Error('condition not reached in time');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * Ledger invariants that must hold after any sequence of events:
   *  - every balance equals the sum of its ledger rows;
   *  - a purchase credits each currency at most once;
   *  - clawbacks never exceed what the purchase credited.
   */
  async assertLedgerConsistent(): Promise<void> {
    const mismatched = await this.pool.query(
      `SELECT b.game_id, b.player_id, b.currency, b.balance, COALESCE(SUM(l.delta), 0) AS ledger_sum
       FROM wallet_balances b
       LEFT JOIN wallet_ledger l USING (game_id, player_id, currency)
       GROUP BY b.game_id, b.player_id, b.currency, b.balance
       HAVING b.balance <> COALESCE(SUM(l.delta), 0)`,
    );
    const orphanLedger = await this.pool.query(
      `SELECT l.game_id, l.player_id, l.currency FROM wallet_ledger l
       LEFT JOIN wallet_balances b USING (game_id, player_id, currency)
       WHERE b.player_id IS NULL`,
    );
    const doubleGrants = await this.pool.query(
      `SELECT purchase_id, currency, COUNT(*) AS grants FROM wallet_ledger
       WHERE reason = 'play_purchase' GROUP BY purchase_id, currency HAVING COUNT(*) > 1`,
    );
    const overClawed = await this.pool.query(
      `SELECT purchase_id, currency FROM wallet_ledger WHERE purchase_id IS NOT NULL
       GROUP BY purchase_id, currency
       HAVING SUM(delta) FILTER (WHERE reason = 'play_revocation') < -COALESCE(SUM(delta) FILTER (WHERE reason = 'play_purchase'), 0)`,
    );
    const problems = [
      ...mismatched.rows.map((r) => `balance mismatch ${JSON.stringify(r)}`),
      ...orphanLedger.rows.map((r) => `ledger without balance ${JSON.stringify(r)}`),
      ...doubleGrants.rows.map((r) => `double grant ${JSON.stringify(r)}`),
      ...overClawed.rows.map((r) => `clawback exceeds grant ${JSON.stringify(r)}`),
    ];
    if (problems.length > 0) throw new Error(`ledger invariants violated:\n${problems.join('\n')}`);
  }
}
