import { errors } from 'jose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createJwtPlayerAuthenticator } from '../src/auth/player-auth.js';
import { createTestIssuer, unsignedToken } from './support/keys.js';
import { Harness, newPurchaseToken, PLAYER_AUDIENCE, PLAYER_ISSUER, purchaseNotification } from './support/harness.js';

let h: Harness;

beforeAll(async () => {
  h = await Harness.start();
});
afterAll(async () => {
  await h.stop();
});
beforeEach(async () => {
  await h.reset();
});
afterEach(async () => {
  await h.assertLedgerConsistent();
});

describe('purchase ownership', () => {
  it("refuses another player's purchase and records the attempt", async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.billingAccount('player-b');

    const res = await h.verify('player-b', 'gems_100', token);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('purchase_not_owned');
    expect((await h.wallet('player-b')).balances).toEqual({});
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);
    const events = await h.pool.query<{ event: string; detail: { claimant: string } }>(
      'SELECT event, detail FROM play_purchase_events',
    );
    expect(events.rows).toEqual([{ event: 'ownership_mismatch', detail: { claimant: 'player-b' } }]);
  });

  it('still grants the purchase to the player who made it', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-b', 'gems_100', token);

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('grants to the buyer from the notification alone, and keeps refusing the other player', async () => {
    const token = await h.buy('player-a', 'gems_100');

    await h.push(purchaseNotification(token));
    const res = await h.verify('player-b', 'gems_100', token);

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect(res.status).toBe(403);
    expect((await h.wallet('player-b')).balances).toEqual({});
  });

  it('holds a purchase whose account id belongs to no player of this game', async () => {
    const token = newPurchaseToken();
    h.fake.addPurchase(token, { productId: 'gems_100', obfuscatedAccountId: 'not-issued-by-this-server' });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    expect((await h.purchaseRow(token))!.rejection_reason).toBe('unknown_account_binding');
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);
  });

  it("does not accept one game's account id in another game", async () => {
    const game2AccountId = await h.billingAccount('player-a', 'game2');
    const token = newPurchaseToken();
    h.fake.addPurchase(token, { productId: 'gems_100', obfuscatedAccountId: game2AccountId });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    expect((await h.purchaseRow(token))!.rejection_reason).toBe('unknown_account_binding');
  });

  it('issues a stable, random account id per player and game that does not reveal the player id', async () => {
    const a1 = await h.billingAccount('player-a');
    const a2 = await h.billingAccount('player-a');
    const b = await h.billingAccount('player-b');
    const aGame2 = await h.billingAccount('player-a', 'game2');
    const concurrent = await Promise.all(Array.from({ length: 10 }, () => h.billingAccount('player-c')));

    expect(a1).toBe(a2);
    expect(new Set([a1, b, aGame2]).size).toBe(3);
    expect(new Set(concurrent).size).toBe(1);
    expect(a1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a1).not.toContain('player');
  });

  describe('purchases without an account id (promo codes redeemed in the Play Store)', () => {
    function outOfAppPurchase(): string {
      const token = newPurchaseToken();
      h.fake.addPurchase(token, { productId: 'gems_100', obfuscatedAccountId: null, orderId: null });
      return token;
    }

    it('binds the purchase to the first signed-in player who claims it', async () => {
      const token = outOfAppPurchase();

      const a = await h.verify('player-a', 'gems_100', token);
      const b = await h.verify('player-b', 'gems_100', token);

      expect(a.body.status).toBe('granted');
      expect(b.status).toBe(403);
      expect(await h.balances('player-a')).toEqual({ gems: 100 });
      expect((await h.wallet('player-b')).balances).toEqual({});
    });

    it('lets exactly one of two players racing to claim it win', async () => {
      const token = outOfAppPurchase();

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => h.verify(i % 2 === 0 ? 'player-a' : 'player-b', 'gems_100', token)),
      );

      const owner = (await h.purchaseRow(token))!.player_id;
      expect(owner === 'player-a' || owner === 'player-b').toBe(true);
      for (const [i, r] of results.entries()) {
        const claimant = i % 2 === 0 ? 'player-a' : 'player-b';
        expect(r.status).toBe(claimant === owner ? 200 : 403);
      }
      expect(await h.ledger()).toHaveLength(1);
    });

    it('waits for a claim when the notification arrives first', async () => {
      const token = outOfAppPurchase();

      await h.push(purchaseNotification(token));
      expect((await h.purchaseRow(token))!.state).toBe('unclaimed');
      expect(await h.ledger()).toHaveLength(0);

      expect((await h.verify('player-a', 'gems_100', token)).body.status).toBe('granted');
    });

    it('is refused when the server requires an account id', async () => {
      await h.reset({ policy: { requireObfuscatedAccountId: true } });
      const token = outOfAppPurchase();

      const res = await h.verify('player-a', 'gems_100', token);

      expect(res.status).toBe(422);
      expect((await h.purchaseRow(token))!.rejection_reason).toBe('missing_account_binding');
    });
  });
});

