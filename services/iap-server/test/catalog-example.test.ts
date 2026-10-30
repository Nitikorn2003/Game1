import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Catalog } from '../src/catalog.js';

describe('the example catalog', () => {
  it('passes the checks the server makes at start-up, with every game the repository has', () => {
    const data = JSON.parse(readFileSync(new URL('../config/catalog.example.json', import.meta.url), 'utf8')) as { games: { gameId: string }[] };
    expect(() => Catalog.parse(data)).not.toThrow();
    // tools/new-game.ts adds each new game here; the games' own tests compare their products.
    expect(data.games.map((game) => game.gameId)).toEqual(expect.arrayContaining(['lodelings', 'starter', 'quiltnook', 'skyjars', 'lotuscanal', 'ricefield', 'tidegarden', 'bloomhive', 'crumblane']));
  });
});
