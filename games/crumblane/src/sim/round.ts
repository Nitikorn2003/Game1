/**
 * One try at a level, a round: the pastry each tile of the counter holds, where each tile is
 * (on the counter, on the tray, up on the cooling rack, or boxed up and gone), and how the try
 * is going. A take or a tool plays out at once; the screens animate what it did.
 *
 * Every deal can be cleared: the pastries are handed out along a way through the counter on
 * which the tray never holds more than two unfinished sets, so a player who finds it keeps
 * the tray at four pastries or fewer, which is three stars.
 */
import { Rng, hashString } from '@game1/engine';
import { coverOf, pastriesFor, type Slot } from './counter.js';

/** Everything a level is: where its tiles sit, how many kinds of pastry, and what is special about its tiles. */
export interface Level {
  slots: readonly Slot[];
  /** How many kinds of pastry its tiles hold: more kinds, fewer matches in sight. */
  kinds: number;
  /** Tiles in paper bags, which hide their pastry while anything covers them. */
  bags: readonly boolean[];
  /** Ribbon boxes: how many sets must be boxed up before each opens; 0 for a tile in no box. */
  locks: readonly number[];
  /** Sprinkled pastries, which pay a little sugar each when boxed up. */
  sprinkles: readonly boolean[];
  /**
   * How often the deal's way through starts a new set while one is still unfinished, from 0
   * to 1: the more often, the more the kinds in sight are mixed up.
   */
  mix: number;
  /**
   * How often the deal's way through goes on under the tile it just took, from 0 to 1: the
   * more often, the more of a set is buried under the rest of it.
   */
  dig: number;
}

export type Place = 'counter' | 'tray' | 'rack' | 'gone';

/** A pastry on the tray, and where it came from, which is where the spatula puts it back. */
export interface Taken {
  tile: number;
  from: 'counter' | 'rack';
}

export interface Round {
  /** The pastry of each tile, by its slot in the level. */
  kinds: number[];
  at: Place[];
  /** The tiles on the tray, left to right: each pastry next to the others of its kind. */
  tray: number[];
  /** The tiles on the cooling rack, which can go back onto the tray at any time. */
  rack: number[];
  /** The tiles on the tray in the order they came, oldest first. */
  taken: Taken[];
  /** The most pastries the tray held after a take: the fewer, the more stars. */
  peak: number;
  /** Sets of three boxed up. */
  sets: number;
  /** Sprinkled pastries boxed up. */
  sprinkled: number;
  /** Times room was made on a full tray. */
  continues: number;
  /** Times the rolling pin was used, which gives each new roll its own seed. */
  rolls: number;
  seed: number;
}

/** Places on the tray: a full tray ends the round, unless room is made. */
export const TRAY = 7;
/** Places on the cooling rack. */
export const RACK = 7;
/** Pastries that go up to the rack when room is made. */
export const MORE_ROOM = 3;
/** The most unfinished sets the deal's way through has at once. */
export const PLAN_OPEN = 2;
/** The most pastries on the tray for each number of stars: four for three stars, five for two. */
export const STAR_PEAKS = [4, 5] as const;

/** For each slot of a layout, the slots it covers. */
const underCache = new WeakMap<readonly Slot[], readonly (readonly number[])[]>();
export function underOf(slots: readonly Slot[]): readonly (readonly number[])[] {
  const known = underCache.get(slots);
  if (known) return known;
  const cover = coverOf(slots);
  const under: number[][] = slots.map(() => []);
  cover.forEach((above, i) => {
    for (const j of above) under[j]?.push(i);
  });
  underCache.set(slots, under);
  return under;
}

/** Tiles still to box up, wherever they are. */
export function tilesLeft(r: Round): number {
  return r.at.filter((p) => p !== 'gone').length;
}

/** Tiles on the counter that nothing on the counter covers. */
export function uncovered(r: Round, level: Level): boolean[] {
  const cover = coverOf(level.slots);
  return r.at.map((p, i) => p === 'counter' && (cover[i] ?? []).every((j) => r.at[j] !== 'counter'));
}

/** A ribbon box that has not opened: fewer sets boxed up than it waits for. */
export function shut(r: Round, level: Level, tile: number): boolean {
  return (level.locks[tile] ?? 0) > r.sets;
}

/**
 * Tiles on the counter that can be taken: nothing covers them and they are in no shut box.
 * When every tile that nothing covers is in a shut box, those boxes open, so a counter never
 * runs out of things to take.
 */
export function takeable(r: Round, level: Level): boolean[] {
  const free = uncovered(r, level);
  const any = free.some((f, i) => f && !shut(r, level, i));
  return free.map((f, i) => f && (!any || !shut(r, level, i)));
}

