import { describe, expect, it } from 'vitest';
import { SEED_PACKS, catalogItem } from '../src/catalog.js';
import * as C from '../src/sim/content.js';
import { cellCount, puzzleOf } from '../src/sim/fields.js';
import { ALBUMS } from '../src/sim/pictures.js';

/** What an album pays when every picture in it grows perfect, with the album bonus. */
function albumPay(index: number, perfect: boolean): number {
  const album = ALBUMS[index];
  if (!album) return 0;
  const fields = album.pictures.reduce((sum, picture) => {
    const seeds = C.fieldSeeds(cellCount(puzzleOf(picture)));
    return sum + seeds + (perfect ? C.perfectBonus(seeds) : 0);
  }, 0);
  return fields + C.ALBUM_SEEDS;
}

const averageField = (index: number) => (albumPay(index, false) - C.ALBUM_SEEDS) / (ALBUMS[index]?.pictures.length ?? 1);

describe('the seeds', () => {
  it('pay more for the bigger fields of later albums', () => {
    const averages = ALBUMS.map((_, i) => averageField(i));
    expect(averages.toSorted((a, b) => a - b)).toEqual(averages);
  });

  it('make a hint cost about what one field of the middle albums pays, and hearts more', () => {
    expect(C.TOOL_COSTS.hint).toBeGreaterThan(averageField(1));
    expect(C.TOOL_COSTS.hint).toBeLessThan(averageField(5));
    expect(C.TOOL_COSTS.hearts).toBeGreaterThan(C.TOOL_COSTS.hint);
    // A free hint every field, and the free seeds of one ad buy two more.
    expect(C.FREE_SEEDS).toBe(2 * C.TOOL_COSTS.hint);
  });

  it('buy the first look after the first two albums, and every look by playing on', () => {
    const cheapest = Math.min(...Object.values(C.LOOK_COSTS).filter((cost) => cost > 0));
    expect(albumPay(0, true) + albumPay(1, true)).toBeGreaterThanOrEqual(cheapest);
    const everything = Object.values(C.LOOK_COSTS).reduce((sum, cost) => sum + cost, 0);
    const albums = ALBUMS.reduce((sum, _, i) => sum + albumPay(i, true), 0);
    // The albums pay for most of it; a few weeks of daily fields for the rest.
    expect(albums).toBeGreaterThan(everything / 2);
    const daily = C.DAILY_SEEDS + C.perfectBonus(C.DAILY_SEEDS);
    expect((everything - albums) / daily).toBeLessThan(60);
  });

  it('sells seed packs that are worth more the bigger they are', () => {
    const seeds = SEED_PACKS.map((id) => catalogItem(id)?.grants?.seeds ?? 0);
    expect(seeds).toEqual([500, 3000, 7000]);
    expect(seeds[0] ?? 0).toBeGreaterThanOrEqual(20 * C.TOOL_COSTS.hint);
  });
});
