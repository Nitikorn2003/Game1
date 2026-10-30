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
import type { PictureId } from './sim/fields.js';
import * as R from './sim/rules.js';
import { createState, saveFormat, type Field, type GameState } from './sim/state.js';
import type { IconName } from './ui/Icon.js';

export type { AccountOptions, StartNote } from '@game1/shell';

export type SoundName = 'plant' | 'pebble' | 'mistake' | 'line' | 'grown' | 'hint' | 'wilt' | 'buy' | 'claim';
export type Sound = ShellSound<SoundName>;
export type ToastParam = ShellToastParam<StringKey>;
export type Toast = ShellToast<StringKey, IconName>;

/** What the screens animate after a move on a cell. */
export interface ActEvent {
  key: R.FieldKey;
  action: R.Action;
  acted: R.Acted;
}

/** What the screens animate after a hint, free or paid for. */
export interface HintEvent {
  key: R.FieldKey;
  hinted: R.Hinted;
}

export interface GameEvents {
  act: ActEvent;
  hint: HintEvent;
}

export interface GameOptions extends SessionOptions {
  scheduler: FrameScheduler;
  sound?: Sound;
}

/**
 * Runs Rice Field Art: the screens read `state` and call the action methods; nothing else
 * changes it. Saving, ads, purchases and accounts come from the shell's Session.
 */
export class Game extends Session<GameState, StringKey, IconName, C.AdPlacement, GameEvents> {
  private readonly loop: FixedStepLoop;
  private readonly sound: Sound;

  private constructor(o: GameOptions, slots: SaveSlots<GameState>, state: GameState, startNote: StartNote) {
    super(o, slots, state, startNote, CATALOG, { purchase: 'seed', cloud: 'cloud' });
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
      // A field waits while the game is closed.
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
  // Fields

  field(key: R.FieldKey): Field | null {
    return R.fieldOf(this.state, key);
  }

  /** An album picture's field: the one in progress, or a new one; null for a grown picture or a closed album. */
  openPicture(id: PictureId): Field | null {
    const had = R.fieldOf(this.state, id);
    const field = R.openAlbumField(this.state, id);
    if (field && field !== had) void this.save();
    this.emitChange();
    return field;
  }

  /** Today's daily field; null once it has grown. */
  openDaily(): Field | null {
    const had = this.state.daily.field;
    const field = R.openDaily(this.state, this.today());
    if (field !== had) void this.save();
    this.emitChange();
    return field;
  }

  /** Plants a cell or pebbles it; null for a cell already known, or a field out of hearts. */
  act(key: R.FieldKey, cell: number, action: R.Action): R.Acted | null {
    const acted = R.act(this.state, key, cell, action);
    if (!acted) return null;
    if (acted.result) {
      this.sound.play('grown');
      this.buzz('heavy');
    } else if (acted.mistake) {
      this.sound.play(acted.wilted ? 'wilt' : 'mistake');
      this.buzz('heavy');
    } else {
      this.sound.play(acted.lines.length > 0 ? 'line' : action === 'plant' ? 'plant' : 'pebble');
      this.buzz('light');
    }
    this.events.emit('act', { key, action, acted });
    void this.save();
    this.emitChange();
    return acted;
  }

  /** Uses the field's free hint. Once it is used, a hint is a tool: `watchAd('hint', slot)` or `buyTool`. */
  freeHint(key: R.FieldKey): R.Hinted | null {
    return this.hinted(key, R.freeHint(this.state, key));
  }

  private hinted(key: R.FieldKey, hinted: R.Hinted | null): R.Hinted | null {
    if (hinted) {
      this.sound.play(hinted.result ? 'grown' : 'hint');
      this.events.emit('hint', { key, hinted });
      void this.save();
    }
    this.emitChange();
    return hinted;
  }

  /** Starts a field over, with all its hearts. */
  restart(key: R.FieldKey): boolean {
    const done = R.restart(this.state, key);
    if (done) void this.save();
    this.emitChange();
    return done;
  }

  /** Whether a tool would help now. */
  toolOffered(key: R.FieldKey, tool: C.Tool): boolean {
    return R.toolOffered(this.state, key, tool);
  }

  /** Pays for a tool with seeds. Watching an ad for it goes through `watchAd(R.TOOL_ADS[tool], R.slotOf(key))`. */
  buyTool(key: R.FieldKey, tool: C.Tool): boolean {
    const helped = R.buyTool(this.state, key, tool);
    if (helped?.tool === 'hint') this.hinted(key, helped.hinted);
    else this.done(helped !== null, 'buy');
    return helped !== null;
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

  /** `slot` is the field's, from `R.slotOf`: 0 for the daily field, then the album pictures. */
  override adOffered(placement: C.AdPlacement, slot = 0): boolean {
    return R.adOffered(this.state, placement, this.today(), R.keyOfSlot(slot));
  }

  protected override grantAdReward(placement: C.AdPlacement, slot: number): boolean {
    const key = R.keyOfSlot(slot);
    const rewarded = R.grantAdReward(this.state, placement, this.now(), this.today(), key);
    if (rewarded?.hinted && key !== null) {
      this.hinted(key, rewarded.hinted);
      return true;
    }
    return this.done(rewarded !== null, 'claim');
  }

  protected override adBreaksEarned(state: GameState): boolean {
    return R.adBreaksEarned(state);
  }

  protected override purchased(): void {
    this.sound.play('claim');
    this.buzz('heavy');
  }
}
