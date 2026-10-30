import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

/**
 * `vite build` makes the app for Android (Capacitor loads it from disk, so paths are relative).
 * `vite build --mode single` inlines every asset, for the one-file preview build.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [preact()],
  // Hooks break if the shared packages and the game end up with different Preact copies.
  resolve: { dedupe: ['preact'] },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? Number.MAX_SAFE_INTEGER : 4096,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
  },
}));
