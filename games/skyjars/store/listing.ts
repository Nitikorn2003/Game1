/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_LEVELS, rewarded ad limits in AD_LIMITS, the
 * level ramp in sim/levels.ts, the atlas, tools and looks in sim/content.ts).
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
    title: 'Sky Jars: Colour Sort Puzzle',
    shortDescription: 'Pour starlight between jars until each holds one colour, and light up the sky.',
    about: `Pour starlight from jar to jar until every jar holds a single colour. Every level you solve lights a star in the night sky, and star by star you fill a sky atlas of 24 constellations.

POUR AND SORT
• Tap a jar to lift it, then tap another to pour. Starlight only goes onto its own colour or into an empty jar
• Ten colours of starlight, each with its own symbol, so you never have to tell colours apart by shade alone
• Levels grow from three colours to ten, with calmer breather levels and tall jars along the way
• Every level is checked to be solvable before it reaches you

HELP WHEN YOU WANT IT
• Five free undos on every shelf, and Restart whenever you like
• One extra empty jar a shelf, for the trickiest moments
• A hint shows a pour on a way to solve the shelf from where it stands now

A SKY TO FILL
• Every solved level lights the next star. Finish a constellation for a stardust bonus and read its little story
• The daily sky is a new shelf every day, the same for everyone. Solve it for stardust and keep your daily streak going

MAKE IT YOURS
• Four jar styles: Glass, Lantern, Seashell and Crystal
• Four skies: Twilight, Moonrise, Aurora and Meteor shower
• Looks only change how the jars and the sky are drawn, never the puzzle

RELAX
• No timers, no lives and no energy: pour as long as you like
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: an extra jar, more undos, a hint, double stardust or free stardust
• Ad breaks only come after you solve a shelf, at most one every five minutes, and never in your first levels. No Ad Breaks turns them off for good and gives you the rewards of reward videos without watching them.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Sky Jars is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: an extra jar, more undos, a hint, double stardust or free stardust
• Ad breaks only come after you solve a shelf, at most one every five minutes, and never in your first levels
• Nothing is for sale: everything is earned by playing.

Sky Jars is in English and Thai.`,
    },
  },
  th: {
    title: 'Sky Jars: พัซเซิลเรียงสีในโหล',
    shortDescription: 'เทแสงดาวไปมาระหว่างโหลจนแต่ละโหลมีสีเดียว แล้วจุดดาวให้เต็มท้องฟ้า',
    about: `เทแสงดาวจากโหลหนึ่งไปอีกโหลหนึ่ง จนทุกโหลมีสีเดียว ทุกด่านที่ผ่านจะจุดดาวหนึ่งดวงบนท้องฟ้ายามค่ำคืน ดาวทีละดวงจะค่อย ๆ เติมแผนที่ดาวที่มีกลุ่มดาวถึง 24 กลุ่ม

เทและเรียงสี
• แตะโหลเพื่อยกขึ้น แล้วแตะอีกโหลเพื่อเท แสงดาวเทลงได้เฉพาะบนสีเดียวกันหรือในโหลว่าง
• แสงดาวมีสิบสี แต่ละสีมีสัญลักษณ์ของตัวเอง จึงไม่ต้องแยกสีจากเฉดสีอย่างเดียว
• ด่านเริ่มจากสามสีไปจนถึงสิบสี มีด่านพักที่ผ่อนคลายกว่าและโหลทรงสูงสลับมาเป็นระยะ
• ทุกด่านผ่านการตรวจแล้วว่าแก้ได้ ก่อนจะถึงมือคุณ

ตัวช่วยเมื่อคุณต้องการ
• ย้อนได้ฟรีห้าครั้งในทุกชั้นโหล และเริ่มใหม่ได้ทุกเมื่อ
• โหลเปล่าเสริมได้หนึ่งใบต่อชั้นโหล สำหรับช่วงที่ยากที่สุด
• คำใบ้ชี้การเทหนึ่งครั้งบนทางที่แก้ชั้นโหลได้จากที่เป็นอยู่ตอนนี้

ท้องฟ้าให้เติมเต็ม
• ทุกด่านที่ผ่านจะจุดดาวดวงถัดไป จุดครบหนึ่งกลุ่มดาวรับโบนัสผงดาว และได้อ่านเรื่องเล่าสั้น ๆ ของกลุ่มดาวนั้น
• ท้องฟ้าประจำวันคือชั้นโหลใหม่ทุกวัน เหมือนกันสำหรับทุกคน แก้ได้รับผงดาวและรักษาการเล่นต่อเนื่องรายวันไว้

แต่งให้เป็นแบบของคุณ
• โหลสี่แบบ: แก้วใส ตะเกียง เปลือกหอย และคริสตัล
• ท้องฟ้าสี่แบบ: สนธยา จันทร์ขึ้น แสงเหนือ และฝนดาวตก
• หน้าตาเปลี่ยนแค่การวาดโหลและท้องฟ้า ไม่เปลี่ยนตัวพัซเซิล

ผ่อนคลาย
• ไม่มีเวลาจำกัด ไม่มีชีวิต และไม่มีพลังงาน เทได้นานเท่าที่ต้องการ
• ความคืบหน้าของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: โหลเสริม ย้อนเพิ่ม คำใบ้ ผงดาวสองเท่า หรือผงดาวฟรี
• โฆษณาคั่นจะขึ้นหลังแก้ชั้นโหลได้เท่านั้น ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในด่านแรก ๆ ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด และรับรางวัลของวิดีโอรางวัลได้โดยไม่ต้องดู
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Sky Jars มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: โหลเสริม ย้อนเพิ่ม คำใบ้ ผงดาวสองเท่า หรือผงดาวฟรี
• โฆษณาคั่นจะขึ้นหลังแก้ชั้นโหลได้เท่านั้น ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในด่านแรก ๆ
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Sky Jars มีภาษาอังกฤษและภาษาไทย`,
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
