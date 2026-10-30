import { SHELL_EN } from '@game1/shell';

/**
 * Every string the game shows: the shell's (settings, account, shop notes, test ads) and the
 * game's own. Thai and future languages translate these keys.
 */
export const en = {
  ...SHELL_EN,
  'app.title': 'Starter',
  'app.tagline': 'Tap, upgrade, repeat',
  'app.startFailed': 'The game could not start. Close it and open it again.',
  'res.coins': 'Coins',
  'tap.label': 'Tap the coin',
  'tap.hint': 'Tap the coin to earn coins.',
  'upgrade.title': 'Better taps',
  'upgrade.desc': 'Each tap gives {coins} coins.',
  'upgrade.buy': 'Upgrade',
  'shop.title': 'Shop',
  'shop.bonus': 'Free coins',
  'shop.bonus.desc': 'Watch an ad for {coins} coins. {left} left today.',
  'shop.claim': 'Claim',
  'shop.coins_small': 'Coin Pouch',
  'shop.coins_small.desc': '500 coins.',
  'shop.remove_ads': 'No Ad Breaks',
  'shop.remove_ads.desc': 'No more ad breaks, and free coins without watching ads.',
} as const;

export type StringKey = keyof typeof en;
