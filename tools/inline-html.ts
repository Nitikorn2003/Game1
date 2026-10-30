/**
 * Packs a `vite build --mode single` output into one HTML file for a host that wraps pages in its
 * own document and keeps them clear of the phone's system bars (a Claude artifact). Scripts and
 * stylesheets go inline; the build has already inlined fonts and images.
 *
 * Run: npx tsx tools/inline-html.ts <build dir> <out file> [--title <page title>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const titleAt = args.indexOf('--title');
const title = titleAt >= 0 ? args.splice(titleAt, 2)[1] : undefined;
const [dir, out] = args;
if (!dir || !out) {
  console.error('Usage: tsx tools/inline-html.ts <build dir> <out file> [--title <page title>]');
  process.exit(1);
}

const read = (path: string) => readFileSync(join(resolve(dir), path), 'utf8');
const html = read('index.html');
const parts = /<head>([\s\S]*)<\/head>\s*<body>([\s\S]*)<\/body>/i.exec(html);
if (!parts) throw new Error('index.html has no <head> and <body>');
const [, head = '', body = ''] = parts;

// A script or style element ends at the first "</script" or "</style" in its text, whatever it means there.
const scriptText = (code: string) => code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const styleText = (css: string) => css.replace(/<\/(style)/gi, '<\\/$1');

const scripts: string[] = [];
const pageTitle = title ?? /<title>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? 'Game';
const kept = head
  // The host's document already has a charset and a viewport.
  .replace(/<meta charset="[^"]*"\s*\/?>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_tag, src: string) => {
    scripts.push(`<script type="module">${scriptText(read(src))}</script>`);
    return '';
  })
  .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_tag, href: string) => `<style>${styleText(read(href))}</style>`);

const page = [
  `<title>${pageTitle}</title>`,
  kept.trim(),
  // The host pads the document for the system bars, so the app itself must not add that room again.
  '<style>:root{--g1-inset-top:0px;--g1-inset-bottom:0px}</style>',
  body.trim(),
  ...scripts,
  '',
].join('\n');

const leftover = /(?:src|href)="\.?\/?assets\/[^"]*"|url\(["']?\.?\/?assets\//.exec(page);
if (leftover) throw new Error(`Not inlined: ${leftover[0]}`);
writeFileSync(out, page);
console.log(`${out}: ${(Buffer.byteLength(page) / 1024).toFixed(1)} kB`);
