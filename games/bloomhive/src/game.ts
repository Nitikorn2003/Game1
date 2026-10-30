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
import type { Bud } from './sim/hive.js';
import type { Shot } from './sim/round.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type Current, type GameState, type RoundResult } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'shoot' | 'stick' | 'pop' | 'bee' | 'jar' | 'swap' | 'won' | 'lost' | 'tool' | 'buy' | 'claim' | 'nope';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** What the screens animate after a shot: its flight, then each step of it, one after another. */
export interface ShotEvent {
  shot: Shot;
  /** The board as it was when the ball left, which it flies over. */
  before: readonly (Bud | null)[];
  /** The round's result, when the shot reached its goals. */
  result: RoundResult | null;
}

export interface GameEvents {
  shot: ShotEvent;
  /** A round that ended without a shot: five more pollen blew away the last buds in the way. */
  ended: RoundResult;
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/** The sound a shot makes when it lands: the biggest thing in it. */
export function soundOf(shot: Shot): SoundName {
  if (shot.won) return 'won';
  if (shot.freed > 0) return 'bee';
  if (shot.filled) return 'jar';
  return shot.steps.some((step) => step.popped.length > 0 || step.fallen.length > 0) ? 'pop' : 'stick';
}

/**
 * Runs Bloom Hive: the screens read `state` and call the action methods; nothing else changes
 * it. Saving, ads, purchases and accounts come from the shell's Session.
 */
export class Game extends Session<GameState, StringKey, IconName, C.AdPlacement, GameEvents> {
  private readonly loop: FixedStepLoop;
  private readonly sound: Sound;

  private constructor(o: GameOptions, slots: SaveSlots<GameState>, state: GameState, startNote: StartNote) {
    super(o, slots, state, startNote, CATALOG, { purchase: 'coin', cloud: 'cloud' });
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
      // A round waits while the game is closed.
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
  // Rounds

  /** A try at a level of the meadow or the wild: the round in progress there, or a new one; null for a level not open yet. */
  startLevel(n: number): Current | null {
    return this.began(this.state.current, R.startLevel(this.state, n));
  }

  /** Today's daily meadow; null once it has been reached. */
  openDaily(): Current | null {
    return this.began(this.state.current, R.openDaily(this.state, this.today()));
  }

  private began(had: Current | null, current: Current | null): Current | null {
    if (current && current !== had) void this.save();
    this.emitChange();
    return current;
  }

  /**
   * Shoots at an angle, in degrees anticlockwise from straight right: the pollen in hand or
   * the jar's bomb, or with `tool` a tool from the pouch. Null when nothing can be shot.
   */
  shoot(angle: number, tool: C.Tool | null = null): R.Shot | null {
    const before = [...(this.state.current?.round.board.cells ?? [])];
    const done = R.shoot(this.state, angle, tool);
    if (!done) {
      this.sound.play('nope');
      this.emitChange();
      return null;
    }
    this.sound.play(tool ? 'tool' : 'shoot');
    this.buzz(done.shot.won ? 'heavy' : 'light');
    this.events.emit('shot', { shot: done.shot, before, result: done.result });
    void this.save();
    this.emitChange();
    return done;
  }

  /** Swaps the pollen in hand for the next one, which takes no pollen. */
  swapPollen(): boolean {
    const done = R.swapPollen(this.state);
    if (done) {
      this.sound.play('swap');
      void this.save();
    }
    this.emitChange();
    return done;
  }

  /** Plays the sound of a shot as it lands; the board calls it when the ball gets there. */
  landed(shot: Shot): void {
    this.sound.play(soundOf(shot));
  }

  /** Buys one of a tool for the pouch. Watching an ad for one goes through `watchAd('tool', R.slotOfTool(tool))`. */
  buyTool(tool: C.Tool): boolean {
    return this.done(R.buyTool(this.state, tool), 'buy');
  }

  /** Five more pollen for a round that ran out, for honey. For an ad: `watchAd('more_shots')`. */
  buyMoreShots(): boolean {
    const done = this.done(R.buyMoreShots(this.state), 'buy');
    if (done) this.endedByMore();
    return done;
  }

  /** Ends the round in progress without reaching its goals. */
  giveUp(): RoundResult | null {
    const result = R.giveUp(this.state);
    return this.done(result !== null, 'lost') ? result : null;
  }

  /** Marks a note on what is new as seen. */
  seeTip(tip: C.TipId): boolean {
    const done = R.seeTip(this.state, tip);
    if (done) void this.save();
    this.emitChange();
    return done;
  }

  private done(done: boolean, sound: SoundName): boolean {
    if (done) {
      this.sound.play(sound);
      void this.save();
    }
    this.emitChange();
    return done;
  }

  /** Five more pollen that blew away the last bee in the way end the round there and then. */
  private endedByMore(): void {
    const result = this.state.result;
    if (!this.state.current && result?.won) {
      this.sound.play('won');
      this.events.emit('ended', result);
    }
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

  /** `slot` says which tool a tool ad is for, from `R.slotOfTool`; the other placements have none. */
  override adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.today(), slot);
  }

  protected override grantAdReward(placement: C.AdPlacement, slot: number): boolean {
    const done = this.done(R.grantAdReward(this.state, placement, this.now(), this.today(), slot), 'claim');
    if (done && placement === 'more_shots') this.endedByMore();
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
