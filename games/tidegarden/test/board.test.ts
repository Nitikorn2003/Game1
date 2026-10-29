import { Rng } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import {
  BOMB,
  COL,
  PEARL,
  ROW,
  clearCell,
  clearMatches,
  clearRow,
  commonestColour,
  crawlTo,
  fireCombo,
  groups,
  hasMove,
  movesOf,
  newBoard,
  settle,
  shuffle,
  specialOf,
  swapPieces,
  swapWorks,
} from '../src/sim/board.js';
import { parseLayout } from '../src/sim/levels.js';
import { boardOf, never, spawner, textOf } from './helpers.js';

describe('matches', () => {
  it('are lines of three or more of one colour, across or down', () => {
    const b = boardOf(['a a a b', 'c b c d', 'b c b a']);
    expect(groups(b).map((g) => g.cells)).toEqual([[0, 1, 2]]);
    expect(groups(boardOf(['a b', 'a c', 'a b'])).map((g) => g.cells)).toEqual([[0, 2, 4]]);
    expect(groups(boardOf(['a a b a', 'b b a b']))).toEqual([]);
  });

  it('do not reach across a gap, a rock or an empty cell', () => {
    expect(groups(boardOf(['a x a a']))).toEqual([]);
    expect(groups(boardOf(['a # a a']))).toEqual([]);
    expect(groups(boardOf(['a . a a']))).toEqual([]);
  });

  it('make a wave from four in a line, a bomb from an L or a T, and a pearl from five', () => {
    const special = (rows: string[]) => {
      const group = groups(boardOf(rows))[0];
      return group ? specialOf(group) : null;
    };
    expect(special(['a a a b'])).toBeNull();
    expect(special(['a a a a'])).toEqual({ kind: 0, special: ROW });
    expect(special(['b', 'b', 'b', 'b'])).toEqual({ kind: 1, special: COL });
    expect(special(['a b c', 'a c b', 'a a a'])).toEqual({ kind: 0, special: BOMB });
    expect(special(['a a a', 'b a c', 'c a b'])).toEqual({ kind: 0, special: BOMB });
    expect(special(['c c c c c'])).toEqual({ kind: PEARL, special: 0 });
  });

  it('put the special piece where the player moved a piece in, or else in the middle', () => {
    const moved = boardOf(['a a a a b']);
    clearMatches(moved, [3], never);
    expect(textOf(moved)).toEqual(['. . . a- b']);
    const cascade = boardOf(['a a a a b']);
    clearMatches(cascade, [], never);
    expect(textOf(cascade)).toEqual(['. a- . . b']);
    const corner = boardOf(['a b c', 'a c b', 'a a a']);
    clearMatches(corner, [], never);
    expect(textOf(corner)).toEqual(['. b c', '. c b', 'a* . .']);
    const pearl = boardOf(['c c c c c']);
    clearMatches(pearl, [], never);
    expect(textOf(pearl)).toEqual(['. . P . .']);
  });

  it('clear a layer of sand under each piece, hit each rock beside them once, and cut kelp free', () => {
    const b = boardOf(['a a a', '# b #', 'c # c']);
    b.sand[1] = 2;
    b.rock[4 - 1] = 2;
    const cleared = clearMatches(b, [], never);
    expect(cleared?.popped.map((p) => p.cell)).toEqual([0, 1, 2]);
    expect(b.sand[1]).toBe(1);
    // The rock under the first piece takes one hit, the one under the last is broken; the one below them is not beside the match.
    expect([b.rock[3], b.rock[5], b.rock[7]]).toEqual([1, 0, 1]);
    const held = boardOf(['~a a a', 'b c b']);
    const cut = clearMatches(held, [], never);
    expect(cut?.kelp).toEqual([0]);
    expect(textOf(held)).toEqual(['a . .', 'b c b']);
    expect(held.kelp[0]).toBe(0);
  });
});

