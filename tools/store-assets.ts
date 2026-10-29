/**
 * Draws a game's Android launcher icon and splash icon, its Google Play graphics and its store
 * screenshots, all from the game's own code and art:
 *
 *   npx tsx tools/store-assets.ts games/<game> [android] [store] [screens]
 *
 * With no part named it makes all three. The game provides `store/art.html` (drawn with
 * `renderStoreArt` from `@game1/ui/store-art`) and `store/screens.ts` (a `StoreConfig` as its
 * default export). Icons go into the game's Android resources, which are committed; Play Store
 * graphics and screenshots go into the git-ignored `store/out/`.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser, Page } from '@playwright/test';

export interface StoreScreen {
  /** Used in the file name, after the screen's place in the list: `1-mine.jpg`. */
  name: string;
  /** Opens the game at `url` and brings it to the moment to show. */
  show: (page: Page, url: string) => Promise<void>;
}

export interface StoreConfig {
  /** The listing languages, as the game's locale codes; each gets its own graphics. */
  locales: readonly string[];
  /** Two to eight phone screenshots, in the order Google Play shows them. */
  screens: readonly StoreScreen[];
}

export interface Asset {
  art: string;
  width: number;
  height: number;
  file: string;
  /** Launcher icon layers keep their transparent background; Google Play graphics are opaque. */
  transparent: boolean;
  locale?: string;
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;

/** One file per screen density: `dp` is the size on screen, the pixel size follows from it. */
function perDensity(art: string, dp: number, folder: 'mipmap' | 'drawable', name: string, transparent = true): Asset[] {
  return Object.entries(DENSITIES).map(([density, scale]) => ({
    art,
    width: dp * scale,
    height: dp * scale,
    file: `android/app/src/main/res/${folder}-${density}/${name}.png`,
    transparent,
  }));
}

export function androidAssets(): Asset[] {
  return [
    ...perDensity('icon-background', 108, 'mipmap', 'ic_launcher_background', false),
    ...perDensity('icon-foreground', 108, 'mipmap', 'ic_launcher_foreground'),
    ...perDensity('icon-monochrome', 108, 'mipmap', 'ic_launcher_monochrome'),
    ...perDensity('icon-legacy', 48, 'mipmap', 'ic_launcher'),
    ...perDensity('icon-round', 48, 'mipmap', 'ic_launcher_round'),
    // Android 12 and later show the splash icon at 288 dp and keep the middle 192 dp circle of it.
    ...perDensity('icon-foreground', 288, 'drawable', 'splash_icon'),
  ];
}

export function storeAssets(locales: readonly string[]): Asset[] {
  return [
    { art: 'icon-play', width: 512, height: 512, file: 'store/out/play-icon.png', transparent: false },
    ...locales.map((locale) => ({ art: 'feature-graphic', width: 1024, height: 500, file: `store/out/${locale}/feature-graphic.jpg`, transparent: false, locale })),
  ];
}

async function drawAssets(browser: Browser, url: string, game: string, assets: Asset[]): Promise<void> {
  const page = await browser.newPage();
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  for (const asset of assets) {
    await page.setViewportSize({ width: asset.width, height: asset.height });
    const query = new URLSearchParams({ asset: asset.art, ...(asset.locale ? { lang: asset.locale } : {}) });
    await page.goto(`${url}store/art.html?${query.toString()}`);
    await page.waitForSelector('body[data-ready], body[data-error]', { state: 'attached' });
    const failed = errors.shift()?.message ?? (await page.locator('body').getAttribute('data-error'));
    if (failed) throw new Error(`store/art.html could not draw ${asset.art}: ${failed}`);
    const path = join(game, asset.file);
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot(asset.file.endsWith('.jpg') ? { path, type: 'jpeg', quality: 92 } : { path, omitBackground: asset.transparent });
    console.log(`${asset.file}  ${String(asset.width)}x${String(asset.height)}`);
  }
  await page.close();
}

async function takeScreenshots(browser: Browser, url: string, game: string, config: StoreConfig): Promise<void> {
  for (const locale of config.locales) {
    const folder = join(game, 'store/out', locale, 'screenshots');
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    for (const [index, screen] of config.screens.entries()) {
      // 1080 × 1920: Google Play wants 9:16 and at least 1080 pixels for its recommendations.
      const context = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, isMobile: true, hasTouch: true, locale });
      const page = await context.newPage();
      await screen.show(page, url);
      const file = join(folder, `${String(index + 1)}-${screen.name}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
      console.log(relative(game, file));
      await context.close();
    }
  }
}

async function main(): Promise<void> {
  const [dir, ...parts] = process.argv.slice(2);
  const known = ['android', 'store', 'screens'];
  if (!dir || parts.some((part) => !known.includes(part))) {
    console.error('usage: tsx tools/store-assets.ts games/<game> [android] [store] [screens]');
    process.exit(2);
  }
  const want = (part: string) => parts.length === 0 || parts.includes(part);
  const game = resolve(dir);
  const config = ((await import(pathToFileURL(join(game, 'store/screens.ts')).href)) as { default: StoreConfig }).default;
  // Loaded here, so the tests can read the asset lists without starting a browser.
  const { chromium } = await import('@playwright/test');
  const { createServer } = await import('vite');
  const server = await createServer({ root: game, configFile: join(game, 'vite.config.ts'), logLevel: 'warn', server: { port: 4191 } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  const browser = await chromium.launch();
  try {
    if (!url) throw new Error('The Vite dev server did not report its address.');
    if (want('android')) await drawAssets(browser, url, game, androidAssets());
    if (want('store')) await drawAssets(browser, url, game, storeAssets(config.locales));
    if (want('screens')) await takeScreenshots(browser, url, game, config);
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
