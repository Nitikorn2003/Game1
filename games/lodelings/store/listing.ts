/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in
 * INTERSTITIAL_RULES, odds in EGGS, content counts in content.ts).
 */
import type { StoreListing } from '../../../tools/store-assets.js';
import { CATALOG } from '../src/catalog.js';
import { translator, type Locale, type StringKey } from '../src/i18n/index.js';

const TEXT: Record<Locale, Omit<StoreListing, 'products'>> = {
  en: {
    title: 'Lodelings: Idle Mining RPG',
    shortDescription: 'Dig deep, hatch crystal creatures and beat stone Guardians: an idle mining RPG.',
    fullDescription: `Dig into the Deep with the Lodelings: small crystal creatures that mine with you.

Tap the rock to break it, collect ore and go deeper. Every five depths a stone Guardian blocks the way. Beat it before time runs out, or keep mining to get stronger and challenge it again.

HATCH AND COLLECT
• 24 Lodelings in four elements: Ember, Tide, Grove and Volt
• Eggs show their odds for every rarity before you buy them
• Hatch a Lodeling you already have to give it a star

BUILD YOUR TEAM
• Level up your Lodelings and your gear: Pickaxe, Helmet Lamp, Mine Cart and Echo Charm
• Bring the right element: Ember beats Grove, Grove beats Volt, Volt beats Tide and Tide beats Ember
• Time four skills: Dynamite, Frenzy, Gold Rush and Rally

KEEP GOING
• Your team keeps mining while you are away
• Resurface for Relic Dust and power up seven relics that make every new dive stronger
• Six cave biomes, daily rewards, daily quests and achievements

PLAY YOUR WAY
• Reward videos are always your choice
• Ad breaks only come at natural pauses, at most one every five minutes, and never in your first minutes of play. No Ad Breaks turns them off for good.
• Gems turn up while mining, from Guardians and from daily quests. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Lodelings is in English and Thai.`,
  },
  th: {
    title: 'Lodelings: เกมขุดแร่ RPG',
    shortDescription: 'ขุดแร่ ฟักสัตว์คริสตัล และโค่นผู้พิทักษ์หิน ในเกม RPG ขุดแร่แบบ idle',
    fullDescription: `ลงไปขุดในห้วงลึกกับเหล่า Lodeling สัตว์คริสตัลตัวน้อยที่ขุดแร่ไปพร้อมกับคุณ

แตะหินเพื่อทุบให้แตก เก็บแร่ แล้วลงไปให้ลึกขึ้น ทุก 5 ชั้นจะมีผู้พิทักษ์หินขวางทางอยู่ เอาชนะให้ได้ก่อนหมดเวลา หรือขุดเก็บแรงต่อแล้วกลับมาท้าสู้ใหม่

ฟักไข่และสะสม
• Lodeling 24 ชนิด ใน 4 ธาตุ: เพลิง วารี พงไพร และอสนี
• ไข่บอกโอกาสของแต่ละระดับความหายากไว้ก่อนซื้อ
• ฟักได้ Lodeling ที่มีอยู่แล้ว จะได้ดาวเพิ่ม

สร้างทีมของคุณ
• อัปเลเวล Lodeling และอุปกรณ์: อีเต้อ ตะเกียงหมวก รถเข็นแร่ และเครื่องรางเสียงสะท้อน
• เลือกธาตุให้ถูก: เพลิงชนะพงไพร พงไพรชนะอสนี อสนีชนะวารี และวารีชนะเพลิง
• ใช้ 4 สกิลให้ถูกจังหวะ: ไดนาไมต์ รัวแตะ ตื่นทอง และปลุกใจ

เล่นต่อได้เรื่อย ๆ
• ทีมของคุณขุดต่อให้แม้ตอนที่ไม่ได้เปิดเกม
• กลับขึ้นผิวดินเพื่อรับผงโบราณ แล้วเสริมพลังโบราณวัตถุ 7 ชิ้นที่ทำให้การลงขุดรอบใหม่แข็งแกร่งขึ้น
• ถ้ำ 6 แบบ รางวัลรายวัน ภารกิจรายวัน และความสำเร็จ

เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ
• โฆษณาคั่นขึ้นเฉพาะช่วงพักตามจังหวะเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในช่วงแรกที่เริ่มเล่น ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดโฆษณาคั่นถาวร
• เพชรหาได้จากการขุด การชนะผู้พิทักษ์ และภารกิจรายวัน การซื้อเป็นเพียงทางเลือก
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นเครื่องใหม่ได้

Lodelings เล่นได้ทั้งภาษาไทยและภาษาอังกฤษ`,
  },
};

/** The listing in one language, with the in-app products named as the game names them. */
export function listing(locale: Locale): StoreListing {
  const text = translator(locale);
  return {
    ...TEXT[locale],
    products: CATALOG.map((item) => {
      const gems = item.grants?.gems;
      const desc = `shop.${item.id}.desc` as StringKey;
      return {
        id: item.id,
        name: text.t(`shop.${item.id}` as StringKey),
        description: item.id.startsWith('gems_') && gems !== undefined ? text.t('shop.gemsAmount', { gems }) : text.t(desc),
      };
    }),
  };
}
