import { ManualClock, MemoryStore, localDayKey } from '@game1/engine';
import { TestStore, type AdsService, type AuthService, type CloudSave, type LinkResult, type SaveWrite, type StoreService } from '@game1/platform';
import { manualFrames } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type AccountOptions } from '../src/game.js';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { T0 } from './helpers.js';

const noAds: AdsService = {
  name: 'admob',
  init: () => Promise.resolve(),
  showRewarded: () => Promise.resolve('unavailable'),
  showInterstitial: () => Promise.resolve(false),
  privacyOptionsRequired: () => false,
  showPrivacyOptions: () => Promise.resolve(),
};

/** The purchase server and Firebase, shared by every phone in a test. */
class World {
  readonly clock = new ManualClock(T0);
  readonly saves = new Map<string, CloudSave>();
  /** Google accounts, and the player each one signs in as. */
  readonly google = new Map<string, string>();
  readonly deletedSignIns: string[] = [];
  serverDeletesSignIn = true;
  offline = false;
  private readonly wallets = new Map<string, TestStore>();
  private players = 0;

  newPlayer(kind: string): string {
    this.players += 1;
    return `${kind}-${this.players}`;
  }

  /** A player's wallet on the server: what they bought and has not been moved into a save yet. */
  wallet(player: string): TestStore {
    let wallet = this.wallets.get(player);
    if (!wallet) {
      wallet = new TestStore(CATALOG, new MemoryStore(), { ask: () => Promise.resolve('buy') });
      this.wallets.set(player, wallet);
    }
    return wallet;
  }

  forgetSignIn(player: string): void {
    this.deletedSignIns.push(player);
    for (const [email, owner] of this.google) if (owner === player) this.google.delete(email);
  }
}

/** One phone: its own storage, its own Firebase session, and a Google account to pick. */
class Phone {
  player: string | null = null;
  guest = true;
  /** What happens in Google's sign-in sheet: this account is picked, or the sheet is closed. */
  googlePick = 'me@example.com';
  game!: Game;

  constructor(
    readonly world: World,
    readonly storage = new MemoryStore(),
  ) {}

  private online<T>(work: (player: string) => T): Promise<T> {
    if (this.world.offline || this.player === null) return Promise.reject(new Error('offline'));
    return Promise.resolve(work(this.player));
  }

  readonly auth: AuthService = {
    account: () => {
      if (this.world.offline) return Promise.resolve(null);
      this.player ??= this.world.newPlayer('guest');
      return Promise.resolve({ playerId: this.player, guest: this.guest, email: this.guest ? null : this.googlePick });
    },
    idToken: () => Promise.resolve(this.world.offline ? null : this.player),
    linkGoogle: (): Promise<LinkResult> => {
      if (this.googlePick === 'cancel') return Promise.resolve('cancelled');
      if (this.player === null || this.world.offline) return Promise.resolve('failed');
      if (this.world.google.has(this.googlePick)) return Promise.resolve('already_used');
      this.world.google.set(this.googlePick, this.player);
      this.guest = false;
      return Promise.resolve('linked');
    },
    switchToGoogle: (): Promise<LinkResult> => {
      if (this.googlePick === 'cancel') return Promise.resolve('cancelled');
      let player = this.world.google.get(this.googlePick);
      if (!player) {
        player = this.world.newPlayer('google');
        this.world.google.set(this.googlePick, player);
      }
      this.player = player;
      this.guest = false;
      return Promise.resolve('linked');
    },
    deleteAccount: () => {
      if (this.player) this.world.forgetSignIn(this.player);
      this.player = null;
      this.guest = true;
      return Promise.resolve();
    },
    signOut: () => {
      this.player = null;
      this.guest = true;
      return Promise.resolve();
    },
  };

  readonly server: AccountOptions['server'] = {
    readSave: () => this.online((player) => this.world.saves.get(player) ?? null),
    writeSave: (baseRevision, data) =>
      this.online((player): SaveWrite => {
        const current = this.world.saves.get(player) ?? null;
        if ((current?.revision ?? null) !== baseRevision) return { status: 'conflict', current };
        const save = { revision: (current?.revision ?? 0) + 1, data, updatedAt: new Date(this.world.clock.now()).toISOString() };
        this.world.saves.set(player, save);
        return { status: 'saved', save };
      }),
    deletePlayer: () =>
      this.online((player) => {
        this.world.saves.delete(player);
        if (this.world.serverDeletesSignIn) this.world.forgetSignIn(player);
        return { signInDeleted: this.world.serverDeletesSignIn };
      }),
  };

