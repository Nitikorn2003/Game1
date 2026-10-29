import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger, type FastifyInstance, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import { z } from 'zod';
import type { PlayerAuthenticator } from './auth/player-auth.js';
import type { PubSubPushVerifier } from './auth/pubsub-auth.js';
import type { Catalog, GameConfig } from './catalog.js';
import type { Pool } from './db/pool.js';
import { AppError, badRequest, unauthorized, unknownGame, upstreamUnavailable } from './errors.js';
import { PlayApiError } from './play/play-api.js';
import type { PurchaseService } from './purchases/service.js';
import { handleRtdnPush } from './rtdn/handler.js';
import { getWallet } from './wallet/ledger.js';

export interface AppDeps {
  pool: Pool;
  catalog: Catalog;
  purchases: PurchaseService;
  playerAuth: PlayerAuthenticator;
  verifyPubSubPush: PubSubPushVerifier;
  rtdnExpectedSubscription?: string;
  verifyRateLimitPerMinute: number;
  /** Omit to disable logging (tests). */
  logger?: FastifyBaseLogger;
  trustProxy?: FastifyServerOptions['trustProxy'];
}

declare module 'fastify' {
  interface FastifyRequest {
    playerId?: string;
  }
}

// Purchase tokens are opaque; this only bounds size and character set before they are
// forwarded to Google.
const purchaseTokenSchema = z.string().min(8).max(4096).regex(/^[A-Za-z0-9._\-~+/=:]+$/);
const productIdSchema = z.string().min(1).max(139).regex(/^[a-z0-9][a-z0-9._]*$/);
const verifyBodySchema = z.object({ productId: productIdSchema, purchaseToken: purchaseTokenSchema }).strict();
const gameParamsSchema = z.object({ gameId: z.string().min(1).max(64) });

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    ...(deps.logger ? { loggerInstance: deps.logger } : { logger: false }),
    bodyLimit: 64 * 1024,
    trustProxy: deps.trustProxy ?? false,
  });

  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      void reply.status(err.httpStatus).send({ error: { code: err.code, message: err.message, retryable: err.retryable } });
      return;
    }
    if (err instanceof PlayApiError) {
      // Reaches here from notification handling; a 5xx makes Pub/Sub redeliver later.
      request.log.warn({ kind: err.kind, status: err.status }, 'Google Play Developer API call failed');
      const unavailable = upstreamUnavailable();
      void reply.status(unavailable.httpStatus).send({ error: { code: unavailable.code, message: unavailable.message, retryable: true } });
      return;
    }
    const status = typeof (err as { statusCode?: unknown }).statusCode === 'number' ? (err as { statusCode: number }).statusCode : 500;
    if (status === 429) {
      void reply.status(429).send({ error: { code: 'rate_limited', message: 'Too many requests.', retryable: true } });
      return;
    }
    if (status >= 400 && status < 500) {
      void reply.status(status).send({ error: { code: 'invalid_request', message: 'Malformed request.', retryable: false } });
      return;
    }
    request.log.error({ err }, 'unhandled error');
    // Unknown server failure: the client must keep the purchase and retry later.
    void reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error.', retryable: true } });
  });

  const resolveGame = (request: FastifyRequest): GameConfig => {
    const params = gameParamsSchema.safeParse(request.params);
    const game = params.success ? deps.catalog.gameById(params.data.gameId) : undefined;
    if (!game) throw unknownGame();
    return game;
  };

  const requirePlayer = async (request: FastifyRequest) => {
    request.playerId = (await deps.playerAuth.authenticate(request.headers.authorization)).playerId;
  };

  const currentPlayer = (request: FastifyRequest): string => {
    if (!request.playerId) throw unauthorized();
    return request.playerId;
  };

  app.get('/healthz', () => ({ ok: true }));

  app.get('/readyz', async (_request, reply) => {
    await deps.pool.query('SELECT 1');
    return reply.send({ ok: true });
  });

  /** Returns the opaque id the client passes to BillingFlowParams.setObfuscatedAccountId(). */
  app.post('/v1/games/:gameId/billing/account', { onRequest: requirePlayer }, async (request) => {
    const game = resolveGame(request);
    const obfuscatedAccountId = await deps.purchases.getOrCreateObfuscatedAccountId(game, currentPlayer(request));
    return { obfuscatedAccountId };
  });

  app.post(
    '/v1/games/:gameId/purchases/google-play',
    {
      onRequest: requirePlayer,
      config: {
        rateLimit: {
          max: deps.verifyRateLimitPerMinute,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (request: FastifyRequest) => request.playerId ?? request.ip,
        },
      },
    },
    async (request) => {
      const game = resolveGame(request);
      const body = verifyBodySchema.safeParse(request.body);
      if (!body.success) throw badRequest('productId and purchaseToken are required');
      const result = await deps.purchases.verifyFromClient(
        game,
        currentPlayer(request),
        body.data.productId,
        body.data.purchaseToken,
      );
      return {
        status: result.status,
        productId: result.productId,
        quantity: result.quantity,
        wallet: result.wallet,
      };
    },
  );

  app.get('/v1/games/:gameId/wallet', { onRequest: requirePlayer }, async (request) => {
    const game = resolveGame(request);
    return getWallet(deps.pool, game.gameId, currentPlayer(request));
  });

  /** Pub/Sub push endpoint for Google Play real-time developer notifications. */
  app.post('/v1/rtdn/google-play', async (request, reply) => {
    await deps.verifyPubSubPush(request.headers.authorization);
    const outcome = await handleRtdnPush(request.body, {
      pool: deps.pool,
      catalog: deps.catalog,
      purchases: deps.purchases,
      logger: request.log,
      ...(deps.rtdnExpectedSubscription ? { expectedSubscription: deps.rtdnExpectedSubscription } : {}),
    });
    // Any 2xx acknowledges the message; errors above become 5xx so Pub/Sub retries.
    return reply.status(200).send({ outcome });
  });

  return app;
}
