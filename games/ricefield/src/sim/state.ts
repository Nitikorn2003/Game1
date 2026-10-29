import { bool, dayKeyOf, int, isRecord, list, num, oneOf, type Data, type SaveFormat } from '@game1/engine';
import {
  createAdLedger,
  createSettings,
  createShop,
  restoreAdLedger,
  restoreSettings,
  restoreShop,
  type AdLedger,
  type ShellSettings,
  type ShopRecord,
} from '@game1/shell';
import {
  AD_PLACEMENTS,
  ENTITLEMENTS,
  FREE_HINTS,
  HEARTS,
  MARKERS,
  MAX_OPEN_FIELDS,
  MODES,
  SCENES,
  type AdPlacement,
  type Entitlement,
  type LookId,
  type Marker,
  type Mode,
  type Scene,
} from './content.js';
import { ALBUM_IDS, complete, isPictureId, puzzleFor, restoreBoard, type PictureId } from './fields.js';
import { UNKNOWN, type CellState } from './nonogram.js';
import type { AlbumId } from './pictures.js';

export type { AdPlacement, Entitlement } from './content.js';

/** One field in progress. */
export interface Field {
  mode: Mode;
  /** An album picture's id, or the day of a daily field. */
  id: string;
  /** What the player knows of each cell, row by row from the top left. Every known cell is right. */
  board: CellState[];
  hearts: number;
  /** Wrong moves made here. Each one cost a heart and was put right at once. */
  mistakes: number;
  /** The cells of those wrong moves, which the field marks. */
  wrong: number[];
  /** Free hints left; more cost an ad or seeds. */
  freeHints: number;
  /** Hints used here, free or not. A field grown without a hint or a wrong move is perfect. */
  hints: number;
  /** Times the field was started over. */
  restarts: number;
}

/** The last field grown, shown until the next one is played. */
export interface FieldResult {
  mode: Mode;
  id: string;
  perfect: boolean;
  mistakes: number;
  hints: number;
  /** What the field paid, and half as much again for a perfect one. */
  pay: number;
  bonus: number;
  /** Both together, which a rewarded ad can double once. */
  seeds: number;
  doubled: boolean;
  /** The album this picture finished, and what that paid on top; never doubled. */
  album: AlbumId | null;
  albumSeeds: number;
  /** The album this picture opened. */
  opened: AlbumId | null;
  /** The daily streak after a daily field. */
  streak: number;
}

export interface GameState {
  createdAt: number;
  seeds: number;
  /** Album fields in progress, the one played last at the end. */
  fields: Field[];
  /** Album pictures grown, in the order they grew. */
  grown: PictureId[];
  daily: { field: Field | null; lastDone: string | null; streak: number; bestStreak: number };
  result: FieldResult | null;
  looks: { scene: Scene; marker: Marker; bought: LookId[] };
  stats: {
    /** Fields grown, album and daily. */
    grown: number;
    perfect: number;
    dailies: number;
    /** Cells of rice planted in grown fields. */
    cells: number;
    mistakes: number;
    hints: number;
    restarts: number;
    playSeconds: number;
  };
  /** The note on how to play stays until the first field has grown. */
  taught: boolean;
  ads: AdLedger<AdPlacement>;
  shop: ShopRecord<Entitlement>;
  settings: ShellSettings;
}

export const SAVE_VERSION = 1;