describe('special pieces', () => {
  it('fire when they are cleared: a wave along its row or its column, a bomb around it', () => {
    const row = boardOf(['b c d e', 'a- a a f', 'c d b c']);
    clearMatches(row, [], never);
    expect(textOf(row)).toEqual(['b c d e', '. . . .', 'c d b c']);
    const col = boardOf(['b c d', 'a a| a', 'e f b']);
    clearMatches(col, [], never);
    expect(textOf(col)).toEqual(['b . d', '. . .', 'e . b']);
    const bomb = boardOf(['b c d e', 'f a* a a', 'c d b c']);
    clearMatches(bomb, [], never);
    expect(textOf(bomb)).toEqual(['. . . e', '. . . .', '. . . c']);
  });

  it('set each other off', () => {
    const b = boardOf(['b c d e', 'a- a a c|', 'f b d f']);
    const cleared = clearMatches(b, [], never);
    expect(textOf(b)).toEqual(['b c d .', '. . . .', 'f b d .']);
    expect(cleared?.blasts.map((blast) => blast.kind)).toEqual(['row', 'col']);
  });

  it('break rocks and cut kelp in their way, but leave turtles be', () => {
    const b = boardOf(['a- a a # ~b T']);
    clearMatches(b, [], never);
    expect(textOf(b)).toEqual(['. . . . b T']);
    expect(b.kelp[4]).toBe(0);
  });

  it('a pearl hit by a blast clears the colour with the most pieces', () => {
    const b = boardOf(['b- b b P', 'c c d c', 'a d c a']);
    expect(commonestColour(b)).toBe(2);
    clearMatches(b, [], never);
    expect(textOf(b)).toEqual(['. . . .', '. . d .', 'a d . a']);
  });
});

describe('swapping two special pieces', () => {
  const combo = (rows: string[], from: number, to: number) => {
    const b = boardOf(rows);
    swapPieces(b, from, to);
    const cleared = fireCombo(b, from, to, never);
    return { b, cleared };
  };

  it('a pearl and a piece clear every piece of its colour', () => {
    const { b } = combo(['P a b', 'a c a', 'b a c'], 0, 1);
    expect(textOf(b)).toEqual(['. . b', '. c .', 'b . c']);
  });

  it('two pearls clear the whole board', () => {
    const { b } = combo(['P P', 'a T'], 0, 1);
    expect(textOf(b)).toEqual(['. .', '. T']);
  });

  it('a pearl and a wave or a bomb turn every piece of that colour into one, and fire them all', () => {
    const { b, cleared } = combo(['P a- b c', 'b c b c', 'c b a c', 'a b c b'], 0, 1);
    // Every coral became a wave and fired: a wave from each of the three corals clears its row or its column.
    expect(cleared?.popped.filter((p) => p.piece.kind === 0)).toHaveLength(3);
    expect(textOf(b)[0]).toEqual('. . . .');
    const bombs = combo(['P a* b c', 'b c b c', 'c b a c', 'a b c b'], 0, 1);
    expect(bombs.cleared?.blasts.filter((blast) => blast.kind === 'bomb')).toHaveLength(3);
  });

  it('two waves clear a cross, a wave and a bomb three rows and three columns, two bombs a wide square', () => {
    const waves = combo(['b c d e', 'c a- b| d', 'd e f b', 'e b c a'], 5, 6);
    expect(textOf(waves.b)).toEqual(['b c . e', '. . . .', 'd e . b', 'e b . a']);
    const board5 = ['a b c d e', 'b c d e a', 'c d a* b- b', 'd e a b c', 'e a b c d'];
    const waveBomb = combo(board5, 13, 12);
    expect(textOf(waveBomb.b)).toEqual(['a . . . e', '. . . . .', '. . . . .', '. . . . .', 'e . . . d']);
    const bombs = combo(['a b c d e', 'b c d e a', 'c d a* b* b', 'd e a b c', 'e a b c d'], 13, 12);
    expect(textOf(bombs.b).join('/').replace(/[^.]/g, '')).toHaveLength(25);
  });

  it('are no combo when only one of the two is special', () => {
    const b = boardOf(['a- b']);
    swapPieces(b, 0, 1);
    expect(fireCombo(b, 0, 1, never)).toBeNull();
  });
});

describe('tools', () => {
  it('the claw clears one cell, and sets off what it clears', () => {
    const b = boardOf(['a b c', 'b a- b', 'c b a']);
    clearCell(b, 4, never);
    expect(textOf(b)).toEqual(['a b c', '. . .', 'c b a']);
    const rock = boardOf(['#']);
    rock.rock[0] = 2;
    clearCell(rock, 0, never);
    expect(rock.rock[0]).toBe(1);
  });

  it('the tide clears a row', () => {
    const b = boardOf(['a b c', 'b a b', 'c b a']);
    clearRow(b, 2, never);
    expect(textOf(b)).toEqual(['a b c', 'b a b', '. . .']);
  });
});