/** A bag hides its pastry while anything on the counter covers it. */
export function hidden(r: Round, level: Level, tile: number, free: readonly boolean[]): boolean {
  return (level.bags[tile] ?? false) && r.at[tile] === 'counter' && !(free[tile] ?? false);
}

export function isWon(r: Round): boolean {
  return r.at.every((p) => p === 'gone');
}

/** A full tray: nothing more can go on it until room is made or a tool frees a place. */
export function isStuck(r: Round): boolean {
  return r.tray.length >= TRAY;
}

export function starsFor(r: Round): 1 | 2 | 3 {
  if (r.peak <= STAR_PEAKS[0]) return 3;
  return r.peak <= STAR_PEAKS[1] ? 2 : 1;
}

export function copyRound(r: Round): Round {
  return {
    ...r,
    kinds: [...r.kinds],
    at: [...r.at],
    tray: [...r.tray],
    rack: [...r.rack],
    taken: r.taken.map((t) => ({ ...t })),
  };
}

// ---------------------------------------------------------------------------------------
// Dealing

interface OpenSet {
  kind: number;
  count: number;
}

/** The pastry of each tile dealt, and the way through the counter they were dealt along. */
export interface Deal {
  kinds: Map<number, number>;
  order: number[];
}

/**
 * Deals pastries to the tiles on the counter and the rack: picks a way through them, one tile
 * that could be taken at a time, and hands out the pastries along it so that the sets left
 * unfinished on the tray (`open`, to begin with) are finished before others are started,
 * with at most `PLAN_OPEN` unfinished at once. `deck` is how many tiles of each pastry there
 * are to hand out, besides those that finish the open sets.
 */
function planDeal(level: Level, at: readonly Place[], deck: Map<number, number>, open: OpenSet[], setsDone: number, rng: Rng, mix: number, dig: number): Deal {
  const sim: Place[] = [...at];
  const cover = coverOf(level.slots);
  const under = underOf(level.slots);
  const kinds = new Map<number, number>();
  const order: number[] = [];
  let sets = setsDone;
  let left = sim.filter((p) => p === 'counter' || p === 'rack').length;
  let last = -1;
  while (left > 0) {
    // The tiles that could be taken next: anything on the rack, and on the counter anything
    // nothing covers that is in no shut box, or the shut boxes when nothing else is free.
    const isFree = (i: number) => sim[i] === 'counter' && (cover[i] ?? []).every((j) => sim[j] !== 'counter');
    const free = sim.flatMap((_, i) => (isFree(i) ? [i] : []));
    const unboxed = free.filter((i) => (level.locks[i] ?? 0) <= sets);
    const rack = sim.flatMap((p, i) => (p === 'rack' ? [i] : []));
    const choices = [...rack, ...(unboxed.length > 0 ? unboxed : free)];
    // Sometimes it goes on with a tile the last one uncovered.
    const below = last >= 0 ? (under[last] ?? []).filter((i) => choices.includes(i)) : [];
    const tile = below.length > 0 && rng.chance(dig) ? rng.pick(below) : rng.pick(choices);
    last = tile;
    const need = open.reduce((n, set) => n + 3 - set.count, 0);
    const fresh = [...deck].filter(([kind, n]) => n >= 3 && !open.some((set) => set.kind === kind));
    const canOpen = open.length < PLAN_OPEN && fresh.length > 0 && left - need >= 3;
    let kind: number;
    if (open.length === 0 || (canOpen && rng.chance(mix))) {
      kind = rng.weighted(fresh);
      deck.set(kind, (deck.get(kind) ?? 0) - 3);
      open.push({ kind, count: 1 });
    } else {
      // Near a full tray, the fullest set is finished first.
      const onTray = open.reduce((n, set) => n + set.count, 0);
      const set = onTray >= TRAY - 2 ? open.reduce((a, b) => (b.count > a.count ? b : a)) : rng.pick(open);
      kind = set.kind;
      set.count += 1;
      if (set.count === 3) {
        open.splice(open.indexOf(set), 1);
        sets += 1;
      }
    }
    kinds.set(tile, kind);
    order.push(tile);
    sim[tile] = 'gone';
    left -= 1;
  }
  return { kinds, order };
}

/** Sets of three for `tiles` tiles, shared out over the pastries as evenly as can be. */
function deckFor(pastries: readonly number[], tiles: number): Map<number, number> {
  const sets = Math.floor(tiles / 3);
  return new Map(pastries.map((kind, i) => [kind, 3 * (Math.floor(sets / pastries.length) + (i < sets % pastries.length ? 1 : 0))]));
}

