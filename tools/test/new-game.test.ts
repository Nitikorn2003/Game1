import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { TEMPLATE, filesOf, identityProblem, isText, rename, scaffold, type Identity } from '../new-game.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const template = join(ROOT, TEMPLATE.dir);
const catalogFile = join(ROOT, 'services/iap-server/config/catalog.example.json');

interface Catalog {
  games: { gameId: string; packageName: string; products: unknown[] }[];
}

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A games folder and a copy of the server's example catalog, outside the repository. */
function sandbox(): { games: string; catalog: string } {
  const dir = mkdtempSync(join(tmpdir(), 'new-game-'));
  temps.push(dir);
  const catalog = join(dir, 'catalog.json');
  copyFileSync(catalogFile, catalog);
  return { games: join(dir, 'games'), catalog };
}

describe('starting a new game from the template', () => {
  it('copies the whole template under the new names and leaves none of the old ones', () => {
    const where = sandbox();
    const made = scaffold({ id: 'quiltnook', name: 'Quilt Nook', ...where });
    expect(made.files).toHaveLength(filesOf(template).length);
    for (const file of made.files) {
      expect(file).not.toMatch(/starter/i);
      const bytes = readFileSync(join(made.dir, file));
      if (isText(bytes)) expect(bytes.toString('utf8'), file).not.toMatch(/starter/i);
    }
    const read = (file: string) => readFileSync(join(made.dir, file), 'utf8');
    expect(JSON.parse(read('package.json'))).toMatchObject({ name: '@game1/quiltnook', description: 'Quilt Nook, a Game1 game.', config: { e2ePort: 4180 } });
    expect(read('capacitor.config.ts')).toContain("appId: 'com.game1.quiltnook',\n  appName: 'Quilt Nook',");
    expect(read('android/app/src/main/java/com/game1/quiltnook/MainActivity.java')).toMatch(/^package com\.game1\.quiltnook;/);
    expect(read('android/app/src/main/res/values/strings.xml')).toContain('<string name="app_name">Quilt Nook</string>');
    expect(read('src/sim/state.ts')).toContain("game: 'quiltnook',");
    expect(read('src/catalog.ts')).toContain("gameId: 'quiltnook', catalog: CATALOG, storagePrefix: 'quiltnook:'");
    expect(read('ANDROID.md')).toContain('npm run android:apk -w games/quiltnook');
  });

  it('copies images unchanged and keeps the Gradle wrapper runnable', () => {
    const made = scaffold({ id: 'quiltnook', name: 'Quilt Nook', ...sandbox() });
    const icon = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png';
    expect(readFileSync(join(made.dir, icon)).equals(readFileSync(join(template, icon)))).toBe(true);
    expect(statSync(join(made.dir, 'android/gradlew')).mode & 0o111).not.toBe(0);
  });

  it('gives each game its own play test port and its products in the server catalog', () => {
    const where = sandbox();
    expect(scaffold({ id: 'quiltnook', name: 'Quilt Nook', ...where }).port).toBe(4180);
    expect(scaffold({ id: 'gametwo', name: 'Game Two', ...where }).port).toBe(4181);
    const catalog = JSON.parse(readFileSync(where.catalog, 'utf8')) as Catalog;
    const starter = catalog.games.find((g) => g.gameId === TEMPLATE.id);
    const quilt = catalog.games.find((g) => g.gameId === 'quiltnook');
    expect(quilt).toEqual({ gameId: 'quiltnook', packageName: 'com.example.quiltnook', products: starter?.products });
    expect(catalog.games.filter((g) => g.gameId === 'gametwo')).toHaveLength(1);
  });

  it('refuses names that would break a file, and never overwrites a game', () => {
    const bad: Identity[] = [
      { id: 'Quilt', name: 'Quilt' },
      { id: '9lives', name: 'Nine Lives' },
      { id: 'quilt_nook', name: 'Quilt Nook' },
      { id: 'q', name: 'Q' },
      { id: 'quiltnook', name: "Quilt's Nook" },
      { id: 'quiltnook', name: 'Quilt <Nook>' },
      { id: 'quiltnook', name: ' Quilt' },
      { id: 'starterkit', name: 'Kit' },
      { id: 'kit', name: 'Starter Kit' },
    ];
    for (const game of bad) expect(identityProblem(game), JSON.stringify(game)).not.toBeNull();
    expect(identityProblem({ id: 'quiltnook', name: 'Quilt Nook' })).toBeNull();
    const where = sandbox();
    scaffold({ id: 'quiltnook', name: 'Quilt Nook', ...where });
    expect(() => scaffold({ id: 'quiltnook', name: 'Quilt Nook', ...where })).toThrow(/already exists/);
  });

  it('never copies build output, installed packages or secrets', () => {
    const files = filesOf(template);
    expect(files).toContain('.env.example');
    expect(files).toContain('android/release.properties.example');
    expect(files.filter((f) => /node_modules|^dist|google-services\.json$|release\.properties$|^\.env(?!\.example)|assets\//.test(f))).toEqual([]);
  });
});

/**
 * Files every game shares with the template, apart from its names. A fix to one of them goes
 * into the template and every game together; a game that needs its own version leaves the list.
 */
const PLUMBING = [
  'vite.config.ts',
  'playwright.config.ts',
  '.env.example',
  'ANDROID.md',
  'src/env.d.ts',
  'src/i18n/index.ts',
  'src/browser.ts',
  'src/main.tsx',
  'src/boot.tsx',
  'src/privacy.ts',
  'store/store.ts',
  'store/art.html',
  'test/android.test.ts',
  'test/catalog.test.ts',
];

/** The Android project, except each game's own icons and launch screen colour, and what `cap sync` rewrites. */
function androidPlumbing(): string[] {
  return filesOf(template).filter(
    (file) => file.startsWith('android/') && !file.endsWith('.png') && !file.endsWith('.jar') && !/values\/colors\.xml$|capacitor\.(build|settings)\.gradle$/.test(file),
  );
}

const games = readdirSync(join(ROOT, 'games')).filter((dir) => existsSync(join(ROOT, 'games', dir, 'capacitor.config.ts')));

describe.each(games)('the game %s', (id) => {
  const dir = join(ROOT, 'games', id);
  const name = /appName: '([^']+)'/.exec(readFileSync(join(dir, 'capacitor.config.ts'), 'utf8'))?.[1] ?? '';
  const game = { id, name };

  it.each([...PLUMBING, ...androidPlumbing()])('shares %s with the template', (file) => {
    const mine = join(dir, rename(file, game));
    expect(existsSync(mine), mine).toBe(true);
    expect(readFileSync(mine, 'utf8')).toBe(rename(readFileSync(join(template, file), 'utf8'), game));
  });
});
