import { Emitter, SaveSlots, exportSave, importSave, localDayKey, type Clock, type KeyValueStore, type SaveFormat } from '@game1/engine';
import {
  CloudSync,
  syncWallet,
  type Account,
  type AdOutcome,
  type AdsService,
  type AuthService,
  type CloudSaveApi,
  type CatalogItem,
  type Haptics,
  type LinkResult,
  type Product,
  type PurchaseResult,
  type StoreService,
  type SyncOutcome,
  type WalletHost,
} from '@game1/platform';
import { INTERSTITIAL_DEFAULTS, interstitialTimely, recordInterstitial, type AdLedger, type InterstitialRules } from './ad-ledger.js';
import type { ShellSettings } from './settings.js';
import { applySettlement, mergeSettlements, REMOVE_ADS, type Grant, type ShopRecord } from './shop.js';
import type { ShellKey } from './strings.js';

/** What the session needs from a game's state. Everything else in it belongs to the game. */
export interface SessionState {
  shop: ShopRecord;
  ads: AdLedger;
  settings: ShellSettings;
}

/** Sign-in and cloud saves, which only the Android version has. */
export interface AccountOptions {
  auth: AuthService;
  /** The purchase server's cloud save and player data endpoints. */
  server: CloudSaveApi & { deletePlayer(): Promise<{ signInDeleted: boolean }> };
}

export interface SessionOptions {
  clock: Clock;
  storage: KeyValueStore;
  ads: AdsService;
  store: StoreService;
  haptics?: Haptics;
  /** The game's sounds; the session only turns them on and off with the setting. */
  sound?: { setEnabled(enabled: boolean): void };
  account?: AccountOptions;
  /** The local calendar day of a time; tests pin the time zone. */
  dayKey?: (ms: number) => string;
  seed?: () => number;
}

/** How the save looked when the game started. */
export type StartNote = 'new' | 'loaded' | 'recovered' | 'unreadable';

/** A toast parameter is shown as is, or translated when it names a string key. */
export type ToastParam<K extends string> = string | number | { key: K };

export interface Toast<K extends string, I extends string> {
  id: number;
  key: K;
  params?: Readonly<Record<string, ToastParam<K>>>;
  icon?: I;
}

export interface SessionEvents<K extends string, I extends string> {
  /** The state changed. */
  change: undefined;
  toast: Toast<K, I>;
}

/** The game's icons for the session's own toasts. */
export interface ShellIcons<I extends string> {
  purchase: I;
  cloud: I;
}

/** How often the session renders, saves and syncs while the game's frame loop calls `frame()`. */
export const RENDER_MS = 100;
export const AUTOSAVE_MS = 15_000;
export const CLOUD_SYNC_MS = 3 * 60_000;
const SAVE_KEY = 'save';
const noHaptics: Haptics = { light: () => undefined, heavy: () => undefined };

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** Reads the save, or reports why there is none, without starting anything. */
export async function loadSaveSlots<S>(storage: KeyValueStore, format: SaveFormat<S>, clock: Clock): Promise<{ slots: SaveSlots<S>; state: S | null; note: StartNote }> {
  const slots = new SaveSlots(storage, SAVE_KEY, format, clock);
  const outcome = await slots.load();
  if (outcome.kind === 'loaded') return { slots, state: outcome.save.state, note: outcome.fellBack ? 'recovered' : 'loaded' };
  return { slots, state: null, note: outcome.kind === 'unreadable' ? 'unreadable' : 'new' };
}

/**
 * Everything a game does around its gameplay: saving, purchases settled exactly once into the
 * save, rewarded ads and rare ad breaks, sign-in, cloud saves and account deletion, toasts and
 * vibration. A game extends it with its own state and actions. The screens read `state` and
 * call the action methods; nothing else changes it.
 *
 * K are the game's string keys, which include the shell's (`ShellKey`); I its icon names; P its
 * rewarded ad placements; E the game's own events next to `change` and `toast`, if it has any.
 */
