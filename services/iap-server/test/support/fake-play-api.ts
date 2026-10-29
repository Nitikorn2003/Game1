import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

/**
 * A local stand-in for the Google Play Developer API (androidpublisher v3) that speaks the
 * same REST paths and JSON shapes as the real service (schema revision 20261028), so tests
 * run the official @googleapis/androidpublisher client end to end. No real purchases or
 * Google accounts are involved.
 */

export type FakeState = 'PURCHASED' | 'PENDING' | 'CANCELLED';

export interface FakePurchase {
  packageName: string;
  productId: string;
  state: FakeState;
  quantity: number;
  /** null omits the field from responses. */
  refundableQuantity: number | null;
  consumed: boolean;
  acknowledged: boolean;
  obfuscatedAccountId: string | null;
  orderId: string | null;
  test: boolean;
  rental: boolean;
  lineItemCount: number;
  completionTime: string | null;
}

export interface FakeVoided {
  packageName: string;
  purchaseToken: string;
  orderId: string | null;
  voidedTimeMillis: number;
  voidedQuantity?: number;
  voidedReason: number;
  voidedSource: number;
  /** When Google "saw" the void; this is what startTime/endTime filter on. */
  seenAtMs: number;
}

export type Op = 'get' | 'consume' | 'acknowledge' | 'voided' | 'refund';
/**
 * hang: never answer. reset: drop the connection before doing anything. lost-response: do the
 * work, then drop the connection, like a timeout after Google already applied the change.
 */
export type FailureMode = number | 'hang' | 'reset' | 'lost-response';
type Failure = { op: Op; status: FailureMode; remaining: number; skip: number };

export const FAKE_ACCESS_TOKEN = 'fake-access-token';

