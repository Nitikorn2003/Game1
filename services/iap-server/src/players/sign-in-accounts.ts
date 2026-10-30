import { auth as googleAuth } from '@googleapis/androidpublisher';

export const IDENTITY_TOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

/** Players' sign-in accounts at the identity provider, deleted together with their data. */
export interface SignInAccounts {
  /** Deletes the account; one that is already gone counts as deleted. Throws SignInAccountsError. */
  delete(uid: string): Promise<void>;
}

export class SignInAccountsError extends Error {
  constructor(
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'SignInAccountsError';
  }
}

/** The part of a Google auth client used here; GoogleAuth and OAuth2Client both have it. */
export interface AuthorizedRequester {
  request(options: { url: string; method: 'POST'; data: unknown; timeout: number; retry: boolean }): Promise<unknown>;
}

export interface FirebaseSignInAccountsOptions {
  projectId: string;
  timeoutMs: number;
  /** Defaults to Application Default Credentials, the same ones the Play Developer API uses. */
  auth?: AuthorizedRequester;
  /** Only overridden by tests that point the client at a local fake. */
  rootUrl?: string;
}

/**
 * Firebase Authentication users, deleted through the Identity Toolkit API. The server's
 * service account needs the Firebase Authentication Admin role in that Firebase project. Then
 * deleting a player never needs a fresh sign-in on the phone, which Firebase asks for when the
 * phone deletes its own account.
 */
export function firebaseSignInAccounts(options: FirebaseSignInAccountsOptions): SignInAccounts {
  const client = options.auth ?? new googleAuth.GoogleAuth({ scopes: [IDENTITY_TOOLKIT_SCOPE] });
  const root = options.rootUrl ?? 'https://identitytoolkit.googleapis.com/';
  const url = `${root}v1/projects/${encodeURIComponent(options.projectId)}/accounts:delete`;
  return {
    async delete(uid) {
      try {
        // Retries belong to the caller, whose request is safe to repeat.
        await client.request({ url, method: 'POST', data: { localId: uid }, timeout: options.timeoutMs, retry: false });
      } catch (err) {
        const { status, message } = describe(err);
        if (status === 404 || message.startsWith('USER_NOT_FOUND')) return;
        const retryable = status === null || status === 408 || status === 429 || status >= 500;
        throw new SignInAccountsError(retryable, `Deleting the sign-in account failed (${status ?? 'no response'}): ${message}`);
      }
    },
  };
}

function describe(err: unknown): { status: number | null; message: string } {
  const response = typeof err === 'object' && err !== null && 'response' in err ? (err as { response?: { status?: unknown; data?: unknown } }).response : undefined;
  const status = typeof response?.status === 'number' ? response.status : null;
  const body = response?.data as { error?: { message?: unknown } } | undefined;
  const message = typeof body?.error?.message === 'string' ? body.error.message : err instanceof Error ? err.message : String(err);
  return { status, message };
}