export abstract class Session<S extends SessionState, K extends string, I extends string, P extends string, E extends object = SessionEvents<K | ShellKey, I>> {
  readonly events = new Emitter<SessionEvents<K | ShellKey, I> & E>();
  /** A rewarded ad, an ad break or a purchase is on screen. */
  busy = false;
  /** The last purchase sync could not reach the store. */
  storeError = false;
  /** The last save could not be written. */
  saveFailed = false;
  /** Store prices by product id, once the store has answered. */
  products: ReadonlyMap<string, Product> = new Map();
  /** The signed-in account; null while signed out, and always in the browser version. */
  account: Account | null = null;
  /** How the last cloud sync went, and when. */
  cloud: { outcome: SyncOutcome; at: number } | null = null;

  protected readonly haptics: Haptics;
  protected readonly dayKey: (ms: number) => string;
  protected readonly format: SaveFormat<S>;
  /** When this session started; ad breaks wait for the first minutes of a session. */
  protected sessionStartedAt = 0;
  /** Set when the state changed and the screens have not been told yet. */
  protected dirty = false;
  protected lastSave = -Infinity;
  /** Ad break timing; a game may make it stricter. */
  protected readonly interstitialRules: InterstitialRules = INTERSTITIAL_DEFAULTS;
  private lastRender = -Infinity;
  private toastId = 0;
  private lastBuzz = -Infinity;
  private syncing: Promise<boolean> | null = null;
  private syncRequests = 0;
  private readonly stops: (() => void)[] = [];
  private readonly cloudSync: CloudSync | null;
  private lastCloudSync = Infinity;
  /** The same emitter as `events`, typed for the session's own events. */
  private readonly own = this.events as unknown as Emitter<SessionEvents<K | ShellKey, I>>;
  private readonly grantInto: Grant<S> = (state, amounts, now) => {
    this.grant(state, amounts, now);
  };

  protected constructor(
    protected readonly o: SessionOptions,
    private readonly slots: SaveSlots<S>,
    public state: S,
    readonly startNote: StartNote,
    private readonly catalog: readonly CatalogItem[],
    private readonly shellIcons: ShellIcons<I>,
  ) {
    this.haptics = o.haptics ?? noHaptics;
    this.dayKey = o.dayKey ?? ((ms) => localDayKey(ms));
    this.format = slots.format;
    o.sound?.setEnabled(state.settings.sound);
    const account = o.account;
    this.cloudSync = account
      ? new CloudSync(
          account.server,
          o.storage,
          {
            current: () => this.exportSave(),
            progress: (text) => this.progressOfSave(text),
            adopt: (text) => this.adoptSave(text),
            absorb: (text) => this.absorbSave(text),
          },
          async () => (await account.auth.account())?.playerId ?? null,
        )
      : null;
  }

  // -------------------------------------------------------------------------------------
  // What each game provides

  /** A new game, for a first start and after the player deleted their account. */
  protected abstract newState(now: number, seed: number): S;
  /**
   * How far a save got, to choose between two that both changed. Use something that only
   * playing increases, so an idle phone never beats one that was played in the meantime.
   */
  protected abstract progressOf(state: S): number;
  /** Adds the currencies of one settlement to the state (negative after a refund). */
  protected abstract grant(state: S, amounts: Readonly<Record<string, number>>, now: number): void;
  /** Sets the one-time purchases the server says the player owns; ignore ids the game does not know. */
  protected abstract setEntitlements(state: S, entitlements: readonly string[]): void;
  /** Whether a rewarded ad for this placement would give something right now. */
  abstract adOffered(placement: P, slot?: number): boolean;
  /** Gives the reward of a rewarded ad the network confirmed; false if it no longer applies. */
  protected abstract grantAdReward(placement: P, slot: number): boolean;
  /** Whether the player has played enough for ad breaks at all (say, past the first levels). */
  protected abstract adBreaksEarned(state: S): boolean;
  /**
   * Brings a state that just became the game up to date: daily resets, offline time and so on.
   * A new game follows a deleted account. A pasted save (imported) gets no offline time; one
   * from another device (adopted) does, as if this device had been that one.
   */
  protected prepare(_how: 'new' | 'imported' | 'adopted'): void {
    // Nothing to do for a game without daily resets or offline time.
  }
  /** Feedback for a finished purchase: a sound, a vibration. */
  protected purchased(): void {
    this.buzz('heavy');
  }

