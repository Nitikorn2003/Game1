import type { Settlement, WalletView } from './store.js';

export interface CloudSave {
  revision: number;
  data: string;
  updatedAt: string;
}

export type SaveWrite = { status: 'saved'; save: CloudSave } | { status: 'conflict'; current: CloudSave | null };

export interface IapServerOptions {
  /** For example https://iap.example.com, without a trailing slash. */
  baseUrl: string;
  gameId: string;
  /** The signed-in player's ID token, or null when nobody can be signed in right now. */
  idToken: (forceRefresh: boolean) => Promise<string | null>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** A refusal or failure from the purchase server. Keep the work and try again when retryable. */
export class ServerError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ServerError';
  }
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; retryable?: unknown };
  save?: CloudSave | null;
}

/** The game's calls to services/iap-server. Purchases themselves go through the Android billing plugin. */
export class IapServerClient {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: IapServerOptions) {
    this.fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  wallet(): Promise<WalletView> {
    return this.request<WalletView>('GET', '/wallet');
  }

  settle(settlementId: string): Promise<Settlement> {
    return this.request<Settlement>('POST', '/wallet/settlements', { settlementId });
  }

  async readSave(): Promise<CloudSave | null> {
    return (await this.request<{ save: CloudSave | null }>('GET', '/save')).save;
  }

  async writeSave(baseRevision: number | null, data: string): Promise<SaveWrite> {
    try {
      const { save } = await this.request<{ save: CloudSave }>('PUT', '/save', { baseRevision, data });
      return { status: 'saved', save };
    } catch (err) {
      if (err instanceof ConflictError) return { status: 'conflict', current: err.current };
      throw err;
    }
  }

  /**
   * Deletes the player's data on the server, and their sign-in account when the server is set up
   * to. signInDeleted false means the app must delete the sign-in account itself.
   */
  async deletePlayer(): Promise<{ signInDeleted: boolean }> {
    const body = await this.request<{ signInDeleted?: unknown }>('DELETE', '/player');
    return { signInDeleted: body.signInDeleted === true };
  }

  private async request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const token = await this.options.idToken(retried);
    if (token === null) throw new ServerError(401, 'signed_out', 'Not signed in.', true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.options.timeoutMs ?? 15_000);
    let res: Response;
    try {
      res = await this.fetch(`${this.options.baseUrl}/v1/games/${encodeURIComponent(this.options.gameId)}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ServerError(0, 'network', err instanceof Error ? err.message : String(err), true);
    } finally {
      clearTimeout(timer);
    }
    // An expired token is refreshed once; a second refusal means the session is really gone.
    if (res.status === 401 && !retried) return this.request<T>(method, path, body, true);
    const parsed: unknown = await res.json().catch(() => null);
    if (res.ok) return parsed as T;
    const error = (parsed as ErrorBody | null)?.error;
    const code = typeof error?.code === 'string' ? error.code : 'http_error';
    if (res.status === 409 && code === 'save_conflict') throw new ConflictError((parsed as ErrorBody).save ?? null);
    throw new ServerError(
      res.status,
      code,
      typeof error?.message === 'string' ? error.message : `HTTP ${res.status}`,
      typeof error?.retryable === 'boolean' ? error.retryable : res.status >= 500 || res.status === 429,
    );
  }
}

class ConflictError extends ServerError {
  constructor(readonly current: CloudSave | null) {
    super(409, 'save_conflict', 'The cloud save changed since this device read it.', false);
  }
}
