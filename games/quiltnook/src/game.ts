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
import { CATALOG } from './catalog.js';
import type { StringKey } from './i18n/index.js';
import * as C from './sim/content.js';
import type { Mode, Quilt, Stitch } from './sim/quilt.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type GameState, type QuiltResult } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'pick' | 'place' | 'seam' | 'perfect' | 'cleared' | 'stuck' | 'snip' | 'buy' | 'claim';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** What the screens animate after a patch is placed. */
export interface StitchEvent {
  mode: Mode;
  stitch: Stitch;
  dailyDone: boolean;
}

export interface GameEvents {
  stitch: StitchEvent;
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/**
 * Runs Quilt Nook: the screens read `state` and call the action methods; nothing else changes
 * it. Saving, ads, purchases and accounts come from the shell's Session.
 */
export class Game extends Session<GameState, StringKey, IconName, C.AdPlacement, GameEvents> {
  private readonly loop: FixedStepLoop;
  private readonly sound: Sound;

  private constructor(o: GameOptions, slots: SaveSlots<GameState>, state: GameState, startNote: StartNote) {
    super(o, slots, state, startNote, CATALOG, { purchase: 'spool', cloud: 'cloud' });
    this.sound = o.sound ?? silentSound;
    this.loop = new FixedStepLoop({
      clock: o.clock,
      scheduler: o.scheduler,
      stepMs: 1000,
      maxCatchUpMs: 60_000,
      // Time played decides which save wins when two devices both changed it.
      onStep: (dt) => {
        this.state.stats.playSeconds += dt;
      },
      // A quilt waits while the game is closed.
      onGap: () => undefined,
      onFrame: (now) => {
        this.frame(now);
      },
    });
  }

  /** Loads the save (or starts a new game) without starting the clock. */
  static async load(o: GameOptions): Promise<Game> {
    const { slots, state, note } = await loadSaveSlots(o.storage, saveFormat, o.clock);
    return new Game(o, slots, state ?? createState(o.clock.now(), (o.seed ?? randomSeed)()), note);
  }

  start(): void {
    this.beginSession();
    void this.save();
    this.loop.start();
    this.startServices();
    this.emitChange();
  }

  override stop(): void {
    this.loop.stop();
    super.stop();
  }

  /** Runs everything due now. The frame loop does this by itself; tests call it directly. */
  pump(): void {
    this.loop.pump();
  }

  // -------------------------------------------------------------------------------------
  // Quilts

  quilt(mode: Mode): Quilt | null {
    return this.state.quilts[mode];
  }

  /** The quilt to play in a mode: the one in progress, or a new one. */
  open(mode: Mode): Quilt {
    const had = this.state.quilts[mode];
    const quilt = R.openQuilt(this.state, mode, this.today());
    if (quilt !== had) void this.save();
    this.emitChange();
    return quilt;
  }

  /** Picking up a patch: only a sound and a buzz. */
  pick(): void {
    this.sound.play('pick');
    this.buzz('light');
  }

  place(mode: Mode, slot: number, x: number, y: number): Stitch | null {
    const placed = R.place(this.state, mode, slot, x, y, this.today());
    if (!placed) return null;
    const { stitch, dailyDone } = placed;
    if (stitch.cleared) this.sound.play('cleared');
    else if (stitch.perfect > 0) this.sound.play('perfect');
    else if (stitch.seams.length > 0) this.sound.play('seam');
    else this.sound.play('place');
    this.buzz(stitch.seams.length > 0 ? 'heavy' : 'light');
    if (dailyDone) this.toast('daily.done', { spools: C.DAILY_SPOOLS }, 'spool');
    if (R.stuck(this.state, mode)) this.sound.play('stuck');
    this.events.emit('stitch', { mode, stitch, dailyDone });
    void this.save();
    this.emitChange();
    return stitch;
  }

  unpick(mode: Mode): boolean {
    return this.tool(R.unpick(this.state, mode), 'snip');
  }

  newPatches(mode: Mode): boolean {
    return this.tool(R.newPatches(this.state, mode), 'pick');
  }

  snip(mode: Mode, x: number, y: number): boolean {
    return this.tool(R.snip(this.state, mode, x, y), 'snip');
  }

  private tool(done: boolean, sound: SoundName): boolean {
    if (done) {
      this.sound.play(sound);
      void this.save();
    }
    this.emitChange();
    return done;
  }

  /** Ends the quilt in progress and pays for it. */
  finish(mode: Mode): QuiltResult | null {
    const result = R.finishQuilt(this.state, mode);
    if (result) this.sound.play('claim');
    void this.save();
    this.emitChange();
    return result;
  }

  // -------------------------------------------------------------------------------------
  // The quilt book: commissions and fabrics

  claimCommission(index: number): number {
    const reward = R.claimCommission(this.state, index);
    if (reward > 0) {
      this.sound.play('claim');
      this.buzz('light');
      void this.save();
    }
    this.emitChange();
    return reward;
  }

  buyFabric(id: C.FabricSetId): boolean {
    const done = R.buyFabric(this.state, id);
    if (done) {
      this.sound.play('buy');
      void this.save();
    }
    this.emitChange();
    return done;
  }

  chooseFabric(id: C.FabricSetId): boolean {
    const done = R.chooseFabric(this.state, id);
    if (done) void this.save();
    this.emitChange();
    return done;
  }

  // -------------------------------------------------------------------------------------
  // What the shell asks of the game

  protected override newState(now: number, seed: number): GameState {
    return createState(now, seed);
  }

  protected override progressOf(state: GameState): number {
    return state.stats.playSeconds;
  }

  protected override grant(state: GameState, amounts: Readonly<Record<string, number>>): void {
    R.grantPurchase(state, amounts);
  }

  protected override setEntitlements(state: GameState, entitlements: readonly string[]): void {
    R.setEntitlements(state, entitlements);
  }

  /** `slot` is the quilt's: 0 for the endless quilt, 1 for the daily one. */
  override adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.today(), R.modeOfSlot(slot));
  }

  protected override grantAdReward(placement: C.AdPlacement, slot: number): boolean {
    const done = R.grantAdReward(this.state, placement, this.now(), this.today(), R.modeOfSlot(slot));
    if (done) {
      this.sound.play('claim');
      void this.save();
    }
    this.emitChange();
    return done;
  }

  protected override adBreaksEarned(state: GameState): boolean {
    return R.adBreaksEarned(state);
  }

  protected override purchased(): void {
    this.sound.play('claim');
    this.buzz('heavy');
  }
}