  // -------------------------------------------------------------------------------------
  // Running

  /** A game's start() calls this first: the session's clock starts, and a damaged save is reported. */
  protected beginSession(): void {
    this.sessionStartedAt = this.o.clock.now();
    if (this.startNote === 'recovered') this.toast('toast.saveRecovered');
    if (this.startNote === 'unreadable') this.toast('toast.saveUnreadable');
  }

  /** A game's start() calls this last: purchases, prices, sign-in and the cloud save. */
  protected startServices(): void {
    this.stops.push(
      this.o.store.onChange(() => {
        void this.syncPurchases(false);
      }),
    );
    void this.syncPurchases(false);
    void this.loadProducts();
    void this.refreshAccount().then(() => this.syncCloud());
  }

  /** Stops what startServices started. */
  stop(): void {
    for (const stop of this.stops.splice(0)) stop();
  }

  /** Call on every animation frame: tells the screens about changes, autosaves and syncs the cloud save. */
  protected frame(now: number): void {
    if (this.dirty && now - this.lastRender >= RENDER_MS) this.emitChange();
    if (now - this.lastSave >= AUTOSAVE_MS) void this.save();
    if (now - this.lastCloudSync >= CLOUD_SYNC_MS) void this.syncCloud();
  }

  /** The app is going to the background: write the save now, then copy it to the cloud. */
  suspend(): Promise<void> {
    const saved = this.save();
    void saved.then(() => this.syncCloud());
    return saved;
  }

  /** The app is back in front: a payment may have cleared. */
  resume(): void {
    void this.syncPurchases(false);
  }

  now(): number {
    return this.o.clock.now();
  }

  today(): string {
    return this.dayKey(this.o.clock.now());
  }

  /** For useSubscription: re-render whenever the game changes. */
  readonly subscribe = (onChange: () => void): (() => void) => this.own.on('change', onChange);

  // -------------------------------------------------------------------------------------
  // Ads

  /** True when the player bought No Ad Breaks. */
  get adsRemoved(): boolean {
    return this.state.shop.entitlements.includes(REMOVE_ADS);
  }

  /**
   * Shows a rewarded ad and gives its reward only if the ad network confirms it. Owners of
   * No Ad Breaks get the reward without watching; the daily limits still apply.
   */
  async watchAd(placement: P, slot = 0): Promise<boolean> {
    if (this.busy || !this.adOffered(placement, slot)) return false;
    let outcome: AdOutcome = 'rewarded';
    if (!this.adsRemoved) {
      this.busy = true;
      this.emitChange();
      try {
        outcome = await this.o.ads.showRewarded(placement);
      } catch {
        outcome = 'unavailable';
      } finally {
        this.busy = false;
      }
    }
    if (outcome !== 'rewarded') {
      if (outcome === 'unavailable') this.toast('toast.adUnavailable');
      this.emitChange();
      return false;
    }
    return this.grantAdReward(placement, slot);
  }

  /**
   * Call at a natural pause (a result screen was just closed). Shows an ad break only when the
   * rules allow it: never early in a session, rarely, and never for No Ad Breaks owners.
   */
  async naturalBreak(): Promise<boolean> {
    if (this.busy || !this.adBreakAllowed()) return false;
    this.busy = true;
    let shown = false;
    try {
      shown = await this.o.ads.showInterstitial('break');
      if (shown) recordInterstitial(this.state.ads, this.o.clock.now(), this.today());
    } catch {
      // No ad break this time.
    } finally {
      this.busy = false;
      this.emitChange();
    }
    return shown;
  }

