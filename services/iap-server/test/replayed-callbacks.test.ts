import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestIssuer, unsignedToken } from './support/keys.js';
import {
  GAME2_PACKAGE,
  Harness,
  LOG_ERROR,
  newPurchaseToken,
  ONE_TIME_PRODUCT_CANCELED,
  PUSH_AUDIENCE,
  PUSH_SERVICE_ACCOUNT,
  purchaseNotification,
  TEST_SUBSCRIPTION,
  voidedNotification,
} from './support/harness.js';

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

describe('replayed notifications', () => {
  it('processes a Pub/Sub message once, however often it is delivered', async () => {
    const token = await h.buy('player-a', 'gems_100');
    const notification = purchaseNotification(token);

    const first = await h.push(notification, { messageId: 'm-1' });
    const second = await h.push(notification, { messageId: 'm-1' });

    expect(first.body).toEqual({ outcome: 'processed' });
    expect(second.body).toEqual({ outcome: 'duplicate' });
    expect(h.fake.count('get')).toBe(1);
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('does not grant again when the same notification is re-sent under new message ids', async () => {
    const token = await h.buy('player-a', 'gems_100');

    for (let i = 0; i < 5; i++) {
      expect((await h.push(purchaseNotification(token))).status).toBe(200);
    }

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect(await h.ledger()).toHaveLength(1);
  });

  it('does not re-grant a refunded purchase when an old purchase notification is replayed', async () => {
    const token = await h.buy('player-a', 'gems_100');
    const purchased = purchaseNotification(token);
    await h.push(purchased);
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });
    await h.push(voidedNotification(token, { orderId: h.fake.purchases.get(token)!.orderId! }));

    await h.push(purchased);

    expect((await h.purchaseRow(token))!.state).toBe('revoked');
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
  });

  it('re-reads Google instead of trusting what a notification says', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });

    await h.push(purchaseNotification(token));

    expect((await h.purchaseRow(token))!.state).toBe('pending');
    expect(await h.ledger()).toHaveLength(0);
  });

  it('ignores a notification for a token Google does not know', async () => {
    const res = await h.push(purchaseNotification(newPurchaseToken()));

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('processed');
    expect((await h.pool.query('SELECT 1 FROM play_purchases')).rowCount).toBe(0);
  });

  it('returns 5xx while Google is unavailable so Pub/Sub redelivers, then processes the retry', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('get', 503);

    const failed = await h.push(purchaseNotification(token), { messageId: 'm-retry' });
    const redelivered = await h.push(purchaseNotification(token), { messageId: 'm-retry' });

    expect(failed.status).toBe(503);
    expect(redelivered.body).toEqual({ outcome: 'processed' });
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('acknowledges and drops undecodable notifications instead of retrying them forever', async () => {
    const res = await h.push(undefined, { rawData: Buffer.from('not json').toString('base64'), messageId: 'm-bad' });
    const again = await h.push(undefined, { rawData: Buffer.from('not json').toString('base64'), messageId: 'm-bad' });

    expect(res.body).toEqual({ outcome: 'ignored' });
    expect(again.body).toEqual({ outcome: 'duplicate' });
    expect(h.logs.messages(LOG_ERROR)).toContain('malformed developer notification; acknowledged and dropped');
  });

  it('ignores notifications for apps that are not in the catalog', async () => {
    const res = await h.push(purchaseNotification(newPurchaseToken(), { packageName: 'com.example.other' }));
    expect(res.body).toEqual({ outcome: 'ignored' });
    expect(h.fake.calls).toHaveLength(0);
  });

  it('accepts the Play Console test notification', async () => {
    const res = await h.push({ version: '1.0', packageName: GAME2_PACKAGE, eventTimeMillis: String(Date.now()), testNotification: { version: '1.0' } });
    expect(res.body).toEqual({ outcome: 'processed' });
  });

  it('ignores subscription notifications, which this server does not support', async () => {
    const res = await h.push({
      version: '1.0',
      packageName: 'com.example.game1',
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: { version: '1.0', notificationType: 4, purchaseToken: newPurchaseToken(), subscriptionId: 'vip' },
    });
    expect(res.body).toEqual({ outcome: 'ignored' });
    expect(h.fake.calls).toHaveLength(0);
  });

  it('ignores pushes from a subscription other than the configured one', async () => {
    await h.reset({ rtdnExpectedSubscription: TEST_SUBSCRIPTION });
    const token = await h.buy('player-a', 'gems_100');

    const wrong = await h.push(purchaseNotification(token), { subscription: 'projects/x/subscriptions/other' });
    const right = await h.push(purchaseNotification(token));

    expect(wrong.body).toEqual({ outcome: 'ignored' });
    expect(right.body).toEqual({ outcome: 'processed' });
  });

  it('cancels a pending purchase on ONE_TIME_PRODUCT_CANCELED after checking with Google', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);
    h.fake.purchases.get(token)!.state = 'CANCELLED';

    await h.push(purchaseNotification(token, { type: ONE_TIME_PRODUCT_CANCELED }));

    expect((await h.purchaseRow(token))!.state).toBe('canceled');
  });
});

