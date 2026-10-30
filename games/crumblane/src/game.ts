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
import type { Take } from './sim/round.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type Current, type GameState, type RoundResult } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'take' | 'set' | 'sprinkle' | 'open' | 'full' | 'spatula' | 'rollingpin' | 'whisk' | 'room' | 'won' | 'lost' | 'buy' | 'claim' | 'nope';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

export interface GameEvents {
  /** A pastry went onto the tray. */
  took: R.Took;
  /** A tool was used. */
  tool: R.ToolUse;
  /** Room was made on a full tray: these pastries went up to the rack. */
  room: readonly number[];
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/** The sound a take makes: the biggest thing in it. */
export function soundOf(take: Take): SoundName {
  if (take.won) return 'won';
  if (take.stuck) return 'full';
  if (take.sprinkled > 0) return 'sprinkle';
  if (take.opened.length > 0) return 'open';
  return take.set ? 'set' : 'take';
}

/**
 * Runs Crumb Lane: the screens read `state` and call the action methods; nothing else changes
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

  /** A try at a level of the lane or the late shift: the round in progress there, or a new one; null for a level not open yet. */
  startLevel(n: number): Current | null {
    return this.began(this.state.current, R.startLevel(this.state, n));
  }

  /** Today's daily special; null once it has been cleared. */
  openDaily(): Current | null {
    return this.began(this.state.current, R.openDaily(this.state, this.today()));
  }

  private began(had: Current | null, current: Current | null): Current | null {
    if (current && current !== had) void this.save();
    this.emitChange();
    return current;
  }

  /** Takes a tile from the counter, or back from the rack, onto the tray. Null when it cannot be taken. */
  take(tile: number): R.Took | null {
    const done = R.take(this.state, tile);
    if (!done) {
      this.sound.play('nope');
      this.emitChange();
      return null;
    }
    this.sound.play(soundOf(done.take));
    this.buzz(done.take.won || done.take.stuck ? 'heavy' : 'light');
    this.events.emit('took', done);
    void this.save();
    this.emitChange();
    return done;
  }

  /** Uses a tool from the pocket. Watching an ad for one goes through `watchAd('tool', R.slotOfTool(tool))`. */
  applyTool(tool: C.Tool): R.ToolUse | null {
    const done = R.applyTool(this.state, tool);
    if (!done) {
      this.sound.play('nope');
      this.emitChange();
      return null;
    }
    this.sound.play(done.result ? 'won' : tool);
    this.buzz(done.result ? 'heavy' : 'light');
    this.events.emit('tool', done);
    void this.save();
    this.emitChange();
    return done;
  }

  /** Buys one of a tool for the pocket. */
  buyTool(tool: C.Tool): boolean {
    return this.done(R.buyTool(this.state, tool), 'buy');
  }

  /** Makes room on a full tray, for sugar. For an ad: `watchAd('more_room')`. */
  buyRoom(): boolean {
    const moved = this.state.current ? [...this.state.current.round.tray] : [];
    const done = this.done(R.buyRoom(this.state), 'room');
    if (done) this.roomMade(moved);
    return done;
  }

  /** Ends the round in progress without clearing the counter. */
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

  /** Tells the screens which pastries of the tray went up to the rack, in the order they sit there. */
  private roomMade(trayBefore: readonly number[]): void {
    const r = this.state.current?.round;
    if (r) this.events.emit('room', r.rack.filter((t) => trayBefore.includes(t)));
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
    const moved = this.state.current ? [...this.state.current.round.tray] : [];
    const done = this.done(R.grantAdReward(this.state, placement, this.now(), this.today(), slot), placement === 'more_room' ? 'room' : 'claim');
    if (done && placement === 'more_room') this.roomMade(moved);
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