export function createState(now: number): GameState {
  return {
    createdAt: now,
    seeds: 0,
    fields: [],
    grown: [],
    daily: { field: null, lastDone: null, streak: 0, bestStreak: 0 },
    result: null,
    looks: { scene: 'terraces', marker: 'pebble', bought: [] },
    stats: { grown: 0, perfect: 0, dailies: 0, cells: 0, mistakes: 0, hints: 0, restarts: 0, playSeconds: 0 },
    taught: false,
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

/** A field in progress, its board checked against its picture; a field that cannot be read is dropped. */
function restoreField(data: unknown, mode: Mode): Field | null {
  if (!isRecord(data)) return null;
  const id = mode === 'album' ? (isPictureId(data.id) ? data.id : null) : dayKeyOf(data.id);
  if (id === null) return null;
  const puzzle = puzzleFor(mode, id);
  const board = restoreBoard(puzzle, list(data.board));
  // A field all planted would have grown when its last cell was planted.
  if (complete(puzzle, board)) return null;
  const wrong = list(data.wrong).filter((cell): cell is number => typeof cell === 'number' && board[cell] !== undefined && board[cell] !== UNKNOWN);
  return {
    mode,
    id,
    board,
    hearts: int(data.hearts, HEARTS, 0, HEARTS),
    mistakes: int(data.mistakes, 0),
    wrong: [...new Set(wrong)],
    freeHints: int(data.freeHints, FREE_HINTS, 0, FREE_HINTS),
    hints: int(data.hints, 0),
    restarts: int(data.restarts, 0),
  };
}

function restoreResult(data: unknown): FieldResult | null {
  if (!isRecord(data)) return null;
  return {
    mode: oneOf(data.mode, MODES, 'album'),
    id: typeof data.id === 'string' ? data.id.slice(0, 40) : '',
    perfect: bool(data.perfect, false),
    mistakes: int(data.mistakes, 0),
    hints: int(data.hints, 0),
    pay: int(data.pay, 0),
    bonus: int(data.bonus, 0),
    seeds: int(data.seeds, 0),
    doubled: bool(data.doubled, false),
    album: isAlbumId(data.album) ? data.album : null,
    albumSeeds: int(data.albumSeeds, 0),
    opened: isAlbumId(data.opened) ? data.opened : null,
    streak: int(data.streak, 0),
  };
}

const isAlbumId = (v: unknown): v is AlbumId => typeof v === 'string' && (ALBUM_IDS as readonly string[]).includes(v);

const LOOKS: readonly LookId[] = [...SCENES, ...MARKERS];
const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back seeds that were already spent.
  s.seeds = int(data.seeds, 0, -1_000_000_000);
  s.grown = [...new Set(list(data.grown).filter(isPictureId))];
  const grown = new Set<string>(s.grown);
  // One field per picture, the last one kept; none for a picture already grown.
  const fields = list(data.fields)
    .map((entry) => restoreField(entry, 'album'))
    .filter((field): field is Field => field !== null && !grown.has(field.id));
  s.fields = fields.filter((field, i) => !fields.slice(i + 1).some((later) => later.id === field.id)).slice(-MAX_OPEN_FIELDS);
  const daily = isRecord(data.daily) ? data.daily : {};
  s.daily = {
    field: restoreField(daily.field, 'daily'),
    lastDone: dayKeyOf(daily.lastDone),
    streak: int(daily.streak, 0),
    bestStreak: int(daily.bestStreak, 0),
  };
  s.result = restoreResult(data.result);
  const looks = isRecord(data.looks) ? data.looks : {};
  s.looks = {
    scene: oneOf(looks.scene, SCENES, 'terraces'),
    marker: oneOf(looks.marker, MARKERS, 'pebble'),
    bought: [...new Set(list(looks.bought).filter(isLook))],
  };
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    grown: int(stats.grown, 0),
    perfect: int(stats.perfect, 0),
    dailies: int(stats.dailies, 0),
    cells: int(stats.cells, 0),
    mistakes: int(stats.mistakes, 0),
    hints: int(stats.hints, 0),
    restarts: int(stats.restarts, 0),
    playSeconds: num(stats.playSeconds, 0),
  };
  s.taught = bool(data.taught, false);
  s.ads = restoreAdLedger(data.ads, AD_PLACEMENTS);
  s.shop = restoreShop(data.shop, ENTITLEMENTS);
  s.settings = restoreSettings(data.settings);
  return s;
}

export const saveFormat: SaveFormat<GameState> = {
  game: 'ricefield',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