export class FakePlayApi {
  readonly purchases = new Map<string, FakePurchase>();
  readonly voided: FakeVoided[] = [];
  readonly calls: { op: Op; token?: string; productId?: string; query?: Record<string, string> }[] = [];
  readonly refunds: { orderId: string; revoke: boolean }[] = [];
  pageSize = 1000;
  private failures: Failure[] = [];
  private server: Server | undefined;
  private readonly sockets = new Set<Socket>();
  private orderSeq = 0;
  url = '';

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      this.handle(req, res).catch((err: unknown) => {
        res.statusCode = 500;
        res.end(String(err));
      });
    });
    this.server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}/`;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }

  reset(): void {
    this.purchases.clear();
    this.voided.length = 0;
    this.calls.length = 0;
    this.refunds.length = 0;
    this.failures = [];
    this.pageSize = 1000;
  }

  addPurchase(token: string, init: Partial<FakePurchase> & { productId: string }): FakePurchase {
    const purchase: FakePurchase = {
      packageName: 'com.example.game1',
      state: 'PURCHASED',
      quantity: 1,
      refundableQuantity: init.quantity ?? 1,
      consumed: false,
      acknowledged: false,
      obfuscatedAccountId: null,
      orderId: `GPA.0000-0000-0000-${String(++this.orderSeq).padStart(5, '0')}`,
      test: true,
      rental: false,
      lineItemCount: 1,
      completionTime: new Date().toISOString(),
      ...init,
    };
    this.purchases.set(token, purchase);
    return purchase;
  }

  /**
   * Makes `times` calls of an operation fail with an HTTP status or a network failure, after
   * letting the next `skip` calls succeed.
   */
  failNext(op: Op, status: FailureMode, times = 1, skip = 0): void {
    this.failures.push({ op, status, remaining: times, skip });
  }

  count(op: Op): number {
    return this.calls.filter((c) => c.op === op).length;
  }

  /** Simulates Google voiding a purchase (refund, chargeback or revocation). */
  voidPurchase(token: string, opts: { quantity?: number; seenAtMs: number; reason?: number; source?: number }): void {
    const purchase = this.purchases.get(token);
    if (!purchase) throw new Error(`no fake purchase ${token}`);
    const refunded = opts.quantity ?? purchase.refundableQuantity ?? purchase.quantity;
    purchase.refundableQuantity = Math.max(0, (purchase.refundableQuantity ?? purchase.quantity) - refunded);
    if (opts.quantity === undefined || purchase.refundableQuantity === 0) purchase.state = 'CANCELLED';
    this.voided.push({
      packageName: purchase.packageName,
      purchaseToken: token,
      orderId: purchase.orderId,
      voidedTimeMillis: opts.seenAtMs,
      ...(opts.quantity !== undefined && purchase.refundableQuantity > 0 ? { voidedQuantity: opts.quantity } : {}),
      voidedReason: opts.reason ?? 1,
      voidedSource: opts.source ?? 0,
      seenAtMs: opts.seenAtMs,
    });
  }

  private takeFailure(op: Op): Failure['status'] | undefined {
    const failure = this.failures.find((f) => f.op === op && f.remaining > 0);
    if (!failure) return undefined;
    if (failure.skip > 0) {
      failure.skip--;
      return undefined;
    }
    failure.remaining--;
    return failure.status;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://fake');
    // Match on the raw path and decode each segment, as a real server does, so a token that
    // contains "/" or ".." cannot reach a different resource.
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams.entries());
    let op: Op;
    let match: RegExpExecArray | null;
    if ((match = /^\/androidpublisher\/v3\/applications\/([^/]+)\/purchases\/productsv2\/tokens\/([^/]+)$/.exec(path)) && req.method === 'GET') {
      op = 'get';
    } else if ((match = /^\/androidpublisher\/v3\/applications\/([^/]+)\/purchases\/products\/([^/]+)\/tokens\/([^/]+):(consume|acknowledge)$/.exec(path)) && req.method === 'POST') {
      op = match[4] === 'consume' ? 'consume' : 'acknowledge';
    } else if ((match = /^\/androidpublisher\/v3\/applications\/([^/]+)\/purchases\/voidedpurchases$/.exec(path)) && req.method === 'GET') {
      op = 'voided';
    } else if ((match = /^\/androidpublisher\/v3\/applications\/([^/]+)\/orders\/([^/]+):refund$/.exec(path)) && req.method === 'POST') {
      op = 'refund';
    } else {
      return this.error(res, 404, 'Not found');
    }
    const segments = match.map((m) => (m === undefined ? m : decodeURIComponent(m)));
    await readBody(req);

    if (req.headers.authorization !== `Bearer ${FAKE_ACCESS_TOKEN}`) {
      return this.error(res, 401, 'Request is missing required authentication credential.');
    }

    const packageName = segments[1]!;
    const token = op === 'get' ? segments[2] : op === 'consume' || op === 'acknowledge' ? segments[3] : undefined;
    const productId = op === 'consume' || op === 'acknowledge' ? segments[2] : undefined;
    this.calls.push({ op, ...(token ? { token } : {}), ...(productId ? { productId } : {}), query });

    const failure = this.takeFailure(op);
    if (failure === 'hang') return; // never answer; the client must time out
    if (failure === 'reset') {
      req.socket.destroy();
      return;
    }
    if (typeof failure === 'number') return this.error(res, failure, 'Injected failure');
    if (failure === 'lost-response') this.dropping.add(res);

    switch (op) {
      case 'get': {
        const purchase = this.purchases.get(token!);
        if (!purchase || purchase.packageName !== packageName) return this.error(res, 400, 'Invalid Value');
        return this.send(res, 200, productPurchaseV2(purchase));
      }
      case 'consume':
      case 'acknowledge': {
        const purchase = this.purchases.get(token!);
        if (!purchase || purchase.packageName !== packageName || purchase.productId !== productId) {
          return this.error(res, 400, 'Invalid Value');
        }
        if (purchase.state !== 'PURCHASED') {
          return this.error(res, 400, 'The purchase is not in a valid state to perform the desired operation.');
        }
        if (op === 'consume') {
          if (purchase.consumed) return this.error(res, 400, 'The purchase has already been consumed.');
          purchase.consumed = true;
          purchase.acknowledged = true;
        } else {
          if (purchase.acknowledged) return this.error(res, 400, 'The purchase has already been acknowledged.');
          purchase.acknowledged = true;
        }
        return this.send(res, 204);
      }
      case 'voided': {
        return this.send(res, 200, this.listVoided(packageName, query));
      }
      case 'refund': {
        const orderId = segments[2]!;
        const revoke = query.revoke === 'true';
        const entry = [...this.purchases.entries()].find(([, p]) => p.orderId === orderId && p.packageName === packageName);
        if (!entry) return this.error(res, 404, 'Order not found');
        this.refunds.push({ orderId, revoke });
        if (revoke) this.voidPurchase(entry[0], { seenAtMs: Date.now(), source: 1, reason: 0 });
        return this.send(res, 204);
      }
    }
  }

  private listVoided(packageName: string, query: Record<string, string>) {
    const includePartial = query.includeQuantityBasedPartialRefund === 'true';
    // A page token carries the offset; follow-up pages reuse the first request's time window.
    const offset = query.token ? Number(Buffer.from(query.token, 'base64url').toString('utf8')) : 0;
    if (!query.token) this.lastWindow = [Number(query.startTime ?? 0), Number(query.endTime ?? Date.now())];
    const [start, end] = this.lastWindow;
    const candidates = this.voided.filter(
      (v) =>
        v.packageName === packageName &&
        (includePartial || v.voidedQuantity === undefined) &&
        v.seenAtMs >= start &&
        v.seenAtMs <= end,
    );
    const page = candidates.slice(offset, offset + this.pageSize);
    const next = offset + this.pageSize < candidates.length ? Buffer.from(String(offset + this.pageSize)).toString('base64url') : undefined;
    return {
      voidedPurchases: page.map((v) => ({
        kind: 'androidpublisher#voidedPurchase',
        purchaseToken: v.purchaseToken,
        orderId: v.orderId ?? undefined,
        voidedTimeMillis: String(v.voidedTimeMillis),
        purchaseTimeMillis: String(v.voidedTimeMillis - 60_000),
        voidedReason: v.voidedReason,
        voidedSource: v.voidedSource,
        ...(v.voidedQuantity !== undefined ? { voidedQuantity: v.voidedQuantity } : {}),
      })),
      ...(next ? { tokenPagination: { nextPageToken: next } } : {}),
    };
  }

  private lastWindow: [number, number] = [0, 0];
  private readonly dropping = new WeakSet<ServerResponse>();

  private send(res: ServerResponse, status: number, body?: unknown): void {
    if (this.dropping.has(res)) {
      res.socket?.destroy();
      return;
    }
    res.statusCode = status;
    if (body === undefined) {
      res.end();
      return;
    }
    res.setHeader('content-type', 'application/json; charset=UTF-8');
    res.end(JSON.stringify(body));
  }

  private error(res: ServerResponse, status: number, message: string): void {
    this.send(res, status, {
      error: { code: status, message, errors: [{ message, domain: 'global', reason: status === 400 ? 'invalid' : 'backendError' }] },
    });
  }
}

function productPurchaseV2(p: FakePurchase) {
  const lineItem = {
    productId: p.productId,
    productOfferDetails: {
      quantity: p.quantity,
      ...(p.refundableQuantity !== null ? { refundableQuantity: p.refundableQuantity } : {}),
      consumptionState: p.consumed ? 'CONSUMPTION_STATE_CONSUMED' : 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
      purchaseOptionId: 'buy',
      offerToken: 'offer-token',
      ...(p.rental ? { rentOfferDetails: {} } : {}),
    },
  };
  return {
    kind: 'androidpublisher#productPurchaseV2',
    productLineItem: Array.from({ length: p.lineItemCount }, () => lineItem),
    purchaseStateContext: { purchaseState: p.state },
    acknowledgementState: p.acknowledged ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING',
    ...(p.obfuscatedAccountId ? { obfuscatedExternalAccountId: p.obfuscatedAccountId } : {}),
    ...(p.orderId ? { orderId: p.orderId } : {}),
    ...(p.test ? { testPurchaseContext: { fopType: 'TEST' } } : {}),
    regionCode: 'TH',
    ...(p.state === 'PURCHASED' && p.completionTime ? { purchaseCompletionTime: p.completionTime } : {}),
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
