/**
 * Draws a game's Android launcher icon and splash icon, its Google Play graphics and its store
 * screenshots, all from the game's own code and art, and writes out its store listing:
 *
 *   npx tsx tools/store-assets.ts games/<game> [android] [store] [screens]
 *
 * With no part named it makes all three. The game provides `store/art.html` (drawn with
 * `renderStoreArt` from `@game1/ui/store-art`) and `store/store.ts` (a `StoreConfig` as its
 * default export). Icons go into the game's Android resources, which are committed; Play Store
 * graphics, screenshots and listing text go into the git-ignored `store/out/`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser, Page } from '@playwright/test';

export interface StoreScreen {
  /** Used in the file name, after the screen's place in the list: `1-mine.jpg`. */
  name: string;
  /** Opens the game at `url` and brings it to the moment to show. */
  show: (page: Page, url: string) => Promise<void>;
}

/** What Play Console asks for in each listing language, within its length limits. */
export interface StoreListing {
  title: string;
  shortDescription: string;
  fullDescription: string;
  /** The in-app products as Play Console lists them. */
  products: readonly { id: string; name: string; description: string }[];
}

/** The privacy policy in one language, as the game shows it. */
export interface PrivacyPolicy {
  title: string;
  /** For example "Updated 2026-10-29". */
  updated: string;
  /** `id` is the same in every language; the page's address for a section ends in #<locale>-<id>. */
  sections: readonly { id: string; heading: string; body: string }[];
}

export interface StoreConfig {
  /** The listing languages, as the game's locale codes; each gets its own graphics and text. */
  locales: readonly string[];
  listing: (locale: string) => StoreListing;
  privacy: (locale: string) => PrivacyPolicy;
  /** Two to eight phone screenshots, in the order Google Play shows them. */
  screens: readonly StoreScreen[];
}

/** Play Console's limits, counted the way its text fields count: every Thai vowel and tone mark is one. */
export const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000, productName: 55, productDescription: 200 } as const;

/** Words Google Play does not allow in a title or short description, and markup it strips. */
const BANNED = /\b(free|best|top|#1|no\. ?1|new|sale|discount|download|install now)\b|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|<[a-z]/iu;

/** What would make Play Console refuse the listing, or what Google's metadata policy forbids. */
export function listingProblems(listing: StoreListing): string[] {
  const problems: string[] = [];
  const check = (what: string, text: string, max: number) => {
    if (text.trim() === '') problems.push(`${what} is empty`);
    if (text.length > max) problems.push(`${what} has ${String(text.length)} characters, over ${String(max)}`);
  };
  check('title', listing.title, LIMITS.title);
  check('short description', listing.shortDescription, LIMITS.shortDescription);
  check('full description', listing.fullDescription, LIMITS.fullDescription);
  for (const text of [listing.title, listing.shortDescription]) {
    const banned = BANNED.exec(text);
    if (banned) problems.push(`"${banned[0]}" in "${text}"`);
  }
  for (const product of listing.products) {
    check(`name of ${product.id}`, product.name, LIMITS.productName);
    check(`description of ${product.id}`, product.description, LIMITS.productDescription);
  }
  return problems;
}

function listingText(listing: StoreListing): string {
  const products = listing.products.map((p) => `${p.id}\n  ${p.name}\n  ${p.description}`).join('\n');
  return `TITLE\n${listing.title}\n\nSHORT DESCRIPTION\n${listing.shortDescription}\n\nFULL DESCRIPTION\n${listing.fullDescription}\n\nIN-APP PRODUCTS (id, name, description)\n${products}\n`;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One page with the policy in every listing language, for the privacy policy address in Play Console. */
export function privacyPage(config: StoreConfig): string {
  const policies = config.locales.map((locale) => ({ locale, ...config.privacy(locale) }));
  const first = policies[0];
  if (!first) throw new Error('A store config needs at least one locale.');
  const switcher = policies.length > 1 ? `<nav>${policies.map((p) => `<a href="#${p.locale}" lang="${p.locale}">${escapeHtml(p.title)}</a>`).join(' · ')}</nav>` : '';
  const articles = policies.map(
    (p) =>
      `<article id="${p.locale}" lang="${p.locale}"><h1>${escapeHtml(p.title)}</h1><p class="updated">${escapeHtml(p.updated)}</p>${p.sections
        .map((section) => `<section id="${p.locale}-${section.id}"><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`)
        .join('')}</article>`,
  );
  return `<!doctype html>
<html lang="${first.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(first.title)}</title>
<style>
:root { color-scheme: light dark; --text: #1d1a17; --dim: #6b625a; --bg: #fffdf9; --line: #e8e0d6; }
@media (prefers-color-scheme: dark) { :root { --text: #f3ece4; --dim: #b3a89c; --bg: #15110f; --line: #3a312b; } }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, 'Noto Sans Thai', 'Leelawadee UI', sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
nav { margin-bottom: 8px; color: var(--dim); }
nav a { color: inherit; }
article + article { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); }
h1 { font-size: 1.6em; line-height: 1.25; margin: 0 0 4px; }
h2 { font-size: 1.1em; margin: 24px 0 4px; }
p { margin: 0; }
.updated { color: var(--dim); font-size: 0.9em; }
</style>
</head>
<body>
<main>${switcher}${articles.join('')}</main>
</body>
</html>
`;
}

function writeListings(game: string, config: StoreConfig): void {
  for (const locale of config.locales) {
    const listing = config.listing(locale);
    const problems = listingProblems(listing);
    if (problems.length > 0) throw new Error(`The ${locale} listing: ${problems.join('; ')}`);
    const file = join(game, 'store/out', locale, 'listing.txt');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, listingText(listing));
    console.log(relative(game, file));
  }
  const page = join(game, 'store/out/privacy.html');
  writeFileSync(page, privacyPage(config));
  console.log(relative(game, page));
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
  const config = ((await import(pathToFileURL(join(game, 'store/store.ts')).href)) as { default: StoreConfig }).default;
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
    if (want('store')) {
      writeListings(game, config);
      await drawAssets(browser, url, game, storeAssets(config.locales));
    }
    if (want('screens')) await takeScreenshots(browser, url, game, config);
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