describe('player authentication', () => {
  async function expectUnauthorized(authorization: string | undefined): Promise<void> {
    const res = await h.call('POST', '/v1/games/game1/purchases/google-play', {
      ...(authorization !== undefined ? { authorization } : {}),
      body: { productId: 'gems_100', purchaseToken: newPurchaseToken() },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  }

  const now = () => Math.floor(Date.now() / 1000);

  it('requires a session token on every player endpoint', async () => {
    await expectUnauthorized(undefined);
    expect((await h.call('GET', '/v1/games/game1/wallet')).status).toBe(401);
    expect((await h.call('POST', '/v1/games/game1/billing/account')).status).toBe(401);
    expect(h.fake.calls).toHaveLength(0);
  });

  it('refuses malformed, unsigned and wrongly signed tokens', async () => {
    await expectUnauthorized('Bearer ');
    await expectUnauthorized('Bearer abc.def');
    await expectUnauthorized(`Bearer ${unsignedToken({ alg: 'none' }, { iss: PLAYER_ISSUER, aud: PLAYER_AUDIENCE, sub: 'player-a', iat: now(), exp: now() + 600 })}`);
    const attacker = await createTestIssuer('player-key-1');
    await expectUnauthorized(`Bearer ${await attacker.sign({ iss: PLAYER_ISSUER, aud: PLAYER_AUDIENCE, sub: 'player-a' })}`);
  });

  it('refuses tokens for another issuer or audience, expired tokens and tokens without a subject', async () => {
    const sign = (claims: object, opts = {}) => h.playerIssuer.sign({ iss: PLAYER_ISSUER, aud: PLAYER_AUDIENCE, sub: 'player-a', ...claims }, opts);
    await expectUnauthorized(`Bearer ${await sign({ iss: 'https://other-issuer.example' })}`);
    await expectUnauthorized(`Bearer ${await sign({ aud: 'some-other-app' })}`);
    await expectUnauthorized(`Bearer ${await sign({}, { issuedAt: now() - 7200, expiresAt: now() - 3600 })}`);
    await expectUnauthorized(`Bearer ${await sign({}, { issuedAt: now() - 2 * 86400, expiresAt: now() + 3600 })}`);
    await expectUnauthorized(`Bearer ${await sign({ sub: undefined })}`);
    await expectUnauthorized(`Bearer ${await sign({ sub: 'x'.repeat(129) })}`);
  });

  it('refuses a Pub/Sub token used as a player session', async () => {
    await expectUnauthorized(`Bearer ${await h.pushToken()}`);
  });

  it('answers 503 instead of 401 when the identity provider keys cannot be fetched', async () => {
    const auth = createJwtPlayerAuthenticator({
      keys: () => Promise.reject(new errors.JWKSTimeout()),
      issuer: PLAYER_ISSUER,
      audience: [PLAYER_AUDIENCE],
    });
    await expect(auth.authenticate(`Bearer ${await h.playerToken('player-a')}`)).rejects.toMatchObject({
      httpStatus: 503,
      code: 'auth_unavailable',
      retryable: true,
    });
  });

  it('takes the player id from the verified token, never from the request', async () => {
    const token = await h.buy('player-a', 'gems_100');
    const res = await h.call('POST', '/v1/games/game1/purchases/google-play', {
      playerId: 'player-b',
      body: { productId: 'gems_100', purchaseToken: token, playerId: 'player-a' },
    });
    expect(res.status).toBe(400);
    expect(await h.ledger()).toHaveLength(0);
  });
});
