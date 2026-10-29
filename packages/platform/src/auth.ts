export interface Account {
  playerId: string;
  /** A guest account lives only on this device until it is linked to Google. */
  guest: boolean;
  email: string | null;
}

export type LinkResult = 'linked' | 'cancelled' | 'already_used' | 'failed';

/** Who the player is to the game's server. */
export interface AuthService {
  /** The signed-in account, signing in as a guest first if nobody is. Null when that is not possible now. */
  account(): Promise<Account | null>;
  /** A token proving the account to the server, or null when signed out. */
  idToken(forceRefresh: boolean): Promise<string | null>;
  /** Adds Google sign-in to the current account, so its progress and purchases survive a reinstall. */
  linkGoogle(): Promise<LinkResult>;
  /** Signs in with a Google account that already has a save, leaving the guest account. */
  switchToGoogle(): Promise<LinkResult>;
  /** Deletes the sign-in account. Delete its server data first, while the token still works. */
  deleteAccount(): Promise<void>;
}

/** Signed out for good: the browser version has no server, so it never signs in. */
export const noAuth: AuthService = {
  account: () => Promise.resolve(null),
  idToken: () => Promise.resolve(null),
  linkGoogle: () => Promise.resolve('failed'),
  switchToGoogle: () => Promise.resolve('failed'),
  deleteAccount: () => Promise.resolve(),
};

interface FirebaseUser {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
}

/** The parts of FirebaseAuthentication from @capacitor-firebase/authentication used here. */
export interface FirebaseAuthenticationPlugin {
  getCurrentUser(): Promise<{ user: FirebaseUser | null }>;
  signInAnonymously(): Promise<{ user: FirebaseUser | null }>;
  signInWithGoogle(): Promise<{ user: FirebaseUser | null }>;
  linkWithGoogle(): Promise<{ user: FirebaseUser | null }>;
  getIdToken(options?: { forceRefresh: boolean }): Promise<{ token: string }>;
  deleteUser(): Promise<void>;
}

const view = (user: FirebaseUser): Account => ({ playerId: user.uid, guest: user.isAnonymous, email: user.email });

function codeOf(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
  return typeof code === 'string' ? code : '';
}

function linkFailure(err: unknown): LinkResult {
  const code = codeOf(err);
  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') return 'already_used';
  // A closed Google sheet comes back as Google's status 12501 (SIGN_IN_CANCELLED) or "Authorization canceled."
  const message = err instanceof Error ? err.message : String(err);
  if (/\b12501\b|cancel/i.test(message)) return 'cancelled';
  return 'failed';
}

/**
 * Firebase Authentication on Android: players start as guests (anonymous accounts) with no sign-in
 * screen, and can link Google later. The server checks the Firebase ID token (AUTH_* settings).
 */
export class FirebaseAuth implements AuthService {
  private signingIn: Promise<Account | null> | null = null;

  constructor(private readonly firebase: FirebaseAuthenticationPlugin) {}

  account(): Promise<Account | null> {
    this.signingIn ??= this.signIn().finally(() => {
      this.signingIn = null;
    });
    return this.signingIn;
  }

  async idToken(forceRefresh: boolean): Promise<string | null> {
    if (!(await this.account())) return null;
    try {
      return (await this.firebase.getIdToken({ forceRefresh })).token;
    } catch {
      return null;
    }
  }

  async linkGoogle(): Promise<LinkResult> {
    if (!(await this.account())) return 'failed';
    try {
      const { user } = await this.firebase.linkWithGoogle();
      return user ? 'linked' : 'failed';
    } catch (err) {
      return linkFailure(err);
    }
  }

  async switchToGoogle(): Promise<LinkResult> {
    try {
      const { user } = await this.firebase.signInWithGoogle();
      return user ? 'linked' : 'failed';
    } catch (err) {
      return linkFailure(err);
    }
  }

  async deleteAccount(): Promise<void> {
    await this.firebase.deleteUser();
  }

  private async signIn(): Promise<Account | null> {
    try {
      const current = (await this.firebase.getCurrentUser()).user;
      if (current) return view(current);
      const { user } = await this.firebase.signInAnonymously();
      return user ? view(user) : null;
    } catch {
      // Offline or Firebase is not set up: the game still plays, without cloud saves or purchases.
      return null;
    }
  }
}
