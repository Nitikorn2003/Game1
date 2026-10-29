import '@game1/ui/ui.css';
import '@game1/shell/shell.css';
import './fonts.css';
import './styles.css';
import { nativeConfig } from '@game1/shell';
import { isNativeApp, nativeServices } from '@game1/shell/native';
import { boot, bootFailed } from './boot.js';
import { browserServices } from './browser.js';
import { GAME } from './catalog.js';

const root = document.getElementById('app');
if (root) {
  boot(root, isNativeApp() ? () => nativeServices(nativeConfig(import.meta.env), GAME) : browserServices).catch((err: unknown) => {
    bootFailed(root, err);
  });
}
