import { FixedStepLoop, type FrameScheduler, type SaveSlots } from '@game1/engine';
import {
  Session,
  loadSaveSlots,
  randomSeed,
  silentSound,
  type SessionOptions,
  type Sound as ShellSound,
  type StartNote,
  type Toast as ShellToast,
  type ToastParam as ShellToastParam,
} from '@game1/shell';
import type { IconName } from './art/Icon.js';
import { CATALOG } from './catalog.js';
import type { StringKey } from './i18n/index.js';
import * as C from './sim/content.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type GameState } from './sim/state.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'tap' | 'crit' | 'break' | 'gem' | 'egg' | 'hatch' | 'guardian' | 'win' | 'lose' | 'buy' | 'skill' | 'claim';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** The game's own events, next to the session's `change` and `toast`. */
export interface GameEvents {
  /** What just happened, for animations. */
  sim: readonly R.SimEvent[];
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

export type HatchResult = Extract<R.SimEvent, { type: 'hatch' }>;

const STEP_MS = 100;
/** Gaps longer than this are offline time, paid out at the offline rate. */
const MAX_CATCH_UP_MS = 60_000;

/**
 * Runs one game of Lodelings: the simulation loop, offline time and daily resets, on top of the
 * shell's saving, ads, purchases and accounts. The screens read `state` and call the action
 * methods; nothing else changes it.
 */
export class Game extends Session<GameState, StringKey, IconName, C.AdPlacement, GameEvents> {
  private readonly loop: FixedStepLoop;
  private readonly sound: Sound;
  private day = '';
  private dayCheckedAt = -Infinity;
  private readonly recentTaps: number[] = [];

  private constructor(o: GameOptions, slots: SaveSlots<GameState>, state: GameState, startNote: StartNote) {
    super(o, slots, state, startNote, CATALOG, { purchase: 'gem', cloud: 'cloud' });
    this.sound = o.sound ?? silentSound;
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
        this.frame(now);
      },
    });
  }

  /** Loads the save (or starts a new game) without starting the clock. */
  static async load(o: GameOptions): Promise<Game> {
    const { slots, state, note } = await loadSaveSlots(o.storage, saveFormat(R.blockHp), o.clock);
    return new Game(o, slots, state ?? createState(o.clock.now(), (o.seed ?? randomSeed)(), R.blockHp(1)), note);
  }

  /** Pays out offline time, starts the clock and brings purchases up to date. */
  start(): void {
    this.beginSession();
    const c = this.ctxAt(this.o.clock.now());
    R.refreshQuests(this.state, c.day);
    R.autoIncubate(this.state, c.now);
    R.returnFromOffline(this.state, c);
    this.dispatch(c, true);
    void this.save();
    this.loop.start();
    this.startServices();
  }

  override stop(): void {
    this.loop.stop();
    super.stop();
  }

  /** Runs everything due now. The frame loop does this by itself; tests call it directly. */
  pump(): void {
    this.loop.pump();
  }

  override today(): string {
    return this.ctxAt(this.o.clock.now()).day;
  }

  // -------------------------------------------------------------------------------------
  // What the shell asks of the game

  protected override newState(now: number, seed: number): GameState {
    return createState(now, seed, R.blockHp(1));
  }

  /** Time played, which offline earnings do not add to. */
  protected override progressOf(state: GameState): number {
    return state.stats.playSeconds;
  }

  protected override grant(state: GameState, amounts: Readonly<Record<string, number>>, now: number): void {
    R.grantPurchase(state, amounts, now);
  }

  protected override setEntitlements(state: GameState, entitlements: readonly string[]): void {
    R.setEntitlements(state, entitlements);
  }

  override adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.ctxAt(this.o.clock.now()), slot);
  }

  protected override grantAdReward(placement: C.AdPlacement, slot: number): boolean {
    return this.act((c) => R.grantAdReward(this.state, c, placement, slot), 'claim', true);
  }

  protected override adBreaksEarned(state: GameState): boolean {
    return R.adBreaksEarned(state);
  }

  protected override prepare(how: 'new' | 'imported' | 'adopted'): void {
    const c = this.ctxAt(this.o.clock.now());
    const s = this.state;
    if (how === 'imported') {
      // A pasted save gets no offline time.
      s.lastSeenAt = c.now;
      s.offline = null;
    }
    R.refreshQuests(s, c.day);
    R.autoIncubate(s, c.now);
    if (how === 'adopted') {
      R.returnFromOffline(s, c);
      this.dispatch(c);
    }
  }

  protected override purchased(): void {
    this.sound.play('claim');
    this.buzz('heavy');
  }

  markTutorial(id: string): void {
    if (this.state.tutorial.includes(id)) return;
    this.state.tutorial.push(id);
    this.dirty = true;
  }

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
}
