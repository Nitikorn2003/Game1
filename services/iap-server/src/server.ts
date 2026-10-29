import { type DestinationStream, pino } from 'pino';
import { buildApp } from './app.js';
import { createJwtPlayerAuthenticator, remoteKeys } from './auth/player-auth.js';
import { createPubSubPushVerifier, GOOGLE_OIDC_JWKS_URL } from './auth/pubsub-auth.js';
import { Catalog } from './catalog.js';
import { type AppConfig, parseTrustProxy } from './config.js';
import { createPool } from './db/pool.js';
import type { Logger } from './logging.js';
import { createGooglePlayDeveloperApi } from './play/play-api.js';
import { PurchaseService } from './purchases/service.js';

export function createLogger(config: Pick<AppConfig, 'LOG_LEVEL'>, destination?: DestinationStream) {
  return pino(
    {
      level: config.LOG_LEVEL,
      // Session tokens and Pub/Sub tokens must never reach log storage.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    destination,
  );
}

/** Wires production dependencies from configuration. */
export function createServices(config: AppConfig, logger: Logger) {
  const catalog = Catalog.load(config.IAP_CATALOG_PATH);
  const pool = createPool(config.DATABASE_URL, config.DATABASE_POOL_MAX, (err) =>
    logger.warn({ err: err.message }, 'database connection lost; it will be replaced'),
  );
  const play = createGooglePlayDeveloperApi({ timeoutMs: config.PLAY_API_TIMEOUT_MS });
  const purchases = new PurchaseService({
    pool,
    catalog,
    play,
    logger,
    policy: {
      requireObfuscatedAccountId: config.REQUIRE_OBFUSCATED_ACCOUNT_ID,
      allowTestPurchases: config.ALLOW_TEST_PURCHASES,
      rejectedPurchasePolicy: config.REJECTED_PURCHASE_POLICY,
    },
  });
  return { catalog, pool, play, purchases };
}

export async function createHttpApp(
  config: AppConfig,
  services: ReturnType<typeof createServices>,
  logger: ReturnType<typeof createLogger>,
) {
  return buildApp({
    pool: services.pool,
    catalog: services.catalog,
    purchases: services.purchases,
    playerAuth: createJwtPlayerAuthenticator({
      keys: remoteKeys(config.AUTH_JWKS_URL),
      issuer: config.AUTH_ISSUER,
      audience: config.AUTH_AUDIENCE,
    }),
    verifyPubSubPush: createPubSubPushVerifier({
      keys: remoteKeys(GOOGLE_OIDC_JWKS_URL),
      audience: config.RTDN_PUSH_AUDIENCE,
      serviceAccountEmail: config.RTDN_PUSH_SERVICE_ACCOUNT,
    }),
    ...(config.RTDN_EXPECTED_SUBSCRIPTION ? { rtdnExpectedSubscription: config.RTDN_EXPECTED_SUBSCRIPTION } : {}),
    verifyRateLimitPerMinute: config.VERIFY_RATE_LIMIT_PER_MINUTE,
    logger,
    trustProxy: parseTrustProxy(config.TRUST_PROXY) ?? false,
  });
}
