import { SHELL_TH } from '@game1/shell';
import type { StringKey } from './en.js';

/** Thai. The game's name stays in English. */
export const th: Partial<Record<StringKey, string>> = {
  ...SHELL_TH,
  'app.tagline': 'แตะ อัปเกรด แล้วแตะอีก',
  'app.startFailed': 'เกมเริ่มไม่ได้ ปิดเกมแล้วเปิดใหม่อีกครั้ง',
  'res.coins': 'เหรียญ',
  'tap.label': 'แตะเหรียญ',
  'tap.hint': 'แตะเหรียญเพื่อรับเหรียญ',
  'upgrade.title': 'แตะได้มากขึ้น',
  'upgrade.desc': 'แตะหนึ่งครั้งได้ {coins} เหรียญ',
  'upgrade.buy': 'อัปเกรด',
  'shop.title': 'ร้านค้า',
  'shop.bonus': 'เหรียญฟรี',
  'shop.bonus.desc': 'ดูโฆษณาเพื่อรับ {coins} เหรียญ วันนี้เหลือ {left} ครั้ง',
  'shop.claim': 'รับ',
  'shop.coins_small': 'ถุงเหรียญ',
  'shop.coins_small.desc': '500 เหรียญ',
  'shop.remove_ads': 'ไม่มีโฆษณาคั่น',
  'shop.remove_ads.desc': 'ไม่มีโฆษณาคั่นอีก และรับเหรียญฟรีได้โดยไม่ต้องดูโฆษณา',
};