/** The deal of a new round, and the way through it that the deal was made along. */
export function dealOf(level: Level, seed: number): Deal {
  if (level.slots.length % 3 !== 0) throw new Error(`A counter of ${String(level.slots.length)} tiles cannot be boxed up in threes`);
  const rng = new Rng(seed);
  const pastries = pastriesFor(Math.min(level.kinds, level.slots.length / 3), rng);
  const at = level.slots.map((): Place => 'counter');
  return planDeal(level, at, deckFor(pastries, level.slots.length), [], 0, rng, level.mix, level.dig);
}

export function startRound(level: Level, seed: number): Round {
  const deal = dealOf(level, seed);
  return {
    kinds: level.slots.map((_, i) => deal.kinds.get(i) ?? 0),
    at: level.slots.map((): Place => 'counter'),
    tray: [],
    rack: [],
    taken: [],
    peak: 0,
    sets: 0,
    sprinkled: 0,
    continues: 0,
    rolls: 0,
    seed,
  };
}

// ---------------------------------------------------------------------------------------
// Taking

/** Where a pastry goes on the tray: just after the last of its kind, or at the end. */
function placeOnTray(r: Round, tile: number): number {
  const kind = r.kinds[tile];
  let slot = r.tray.length;
  for (let i = r.tray.length - 1; i >= 0; i--)
    if (r.kinds[r.tray[i] ?? -1] === kind) {
      slot = i + 1;
      break;
    }
  r.tray.splice(slot, 0, tile);
  return slot;
}

/** Boxes up three of a kind on the tray, if there are three. */
function boxUp(r: Round, level: Level, kind: number): number[] | null {
  const same = r.tray.filter((t) => r.kinds[t] === kind);
  if (same.length < 3) return null;
  const set = same.slice(0, 3);
  r.tray = r.tray.filter((t) => !set.includes(t));
  for (const t of set) r.at[t] = 'gone';
  r.sets += 1;
  r.sprinkled += set.filter((t) => level.sprinkles[t]).length;
  return set;
}

/** Forgets where tiles came from once they are off the tray. */
function prune(r: Round): void {
  r.taken = r.taken.filter((t) => r.at[t.tile] === 'tray');
}

/** The ribbon boxes that open once `after` sets are boxed up, having been shut at `before`. */
function openedBetween(level: Level, before: number, after: number): number[] {
  return level.locks.flatMap((lock, i) => (lock > before && lock <= after ? [i] : []));
}

/** What a take did, for the screens. */
export interface Take {
  tile: number;
  from: 'counter' | 'rack';
  /** Where on the tray the pastry went, before any set was boxed up. */
  slot: number;
  /** The set of three it finished, which was boxed up; null when it finished none. */
  set: readonly number[] | null;
  /** Sprinkled pastries in that set. */
  sprinkled: number;
  /** Ribbon boxes that opened. */
  opened: readonly number[];
  won: boolean;
  stuck: boolean;
}

/** Takes a tile from the counter, or back from the rack, onto the tray. Null when it cannot be taken. */
export function take(r: Round, level: Level, tile: number): Take | null {
  if (isStuck(r)) return null;
  const place = r.at[tile];
  let from: Taken['from'];
  if (place === 'counter') {
    if (!takeable(r, level)[tile]) return null;
    from = 'counter';
  } else if (place === 'rack') {
    r.rack = r.rack.filter((t) => t !== tile);
    from = 'rack';
  } else return null;
  const before = r.sets;
  r.at[tile] = 'tray';
  const slot = placeOnTray(r, tile);
  r.taken.push({ tile, from });
  const set = boxUp(r, level, r.kinds[tile] ?? -1);
  r.peak = Math.max(r.peak, r.tray.length);
  prune(r);
  return {
    tile,
    from,
    slot,
    set,
    sprinkled: set ? set.filter((t) => level.sprinkles[t]).length : 0,
    opened: openedBetween(level, before, r.sets),
    won: isWon(r),
    stuck: isStuck(r),
  };
}

// ---------------------------------------------------------------------------------------
// Tools, and making room

/** What the spatula did: the pastry it put back, and where it had been on the tray. */
export interface Undo {
  tile: number;
  to: Taken['from'];
  slot: number;
}

/** Puts the newest pastry on the tray back where it came from. */
export function spatula(r: Round): Undo | null {
  const last = r.taken.at(-1);
  if (!last) return null;
  const slot = r.tray.indexOf(last.tile);
  if (slot < 0) return null;
  r.tray.splice(slot, 1);
  r.taken.pop();
  if (last.from === 'rack') {
    r.at[last.tile] = 'rack';
    r.rack.push(last.tile);
  } else r.at[last.tile] = 'counter';
  return { tile: last.tile, to: last.from, slot };
}

