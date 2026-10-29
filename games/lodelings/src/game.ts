import { Emitter, FixedStepLoop, SaveSlots, exportSave, importSave, localDayKey, type Clock, type FrameScheduler, type KeyValueStore } from '@game1/engine';
import {
  CloudSync,
  syncWallet,
  type Account,
  type AdOutcome,
  type AdsService,
  type AuthService,
  type CloudSaveApi,
  type Haptics,
  type LinkResult,
  type Product,
  type PurchaseResult,
  type StoreService,
  type SyncOutcome,
  type WalletHost,
} from '@game1/platform';
import type { IconName } from './art/Icon.js';
import { CATALOG, catalogItem } from './catalog.js';
import type { StringKey } from './i18n/index.js';
import * as C from './sim/content.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type GameState } from './sim/state.js';

export type SoundName = 'tap' | 'crit' | 'break' | 'gem' | 'egg' | 'hatch' | 'guardian' | 'win' | 'lose' | 'buy' | 'skill' | 'claim';

export interface Sound {
  play(name: SoundName): void;
  setEnabled(enabled: boolean): void;
}

export const silentSound: Sound = { play: () => undefined, setEnabled: () => undefined };
const noHaptics: Haptics = { light: () => undefined, heavy: () => undefined };

/** A toast parameter is shown as is, or translated when it names a string key. */
export type ToastParam = string | number | { key: StringKey };

export interface Toast {
  id: number;
  key: StringKey;
  params?: Readonly<Record<string, ToastParam>>;
  icon?: IconName;
}

export interface GameEvents {
  /** The state changed; at most about ten times a second while the game runs on its own. */
  change: undefined;
  /** What just happened, for animations. */
  sim: readonly R.SimEvent[];
  toast: Toast;
}

/** Sign-in and cloud saves, which only the Android version has. */
export interface AccountOptions {
  auth: AuthService;
  /** The purchase server's cloud save and player data endpoints. */
  server: CloudSaveApi & { deletePlayer(): Promise<{ signInDeleted: boolean }> };
}

export interface GameOptions {
  clock: Clock;
  scheduler: FrameScheduler;
  storage: KeyValueStore;
  ads: AdsService;
  store: StoreService;
  haptics?: Haptics;
  sound?: Sound;
  account?: AccountOptions;
  /** The local calendar day of a time; tests pin the time zone. */
  dayKey?: (ms: number) => string;
  seed?: () => number;
}

/** How the save looked when the game started. */
export type StartNote = 'new' | 'loaded' | 'recovered' | 'unreadable';

export type HatchResult = Extract<R.SimEvent, { type: 'hatch' }>;

