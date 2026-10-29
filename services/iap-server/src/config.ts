import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Fastify trustProxy: "true" (trust all proxies) or a comma separated list of proxy IPs/CIDRs. */
  TRUST_PROXY: z.string().optional(),

  DATABASE_URL: z.string().min(1),
  /** At least 2: the voided purchases sync holds one connection for its lock while it works. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
  MIGRATE_ON_START: booleanString.default(false),

  IAP_CATALOG_PATH: z.string().min(1),

  // Player sessions: any OIDC/JWT issuer, for example Firebase Authentication ID tokens.
  AUTH_JWKS_URL: z.url(),
  AUTH_ISSUER: z.string().min(1),
  /** Comma separated list of accepted audiences. */
  AUTH_AUDIENCE: z.string().min(1),

  // Google Play Developer API. Credentials come from Application Default Credentials
  // (GOOGLE_APPLICATION_CREDENTIALS or the platform's workload identity), never from this file.
  PLAY_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),

  // Real-time developer notifications delivered by an authenticated Pub/Sub push subscription.
  RTDN_PUSH_AUDIENCE: z.string().min(1),
  RTDN_PUSH_SERVICE_ACCOUNT: z.email(),
  RTDN_EXPECTED_SUBSCRIPTION: z.string().optional(),

  // Purchase policy.
  REQUIRE_OBFUSCATED_ACCOUNT_ID: booleanString.default(false),
  /** License-tester purchases cost nothing, so granting them is opt-in. */
  ALLOW_TEST_PURCHASES: booleanString.default(false),
  /** "hold" leaves rejected purchases unacknowledged; "refund" refunds and revokes them through orders.refund. */
  REJECTED_PURCHASE_POLICY: z.enum(['hold', 'refund']).default('hold'),

  RUN_BACKGROUND_JOBS: booleanString.default(true),
  VERIFY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(10_000).default(30),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);
  const config = {
    ...parsed,
    AUTH_AUDIENCE: parsed.AUTH_AUDIENCE.split(',').map((a) => a.trim()).filter(Boolean),
  };
  if (config.NODE_ENV === 'production') {
    if (!config.AUTH_JWKS_URL.startsWith('https://')) {
      throw new Error('AUTH_JWKS_URL must use https in production');
    }
    if (!config.RTDN_PUSH_AUDIENCE.startsWith('https://')) {
      throw new Error('RTDN_PUSH_AUDIENCE must be the https push endpoint URL in production');
    }
  }
  return config;
}

export function parseTrustProxy(value: string | undefined): boolean | string[] | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value.split(',').map((v) => v.trim());
}
