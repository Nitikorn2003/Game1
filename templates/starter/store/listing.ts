/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS, rewarded ad limits in AD_LIMITS).
 */
import type { Edition, StoreListing } from '../../../tools/store-assets.js';
import { CATALOG } from '../src/catalog.js';
import { translator, type Locale, type StringKey } from '../src/i18n/index.js';

interface Text {
  title: string;
  shortDescription: string;
  /** Everything above the part that differs between editions. */
  about: string;
  /** How ads and purchases work, then the languages line. */
  playYourWay: Record<Edition, string>;
}

const TEXT: Record<Locale, Text> = {
  en: {
    title: 'Starter: Tap and Upgrade',
    shortDescription: 'Tap the coin, upgrade your taps and watch the coins pile up.',
    about: `Tap the big coin to earn coins, then spend them to make every tap worth more.

• One tap, one coin, and more with every upgrade
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice
• Ad breaks only come at natural pauses, at most one every five minutes, and never in your first minutes of play. No Ad Breaks turns them off for good.
• Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Starter is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice
• Ad breaks only come at natural pauses, at most one every five minutes, and never in your first minutes of play
• Nothing is for sale: everything is earned by playing.

Starter is in English and Thai.`,
    },
  },
  th: {
    title: 'Starter: แตะและอัปเกรด',
    shortDescription: 'แตะเหรียญ อัปเกรดการแตะ แล้วดูเหรียญกองพูนขึ้นเรื่อย ๆ',
    about: `แตะเหรียญใหญ่เพื่อรับเหรียญ แล้วใช้เหรียญอัปเกรดให้การแตะแต่ละครั้งได้มากขึ้น

• แตะหนึ่งครั้งได้หนึ่งเหรียญ และได้มากขึ้นทุกครั้งที่อัปเกรด
• ความคืบหน้าถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ
• โฆษณาคั่นจะขึ้นเฉพาะตอนพักจังหวะ ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในช่วงแรกที่เริ่มเล่น ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด
• การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Starter มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ
• โฆษณาคั่นจะขึ้นเฉพาะตอนพักจังหวะ ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในช่วงแรกที่เริ่มเล่น
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Starter มีภาษาอังกฤษและภาษาไทย`,
    },
  },
};

export function listing(locale: Locale, edition: Edition): StoreListing {
  const text = translator(locale);
  const { title, shortDescription, about, playYourWay } = TEXT[locale];
  return {
    title,
    shortDescription,
    fullDescription: `${about}\n\n${playYourWay[edition]}`,
    products: (edition === 'full' ? CATALOG : []).map((item) => ({
      id: item.id,
      name: text.t(`shop.${item.id}` as StringKey),
      description: text.t(`shop.${item.id}.desc` as StringKey),
    })),
  };
}