describe('falling', () => {
  it('drops pieces into the gaps and brings new ones in at the top', () => {
    const b = boardOf(['a', '.', 'b', '.']);
    expect(settle(b, spawner([2]))).toBe(true);
    expect(textOf(b)).toEqual(['c', 'c', 'a', 'b']);
  });

  it('lets pieces fall straight through gaps in the board', () => {
    const b = boardOf(['a', 'x', '.']);
    settle(b, spawner([2]));
    expect(textOf(b)).toEqual(['c', 'x', 'a']);
  });

  it('stops at rocks and kelp, and lets a piece slide down beside them into a cell nothing falls into', () => {
    const b = boardOf(['a b', '# .', '. .']);
    settle(b, spawner([2]));
    expect(textOf(b)).toEqual(['a c', '# c', 'c b']);
    const held = boardOf(['a', '~b', '.']);
    expect(settle(held, spawner([2]))).toBe(false);
    expect(textOf(held)).toEqual(['a', 'b', '.']);
  });

  it('does nothing to a full board', () => {
    const b = boardOf(['a b', 'b a']);
    expect(settle(b, spawner([2]))).toBe(false);
  });
});

describe('moves', () => {
  it('are swaps of neighbours that make a match, or fire special pieces together', () => {
    const b = boardOf(['a b a', 'b a b']);
    expect(swapWorks(b, 1, 4)).toBe(true);
    expect(swapWorks(b, 0, 1)).toBe(false);
    expect(swapWorks(b, 0, 2)).toBe(false);
    expect(swapWorks(boardOf(['P b', 'c d']), 0, 1)).toBe(true);
    expect(swapWorks(boardOf(['a- b|', 'c d']), 0, 1)).toBe(true);
    expect(swapWorks(boardOf(['a* c', 'b d']), 0, 1)).toBe(false);
    expect(swapWorks(boardOf(['P T', 'c d']), 0, 1)).toBe(false);
  });

  it('never move a piece held by kelp', () => {
    expect(swapWorks(boardOf(['~b a a', 'a c c']), 0, 3)).toBe(false);
    expect(movesOf(boardOf(['~b a a', 'a c c']))).toEqual([]);
  });

  it('let a baby turtle crawl down a cell, match or not, and past a gap below it', () => {
    const b = boardOf(['a T b', 'c d e']);
    expect(swapWorks(b, 1, 4)).toBe(true);
    expect(swapWorks(b, 4, 1)).toBe(true);
    expect(swapWorks(b, 1, 0)).toBe(false);
    expect(movesOf(b)).toEqual([{ from: 1, to: 4 }]);
    const gap = boardOf(['a T b', 'c x e', 'd f a']);
    expect(crawlTo(gap, 1)).toBe(7);
    expect(swapWorks(gap, 1, 7)).toBe(true);
    expect(movesOf(gap)).toEqual([{ from: 1, to: 7 }]);
  });

  it('never let a turtle crawl onto kelp or another turtle, or off the board', () => {
    expect(swapWorks(boardOf(['a T b', 'c ~d e']), 1, 4)).toBe(false);
    expect(swapWorks(boardOf(['a T b', 'c T e']), 1, 4)).toBe(false);
    expect(crawlTo(boardOf(['a T b']), 1)).toBeNull();
  });

  it('lists each working swap once', () => {
    const b = boardOf(['a b a', 'b a b', 'a b a']);
    expect(movesOf(b)).toEqual([
      { from: 1, to: 4 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 4, to: 7 },
    ]);
  });
});

describe('new boards', () => {
  it('start without a match but with a move, and the same from the same seed', () => {
    const layout = parseLayout(['-.......-', '..r...r..', '.........', '...k.....', '.........', '..s..S...', '.........']);
    for (let seed = 1; seed <= 30; seed++) {
      const rng = new Rng(seed);
      const b = newBoard(layout, 5, () => rng.next());
      expect(groups(b)).toEqual([]);
      expect(hasMove(b)).toBe(true);
      expect(b.pieces[0]).toBeNull();
      expect(b.pieces[11]).toBeNull();
      expect(b.pieces[30]).not.toBeNull();
      const again = new Rng(seed);
      expect(newBoard(layout, 5, () => again.next()).pieces).toEqual(b.pieces);
    }
  });

  it('are shuffled when no swap works, keeping special pieces and kelp where they are', () => {
    const b = boardOf(['a b c d', 'c d a b', 'a b c d', 'c d a- ~b']);
    expect(hasMove(b)).toBe(false);
    const rng = new Rng(7);
    expect(shuffle(b, 4, () => rng.next())).toBe(true);
    expect(groups(b)).toEqual([]);
    expect(hasMove(b)).toBe(true);
    expect(textOf(b)[3]?.split(' ').slice(2)).toEqual(['a-', 'b']);
  });
});