  /** Whether an ad break may come now. */
  adBreakAllowed(): boolean {
    if (this.adsRemoved || !this.adBreaksEarned(this.state)) return false;
    return interstitialTimely(this.state.ads, this.o.clock.now(), this.today(), this.sessionStartedAt, this.interstitialRules);
  }

  privacyOptionsRequired(): boolean {
    return this.o.ads.privacyOptionsRequired();
  }

  showPrivacyOptions(): Promise<void> {
    return this.o.ads.showPrivacyOptions();
  }

  // -------------------------------------------------------------------------------------
  // Purchases. The store and the purchase server decide what was paid; the session only
  // settles the server wallet into the save, once per settlement id.

  async purchase(productId: string): Promise<PurchaseResult> {
    if (this.busy) return { status: 'cancelled' };
    this.busy = true;
    this.emitChange();
    let result: PurchaseResult;
    try {
      result = (await this.readyToBuy(productId)) ? await this.o.store.purchase(productId) : { status: 'cancelled' };
    } catch (err) {
      result = { status: 'failed', reason: err instanceof Error ? err.message : String(err), retryable: true };
    } finally {
      this.busy = false;
    }
    if (result.status === 'granted') {
      await this.syncPurchases(true);
      this.toast('shop.thanks', undefined, this.shellIcons.purchase);
      this.purchased();
    } else if (result.status === 'pending') {
      this.toast('shop.pending');
    } else if (result.status === 'failed') {
      this.toast(result.reason === 'already_owned' ? 'shop.alreadyOwned' : 'shop.failed');
    }
    this.emitChange();
    return result;
  }

  /** True when buying this product first asks a guest to link Google. */
  needsGoogleFor(productId: string): boolean {
    return this.catalog.find((item) => item.id === productId)?.kind === 'non_consumable' && this.account?.guest === true;
  }

  /**
   * One-time purchases stay with the account that bought them, and a guest account is lost with
   * the phone, so a guest links Google before buying one.
   */
  private async readyToBuy(productId: string): Promise<boolean> {
    if (!this.needsGoogleFor(productId)) return true;
    const result = await this.linkGoogle();
    if (result === 'already_used') this.toast('shop.linkExisting');
    else if (result === 'cancelled') this.toast('shop.linkNeeded');
    else if (result === 'failed') this.toast('settings.account.linkFailed');
    return result === 'linked';
  }

  /** False in the ads-only edition, which has no purchase server: its shop has no paid items. */
  get sells(): boolean {
    return this.o.store.name !== 'none';
  }

  async loadProducts(): Promise<void> {
    if (!this.sells) return;
    try {
      const list = await this.o.store.products(this.catalog.map((p) => p.id));
      this.products = new Map(list.map((p) => [p.id, p]));
    } catch {
      this.storeError = true;
    }
    this.emitChange();
  }

  /** True in the browser version, where ads and purchases are simulated. */
  get testMode(): boolean {
    return this.o.store.name === 'test' || this.o.ads.name === 'test';
  }

  /**
   * Brings the save up to date with the server wallet. Safe to call any time, any number of
   * times. Resolves to false if the server could not be reached.
   */
  syncPurchases(quiet: boolean): Promise<boolean> {
    if (!this.sells) return Promise.resolve(false);
    this.syncRequests += 1;
    if (this.syncing) return this.syncing;
    const run = async () => {
      // Calls made while a sync runs are answered by one more round after it.
      let answered = -1;
      let reached = false;
      while (answered !== this.syncRequests) {
        answered = this.syncRequests;
        reached = false;
        try {
          const settlement = await syncWallet(this.o.store, this.walletHost);
          reached = true;
          this.storeError = false;
          if (!quiet && settlement && Object.values(settlement.amounts).some((v) => v > 0)) {
            this.toast('shop.thanks', undefined, this.shellIcons.purchase);
            this.purchased();
          }
        } catch {
          // Offline or the server is down: the wallet keeps everything until the next try.
          this.storeError = true;
        }
      }
      return reached;
    };
    const running = run().finally(() => {
      this.syncing = null;
      this.emitChange();
    });
    this.syncing = running;
    return running;
  }