const STEP_MS = 100;
/** Gaps longer than this are offline time, paid out at the offline rate. */
const MAX_CATCH_UP_MS = 60_000;
const RENDER_MS = 100;
const AUTOSAVE_MS = 15_000;
const CLOUD_SYNC_MS = 3 * 60_000;
const SAVE_KEY = 'save';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/**
 * Runs one game of Lodelings: the simulation loop, saving, offline time, daily resets, ads and
 * purchases. The screens read `state` and call the action methods; nothing else changes it.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly format = saveFormat(R.blockHp);
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

  private readonly loop: FixedStepLoop;
  private readonly haptics: Haptics;
  private readonly sound: Sound;
  private readonly dayKey: (ms: number) => string;
  private day = '';
  private dayCheckedAt = -Infinity;
  private sessionStartedAt = 0;
  private dirty = false;
  private lastRender = -Infinity;
  private lastSave = -Infinity;
  private readonly recentTaps: number[] = [];
  private toastId = 0;
  private lastBuzz = -Infinity;
  private syncing: Promise<boolean> | null = null;
  private syncRequests = 0;
  private readonly stops: (() => void)[] = [];
  private readonly cloudSync: CloudSync | null;
  private lastCloudSync = Infinity;

  private constructor(
    private readonly o: GameOptions,
    private readonly slots: SaveSlots<GameState>,
    public state: GameState,
    readonly startNote: StartNote,
  ) {
    this.haptics = o.haptics ?? noHaptics;
    this.sound = o.sound ?? silentSound;
    this.dayKey = o.dayKey ?? ((ms) => localDayKey(ms));
    this.sound.setEnabled(state.settings.sound);
    const account = o.account;
    this.cloudSync = account
      ? new CloudSync(
          account.server,
          o.storage,
          {
            current: () => this.exportSave(),
            progress: (text) => this.progressOf(text),
            adopt: (text) => this.adoptSave(text),
            absorb: (text) => this.absorbSave(text),
          },
          async () => (await account.auth.account())?.playerId ?? null,
        )
      : null;
    this.loop = new FixedStepLoop({
      clock: o.clock,
      scheduler: o.scheduler,
      stepMs: STEP_MS,
      maxCatchUpMs: MAX_CATCH_UP_MS,
      onStep: (dt, now) => {
        const c = this.ctxAt(now);
        R.step(this.state, c, dt);
        this.dispatch(c);
      },
      onGap: (_gap, now) => {
        const c = this.ctxAt(now);
        R.returnFromOffline(this.state, c);
        this.dispatch(c, true);
        void this.save();
      },
      onFrame: (now) => {
        if (this.dirty && now - this.lastRender >= RENDER_MS) this.emitChange();
        if (now - this.lastSave >= AUTOSAVE_MS) void this.save();
        if (now - this.lastCloudSync >= CLOUD_SYNC_MS) void this.syncCloud();
      },
    });
  }

  /** Loads the save (or starts a new game) without starting the clock. */
  static async load(o: GameOptions): Promise<Game> {
    const format = saveFormat(R.blockHp);
    const slots = new SaveSlots(o.storage, SAVE_KEY, format, o.clock);
    const outcome = await slots.load();
    if (outcome.kind === 'loaded') return new Game(o, slots, outcome.save.state, outcome.fellBack ? 'recovered' : 'loaded');
    const state = createState(o.clock.now(), (o.seed ?? randomSeed)(), R.blockHp(1));
    return new Game(o, slots, state, outcome.kind === 'unreadable' ? 'unreadable' : 'new');
  }

  /** Pays out offline time, starts the clock and brings purchases up to date. */
  start(): void {
    const now = this.o.clock.now();
    this.sessionStartedAt = now;
    const c = this.ctxAt(now);
    R.refreshQuests(this.state, c.day);
    R.autoIncubate(this.state, now);
    R.returnFromOffline(this.state, c);
    if (this.startNote === 'recovered') this.toast('toast.saveRecovered');
    if (this.startNote === 'unreadable') this.toast('toast.saveUnreadable');
    this.dispatch(c, true);
    void this.save();
    this.stops.push(
      this.o.store.onChange(() => {
        void this.syncPurchases(false);
      }),
    );
    void this.syncPurchases(false);
    void this.loadProducts();
    this.loop.start();
    void this.refreshAccount().then(() => this.syncCloud());
  }

  stop(): void {
    this.loop.stop();
    for (const stop of this.stops.splice(0)) stop();
  }

  /** The app is going to the background: write the save now, then copy it to the cloud. */
  suspend(): Promise<void> {
    const saved = this.save();
    void saved.then(() => this.syncCloud());
    return saved;
  }

  /** The app is back in front. Offline time is paid on the next frame; a payment may have cleared. */
  resume(): void {
    void this.syncPurchases(false);
  }

  /** Runs everything due now. The frame loop does this by itself; tests call it directly. */
  pump(): void {
    this.loop.pump();
  }

  now(): number {
    return this.o.clock.now();
  }

  today(): string {
    return this.ctxAt(this.o.clock.now()).day;
  }

  /** For useSubscription: re-render whenever the game changes. */
  readonly subscribe = (onChange: () => void): (() => void) => this.events.on('change', onChange);

  // -------------------------------------------------------------------------------------
  // Mining

  tap(): boolean {
    const now = this.o.clock.now();
    const taps = this.recentTaps;
    while (taps.length > 0 && now - (taps[0] as number) >= 1000) taps.shift();
    if (taps.length >= C.MAX_TAPS_PER_SECOND) return false;
    taps.push(now);
    const c = this.ctxAt(now);
    R.tap(this.state, c);
    if (this.state.stats.taps >= 5) this.markTutorial('tap');
    this.dispatch(c, true);
    return true;
  }

  challengeGuardian(): boolean {
    return this.act((c) => R.startGuardian(this.state, c));
  }

  castSkill(id: C.SkillId): boolean {
    return this.act((c) => R.castSkill(this.state, c, id), 'skill');
  }

  resetSkills(): boolean {
    return this.act((c) => R.resetSkills(this.state, c.now), 'claim', true);
  }

  // -------------------------------------------------------------------------------------
  // Spending ore and gems

  levelUp(id: C.SpeciesId, amount: R.Amount): number {
    return this.act(() => R.levelUp(this.state, id, amount), 'buy');
  }

  buyGear(id: C.GearId, amount: R.Amount): number {
    return this.act(() => R.buyGear(this.state, id, amount), 'buy');
  }

  toggleTeam(id: C.SpeciesId): boolean {
    return this.act(() => R.toggleTeam(this.state, id));
  }

  hatch(slot: number): HatchResult | null {
    const c = this.ctxAt(this.o.clock.now());
    R.hatch(this.state, c, slot);
    const result = c.events.find((e): e is HatchResult => e.type === 'hatch') ?? null;
    this.dispatch(c, true);
    if (result) {
      this.markTutorial('egg');
      void this.save();
    }
    return result;
  }

  finishEgg(slot: number): boolean {
    return this.act((c) => R.finishEggWithGems(this.state, slot, c.now), 'claim', true);
  }

  buyEgg(kind: C.EggKind): boolean {
    return this.act((c) => R.buyEgg(this.state, kind, c.now), 'buy', true);
  }

  buyIncubator(): boolean {
    return this.act((c) => R.buyIncubator(this.state, c.now), 'buy', true);
  }

  resurface(): number {
    const dust = this.act((c) => R.resurface(this.state, c.now), 'win', true);
    if (dust > 0) this.toast('resurface.done', { dust }, 'dust');
    return dust;
  }

  buyRelic(id: C.RelicId): boolean {
    return this.act(() => R.buyRelic(this.state, id), 'buy', true);
  }

  // -------------------------------------------------------------------------------------
  // Rewards

  collectOffline(): boolean {
    return this.act((c) => R.collectOffline(this.state, c.now, false) !== null, 'claim', true);
  }

  claimDaily(): C.DailyReward | null {
    return this.act((c) => R.claimDaily(this.state, c), 'claim', true);
  }

  claimQuest(index: number): boolean {
    return this.act(() => R.claimQuest(this.state, index), 'claim', true);
  }

  claimQuestBonus(): boolean {
    return this.act((c) => R.claimQuestBonus(this.state, c.now), 'claim', true);
  }

  claimAchievement(id: C.AchievementId): number {
    return this.act(() => R.claimAchievement(this.state, id), 'claim', true);
  }

  /** Things waiting to be claimed, for the badge on the rewards button. */
  claimable(): number {
    const s = this.state;
    const quests = s.daily.quests.filter((q) => !q.claimed && q.progress >= q.target).length;
    const achievements = C.ACHIEVEMENT_IDS.filter((id) => R.achievementReady(s, id)).length;
    return (R.dailyRewardReady(s, this.today()) ? 1 : 0) + quests + achievements + (R.questBonusReady(s) ? 1 : 0);
  }

  // -------------------------------------------------------------------------------------
  // Ads

  /** Whether a rewarded ad for this placement would give something right now. */
  adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.ctxAt(this.o.clock.now()), slot);
  }

  /**
   * Shows a rewarded ad and gives its reward only if the ad network confirms it. Owners of
   * No Ad Breaks get the reward without watching; the daily limits still apply.
   */
  async watchAd(placement: C.AdPlacement, slot = 0): Promise<boolean> {
    if (this.busy || !this.adOffered(placement, slot)) return false;
    let outcome: AdOutcome = 'rewarded';
    if (!R.hasEntitlement(this.state, 'remove_ads')) {
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
    return this.act((c) => R.grantAdReward(this.state, c, placement, slot), 'claim', true);
  }

  /**
   * Call at a natural pause (a result screen was just closed). Shows an ad break only when the
   * rules allow it: never early in a session, rarely, and never for No Ad Breaks owners.
   */
  async naturalBreak(): Promise<boolean> {
    if (this.busy) return false;
    if (!R.interstitialAllowed(this.state, { now: this.o.clock.now(), day: this.today() }, this.sessionStartedAt)) return false;
    this.busy = true;
    let shown = false;
    try {
      shown = await this.o.ads.showInterstitial('break');
      if (shown) R.recordInterstitial(this.state, { now: this.o.clock.now(), day: this.today() });
    } catch {
      // No ad break this time.
    } finally {
      this.busy = false;
      this.emitChange();
    }
    return shown;
  }

  // -------------------------------------------------------------------------------------
  // Purchases. The store and the purchase server decide what was paid; the game only
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
      this.toast('shop.thanks', undefined, 'gem');
      this.sound.play('claim');
      this.buzz('heavy');
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
    return catalogItem(productId)?.kind === 'non_consumable' && this.account?.guest === true;
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
      const list = await this.o.store.products(CATALOG.map((p) => p.id));
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

  privacyOptionsRequired(): boolean {
    return this.o.ads.privacyOptionsRequired();
  }

  showPrivacyOptions(): Promise<void> {
    return this.o.ads.showPrivacyOptions();
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
            this.toast('shop.thanks', undefined, 'gem');
            this.sound.play('claim');
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
      R.applySettlement(this.state, settlement.id, settlement.amounts, this.o.clock.now());
      this.state.shop.pending = null;
      this.dirty = true;
      await this.slots.save(this.state);
    },
    setEntitlements: (entitlements) => {
      R.setEntitlements(this.state, entitlements);
      this.state.shop.starterBought = entitlements.includes('starter_pack');
      this.dirty = true;
    },
  };

  // -------------------------------------------------------------------------------------
  // Settings and saves

  setSettings(patch: Partial<GameState['settings']>): void {
    Object.assign(this.state.settings, patch);
    this.sound.setEnabled(this.state.settings.sound);
    this.emitChange();
    void this.save();
  }

  markTutorial(id: string): void {
    if (this.state.tutorial.includes(id)) return;
    this.state.tutorial.push(id);
    this.dirty = true;
  }

  exportSave(): string {
    return exportSave(this.format, this.state, this.o.clock.now());
  }

  /** Replaces the game with a save the player pasted. Offline time is not paid for it. */
  async importSave(text: string): Promise<boolean> {
    let state: GameState;
    try {
      state = importSave(this.format, text).state;
    } catch {
      return false;
    }
    const now = this.o.clock.now();
    state.lastSeenAt = now;
    state.offline = null;
    R.mergeSettlements(state, this.state, now);
    this.state = state;
    R.refreshQuests(state, this.today());
    R.autoIncubate(state, now);
    this.sound.setEnabled(state.settings.sound);
    await this.save();
    await this.syncPurchases(true);
    this.emitChange();
    return true;
  }

  /**
   * Replaces the game with a save from another device that got further. Purchases this save
   * received are carried over, and unlike a pasted save, offline time since that device last
   * played is paid as usual. Throws while a purchase cannot be finished into this save yet, so
   * the cloud sync tries again later.
   */
  async adoptSave(text: string): Promise<'adopted' | 'merged' | 'unreadable'> {
    let state: GameState;
    try {
      state = importSave(this.format, text).state;
    } catch {
      return 'unreadable';
    }
    await this.settlePending();
    const c = this.ctxAt(this.o.clock.now());
    const merged = R.mergeSettlements(state, this.state, c.now);
    this.state = state;
    R.refreshQuests(state, c.day);
    R.autoIncubate(state, c.now);
    R.returnFromOffline(state, c);
    this.sound.setEnabled(state.settings.sound);
    this.dispatch(c, true);
    await this.save();
    await this.syncPurchases(true);
    return merged > 0 ? 'merged' : 'adopted';
  }

  /** This save won over another device's: take over the purchases that one received. */
  async absorbSave(text: string): Promise<void> {
    let other: GameState;
    try {
      other = importSave(this.format, text).state;
    } catch {
      return;
    }
    const merged = R.mergeSettlements(this.state, other, this.o.clock.now());
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

  /**
   * How far a save got, to choose between two that both changed: its time played, which offline
   * earnings do not add to, so an idle phone never beats one that was played in the meantime.
   */
  progressOf(text: string): number {
    try {
      return importSave(this.format, text).state.stats.playSeconds;
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

  /** Syncs the cloud save now. The game also does it every few minutes and when it goes to the background. */
  async syncCloud(): Promise<SyncOutcome | null> {
    if (!this.cloudSync) return null;
    this.lastCloudSync = this.o.clock.now();
    const outcome = await this.cloudSync.sync();
    this.cloud = { outcome, at: this.o.clock.now() };
    if (outcome === 'downloaded') this.toast('toast.cloudLoaded', undefined, 'cloud');
    this.emitChange();
    return outcome;
  }

  /** Adds Google sign-in to this account, so progress and purchases survive a new phone. */
  async linkGoogle(): Promise<LinkResult> {
    if (!this.o.account) return 'failed';
    const result = await this.o.account.auth.linkGoogle();
    await this.refreshAccount();
    if (result === 'linked') this.toast('toast.googleLinked', undefined, 'cloud');
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
    const now = this.o.clock.now();
    this.state = createState(now, (this.o.seed ?? randomSeed)(), R.blockHp(1));
    this.account = null;
    this.cloud = null;
    // Both save slots, so no copy of the old game is left on the device.
    await this.save();
    await this.save();
    this.toast('toast.accountDeleted');
    await this.refreshAccount();
    return true;
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

  private act<T>(run: (c: R.Ctx) => T, sound?: SoundName, save = false): T {
    const c = this.ctxAt(this.o.clock.now());
    const result = run(c);
    const done = result !== false && result !== 0 && result !== null;
    if (done && sound) this.sound.play(sound);
    this.dispatch(c, true);
    if (done && save) void this.save();
    return result;
  }

  private ctxAt(now: number): R.Ctx {
    if (now - this.dayCheckedAt >= 1000 || now < this.dayCheckedAt) {
      this.dayCheckedAt = now;
      const day = this.dayKey(now);
      if (day !== this.day) {
        const rollover = this.day !== '';
        this.day = day;
        if (rollover) {
          R.refreshQuests(this.state, day);
          if (R.dailyRewardReady(this.state, day)) this.toast('toast.dailyReady', undefined, 'gift');
          this.dirty = true;
        }
      }
    }
    return R.ctx(now, this.day);
  }

  private dispatch(c: R.Ctx, render = false): void {
    if (c.events.length > 0) {
      for (const e of c.events) this.react(e);
      this.events.emit('sim', c.events);
    }
    this.dirty = true;
    if (render) this.emitChange();
  }

  private react(e: R.SimEvent): void {
    switch (e.type) {
      case 'hit':
        if (e.source === 'tap') this.sound.play(e.crit ? 'crit' : 'tap');
        if (e.source === 'dynamite') this.buzz('heavy');
        break;
      case 'block':
        this.sound.play(e.gem ? 'gem' : 'break');
        this.buzz('light');
        break;
      case 'egg_found':
        this.sound.play('egg');
        this.toast('toast.eggFound', { egg: { key: `egg.${e.egg}` } }, 'egg');
        break;
      case 'guardian_start':
        this.sound.play('guardian');
        break;
      case 'guardian_won':
        this.sound.play('win');
        this.buzz('heavy');
        this.toast('toast.guardianWon', { name: R.guardianName(e.depth) }, 'sword');
        this.lastSave = -Infinity;
        break;
      case 'guardian_lost':
        this.sound.play('lose');
        this.toast('toast.guardianLost', { name: R.guardianName(e.depth) }, 'clock');
        break;
      case 'unlock':
        if (e.what === 'skill') this.toast('toast.skillUnlocked', { name: { key: `skill.${e.id}` as StringKey } }, e.id as IconName);
        else this.toast('toast.slotUnlocked', undefined, 'creatures');
        break;
      case 'hatch':
        this.sound.play('hatch');
        this.buzz('heavy');
        break;
      case 'descend':
        break;
    }
  }

  /** Vibration, if the player wants it, at most a few times a second. */
  private buzz(kind: 'light' | 'heavy'): void {
    const now = this.o.clock.now();
    if (!this.state.settings.haptics || now - this.lastBuzz < (kind === 'light' ? 250 : 120)) return;
    this.lastBuzz = now;
    this.haptics[kind]();
  }

  private toast(key: StringKey, params?: Toast['params'], icon?: IconName): void {
    this.toastId += 1;
    this.events.emit('toast', { id: this.toastId, key, ...(params ? { params } : {}), ...(icon ? { icon } : {}) });
  }

  private emitChange(): void {
    this.dirty = false;
    this.lastRender = this.o.clock.now();
    this.events.emit('change', undefined);
  }
}