  readonly store: StoreService = {
    name: 'play',
    products: (ids) => this.world.wallet('prices').products(ids),
    purchase: (id) => this.withWallet((wallet) => wallet.purchase(id)),
    wallet: () => this.withWallet((wallet) => wallet.wallet()),
    settle: (id) => this.withWallet((wallet) => wallet.settle(id)),
    onChange: () => () => undefined,
  };

  private withWallet<T>(work: (wallet: TestStore) => Promise<T>): Promise<T> {
    if (this.world.offline || this.player === null) return Promise.reject(new Error('offline'));
    return work(this.world.wallet(this.player));
  }

  async open(): Promise<Game> {
    this.game = await Game.load({
      clock: this.world.clock,
      scheduler: manualFrames,
      storage: this.storage,
      ads: noAds,
      store: this.store,
      account: { auth: this.auth, server: this.server },
      dayKey: (ms) => localDayKey(ms, 0),
      seed: () => 7,
    });
    this.game.start();
    await settle();
    return this.game;
  }

  /** Plays with the app open: taps and the simulation running. */
  play(seconds: number): void {
    for (let i = 0; i < seconds * 10; i++) {
      this.world.clock.advance(100);
      if (i % 4 === 0) this.game.tap();
      this.game.pump();
    }
  }
}

