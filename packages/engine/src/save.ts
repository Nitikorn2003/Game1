import { hashString } from './random.js';
import type { Clock } from './time.js';

/** Async key-value storage: localStorage on the web, Capacitor Preferences on Android. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }
}

export type SaveErrorReason = 'not_a_save' | 'wrong_game' | 'checksum' | 'too_new' | 'migration' | 'invalid';

export class SaveError extends Error {
  constructor(
    readonly reason: SaveErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export interface SaveFormat<T> {
  /** Identifies the game, so one game's save is never loaded into another. */
  game: string;
  /** Current schema version. Older saves are migrated up one version at a time. */
  version: number;
  /** migrations[n] turns version n data into version n + 1 data. */
  migrations: Readonly<Record<number, Migration>>;
  /** Turns migrated data into a valid state, repairing what it can, or throws. */
  restore(data: Record<string, unknown>): T;
}

export interface DecodedSave<T> {
  state: T;
  seq: number;
  savedAt: number;
  /** The version the save was written with, before migration. */
  version: number;
}

interface Envelope {
  g: string;
  v: number;
  seq: number;
  at: number;
  sum: string;
  /** The state as JSON text, so the checksum covers exactly the bytes that were written. */
  d: string;
}

function checksum(text: string): string {
  return hashString(text).toString(16).padStart(8, '0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    isRecord(value) &&
    typeof value.g === 'string' &&
    Number.isInteger(value.v) &&
    Number.isInteger(value.seq) &&
    typeof value.at === 'number' &&
    typeof value.sum === 'string' &&
    typeof value.d === 'string'
  );
}

export function encodeSave<T>(format: SaveFormat<T>, state: T, seq: number, savedAt: number): string {
  return wrap(format, JSON.stringify(state), seq, savedAt);
}

function wrap(format: SaveFormat<unknown>, d: string, seq: number, savedAt: number): string {
  const envelope: Envelope = { g: format.game, v: format.version, seq, at: savedAt, sum: checksum(d), d };
  return JSON.stringify(envelope);
}

export function decodeSave<T>(format: SaveFormat<T>, text: string): DecodedSave<T> {
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new SaveError('not_a_save', 'The save is not valid JSON.');
  }
  if (!isEnvelope(envelope)) throw new SaveError('not_a_save', 'The save has an unknown layout.');
  if (envelope.g !== format.game) throw new SaveError('wrong_game', `The save belongs to ${envelope.g}.`);
  if (checksum(envelope.d) !== envelope.sum) throw new SaveError('checksum', 'The save is damaged.');
  if (envelope.v > format.version) {
    throw new SaveError('too_new', `The save is from a newer version (${envelope.v}) of the game.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(envelope.d);
  } catch {
    throw new SaveError('checksum', 'The save is damaged.');
  }
  if (!isRecord(data)) throw new SaveError('invalid', 'The save holds no game state.');
  for (let v = envelope.v; v < format.version; v++) {
    const migrate = format.migrations[v];
    if (!migrate) throw new SaveError('migration', `No migration from save version ${v}.`);
    try {
      data = migrate(data);
    } catch (err) {
      throw new SaveError('migration', `Migrating from save version ${v} failed: ${String(err)}`);
    }
    if (!isRecord(data)) throw new SaveError('migration', `Migration from save version ${v} lost the state.`);
  }
  let state: T;
  try {
    state = format.restore(data);
  } catch (err) {
    throw new SaveError('invalid', `The save could not be restored: ${String(err)}`);
  }
  return { state, seq: envelope.seq, savedAt: envelope.at, version: envelope.v };
}

function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): string {
  const binary = atob(text);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** A save as one line of text the player can copy, e.g. to move it by hand or send to support. */
export function exportSave<T>(format: SaveFormat<T>, state: T, savedAt: number): string {
  return `${format.game}:${toBase64(encodeSave(format, state, 0, savedAt))}`;
}

export function importSave<T>(format: SaveFormat<T>, text: string): DecodedSave<T> {
  const trimmed = text.trim();
  const prefix = `${format.game}:`;
  if (!trimmed.startsWith(prefix)) throw new SaveError('wrong_game', 'This is not a save for this game.');
  let json: string;
  try {
    json = fromBase64(trimmed.slice(prefix.length));
  } catch {
    throw new SaveError('not_a_save', 'The save text is incomplete.');
  }
  return decodeSave(format, json);
}

export type LoadOutcome<T> =
  | { kind: 'empty' }
  | { kind: 'loaded'; save: DecodedSave<T>; /** True when the newest copy was unreadable and an older one was used. */ fellBack: boolean }
  | { kind: 'unreadable'; errors: SaveError[] };

/**
 * Keeps two copies of a save and writes them in turn, so a write that is cut off (app killed,
 * disk full) damages at most the newer copy and the game falls back to the older one.
 */
export class SaveSlots<T> {
  private seq = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string,
    readonly format: SaveFormat<T>,
    private readonly clock: Clock,
  ) {}

  async load(): Promise<LoadOutcome<T>> {
    const raws = await Promise.all([this.store.get(`${this.key}.a`), this.store.get(`${this.key}.b`)]);
    const present = raws.filter((raw): raw is string => raw !== null);
    if (present.length === 0) return { kind: 'empty' };
    const decoded: DecodedSave<T>[] = [];
    const errors: SaveError[] = [];
    for (const raw of present) {
      try {
        decoded.push(decodeSave(this.format, raw));
      } catch (err) {
        errors.push(err instanceof SaveError ? err : new SaveError('invalid', String(err)));
      }
    }
    if (decoded.length === 0) {
      // Keep the unreadable text so it can still be recovered by hand before a new game overwrites it.
      await this.store.set(`${this.key}.broken`, JSON.stringify(present));
      return { kind: 'unreadable', errors };
    }
    decoded.sort((x, y) => y.seq - x.seq);
    const newest = decoded[0] as DecodedSave<T>;
    this.seq = newest.seq;
    return { kind: 'loaded', save: newest, fellBack: errors.length > 0 };
  }

  /** Writes the state as it is now. Calls run one after another in the order they were made. */
  save(state: T): Promise<void> {
    const d = JSON.stringify(state);
    const savedAt = this.clock.now();
    const run = this.queue.then(async () => {
      const seq = this.seq + 1;
      await this.store.set(`${this.key}.${seq % 2 === 0 ? 'a' : 'b'}`, wrap(this.format, d, seq, savedAt));
      this.seq = seq;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async clear(): Promise<void> {
    await this.queue;
    await Promise.all([this.store.remove(`${this.key}.a`), this.store.remove(`${this.key}.b`)]);
    this.seq = 0;
  }
}
