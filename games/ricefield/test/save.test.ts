import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import { pictureOf, puzzleOf, startBoard } from '../src/sim/fields.js';
import { EMPTY, FILLED, truthOf, UNKNOWN } from '../src/sim/nonogram.js';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { DAY, growPicture, T0, toPlant } from './helpers.js';

/** A game some way in: pictures grown, fields in progress with wrong moves and hints, a daily field, a bought look. */
function played(): GameState {
  const s = createState(T0);
  growPicture(s, 'heart');
  growPicture(s, 'house');
  const field = R.openAlbumField(s, 'cat');
  const cat = puzzleOf(pictureOf('cat'));
  const [plant = 0] = toPlant(s, 'cat');
  R.act(s, 'cat', plant, 'plant');
  // A wrong move: rice where the picture has none.
  R.act(s, 'cat', cat.shape.filled.findIndex((filled, cell) => !filled && field?.board[cell] === UNKNOWN), 'plant');
  R.freeHint(s, 'cat');
  R.openAlbumField(s, 'tree');
  R.act(s, 'tree', 1, 'plant');
  R.openDaily(s, DAY);
  const [daily = 0] = toPlant(s, 'daily');
  R.act(s, 'daily', daily, 'plant');
  s.seeds += 1000;
  R.buyLook(s, 'golden');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_seeds', T0, DAY, null);
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

interface FieldData {
  id: unknown;
  board: unknown;
  hearts: unknown;
  wrong: unknown;
  freeHints: unknown;
}

const dataOf = (s: GameState) => JSON.parse(JSON.stringify(s)) as { fields: FieldData[]; daily: { field: FieldData } } & Record<string, unknown>;

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.fields.map((f) => f.id)).toEqual(['cat', 'tree']);
    expect(s.fields[0]).toMatchObject({ mistakes: 1, hints: 1, freeHints: 0, hearts: C.HEARTS - 1 });
    expect(s.daily.field?.id).toBe(DAY);
    expect(roundTrip(s)).toEqual(s);
    // And the results of a grown field.
    expect(s.result).toBeNull();
    const t = createState(T0);
    growPicture(t, 'sun');
    expect(roundTrip(t)).toEqual(t);
  });

  it('goes through the save text a player can copy, and back', () => {
    const s = played();
    const back = importSave(saveFormat, exportSave(saveFormat, s, T0));
    expect(back.state).toEqual(s);
    expect(back.version).toBe(saveFormat.version);
  });

  it('keeps only the cells of a board that are right, so a damaged board never shows a wrong one', () => {
    const s = played();
    const data = dataOf(s);
    const tree = puzzleOf(pictureOf('tree'));
    const board = new Array<unknown>(25).fill(UNKNOWN);
    // Cell 0 is plain rice and cell 1 rice of the picture: one wrong, one right, then junk.
    board[0] = FILLED;
    board[1] = FILLED;
    board[2] = 'rice';
    board[3] = 7;
    const [treeField] = data.fields.filter((f) => f.id === 'tree');
    if (treeField) treeField.board = board;
    const back = restoreState(data).fields.find((f) => f.id === 'tree');
    expect(back?.board[0]).toBe(UNKNOWN);
    expect(back?.board[1]).toBe(truthOf(tree.shape, 1));
    expect(back?.board.slice(2)).toEqual(new Array(23).fill(UNKNOWN));
    // A board too short or not a board at all starts the field again, with what the field shows from the start.
    const cat = puzzleOf(pictureOf('cat'));
    const [catField] = data.fields.filter((f) => f.id === 'cat');
    if (catField) catField.board = 'all rice';
    expect(restoreState(data).fields.find((f) => f.id === 'cat')?.board).toEqual(startBoard(cat));
  });

  it('pebbles the lines a saved board finished', () => {
    const s = createState(T0);
    R.openAlbumField(s, 'heart');
    const data = dataOf(s);
    const [field] = data.fields;
    if (field) field.board = [UNKNOWN, FILLED, UNKNOWN, FILLED, ...new Array<number>(21).fill(UNKNOWN)];
    expect(restoreState(data).fields[0]?.board.slice(0, 5)).toEqual([EMPTY, FILLED, EMPTY, FILLED, EMPTY]);
  });

  it('drops fields it cannot play: unknown pictures, grown ones, finished boards and bad days', () => {
    const s = played();
    const data = dataOf(s);
    const tree = puzzleOf(pictureOf('tree'));
    data.fields = [
      { ...(data.fields[0] ?? fail()), id: 'dragon' },
      { ...(data.fields[0] ?? fail()), id: 'heart' },
      { ...(data.fields[1] ?? fail()), board: tree.shape.filled.map((filled) => (filled ? FILLED : EMPTY)) },
      ...data.fields,
      // A second copy of the cat's field: the later one is kept.
      { ...(data.fields[0] ?? fail()), hearts: 1 },
    ];
    data.daily.field.id = 'yesterday';
    const back = restoreState(data);
    expect(back.fields.map((f) => f.id)).toEqual(['tree', 'cat']);
    expect(back.fields[1]?.hearts).toBe(1);
    expect(back.daily.field).toBeNull();
  });

  it('keeps wrong-move marks only on cells the board knows, and hearts and hints in range', () => {
    const s = played();
    const data = dataOf(s);
    const [cat] = data.fields;
    if (!cat) fail();
    const known = (s.fields[0]?.wrong ?? [])[0] ?? -1;
    cat.wrong = [known, known, 999, -1, 'x', 0.5];
    cat.hearts = 9;
    cat.freeHints = 5;
    const back = restoreState(data).fields[0];
    expect(back?.wrong).toEqual([known]);
    expect(back?.hearts).toBe(C.HEARTS);
    expect(back?.freeHints).toBe(C.FREE_HINTS);
  });

  it('replaces damaged fields with safe values', () => {
    const back = restoreState({
      seeds: 'lots',
      grown: ['heart', 'heart', 'dragon', 7],
      fields: 'none',
      looks: { scene: 'volcano', marker: 'frog', bought: ['frog', 'frog', 'velvet'] },
      daily: { lastDone: 'soon', streak: -2 },
      stats: null,
      result: { mode: 'tournament', perfect: 'yes', album: 'moon', opened: 'farm' },
    });
    expect(back.seeds).toBe(0);
    expect(back.grown).toEqual(['heart']);
    expect(back.fields).toEqual([]);
    expect(back.looks).toEqual({ scene: 'terraces', marker: 'frog', bought: ['frog'] });
    expect(back.daily).toEqual({ field: null, lastDone: null, streak: 0, bestStreak: 0 });
    expect(back.stats).toEqual(createState(0).stats);
    expect(back.result).toMatchObject({ mode: 'album', perfect: false, album: null, opened: 'farm' });
    // A refund can leave the seeds below nothing.
    expect(restoreState({ seeds: -40 }).seeds).toBe(-40);
  });
});

function fail(): never {
  throw new Error('missing');
}
