/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_WINS, rewarded ad limits in AD_LIMITS, the
 * tools, honey and looks in sim/content.ts, the zones and levels in sim/levels.ts, the
 * jar, the extra pollen and the stars in sim/round.ts).
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
    title: 'Bloom Hive: Bubble Shooter',
    shortDescription: 'Aim pollen, pop buds of one colour and rescue the baby bees of the meadow.',
    about: `Bloom Hive is a bubble shooter in a flower meadow. Pip the bee shoots pollen up at the buds hanging from a branch: three or more of one colour touching pop, and every bud left hanging from nothing falls. Free the baby bees caught in the buds, reach each level's goals before the pollen runs out, and bring the meadow into bloom one zone at a time.

AIM, BOUNCE AND POP
• Drag to aim, with a dotted line that shows where the pollen will stick, and let go to shoot
• Bounce shots off the sides to reach buds behind others
• Tap the next pollen to swap it for the one in hand, for free
• Every bud popped or fallen fills the nectar jar, and a full jar gives a bomb that takes no pollen

96 LEVELS IN EIGHT ZONES
• Clover Lawn, Sunflower Field, Beeswax Hollow, Honey Orchard, Dandelion Hill, Butterfly Garden, Moonlit Meadow and the Queen's Garden
• Free the baby bees, clear the top row, or collect buds of a colour
• Meet beeswax that never pops, honey that keeps a bud out of matches, dandelion puffs that burst their neighbours and butterflies that change a bud's colour
• Reach every level of a zone and its flower blooms in Pip's garden, with 150 honey and a tool of each kind
• Earn up to three stars on every level. After the meadow, the wild meadow plays its boards again in new colours
• The daily meadow is a new level every day, the same for everyone. Reach it for 60 honey, and 10 more on each day your streak goes on, up to 110

TOOLS IN YOUR POUCH
• The rainbow takes the colour that pops the most where it sticks, the bomb pops every bud near it, wax too, and the sunbeam shines through every bud on its way up
• Tools take no pollen. You start with five, get more for every zone you finish, and can buy them with honey
• Out of pollen, or a bud came down to Pip? Take 5 more and keep going

MAKE IT YOURS
• Four skies: Morning, Sunset, Summer rain and Starry night
• Four hats for Pip: Leaf cap, Straw hat, Flower crown and Knitted beanie
• Looks only change how the meadow is drawn, never the game

RELAX
• No timers and no energy: play as long as you like
• Every colour of bud has its own mark, a heart, a star, a clover, a drop, a moon or a flower, so the board reads without colour too
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: more pollen, a tool, double honey or free honey
• Ad breaks only come after a level ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have reached three levels. No Ad Breaks turns them off for good and gives you the rewards of reward videos without watching them.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Bloom Hive is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: more pollen, a tool, double honey or free honey
• Ad breaks only come after a level ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have reached three levels
• Nothing is for sale: everything is earned by playing.

Bloom Hive is in English and Thai.`,
    },
  },
  th: {
    title: 'Bloom Hive: ยิงดอกตูมจับคู่สี',
    shortDescription: 'เล็งเกสร ยิงดอกตูมสีเดียวกันให้แตก และช่วยลูกผึ้งออกจากทุ่งดอกไม้',
    about: `Bloom Hive คือเกมยิงลูกจับคู่สีในทุ่งดอกไม้ ผึ้งน้อยพิปยิงเกสรขึ้นไปหาดอกตูมที่ห้อยอยู่ใต้กิ่งไม้ ดอกตูมสีเดียวกันติดกันสามดอกขึ้นไปจะแตก และดอกที่ไม่มีอะไรยึดไว้จะร่วงลงมาทั้งหมด ช่วยลูกผึ้งที่ติดอยู่ในดอกตูม ทำเป้าหมายของแต่ละด่านให้ครบก่อนเกสรหมด แล้วทำให้ทุ่งดอกไม้บานทีละโซน

เล็ง เด้ง แล้วแตก
• ลากเพื่อเล็ง มีเส้นประบอกว่าเกสรจะไปติดตรงไหน แล้วปล่อยเพื่อยิง
• ยิงให้เด้งกับขอบเพื่อไปถึงดอกตูมที่อยู่ด้านหลัง
• แตะลูกถัดไปเพื่อสลับกับลูกในมือได้ฟรี
• ดอกตูมทุกดอกที่แตกหรือร่วงจะเติมโถน้ำหวาน และเมื่อโถเต็มจะได้ระเบิดที่ไม่เสียเกสร

96 ด่านในแปดโซน
• สนามโคลเวอร์ ทุ่งทานตะวัน โพรงขี้ผึ้ง สวนผลไม้น้ำผึ้ง เนินแดนดิไลออน สวนผีเสื้อ ทุ่งแสงจันทร์ และสวนของนางพญาผึ้ง
• ช่วยลูกผึ้ง เคลียร์แถวบนสุด หรือเก็บดอกตูมสีที่กำหนด
• พบขี้ผึ้งที่ไม่แตก น้ำผึ้งที่ทำให้ดอกตูมจับคู่ไม่ได้ ปุยแดนดิไลออนที่ระเบิดใส่ดอกข้าง ๆ และผีเสื้อที่เปลี่ยนสีดอกตูม
• ผ่านทุกด่านในโซนแล้วดอกไม้ประจำโซนจะบานในสวนของพิป พร้อมรับน้ำผึ้ง 150 หยด และเครื่องมือทุกแบบอย่างละชิ้น
• เก็บได้ถึงสามดาวในทุกด่าน และเมื่อผ่านทุ่งดอกไม้ครบแล้ว ทุ่งป่าจะนำกระดานเดิมกลับมาในสีสันใหม่
• ทุ่งประจำวันเป็นด่านใหม่ทุกวัน เหมือนกันสำหรับทุกคน ผ่านด่านรับน้ำผึ้ง 60 หยด และเพิ่มอีก 10 หยดในทุกวันที่เล่นต่อเนื่อง สูงสุด 110 หยด

เครื่องมือในกระเป๋า
• สายรุ้งเปลี่ยนเป็นสีที่แตกได้มากที่สุดตรงที่มันติด ระเบิดทำให้ทุกดอกใกล้ ๆ แตกรวมทั้งขี้ผึ้ง และลำแสงตะวันส่องทะลุทุกดอกตลอดทางขึ้นไป
• เครื่องมือไม่เสียเกสร เริ่มต้นมีห้าชิ้น ได้เพิ่มทุกครั้งที่ผ่านครบโซน และซื้อด้วยน้ำผึ้งได้
• เกสรหมด หรือดอกตูมลงมาถึงพิปแล้ว? รับเพิ่มอีก 5 ลูกแล้วเล่นต่อ

แต่งให้เป็นแบบของคุณ
• ท้องฟ้าสี่แบบ: ยามเช้า ยามเย็น ฝนหน้าร้อน และคืนดาวพราว
• หมวกสี่ใบให้พิป: หมวกใบไม้ หมวกฟาง มงกุฎดอกไม้ และหมวกไหมพรม
• หน้าตาเปลี่ยนแค่การวาดทุ่งดอกไม้ ไม่เปลี่ยนตัวเกม

ผ่อนคลาย
• ไม่มีเวลาจำกัดและไม่มีพลังงาน เล่นได้นานเท่าที่ต้องการ
• ดอกตูมแต่ละสีมีลายของตัวเอง ทั้งหัวใจ ดาว ใบโคลเวอร์ หยดน้ำ พระจันทร์ และดอกไม้ จึงดูออกแม้ไม่ดูสี
• ความคืบหน้าของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: เกสรเพิ่ม เครื่องมือ น้ำผึ้งสองเท่า หรือน้ำผึ้งฟรี
• โฆษณาคั่นจะขึ้นหลังจบด่านเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณผ่านครบสามด่านแล้ว ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด และรับรางวัลของวิดีโอรางวัลได้โดยไม่ต้องดู
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Bloom Hive มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: เกสรเพิ่ม เครื่องมือ น้ำผึ้งสองเท่า หรือน้ำผึ้งฟรี
• โฆษณาคั่นจะขึ้นหลังจบด่านเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณผ่านครบสามด่านแล้ว
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Bloom Hive มีภาษาอังกฤษและภาษาไทย`,
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
