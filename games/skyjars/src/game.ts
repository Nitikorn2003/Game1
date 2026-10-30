import { FixedStepLoop, type FrameScheduler, type SaveSlots } from '@game1/engine';
import {
  Session,
  loadSaveSlots,
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
import * as R from './sim/rules.js';
import { createState, saveFormat, type GameState, type Shelf, type ShelfResult } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'pick' | 'pour' | 'fill' | 'solved' | 'nope' | 'undo' | 'stuck' | 'hint' | 'buy' | 'claim';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** What the screens animate after a pour. */
export interface PourEvent {
  mode: C.Mode;
  from: number;
  to: number;
  n: number;
  filled: boolean;
  result: ShelfResult | null;
  /** The shelf after the pour, also once a solving pour took it out of the state. */
  shelf: Shelf;
}

export interface GameEvents {
  pour: PourEvent;
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/**
 * Runs Sky Jars: the screens read `state` and call the action methods; nothing else changes
 * it. Saving, ads, purchases and accounts come from the shell's Session.
 */
export class Game extends Session<GameState, StringKey, IconName, C.AdPlacement, GameEvents> {
  private readonly loop: FixedStepLoop;
  private readonly sound: Sound;

  private constructor(o: GameOptions, slots: SaveSlots<GameState>, state: GameState, startNote: StartNote) {
    super(o, slots, state, startNote, CATALOG, { purchase: 'stardust', cloud: 'cloud' });
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
      // A shelf waits while the game is closed.
      onGap: () => undefined,
      onFrame: (now) => {
        this.frame(now);
      },
    });
  }

  /** Loads the save (or starts a new game) without starting the clock. */
  static async load(o: GameOptions): Promise<Game> {
    const { slots, state, note } = await loadSaveSlots(o.storage, saveFormat, o.clock);
    return new Game(o, slots, state ?? createState(o.clock.now()), note);
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
  // Shelves

  shelf(mode: C.Mode): Shelf | null {
    return this.state.shelves[mode];
  }

  /** The shelf to play in a mode: the one in progress, or a new one; null once today's daily sky is solved. */
  open(mode: C.Mode): Shelf | null {
    const had = this.state.shelves[mode];
    const shelf = R.openShelf(this.state, mode, this.today());
    if (shelf !== had) void this.save();
    this.emitChange();
    return shelf;
  }

  /** Lifting a jar: only a sound and a buzz. */
  pick(): void {
    this.sound.play('pick');
    this.buzz('light');
  }

  /** A pour that is not allowed. */
  nope(): void {
    this.sound.play('nope');
    this.buzz('light');
  }

  pour(mode: C.Mode, from: number, to: number): R.Poured | null {
    const shelf = this.state.shelves[mode];
    const poured = R.pour(this.state, mode, from, to);
    if (!shelf || !poured) {
      this.nope();
      return null;
    }
    if (poured.result) this.sound.play('solved');
    else if (poured.filled) this.sound.play('fill');
    else this.sound.play('pour');
    this.buzz(poured.filled ? 'heavy' : 'light');
    if (!poured.result && R.stuck(this.state, mode)) this.sound.play('stuck');
    this.events.emit('pour', { mode, from, to, ...poured, shelf });
    void this.save();
    this.emitChange();
    return poured;
  }

  undo(mode: C.Mode): boolean {
    return this.done(R.undo(this.state, mode), 'undo');
  }

  restart(mode: C.Mode): boolean {
    return this.done(R.restart(this.state, mode), 'undo');
  }

  /** Whether a tool would help now. A hint looks for a way forward first, so a hint that finds none costs nothing. */
  toolOffered(mode: C.Mode, tool: C.Tool): boolean {
    return R.toolOffered(this.state, mode, tool);
  }

  /** Pays for a tool with stardust. Watching an ad for it goes through `watchAd(R.TOOL_ADS[tool], slot)`. */
  buyTool(mode: C.Mode, tool: C.Tool): boolean {
    return this.done(R.buyTool(this.state, mode, tool), tool === 'hint' ? 'hint' : 'buy');
  }

  private done(done: boolean, sound: SoundName): boolean {
    if (done) {
      this.sound.play(sound);
      void this.save();
    }
    this.emitChange();
    return done;
  }

  // -------------------------------------------------------------------------------------
  // Looks

  buyLook(id: C.LookId): boolean {
    return this.done(R.buyLook(this.state, id), 'buy');
  }

  chooseLook(id: C.LookId): boolean {
    const done = R.chooseLook(this.state, id);
    if (done) void this.save();
    this.emitChange();
    return done;
  }

  // -------------------------------------------------------------------------------------
  // What the shell asks of the game

  protected override newState(now: number): GameState {
    return createState(now);
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

  /** `slot` is the shelf's: 0 for the level, 1 for the daily sky. */
  override adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.today(), R.modeOfSlot(slot));
  }

  protected override grantAdReward(placement: C.AdPlacement, slot: number): boolean {
    const done = R.grantAdReward(this.state, placement, this.now(), this.today(), R.modeOfSlot(slot));
    if (done) {
      this.sound.play(placement === 'hint' ? 'hint' : 'claim');
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
