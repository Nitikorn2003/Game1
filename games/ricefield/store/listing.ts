/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_WINS, rewarded ad limits in AD_LIMITS, the
 * hearts, hints, seeds and looks in sim/content.ts, the pictures and their sizes in
 * sim/pictures.ts, the daily field in sim/daily.ts).
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
    title: 'Rice Field Art: Picture Logic',
    shortDescription: 'Read the numbers, plant the rice and watch a picture grow in the fields.',
    about: `Rice Field Art is a picture logic puzzle set in the rice fields. Every field hides a picture: read the numbers along its rows and columns, plant the rice where it must go, and watch the picture come up out of the paddy in colour.

PLANT AND PEBBLE
• The numbers beside each row and above each column are its runs of rice, in order
• Choose Plant to put rice in a cell, or Pebble to mark one that stays empty. Drag along a row or a column to do many cells at once
• Every field can be worked out without guessing
• A wrong move costs one of the field's three hearts, and the cell is put right
• Out of hearts? Fill them up, or start the field over for nothing

72 PICTURES IN SIX ALBUMS
• First Sprouts, Water's Edge, Farmyard, Village Life, Harvest Time and Open Sky
• The fields grow from 5 × 5 up to 12 × 12 as you go
• Every grown field pays seeds, half as much again when you make no wrong move and use no hint, and a full album pays 100 seeds more
• A new album opens once eight pictures of the album before it have grown
• The daily field is a new pattern every day, the same for everyone. Grow it for 40 seeds and keep your daily streak going

HELP WHEN YOU WANT IT
• The first hint of every field costs nothing, and fills in the row or column the numbers tell the most about
• Spend seeds on more hints, on hearts or on new looks

MAKE IT YOURS
• Four scenes: Green terraces, Golden harvest, Misty morning and Snowy fields
• Four markers for empty cells: Pebbles, Little frogs, Lotus blossoms and Snails
• Looks only change how the fields are drawn, never the game

RELAX
• No timers and no energy: play as long as you like
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: a hint, full hearts, double seeds or free seeds
• Ad breaks only come after a field has grown, never in the first five minutes after you open the game, at most one every five minutes, and not until you have grown three fields. No Ad Breaks turns them off for good and gives you the rewards of reward videos without watching them.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Rice Field Art is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: a hint, full hearts, double seeds or free seeds
• Ad breaks only come after a field has grown, never in the first five minutes after you open the game, at most one every five minutes, and not until you have grown three fields
• Nothing is for sale: everything is earned by playing.

Rice Field Art is in English and Thai.`,
    },
  },
  th: {
    title: 'Rice Field Art: ปริศนาภาพ',
    shortDescription: 'อ่านตัวเลข ปลูกข้าว แล้วดูภาพค่อย ๆ เติบโตขึ้นในนาข้าว',
    about: `Rice Field Art คือเกมปริศนาภาพจากตัวเลขในทุ่งนา นาทุกแปลงซ่อนภาพไว้ อ่านตัวเลขข้างแถวและเหนือคอลัมน์ ปลูกข้าวในช่องที่ต้องเป็นข้าว แล้วดูภาพค่อย ๆ เติบโตขึ้นจากนาเป็นสีสัน

ปลูกข้าวและวางกรวด
• ตัวเลขข้างแถวและเหนือคอลัมน์คือจำนวนช่องข้าวที่ติดกันเป็นกลุ่ม ๆ เรียงตามลำดับ
• เลือก “ปลูก” เพื่อปลูกข้าวในช่อง หรือ “วางกรวด” เพื่อทำเครื่องหมายช่องที่ต้องว่าง ลากไปตามแถวหรือคอลัมน์เพื่อทำหลายช่องพร้อมกัน
• นาทุกแปลงไขได้โดยไม่ต้องเดา
• ทำผิดจะเสียหัวใจหนึ่งในสามดวงของนาแปลงนั้น และช่องนั้นจะถูกแก้ให้ถูกต้อง
• หัวใจหมด? เติมหัวใจ หรือเริ่มนาแปลงนั้นใหม่ได้โดยไม่เสียอะไร

72 ภาพในสมุดภาพหกเล่ม
• ต้นกล้าแรก ริมน้ำ ลานฟาร์ม ชีวิตในหมู่บ้าน ฤดูเก็บเกี่ยว และท้องฟ้ากว้าง
• นาขยายจาก 5 × 5 ไปจนถึง 12 × 12 ช่องเมื่อเล่นไปเรื่อย ๆ
• นาทุกแปลงที่เติบโตให้เมล็ดพันธุ์ ได้เพิ่มอีกครึ่งหนึ่งเมื่อไม่พลาดเลยและไม่ใช้คำใบ้ และปลูกครบเล่มรับเพิ่มอีก 100 เมล็ด
• สมุดภาพเล่มใหม่จะเปิดเมื่อภาพในเล่มก่อนหน้าเติบโตครบแปดภาพ
• นาประจำวันเป็นลวดลายใหม่ทุกวัน เหมือนกันสำหรับทุกคน ปลูกจนเติบโตรับ 40 เมล็ด และรักษาการปลูกต่อเนื่องรายวันไว้

ตัวช่วยเมื่อคุณต้องการ
• คำใบ้แรกของนาทุกแปลงไม่เสียอะไร และจะเติมแถวหรือคอลัมน์ที่ตัวเลขบอกได้มากที่สุด
• ใช้เมล็ดพันธุ์แลกคำใบ้เพิ่ม เติมหัวใจ หรือซื้อหน้าตาใหม่

แต่งให้เป็นแบบของคุณ
• ฉากสี่แบบ: นาขั้นบันได ทุ่งรวงทอง เช้าหมอกลง และทุ่งหิมะ
• เครื่องหมายช่องว่างสี่แบบ: ก้อนกรวด กบน้อย ดอกบัว และหอยทาก
• หน้าตาเปลี่ยนแค่การวาดแปลงนา ไม่เปลี่ยนตัวเกม

ผ่อนคลาย
• ไม่มีเวลาจำกัดและไม่มีพลังงาน เล่นได้นานเท่าที่ต้องการ
• ความคืบหน้าของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: คำใบ้ เติมหัวใจ เมล็ดพันธุ์สองเท่า หรือเมล็ดพันธุ์ฟรี
• โฆษณาคั่นจะขึ้นหลังนาแปลงหนึ่งเติบโตเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณปลูกนาจนเติบโตครบสามแปลงแล้ว ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด และรับรางวัลของวิดีโอรางวัลได้โดยไม่ต้องดู
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Rice Field Art มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: คำใบ้ เติมหัวใจ เมล็ดพันธุ์สองเท่า หรือเมล็ดพันธุ์ฟรี
• โฆษณาคั่นจะขึ้นหลังนาแปลงหนึ่งเติบโตเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณปลูกนาจนเติบโตครบสามแปลงแล้ว
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Rice Field Art มีภาษาอังกฤษและภาษาไทย`,
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