/** Lets the background work started by the game (saves, syncs) finish. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('accounts and cloud saves', () => {
  it('signs a new player in as a guest and keeps a copy of the save in the cloud', async () => {
    const world = new World();
    const phone = new Phone(world);
    const game = await phone.open();
    expect(game.account).toEqual({ playerId: 'guest-1', guest: true, email: null });
    expect(game.cloud?.outcome).toBe('uploaded');
    expect(world.saves.get('guest-1')?.revision).toBe(1);

    phone.play(30);
    await game.suspend();
    await settle();
    expect(world.saves.get('guest-1')?.revision).toBe(2);
    expect(world.saves.get('guest-1')?.data).toBe(game.exportSave());
  });

  it('lets a new phone pick up the save played longer, keeping gems bought on both phones', async () => {
    const world = new World();
    const first = new Phone(world);
    const old = await first.open();
    expect(await old.linkGoogle()).toBe('linked');
    first.play(120);
    expect((await old.purchase('gems_small')).status).toBe('granted');
    await old.syncCloud();
    const oldGems = old.state.gems;
    const oldPlay = old.state.stats.playSeconds;
    old.stop();

    const second = new Phone(world);
    const fresh = await second.open();
    second.play(5);
    expect((await fresh.purchase('gems_medium')).status).toBe('granted');
    expect(await fresh.linkGoogle()).toBe('already_used');
    expect(await fresh.switchToGoogle()).toBe('linked');
    await settle();

    expect(fresh.account?.playerId).toBe(first.player);
    expect(fresh.state.stats.playSeconds).toBeGreaterThanOrEqual(oldPlay);
    expect(fresh.state.gems).toBe(oldGems + 550);
    expect(fresh.state.shop.settled).toHaveLength(2);

    // The new phone is played some more, so the old phone takes its save next time.
    second.play(5);
    await fresh.suspend();
    await settle();
    first.game = await first.open();
    expect(first.game.cloud?.outcome).toBe('downloaded');
    expect(first.game.state.shop.settled).toHaveLength(2);
    expect(first.game.state.gems).toBe(fresh.state.gems);
    expect(first.game.state.gems).toBeGreaterThanOrEqual(oldGems + 550);
  });

  it('keeps gems bought on the other phone when this save wins', async () => {
    const world = new World();
    const a = new Phone(world);
    const longer = await a.open();
    await longer.linkGoogle();
    await longer.suspend();
    await settle();
    const b = new Phone(world);
    b.googlePick = a.googlePick;
    const shorter = await b.open();
    await shorter.switchToGoogle();
    await settle();

    // Both phones play offline from each other; only B buys gems, but A plays longer.
    a.play(300);
    b.play(20);
    expect((await shorter.purchase('gems_medium')).status).toBe('granted');
    await shorter.suspend();
    await settle();
    const gemsOnA = longer.state.gems;
    expect(await longer.syncCloud()).toBe('kept_local');
    expect(longer.state.gems).toBe(gemsOnA + 550);
    expect(world.saves.get(a.player ?? '')?.data).toBe(longer.exportSave());
  });

  it('keeps the save played on another phone over one that only collected idle earnings', async () => {
    const world = new World();
    const a = new Phone(world);
    const playedHere = await a.open();
    await playedHere.linkGoogle();
    await playedHere.suspend();
    await settle();
    const b = new Phone(world);
    b.googlePick = a.googlePick;
    const other = await b.open();
    await other.switchToGoogle();
    await settle();
    other.stop();

    // Phone A is played for ten minutes while phone B sits in a drawer for eight hours.
    a.play(600);
    await playedHere.suspend();
    await settle();
    const played = playedHere.state.stats.playSeconds;
    world.clock.advance(8 * 3600_000);

    const reopened = await b.open();
    expect(reopened.cloud?.outcome).toBe('downloaded');
    expect(reopened.state.stats.playSeconds).toBeGreaterThanOrEqual(played);
    // Idle earnings are still paid for the time since phone A last played, up to the usual limit.
    expect(reopened.state.offline?.seconds).toBe(C.OFFLINE_BASE_SECONDS);
  });

  it('finishes a purchase that was on its way into this save before another save replaces it', async () => {
    const world = new World();
    const phone = new Phone(world);
    const game = await phone.open();
    const player = phone.player ?? '';
    phone.play(10);
    const gems = game.state.gems;
    // Another phone got further on this account.
    world.saves.set(player, { revision: 99, data: game.exportSave(), updatedAt: '' });
    // Paid, and the server already moved the gems out of the wallet for this save, but the app
    // was closed before they arrived in it.
    await world.wallet(player).purchase('gems_large');
    game.state.shop.pending = 'settle-on-the-way';
    await world.wallet(player).settle('settle-on-the-way');
    game.state.stats.playSeconds = 0;

    expect(await game.syncCloud()).toBe('downloaded');
    expect(game.state.gems).toBe(gems + 1200);
    expect(game.state.shop.pending).toBeNull();
    expect(game.state.shop.settled.map((x) => x.id)).toContain('settle-on-the-way');
  });

  it('asks a guest to link Google before a one-time purchase, which then belongs to that account', async () => {
    const world = new World();
    const phone = new Phone(world);
    const game = await phone.open();
    expect(game.needsGoogleFor('remove_ads')).toBe(true);
    expect(game.needsGoogleFor('gems_small')).toBe(false);

    phone.googlePick = 'cancel';
    expect((await game.purchase('remove_ads')).status).toBe('cancelled');
    expect(R.hasEntitlement(game.state, 'remove_ads')).toBe(false);

    phone.googlePick = 'me@example.com';
    expect((await game.purchase('remove_ads')).status).toBe('granted');
    expect(game.account?.guest).toBe(false);
    expect(R.hasEntitlement(game.state, 'remove_ads')).toBe(true);
    expect(game.needsGoogleFor('ore_doubler')).toBe(false);
  });

  it('does not switch accounts while purchases cannot reach the guest account\'s save', async () => {
    const world = new World();
    const phone = new Phone(world);
    const game = await phone.open();
    world.google.set('me@example.com', 'google-old');
    const guest = phone.player;
    world.offline = true;
    expect(await game.switchToGoogle()).toBe('failed');
    expect(phone.player).toBe(guest);
  });

  it('deletes the account, the cloud save and this phone\'s save, and starts over as a new guest', async () => {
    const world = new World();
    const phone = new Phone(world);
    const game = await phone.open();
    await game.linkGoogle();
    phone.play(60);
    await game.syncCloud();
    const player = phone.player ?? '';
    expect(world.saves.has(player)).toBe(true);

    expect(await game.deleteAccount()).toBe(true);
    await settle();
    expect(world.deletedSignIns).toEqual([player]);
    expect(world.saves.has(player)).toBe(false);
    expect(world.google.size).toBe(0);
    expect(game.state.stats.playSeconds).toBe(0);
    expect(game.account).toMatchObject({ guest: true });
    expect(game.account?.playerId).not.toBe(player);
    expect(await phone.storage.get(`cloud.${player}`)).toBeNull();
    // Nothing of the old game is left in either save slot.
    game.stop();
    const reopened = await new Phone(world, phone.storage).open();
    expect(reopened.state.stats.playSeconds).toBeLessThan(1);
  });

  it('deletes the sign-in account on the phone when the server does not', async () => {
    const world = new World();
    world.serverDeletesSignIn = false;
    const phone = new Phone(world);
    const game = await phone.open();
    const player = phone.player;
    expect(await game.deleteAccount()).toBe(true);
    expect(world.deletedSignIns).toEqual([player]);
  });

  it('keeps everything when the account cannot be deleted right now', async () => {
    const world = new World();
    const phone = new Phone(world);
    const game = await phone.open();
    phone.play(30);
    const played = game.state.stats.playSeconds;
    world.offline = true;
    expect(await game.deleteAccount()).toBe(false);
    expect(game.state.stats.playSeconds).toBe(played);
    expect(world.deletedSignIns).toEqual([]);
  });
});
