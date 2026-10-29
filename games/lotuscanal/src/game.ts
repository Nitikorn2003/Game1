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
import type { Card } from './sim/cards.js';
import * as C from './sim/content.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type Deal, type DealResult, type GameState } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'play' | 'streak' | 'draw' | 'flip' | 'nope' | 'wild' | 'won' | 'lost' | 'undo' | 'buy' | 'claim';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** What the screens animate after a card is played. */
export interface PlayEvent {
  mode: C.Mode;
  spot: number;
  card: Card;
  revealed: number[];
  streak: number;
  bonus: number;
  result: DealResult | null;
  /** The deal after the play, also once a clearing play took it out of the state. */
  deal: Deal;
}

export interface DrawEvent {
  mode: C.Mode;
  card: Card;
}

export interface GameEvents {
  play: PlayEvent;
  draw: DrawEvent;
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/**
 * Runs Lotus Canal: the screens read `state` and call the action methods; nothing else
 * changes it. Saving, ads, purchases and accounts come from the shell's Session.
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
      // A deal waits while the game is closed.
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
  // Deals

  deal(mode: C.Mode): Deal | null {
    return this.state.deals[mode];
  }

  /** The deal to play in a mode: the one in progress, or a new one; null once today's daily deal is cleared. */
  open(mode: C.Mode): Deal | null {
    const had = this.state.deals[mode];
    const deal = R.openDeal(this.state, mode, this.today());
    if (deal !== had) void this.save();
    this.emitChange();
    return deal;
  }

  /** A tap on a card that cannot be played. */
  nope(): void {
    this.sound.play('nope');
    this.buzz('light');
  }

  play(mode: C.Mode, spot: number): R.Played | null {
    const deal = this.state.deals[mode];
    const played = R.play(this.state, mode, spot, this.today());
    if (!deal || !played) {
      this.nope();
      return null;
    }
    if (played.result) this.sound.play('won');
    else if (played.bonus > 0) this.sound.play('streak');
    else this.sound.play('play');
    if (played.revealed.length > 0 && !played.result) this.sound.play('flip');
    this.buzz(played.bonus > 0 || played.result ? 'heavy' : 'light');
    this.events.emit('play', { mode, spot, ...played, deal });
    void this.save();
    this.emitChange();
    return played;
  }

  draw(mode: C.Mode): boolean {
    const card = R.draw(this.state, mode);
    if (card === null) {
      this.nope();
      return false;
    }
    this.sound.play('draw');
    this.buzz('light');
    this.events.emit('draw', { mode, card });
    void this.save();
    this.emitChange();
    return true;
  }

  undo(mode: C.Mode): boolean {
    return this.done(R.undo(this.state, mode), 'undo');
  }

  /** Ends a stuck deal; the next deal of the level or the day is a new one. */
  giveUp(mode: C.Mode): DealResult | null {
    const result = R.giveUp(this.state, mode, this.today());
    if (result) {
      this.sound.play('lost');
      void this.save();
    }
    this.emitChange();
    return result;
  }

  /** Whether a tool would help now. */
  toolOffered(mode: C.Mode, tool: C.Tool): boolean {
    return R.toolOffered(this.state, mode, tool);
  }

  /** Pays for a tool with coins. Watching an ad for it goes through `watchAd(R.TOOL_ADS[tool], slot)`. */
  buyTool(mode: C.Mode, tool: C.Tool): boolean {
    return this.done(R.buyTool(this.state, mode, tool), tool === 'wild' ? 'wild' : 'buy');
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

  /** `slot` is the deal's: 0 for the level, 1 for the daily deal. */
  override adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.today(), R.modeOfSlot(slot));
  }

  protected override grantAdReward(placement: C.AdPlacement, slot: number): boolean {
    const done = R.grantAdReward(this.state, placement, this.now(), this.today(), R.modeOfSlot(slot));
    if (done) {
      this.sound.play(placement === 'wild' ? 'wild' : 'claim');
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