/** The pastry the whisk whips up when the tray is empty: the one with the most tiles left. */
function commonest(r: Round): number {
  const count = new Map<number, number>();
  r.at.forEach((p, i) => {
    if (p === 'counter' || p === 'rack') count.set(r.kinds[i] ?? 0, (count.get(r.kinds[i] ?? 0) ?? 0) + 1);
  });
  let best = -1;
  let most = 0;
  for (const [kind, n] of count) if (n > most || (n === most && kind < best)) [best, most] = [kind, n];
  return best;
}

/** What the whisk did: the set it boxed up, the tiles already on the tray first, and where each came from. */
export interface Whisk {
  kind: number;
  set: readonly number[];
  from: readonly Place[];
  sprinkled: number;
  opened: readonly number[];
  won: boolean;
}

/**
 * Whips up a set of three: of the first pastry on the tray, or with an empty tray of the
 * pastry with the most tiles left. What the tray lacks comes from the rack first, then from
 * the counter, tiles that could be taken before covered ones and higher ones before lower.
 */
export function whisk(r: Round, level: Level): Whisk | null {
  if (isWon(r)) return null;
  const kind = r.tray.length > 0 ? (r.kinds[r.tray[0] ?? -1] ?? -1) : commonest(r);
  const onTray = r.tray.filter((t) => r.kinds[t] === kind);
  const can = takeable(r, level);
  const slot = (i: number): Slot => level.slots[i] ?? { x: 0, y: 0, z: 0 };
  const counter = r.at
    .flatMap((p, i) => (p === 'counter' && r.kinds[i] === kind ? [i] : []))
    .sort((a, b) => Number(can[b]) - Number(can[a]) || slot(b).z - slot(a).z || slot(a).y - slot(b).y || slot(a).x - slot(b).x);
  const pulled = [...r.rack.filter((t) => r.kinds[t] === kind), ...counter].slice(0, 3 - onTray.length);
  if (onTray.length + pulled.length < 3) return null;
  const from: Place[] = [...onTray.map((): Place => 'tray'), ...pulled.map((t) => r.at[t] ?? 'counter')];
  const before = r.sets;
  const set = [...onTray, ...pulled];
  r.tray = r.tray.filter((t) => !onTray.includes(t));
  r.rack = r.rack.filter((t) => !pulled.includes(t));
  for (const t of set) r.at[t] = 'gone';
  r.sets += 1;
  const sprinkled = set.filter((t) => level.sprinkles[t]).length;
  r.sprinkled += sprinkled;
  prune(r);
  return { kind, set, from, sprinkled, opened: openedBetween(level, before, r.sets), won: isWon(r) };
}

/**
 * Rolls the pastries on the counter and the rack into new places: dealt again, the sets
 * unfinished on the tray first, along a new way through the tiles, which it returns. Nothing
 * is added or taken away. Not on a full tray, where it would change nothing.
 */
export function rollingPin(r: Round, level: Level): Deal | null {
  if (isStuck(r) || isWon(r)) return null;
  const tiles = r.at.flatMap((p, i) => (p === 'counter' || p === 'rack' ? [i] : []));
  if (tiles.length === 0) return null;
  const open: OpenSet[] = [];
  for (const t of r.tray) {
    const kind = r.kinds[t] ?? 0;
    const set = open.find((s) => s.kind === kind);
    if (set) set.count += 1;
    else open.push({ kind, count: 1 });
  }
  const deck = new Map<number, number>();
  for (const t of tiles) deck.set(r.kinds[t] ?? 0, (deck.get(r.kinds[t] ?? 0) ?? 0) + 1);
  for (const set of open) deck.set(set.kind, (deck.get(set.kind) ?? 0) - (3 - set.count));
  r.rolls += 1;
  const rng = new Rng(hashString(`${String(r.seed)}:roll:${String(r.rolls)}`));
  const deal = planDeal(level, r.at, deck, open, r.sets, rng, 0, 0);
  for (const [tile, kind] of deal.kinds) r.kinds[tile] = kind;
  return deal;
}

export function canMakeRoom(r: Round): boolean {
  return isStuck(r) && r.rack.length + MORE_ROOM <= RACK;
}

/** Makes room on a full tray: three pastries go up to the cooling rack, ones without a pair first, the newest first. */
export function makeRoom(r: Round): number[] | null {
  if (!canMakeRoom(r)) return null;
  const count = (t: number) => r.tray.filter((u) => r.kinds[u] === r.kinds[t]).length;
  const newest = r.taken.map((t) => t.tile).reverse();
  const moved = newest.sort((a, b) => count(a) - count(b)).slice(0, MORE_ROOM);
  r.tray = r.tray.filter((t) => !moved.includes(t));
  for (const t of moved) {
    r.at[t] = 'rack';
    r.rack.push(t);
  }
  r.continues += 1;
  prune(r);
  return moved;
}
