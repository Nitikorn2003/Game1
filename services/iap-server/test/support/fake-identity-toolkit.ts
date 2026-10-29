import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FAKE_ACCESS_TOKEN } from './fake-play-api.js';

/**
 * A local stand-in for the Identity Toolkit API's accounts:delete, which Firebase Admin uses to
 * delete users, with the same path, body and error shape. No real accounts are involved.
 */
export class FakeIdentityToolkit {
  readonly users = new Set<string>();
  readonly calls: { project: string; localId: unknown; authorization: string | undefined }[] = [];
  /** HTTP statuses for the next calls to answer with instead of doing the work. */
  failures: number[] = [];
  private server: Server | undefined;
  url = '';

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  reset(): void {
    this.users.clear();
    this.calls.length = 0;
    this.failures = [];
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const match = /^\/v1\/projects\/([^/]+)\/accounts:delete$/.exec(req.url ?? '');
    if (req.method !== 'POST' || !match) return this.error(res, 404, 'NOT_FOUND');
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { localId?: unknown };
    this.calls.push({ project: decodeURIComponent(match[1]!), localId: body.localId, authorization: req.headers.authorization });
    if (req.headers.authorization !== `Bearer ${FAKE_ACCESS_TOKEN}`) return this.error(res, 401, 'UNAUTHENTICATED');
    const failure = this.failures.shift();
    if (failure !== undefined) return this.error(res, failure, failure === 403 ? 'PERMISSION_DENIED' : 'BACKEND_ERROR');
    if (typeof body.localId !== 'string' || !this.users.delete(body.localId)) return this.error(res, 400, 'USER_NOT_FOUND');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ kind: 'identitytoolkit#DeleteAccountResponse' }));
  }

  private error(res: ServerResponse, status: number, message: string): void {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: status, message, errors: [{ message, domain: 'global', reason: 'invalid' }] } }));
  }
}
