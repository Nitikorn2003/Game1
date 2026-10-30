import { describe, expect, it } from 'vitest';
import { fits, RANKS, WILD } from '../src/sim/cards.js';
import { apply, canExtra, isFree, playable, replay, revealedBy, startTable, stuck, topCard, won, type Move } from '../src/sim/table.js';
import { dealtOf } from './helpers.js';

/*
 * Two peaks, by spot:          0               1
 *                          2       3       4       5
 *                        6     7     8   9    10    11
 *                     12  13  14  15  16  17  18  19
 */
const RUN = dealtOf('peaks2', [9, 9, 10, 10, 11, 11, 6, 7, 8, 6, 7, 8, 1, 2, 3, 4, 5, 3, 2, 1], [0, 12, 0], [4, 4, 5, 5, 9, 12, 12, 1, 2, 3]);
/** Nothing face up fits the ace the pile starts with, and the stock is empty. */
const STUCK = dealtOf('peaks2', [9, 9, 10, 10, 11, 11, 6, 7, 8, 5, 6, 7, 3, 4, 5, 6, 7, 8, 3, 4], [0], [1, 2, 3, 4, 5, 2]);

const plays = (...spots: number[]): Move[] => spots.map((spot) => ({ kind: 'play', spot }));

describe('the cards', () => {
  it('go onto a card one rank above or below, and kings and aces are next to each other', () => {
    const card = (rank: number, suit = 0) => suit * RANKS + rank;
    expect(fits(card(1), card(0))).toBe(true);
    expect(fits(card(0, 2), card(1, 3))).toBe(true);
    expect(fits(card(12), card(0, 1))).toBe(true);
    expect(fits(card(0), card(12, 1))).toBe(true);
    expect(fits(card(2), card(0))).toBe(false);
    expect(fits(card(5, 1), card(5))).toBe(false);
    expect(fits(card(7), WILD)).toBe(true);
  });
});

describe('a deal on the table', () => {
  it('starts the pile with the first stock card, with only the bottom line face up', () => {
    const t = startTable(RUN);
    expect(topCard(t)).toBe(RUN.stock[0]);
    expect(t.stock).toEqual(RUN.stock.slice(1));
    expect(RUN.cards.map((_, spot) => isFree(t, spot))).toEqual(RUN.cards.map((_, spot) => spot >= 12));
    // A 2 and the other 2 of the bottom line fit the ace.
    expect(playable(t)).toEqual([12, 19]);
  });

  it('turns a card face up once both cards lying on it are played', () => {
    const t = startTable(RUN);
    expect(revealedBy(t, 12)).toEqual([]);
    expect(apply(t, { kind: 'play', spot: 12 })).toBe(true);
    expect(isFree(t, 6)).toBe(false);
    expect(revealedBy(t, 13)).toEqual([6]);
    expect(apply(t, { kind: 'play', spot: 13 })).toBe(true);
    expect(isFree(t, 6)).toBe(true);
    // A played card cannot be played again, and a covered one not at all.
    expect(apply(t, { kind: 'play', spot: 13 })).toBe(false);
    expect(apply(t, { kind: 'play', spot: 0 })).toBe(false);
  });

  it('pays a coin a card and five more on every fifth card in a row; a draw ends the run', () => {
    const { table: t, made } = replay(RUN, plays(12, 13, 14, 15, 16, 6, 7, 8));
    expect(made).toBe(8);
    expect(t.streak).toBe(8);
    expect(t.pot).toBe(8 + 5);
    expect(apply(t, { kind: 'draw' })).toBe(true);
    expect(t.streak).toBe(0);
    expect(t.bestStreak).toBe(8);
    expect(t.pot).toBe(13);
    expect(topCard(t)).toBe(RUN.stock[1]);
  });

  it('lets any face-up card go onto the lotus wild, but not a wild onto a wild', () => {
    const t = startTable(RUN);
    expect(canPlayAll(t)).toBe(false);
    expect(apply(t, { kind: 'wild' })).toBe(true);
    expect(topCard(t)).toBe(WILD);
    expect(apply(t, { kind: 'wild' })).toBe(false);
    expect(playable(t)).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
    // A wild keeps the run going.
    apply(t, { kind: 'play', spot: 12 });
    apply(t, { kind: 'wild' });
    apply(t, { kind: 'play', spot: 17 });
    expect(t.streak).toBe(2);
  });

  it('is stuck when nothing fits and the stock is empty, until More cards fills the stock', () => {
    const t = startTable(STUCK);
    expect(stuck(t)).toBe(true);
    expect(canExtra(t)).toBe(true);
    expect(apply(t, { kind: 'extra' })).toBe(true);
    expect(t.stock).toEqual(STUCK.reserve.slice(0, 5));
    expect(stuck(t)).toBe(false);
    // Not while the stock has cards.
    expect(apply(t, { kind: 'extra' })).toBe(false);
    for (let i = 0; i < 5; i++) apply(t, { kind: 'draw' });
    expect(apply(t, { kind: 'extra' })).toBe(true);
    expect(t.stock).toEqual(STUCK.reserve.slice(5));
    for (let i = 0; i < 1; i++) apply(t, { kind: 'draw' });
    expect(canExtra(t)).toBe(false);
  });

  it('is cleared when the last layout card is played, and replays only the moves that can be made', () => {
    const t = startTable(RUN);
    t.cleared = t.cleared.map(() => true);
    t.played = RUN.cards.length;
    expect(won(t)).toBe(true);
    expect(stuck(t)).toBe(false);
    const { table, made } = replay(RUN, [...plays(12, 13), { kind: 'play', spot: 0 }, ...plays(14)]);
    expect(made).toBe(2);
    expect(table.played).toBe(2);
  });
});

function canPlayAll(t: ReturnType<typeof startTable>): boolean {
  return playable(t).length === t.dealt.cards.filter((_, spot) => isFree(t, spot)).length;
}
