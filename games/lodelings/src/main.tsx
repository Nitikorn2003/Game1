import '@game1/ui/ui.css';
import './fonts.css';
import './styles.css';
import { boot, bootFailed } from './boot.js';
import { browserServices } from './browser.js';
import { isNativeApp, nativeConfig, nativeServices } from './native.js';

const root = document.getElementById('app');
if (root) {
  boot(root, isNativeApp() ? () => nativeServices(nativeConfig(import.meta.env)) : browserServices).catch((err: unknown) => {
    bootFailed(root, err);
  });
}
