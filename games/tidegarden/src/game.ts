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
import type { Played } from './sim/dive.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type Current, type DiveResult, type GameState } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'swap' | 'nope' | 'match' | 'special' | 'save' | 'won' | 'lost' | 'tool' | 'buy' | 'claim';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** What the screens animate after a swap or a tool: each step of it, one after another. */
export interface MoveEvent {
  by: 'swap' | C.Tool;
  played: Played;
  /** The dive's result, when the move reached its goals. */
  result: DiveResult | null;
}

export interface GameEvents {
  move: MoveEvent;
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/** The sound a move makes: the biggest thing in it. */
function soundOf(played: Played, won: boolean): SoundName {
  if (won) return 'won';
  if (played.steps.some((step) => step.saved.length > 0)) return 'save';
  if (played.steps.some((step) => (step.cleared?.blasts.length ?? 0) > 0 || (step.cleared?.made.length ?? 0) > 0)) return 'special';
  return played.steps.some((step) => step.kind === 'clear') ? 'match' : 'swap';
}

/**
 * Runs Tide Garden: the screens read `state` and call the action methods; nothing else changes
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
      // A dive waits while the game is closed.
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
  // Dives

  /** A try at a level of the reef or the sea: the dive in progress there, or a new one; null for a level not open yet. */
  startLevel(n: number): Current | null {
    return this.began(this.state.current, R.startLevel(this.state, n));
  }

  /** Today's daily dive; null once it has been reached. */
  openDaily(): Current | null {
    return this.began(this.state.current, R.openDaily(this.state, this.today()));
  }

  private began(had: Current | null, current: Current | null): Current | null {
    if (current && current !== had) void this.save();
    this.emitChange();
    return current;
  }

  /** Swaps two pieces, which takes a move; null when the swap does nothing, and the pieces go back. */
  swap(from: number, to: number): R.Moved | null {
    return this.moved('swap', R.swap(this.state, from, to));
  }

  /** Uses a tool from the bag, which takes no move; null where it would do nothing, or with none in the bag. */
  playTool(use: R.ToolUse): R.Moved | null {
    return this.moved(use.tool, R.playTool(this.state, use));
  }

  private moved(by: MoveEvent['by'], moved: R.Moved | null): R.Moved | null {
    if (!moved) {
      this.sound.play('nope');
      this.emitChange();
      return null;
    }
    const won = moved.result !== null;
    this.sound.play(by === 'swap' ? soundOf(moved.played, won) : won ? 'won' : 'tool');
    this.buzz(won ? 'heavy' : 'light');
    this.events.emit('move', { by, played: moved.played, result: moved.result });
    void this.save();
    this.emitChange();
    return moved;
  }

  /** Buys one of a tool for the bag. Watching an ad for one goes through `watchAd('tool', R.slotOfTool(tool))`. */
  buyTool(tool: C.Tool): boolean {
    return this.done(R.buyTool(this.state, tool), 'buy');
  }

  /** Five more moves for a dive that ran out, for sand dollars. For an ad: `watchAd('more_moves')`. */
  buyMoreMoves(): boolean {
    return this.done(R.buyMoreMoves(this.state), 'buy');
  }

  /** Ends the dive in progress without reaching its goals. */
  giveUp(): DiveResult | null {
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
    return this.done(R.grantAdReward(this.state, placement, this.now(), this.today(), slot), 'claim');
  }

  protected override adBreaksEarned(state: GameState): boolean {
    return R.adBreaksEarned(state);
  }

  protected override purchased(): void {
    this.sound.play('claim');
    this.buzz('heavy');
  }
}
