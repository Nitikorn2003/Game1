import { describe, expect, it } from 'vitest';
import { IapServerClient, ServerError } from '../src/iap-client.js';

interface Sent {
  method: string;
  url: string;
  authorization: string | null;
  body: unknown;
}

function server(answers: (sent: Sent) => { status: number; body?: unknown } | Error) {
  const sent: Sent[] = [];
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const request: Sent = {
      method: init?.method ?? 'GET',
      url: input instanceof Request ? input.url : input.toString(),
      authorization: headers.get('authorization'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    sent.push(request);
    const answer = answers(request);
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(new Response(answer.body === undefined ? null : JSON.stringify(answer.body), { status: answer.status }));
  };
  return { sent, fetch };
}

function tokens() {
  const asked: boolean[] = [];
  return {
    asked,
    idToken: (forceRefresh: boolean) => {
      asked.push(forceRefresh);
      return Promise.resolve(forceRefresh ? 'fresh-token' : 'cached-token');
    },
  };
}

describe('the purchase server client', () => {
  it('sends the signed-in token to the game\'s endpoints', async () => {
    const s = server((r) => (r.url.endsWith('/wallet') ? { status: 200, body: { balances: { gems: 5 }, entitlements: [] } } : { status: 200, body: { id: 'abc12345', amounts: { gems: 5 } } }));
    const client = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'lodelings', idToken: tokens().idToken, fetch: s.fetch });

    expect(await client.wallet()).toEqual({ balances: { gems: 5 }, entitlements: [] });
    expect(await client.settle('abc12345')).toEqual({ id: 'abc12345', amounts: { gems: 5 } });
    expect(s.sent).toEqual([
      { method: 'GET', url: 'https://iap.test/v1/games/lodelings/wallet', authorization: 'Bearer cached-token', body: undefined },
      { method: 'POST', url: 'https://iap.test/v1/games/lodelings/wallet/settlements', authorization: 'Bearer cached-token', body: { settlementId: 'abc12345' } },
    ]);
  });

  it('refreshes an expired token once, and gives up if the server still refuses it', async () => {
    const t = tokens();
    let refusals = 1;
    const s = server(() => (refusals-- > 0 ? { status: 401, body: { error: { code: 'unauthorized', message: 'no', retryable: false } } } : { status: 200, body: { save: null } }));
    const client = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'g', idToken: t.idToken, fetch: s.fetch });
    expect(await client.readSave()).toBeNull();
    expect(t.asked).toEqual([false, true]);
    expect(s.sent[1]?.authorization).toBe('Bearer fresh-token');

    refusals = 2;
    await expect(client.readSave()).rejects.toMatchObject({ status: 401, code: 'unauthorized', retryable: false });
  });

  it('reports a save written by another device as a conflict with that save', async () => {
    const current = { revision: 4, data: 'tablet', updatedAt: '2026-10-29T00:00:00.000Z' };
    const s = server((r) =>
      (r.body as { baseRevision: number }).baseRevision === 3
        ? { status: 409, body: { error: { code: 'save_conflict', message: 'changed', retryable: false }, save: current } }
        : { status: 200, body: { save: { ...current, revision: 5, data: 'phone' } } },
    );
    const client = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'g', idToken: tokens().idToken, fetch: s.fetch });
    expect(await client.writeSave(3, 'phone')).toEqual({ status: 'conflict', current });
    expect(await client.writeSave(4, 'phone')).toMatchObject({ status: 'saved', save: { revision: 5 } });
    expect(s.sent[0]).toMatchObject({ method: 'PUT', body: { baseRevision: 3, data: 'phone' } });
  });

  it('turns network failures and server errors into retryable or final errors', async () => {
    const offline = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'g', idToken: tokens().idToken, fetch: server(() => new TypeError('Failed to fetch')).fetch });
    await expect(offline.wallet()).rejects.toMatchObject({ code: 'network', retryable: true });

    const busy = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'g', idToken: tokens().idToken, fetch: server(() => ({ status: 503 })).fetch });
    const error = await busy.wallet().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServerError);
    expect(error).toMatchObject({ status: 503, retryable: true });

    const unknown = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'nope', idToken: tokens().idToken, fetch: server(() => ({ status: 404, body: { error: { code: 'unknown_game', message: 'Unknown game.', retryable: false } } })).fetch });
    await expect(unknown.deletePlayer()).rejects.toMatchObject({ code: 'unknown_game', retryable: false });
  });

  it('does not call the server while signed out', async () => {
    const s = server(() => ({ status: 200, body: {} }));
    const client = new IapServerClient({ baseUrl: 'https://iap.test', gameId: 'g', idToken: () => Promise.resolve(null), fetch: s.fetch });
    await expect(client.wallet()).rejects.toMatchObject({ code: 'signed_out', retryable: true });
    expect(s.sent).toEqual([]);
  });
});