  private readonly walletHost: WalletHost = {
    pendingSettlement: () => this.state.shop.pending,
    beginSettlement: async (id) => {
      this.state.shop.pending = id;
      await this.slots.save(this.state);
    },
    finishSettlement: async (settlement) => {
      applySettlement(this.state, this.grantInto, settlement.id, settlement.amounts, this.o.clock.now());
      this.state.shop.pending = null;
      this.dirty = true;
      await this.slots.save(this.state);
    },
    setEntitlements: (entitlements) => {
      this.setEntitlements(this.state, entitlements);
      this.dirty = true;
    },
  };

  // -------------------------------------------------------------------------------------
  // Settings and saves

  setSettings(patch: Partial<S['settings']>): void {
    Object.assign(this.state.settings, patch);
    this.o.sound?.setEnabled(this.state.settings.sound);
    this.emitChange();
    void this.save();
  }

  exportSave(): string {
    return exportSave(this.format, this.state, this.o.clock.now());
  }

  /** Replaces the game with a save the player pasted. Purchases this save received are kept. */
  async importSave(text: string): Promise<boolean> {
    let state: S;
    try {
      state = importSave(this.format, text).state;
    } catch {
      return false;
    }
    mergeSettlements(state, this.state, this.grantInto, this.o.clock.now());
    this.replaceState(state);
    this.prepare('imported');
    await this.save();
    await this.syncPurchases(true);
    this.emitChange();
    return true;
  }

  /**
   * Replaces the game with a save from another device that got further. Purchases this save
   * received are carried over. Throws while a purchase cannot be finished into this save yet,
   * so the cloud sync tries again later.
   */
  async adoptSave(text: string): Promise<'adopted' | 'merged' | 'unreadable'> {
    let state: S;
    try {
      state = importSave(this.format, text).state;
    } catch {
      return 'unreadable';
    }
    await this.settlePending();
    const merged = mergeSettlements(state, this.state, this.grantInto, this.o.clock.now());
    this.replaceState(state);
    this.prepare('adopted');
    this.emitChange();
    await this.save();
    await this.syncPurchases(true);
    return merged > 0 ? 'merged' : 'adopted';
  }

  /** This save won over another device's: take over the purchases that one received. */
  async absorbSave(text: string): Promise<void> {
    let other: S;
    try {
      other = importSave(this.format, text).state;
    } catch {
      return;
    }
    const merged = mergeSettlements(this.state, other, this.grantInto, this.o.clock.now());
    // A purchase the other device had not finished yet is finished here, in case that device
    // never comes back. Settlements are idempotent, so both finishing it grants it once per save.
    const theirs = other.shop.pending;
    const takeOver = theirs !== null && this.state.shop.pending === null && !this.state.shop.settled.some((s) => s.id === theirs);
    if (takeOver) this.state.shop.pending = theirs;
    if (merged === 0 && !takeOver) return;
    this.dirty = true;
    await this.save();
    if (takeOver) void this.syncPurchases(true);
  }

  private progressOfSave(text: string): number {
    try {
      return this.progressOf(importSave(this.format, text).state);
    } catch {
      return -1;
    }
  }

  /** Finishes a purchase being settled into this save, so it is in `shop.settled`. Throws if it cannot yet. */
  private async settlePending(): Promise<void> {
    if (this.state.shop.pending === null) return;
    const reached = await this.syncPurchases(true);
    // The sync clears the pending id once the server has answered for it.
    if (!reached || this.walletHost.pendingSettlement() !== null) throw new Error('A purchase is still being settled into this save.');
  }

