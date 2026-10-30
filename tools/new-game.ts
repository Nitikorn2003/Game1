/**
 * Starts a new game from templates/starter, the smallest complete Game1 game:
 *
 *   npx tsx tools/new-game.ts <id> "<Name>"
 *
 * It copies the template to games/<id> with the template's names replaced (the package, the
 * Android app and its Java package, the save format, the storage prefix, the store text), gives
 * the game its own port for the play tests, and adds the game to the purchase server's example
 * catalog. The copy builds, runs and passes its tests as it is; then its gameplay, screens, art
 * and store text are replaced. docs/FRAMEWORK.md lists what to change.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The template's own names, which a new game replaces with its own. */
export const TEMPLATE = { dir: 'templates/starter', id: 'starter', name: 'Starter' } as const;

/** Also a Java package name, an npm package name, a save format id and the purchase server's game id. */
const ID = /^[a-z][a-z0-9]{1,29}$/;
/** Shown under the launcher icon and in every store text; plain, so it fits in any file unescaped. */
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9 -]{0,28}[A-Za-z0-9])?$/;

export interface Identity {
  /** The folder under games/, for example `quiltnook`. */
  id: string;
  /** The game's name, for example `Quilt Nook`. */
  name: string;
}

/** Why the id or the name cannot be used, or null when both can. */
export function identityProblem(game: Identity): string | null {
  if (!ID.test(game.id)) return `The id "${game.id}" must be 2 to 30 lowercase letters and digits, starting with a letter.`;
  if (!NAME.test(game.name)) return `The name "${game.name}" must be up to 30 letters, digits, spaces and hyphens.`;
  if (/starter/i.test(game.id) || /starter/i.test(game.name)) return 'The id and the name must not contain "starter", the template\'s own name.';
  return null;
}

/** Replaces the template's names in a file's text or path with the game's. */
export function rename(text: string, game: Identity): string {
  return text
    .replaceAll(TEMPLATE.dir, `games/${game.id}`)
    .replace(new RegExp(`\\b${TEMPLATE.id}\\b`, 'g'), game.id)
    .replace(new RegExp(`\\b${TEMPLATE.name}\\b`, 'g'), game.name);
}

/**
 * What is never copied: build output, installed packages, test output, and the files git
 * ignores in an Android project (copied web assets, local paths, secrets).
 */
const SKIPPED = [
  /^node_modules\//,
  /^dist(-single)?\//,
  /^test-results\//,
  /^store\/out\//,
  /^\.env(?!\.example$)/,
  /^android\/(\.gradle|build|app\/build|capacitor-cordova-android-plugins)\//,
  /^android\/app\/src\/main\/assets\//,
  /^android\/app\/src\/main\/res\/xml\/config\.xml$/,
  /(^|\/)(local\.properties|release\.properties|google-services\.json)$/,
  /\.(jks|keystore|apk|aab)$/,
  /(^|\/)(\.DS_Store|Thumbs\.db)$/,
];

export function skipped(path: string): boolean {
  return SKIPPED.some((pattern) => pattern.test(path));
}

/** Every file of a folder, as paths relative to it with forward slashes. */
export function filesOf(dir: string, under = ''): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(dir, under), { withFileTypes: true })) {
    const path = under ? `${under}/${entry.name}` : entry.name;
    if (skipped(entry.isDirectory() ? `${path}/` : path)) continue;
    if (entry.isDirectory()) files.push(...filesOf(dir, path));
    else files.push(path);
  }
  return files.sort();
}

/** Images, jars and anything else with a zero byte is copied as it is. */
export function isText(bytes: Buffer): boolean {
  return !bytes.subarray(0, 8000).includes(0);
}

export interface ScaffoldOptions extends Identity {
  /** The template folder; templates/starter by default. */
  template?: string;
  /** Where the game's folder goes; games/ by default. */
  games?: string;
  /** The purchase server's example catalog, which gets the game's products. */
  catalog?: string;
}

export interface Scaffolded {
  dir: string;
  files: string[];
  port: number;
}

interface PackageJson {
  description?: string;
  config?: { e2ePort?: number };
}

/** The first play test port after every game's, so their tests can run at the same time. */
function freePort(games: string): number {
  let last = 4179;
  for (const entry of existsSync(games) ? readdirSync(games) : []) {
    const file = join(games, entry, 'package.json');
    if (!existsSync(file)) continue;
    const port = (JSON.parse(readFileSync(file, 'utf8')) as PackageJson).config?.e2ePort;
    if (typeof port === 'number') last = Math.max(last, port);
  }
  return last + 1;
}

interface Catalog {
  games: { gameId: string; packageName: string; products: unknown[] }[];
}

/** Gives the game the template's products in the purchase server's example catalog. */
function addToCatalog(path: string, game: Identity): void {
  const catalog = JSON.parse(readFileSync(path, 'utf8')) as Catalog;
  const template = catalog.games.find((g) => g.gameId === TEMPLATE.id);
  if (!template) throw new Error(`${path} has no "${TEMPLATE.id}" game to copy the products from.`);
  if (catalog.games.some((g) => g.gameId === game.id)) return;
  catalog.games.push({ ...structuredClone(template), gameId: game.id, packageName: `com.example.${game.id}` });
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
}

export function scaffold(o: ScaffoldOptions): Scaffolded {
  const problem = identityProblem(o);
  if (problem) throw new Error(problem);
  const template = o.template ?? join(ROOT, TEMPLATE.dir);
  const games = o.games ?? join(ROOT, 'games');
  const dir = join(games, o.id);
  if (existsSync(dir)) throw new Error(`${dir} already exists.`);
  const port = freePort(games);
  const files: string[] = [];
  for (const path of filesOf(template)) {
    const from = join(template, path);
    const to = rename(path, o);
    const target = join(dir, to);
    mkdirSync(dirname(target), { recursive: true });
    const bytes = readFileSync(from);
    if (isText(bytes)) writeFileSync(target, rename(bytes.toString('utf8'), o));
    else copyFileSync(from, target);
    // Keeps gradlew runnable.
    chmodSync(target, statSync(from).mode & 0o777);
    files.push(to);
  }
  const pkgFile = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as PackageJson;
  pkg.description = `${o.name}, a Game1 game.`;
  pkg.config = { ...pkg.config, e2ePort: port };
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  addToCatalog(o.catalog ?? join(ROOT, 'services/iap-server/config/catalog.example.json'), o);
  return { dir, files, port };
}

function main(): void {
  const [id, name] = process.argv.slice(2);
  if (!id || !name) {
    console.error('usage: tsx tools/new-game.ts <id> "<Name>"   for example: tsx tools/new-game.ts quiltnook "Quilt Nook"');
    process.exit(2);
  }
  let made: Scaffolded;
  try {
    made = scaffold({ id, name });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  const at = relative(ROOT, made.dir).split(sep).join('/');
  console.log(`Made ${at}: ${String(made.files.length)} files copied from ${TEMPLATE.dir} and named ${name}. Its play tests use port ${String(made.port)}.

Next steps:
1. npm install, which links the new workspace.
2. npm test, then npm run e2e -w ${at}: the copy passes the template's tests as it is.
3. Give it its own gameplay, screens, art and store text. docs/FRAMEWORK.md lists the files.
4. npx tsx tools/store-assets.ts ${at} android, which draws its launcher icon from store/art.tsx.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
