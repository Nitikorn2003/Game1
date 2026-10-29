import { createHash } from 'node:crypto';

/** Minimal structured logger interface; Fastify's pino logger satisfies it. */
export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/**
 * Purchase tokens identify a paid purchase, so they are never written to logs or the
 * audit table. This short hash still lets operators correlate log lines.
 */
export function tokenFingerprint(purchaseToken: string): string {
  return createHash('sha256').update(purchaseToken).digest('hex').slice(0, 16);
}

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