  /** Makes `state` the game. A game that keeps things derived from the state resets them here. */
  protected replaceState(state: S): void {
    this.state = state;
    this.o.sound?.setEnabled(state.settings.sound);
  }

  async save(): Promise<void> {
    this.lastSave = this.o.clock.now();
    try {
      await this.slots.save(this.state);
      this.saveFailed = false;
    } catch {
      if (!this.saveFailed) this.toast('toast.saveFailed');
      this.saveFailed = true;
    }
  }

  // -------------------------------------------------------------------------------------
  // Account and cloud save

  get accountsEnabled(): boolean {
    return this.o.account !== undefined;
  }

  async refreshAccount(): Promise<void> {
    if (!this.o.account) return;
    this.account = await this.o.account.auth.account();
    this.emitChange();
  }

  /** Syncs the cloud save now. The session also does it every few minutes and when the app goes to the background. */
  async syncCloud(): Promise<SyncOutcome | null> {
    if (!this.cloudSync) return null;
    this.lastCloudSync = this.o.clock.now();
    const outcome = await this.cloudSync.sync();
    this.cloud = { outcome, at: this.o.clock.now() };
    if (outcome === 'downloaded') this.toast('toast.cloudLoaded', undefined, this.shellIcons.cloud);
    this.emitChange();
    return outcome;
  }

  /** Adds Google sign-in to this account, so progress and purchases survive a new phone. */
  async linkGoogle(): Promise<LinkResult> {
    if (!this.o.account) return 'failed';
    const result = await this.o.account.auth.linkGoogle();
    await this.refreshAccount();
    if (result === 'linked') this.toast('toast.googleLinked', undefined, this.shellIcons.cloud);
    return result;
  }

  /** Signs in with a Google account that already has a save; the save that got further is kept. */
  async switchToGoogle(): Promise<LinkResult> {
    if (!this.o.account) return 'failed';
    // Purchases on their way to the guest account must reach this save before the account changes.
    if (!(await this.syncPurchases(true)) || this.state.shop.pending !== null) return 'failed';
    const result = await this.o.account.auth.switchToGoogle();
    await this.refreshAccount();
    if (result === 'linked') {
      await this.syncCloud();
      await this.syncPurchases(true);
    }
    return result;
  }

  /**
   * Deletes the player's data on the server, their sign-in account and the save on this device,
   * then starts a new game. Purchase records stay on the server for refunds and accounting.
   */
  async deleteAccount(): Promise<boolean> {
    const account = this.o.account;
    if (!account || !this.cloudSync) return false;
    try {
      const { signInDeleted } = await account.server.deletePlayer();
      await this.cloudSync.forget();
      if (signInDeleted) await account.auth.signOut();
      else await account.auth.deleteAccount();
    } catch {
      this.toast('toast.deleteFailed');
      this.emitChange();
      return false;
    }
    this.replaceState(this.newState(this.o.clock.now(), (this.o.seed ?? randomSeed)()));
    this.prepare('new');
    this.account = null;
    this.cloud = null;
    // Both save slots, so no copy of the old game is left on the device.
    await this.save();
    await this.save();
    this.toast('toast.accountDeleted');
    await this.refreshAccount();
    return true;
  }

  // -------------------------------------------------------------------------------------

  /** Vibration, if the player wants it, at most a few times a second. */
  protected buzz(kind: 'light' | 'heavy'): void {
    const now = this.o.clock.now();
    if (!this.state.settings.haptics || now - this.lastBuzz < (kind === 'light' ? 250 : 120)) return;
    this.lastBuzz = now;
    this.haptics[kind]();
  }

  protected toast(key: K | ShellKey, params?: Toast<K | ShellKey, I>['params'], icon?: I): void {
    this.toastId += 1;
    this.own.emit('toast', { id: this.toastId, key, ...(params ? { params } : {}), ...(icon ? { icon } : {}) });
  }

  protected emitChange(): void {
    this.dirty = false;
    this.lastRender = this.o.clock.now();
    this.own.emit('change', undefined);
  }
}