describe('forged notifications', () => {
  async function expectRefused(authorization: string | undefined): Promise<void> {
    const token = await h.buy('player-a', 'gems_100');
    const res = await h.call('POST', '/v1/rtdn/google-play', {
      ...(authorization !== undefined ? { authorization } : {}),
      body: h.pushEnvelope(purchaseNotification(token)),
    });
    expect(res.status).toBe(401);
    expect(h.fake.calls).toHaveLength(0);
    expect((await h.pool.query('SELECT 1 FROM rtdn_messages')).rowCount).toBe(0);
    expect(await h.ledger()).toHaveLength(0);
  }

  it('refuses a push without a token', async () => {
    await expectRefused(undefined);
  });

  it('refuses a malformed authorization header', async () => {
    await expectRefused('Basic dXNlcjpwYXNz');
    await expectRefused('Bearer not-a-jwt');
  });

  it('refuses a token minted for a different audience', async () => {
    await expectRefused(`Bearer ${await h.pushToken({ aud: 'https://attacker.example/push' })}`);
  });

  it('refuses a token for a different service account', async () => {
    await expectRefused(`Bearer ${await h.pushToken({ email: 'someone@attacker.iam.gserviceaccount.com' })}`);
  });

  it('refuses a token whose email is not verified', async () => {
    await expectRefused(`Bearer ${await h.pushToken({ email_verified: false })}`);
  });

  it('refuses a token from another issuer', async () => {
    await expectRefused(`Bearer ${await h.pushToken({ iss: 'https://evil.example' })}`);
  });

  it('refuses an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectRefused(`Bearer ${await h.pushToken({}, { issuedAt: now - 7200, expiresAt: now - 3600 })}`);
  });

  it('refuses a token signed by a key Google does not publish', async () => {
    const attacker = await createTestIssuer('google-key-1');
    const forged = await attacker.sign({
      iss: 'https://accounts.google.com',
      aud: PUSH_AUDIENCE,
      email: PUSH_SERVICE_ACCOUNT,
      email_verified: true,
    });
    await expectRefused(`Bearer ${forged}`);
  });

  it('refuses unsigned and symmetric-algorithm tokens', async () => {
    const claims = { iss: 'https://accounts.google.com', aud: PUSH_AUDIENCE, email: PUSH_SERVICE_ACCOUNT, email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) };
    await expectRefused(`Bearer ${unsignedToken({ alg: 'none', typ: 'JWT' }, claims)}`);
    await expectRefused(`Bearer ${unsignedToken({ alg: 'HS256', typ: 'JWT', kid: 'google-key-1' }, claims, 'c2lnbmF0dXJl')}`);
  });

  it('refuses a player session token on the notification endpoint', async () => {
    await expectRefused(`Bearer ${await h.playerToken('player-a')}`);
  });
});
