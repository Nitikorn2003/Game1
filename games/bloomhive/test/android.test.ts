import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { androidAssets } from '../../../tools/store-assets.js';

const game = fileURLToPath(new URL('..', import.meta.url));
const app = join(game, 'android/app/src/main');
// The Capacitor library's resources are merged into the app too.
const resFolders = [join(app, 'res'), join(game, '../../node_modules/@capacitor/android/capacitor/src/main/res')];

function png(path: string): { width: number; height: number; colorType: number } | null {
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  if (bytes.subarray(1, 4).toString('latin1') !== 'PNG') return null;
  // The IHDR chunk comes first: width, height, bit depth, colour type.
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] ?? -1 };
}

/** Whether `@type/name` names a resource of the app or of the Capacitor library. */
function resolves(type: string, name: string): boolean {
  for (const res of resFolders) {
    for (const folder of readdirSync(res)) {
      if (folder === type || folder.startsWith(`${type}-`)) {
        if (readdirSync(join(res, folder)).some((file) => file.replace(/\.(png|webp|xml)$/, '') === name)) return true;
      }
      if (folder === 'values' || folder.startsWith('values-')) {
        for (const file of readdirSync(join(res, folder))) {
          const xml = readFileSync(join(res, folder, file), 'utf8');
          if (new RegExp(`<${type}\\b[^>]*\\bname="${name.replace(/\./g, '\\.')}"`).test(xml)) return true;
        }
      }
    }
  }
  return false;
}

describe('the Android launcher icon and launch screen', () => {
  it('has every icon layer and the splash icon at every density, at its size', () => {
    for (const asset of androidAssets()) {
      const image = png(join(game, asset.file));
      expect(image, asset.file).toMatchObject({ width: asset.width, height: asset.height });
      // Colour type 6 has an alpha channel; layers drawn over others need it.
      if (asset.transparent) expect(image?.colorType, asset.file).toBe(6);
    }
  });

  it('refers only to resources that exist', () => {
    const files = [join(app, 'AndroidManifest.xml')];
    for (const folder of readdirSync(join(app, 'res'))) {
      for (const file of readdirSync(join(app, 'res', folder))) if (file.endsWith('.xml')) files.push(join(app, 'res', folder, file));
    }
    const refs = new Set(files.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/@(mipmap|drawable|color|style|string|xml)\/([\w.]+)/g)].map((m) => `${m[1]}/${m[2]}`)));
    expect(refs).toContain('mipmap/ic_launcher_monochrome');
    expect(refs).toContain('drawable/splash_icon');
    const missing = [...refs].filter((ref) => {
      const [type = '', name = ''] = ref.split('/');
      return !resolves(type, name);
    });
    expect(missing).toEqual([]);
  });
});
