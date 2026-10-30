/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_WINS, rewarded ad limits in AD_LIMITS, the
 * tools, sugar and looks in sim/content.ts, the shops and levels in sim/levels.ts, the tray,
 * the rack and the stars in sim/round.ts).
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
    title: 'Crumb Lane: Tile Match Bakery',
    shortDescription: 'Tap pastries onto the tray, box up three of a kind and clear the bakery counter.',
    about: `Crumb Lane is a cozy tile-match puzzle on a little lane of bakeries. Help Hazel the baker clear her counters: tap a pastry to put it on the tray, and three of a kind box themselves up. Box up every pastry to clear the counter, and open the shops of the lane one by one.

TAP, MATCH, BOX UP
• Tap a pastry on the counter and it goes on the tray, next to the others of its kind
• Three of a kind on the tray are boxed up and leave it
• A pastry under another cannot be taken until the one on top is gone, so look before you tap
• The tray holds seven. Keep it at four or fewer for three stars
• Every counter is dealt so that it can be cleared with three stars

96 LEVELS IN EIGHT SHOPS
• Bread Corner, Croissant Café, The Cookie Jar, The Cupcake Parlour, The Pie Pantry, The Donut Stand, The Chocolate Shop and The Cake Hall
• Meet paper bags that hide what is inside, stacks with only the top pastry on show, ribbon boxes that open once enough sets are boxed up, and sprinkled pastries that pay a little extra sugar
• Clear every level of a shop and it opens on the lane, with 150 sugar and a tool of each kind
• After the lane, the late shift brings its counters back with more kinds of pastry
• The daily special is a new counter every day, the same for everyone. Clear it for 60 sugar, and 10 more on each day your streak goes on, up to 110

TOOLS IN YOUR APRON
• The spatula puts the last pastry back, the rolling pin rolls the counter into new places, and the whisk boxes up a set of three at once
• Tools take no place on the tray. You start with five, get more for every shop you open, and can buy them with sugar
• Tray full? Make room: three pastries go up to the cooling rack, and you can take them back any time

MAKE IT YOURS
• Four sets of tiles: Cream, Willow, Gingham and Mint
• Four seasons on the lane: Spring blossom, Summer rain, Autumn leaves and Winter snow
• Looks only change how the bakery is drawn, never the game

RELAX
• No timers and no energy: play as long as you like
• Every pastry is its own drawing, so the counter reads without colour too
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: room on a full tray, a tool, double sugar or free sugar
• Ad breaks only come after a level ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have cleared three counters. No Ad Breaks turns them off for good and gives you the rewards of reward videos without watching them.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Crumb Lane is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: room on a full tray, a tool, double sugar or free sugar
• Ad breaks only come after a level ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have cleared three counters
• Nothing is for sale: everything is earned by playing.

Crumb Lane is in English and Thai.`,
    },
  },
  th: {
    title: 'Crumb Lane: จับคู่ขนมสามชิ้น',
    shortDescription: 'แตะขนมวางบนถาด แพ็กขนมชนิดเดียวกันครบสามชิ้น แล้วเคลียร์เคาน์เตอร์ร้านเบเกอรี่',
    about: `Crumb Lane คือเกมจับคู่ขนมสามชิ้นแสนอบอุ่นบนถนนสายเล็กที่เรียงรายด้วยร้านเบเกอรี่ ช่วยเฮเซลคนทำขนมเคลียร์เคาน์เตอร์ของเธอ แตะขนมเพื่อวางบนถาด ขนมชนิดเดียวกันครบสามชิ้นจะถูกแพ็กใส่กล่องเอง แพ็กขนมทุกชิ้นเพื่อเคลียร์เคาน์เตอร์ แล้วเปิดร้านบนถนนทีละร้าน

แตะ จับคู่ แพ็กใส่กล่อง
• แตะขนมบนเคาน์เตอร์ ขนมจะไปวางบนถาดข้างขนมชนิดเดียวกัน
• ขนมชนิดเดียวกันครบสามชิ้นบนถาดจะถูกแพ็กใส่กล่องและออกจากถาด
• ขนมที่มีชิ้นอื่นทับอยู่หยิบไม่ได้จนกว่าชิ้นข้างบนจะหายไป ดูให้ดีก่อนแตะ
• ถาดวางได้เจ็ดชิ้น ให้ถาดมีขนมไม่เกินสี่ชิ้นเพื่อรับสามดาว
• ทุกเคาน์เตอร์จัดขนมไว้ให้เคลียร์ได้สามดาวเสมอ

96 ด่านในแปดร้าน
• มุมขนมปัง คาเฟ่ครัวซองต์ โหลคุกกี้ ร้านคัพเค้ก ห้องเก็บพาย ซุ้มโดนัท ร้านช็อกโกแลต และหอเค้ก
• พบถุงกระดาษที่ซ่อนขนมข้างใน กองขนมที่เห็นแค่ชิ้นบนสุด กล่องผูกโบที่เปิดเมื่อแพ็กขนมได้ครบจำนวนชุด และขนมโรยเกล็ดสีที่ให้น้ำตาลเพิ่มอีกนิด
• เคลียร์ทุกด่านของร้านแล้วร้านจะเปิดบนถนน พร้อมรับน้ำตาล 150 ก้อน และเครื่องมือทุกแบบอย่างละชิ้น
• เมื่อผ่านถนนครบแล้ว กะดึกจะนำเคาน์เตอร์เดิมกลับมาพร้อมขนมหลายชนิดขึ้น
• เมนูพิเศษประจำวันเป็นเคาน์เตอร์ใหม่ทุกวัน เหมือนกันสำหรับทุกคน เคลียร์ได้รับน้ำตาล 60 ก้อน และเพิ่มอีก 10 ก้อนในทุกวันที่เล่นต่อเนื่อง สูงสุด 110 ก้อน

เครื่องมือในผ้ากันเปื้อน
• ตะหลิววางขนมชิ้นล่าสุดคืนที่เดิม ไม้คลึงแป้งจัดขนมบนเคาน์เตอร์ใหม่ และตะกร้อตีไข่แพ็กขนมให้หนึ่งชุดทันที
• เครื่องมือไม่กินที่บนถาด เริ่มต้นมีห้าชิ้น ได้เพิ่มทุกครั้งที่เปิดร้าน และซื้อด้วยน้ำตาลได้
• ถาดเต็มแล้ว? เพิ่มที่ว่าง: ขนมสามชิ้นจะขึ้นไปพักบนตะแกรง และหยิบกลับมาได้ทุกเมื่อ

แต่งให้เป็นแบบของคุณ
• กระเบื้องสี่แบบ: ครีม ใบหลิว ลายตาราง และมินต์
• ฤดูบนถนนสี่แบบ: ดอกไม้ผลิ ฝนหน้าร้อน ใบไม้ร่วง และหิมะฤดูหนาว
• หน้าตาเปลี่ยนแค่การวาดร้านเบเกอรี่ ไม่เปลี่ยนตัวเกม

ผ่อนคลาย
• ไม่มีเวลาจำกัดและไม่มีพลังงาน เล่นได้นานเท่าที่ต้องการ
• ขนมแต่ละชนิดมีรูปวาดของตัวเอง จึงดูออกแม้ไม่ดูสี
• ความคืบหน้าของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: ที่ว่างบนถาดที่เต็ม เครื่องมือ น้ำตาลสองเท่า หรือน้ำตาลฟรี
• โฆษณาคั่นจะขึ้นหลังจบด่านเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณเคลียร์เคาน์เตอร์ครบสามครั้งแล้ว ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด และรับรางวัลของวิดีโอรางวัลได้โดยไม่ต้องดู
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Crumb Lane มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: ที่ว่างบนถาดที่เต็ม เครื่องมือ น้ำตาลสองเท่า หรือน้ำตาลฟรี
• โฆษณาคั่นจะขึ้นหลังจบด่านเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณเคลียร์เคาน์เตอร์ครบสามครั้งแล้ว
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Crumb Lane มีภาษาอังกฤษและภาษาไทย`,
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
