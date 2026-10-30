/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_QUILTS, rewarded ad limits in AD_LIMITS, the
 * scoring in sim/quilt.ts, the fabric sets in content.ts and ui/fabrics.ts).
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
    title: 'Quilt Nook: Cozy Block Puzzle',
    shortDescription: 'Sew patchwork pieces onto a cozy quilt and stitch full rows into seams.',
    about: `Sew a cozy quilt, one patch at a time. Drag patches onto the 8 by 8 quilt. Fill a row or a column and it is stitched into a seam, which makes room for more.

STITCH AND SCORE
• Three patches at a time, in more than thirty shapes
• Seams of a single fabric are perfect seams: double points and a spool of thread
• Stitch seams one after another for a streak that multiplies your seam points up to four times
• Empty the whole quilt for a big bonus

A NEW QUILT EVERY DAY
• The daily quilt has a goal. Reach it for spools and keep your daily streak going
• The quilt book gives you commissions that pay spools

MAKE IT YOURS
• Six fabric sets, from Cottage to Woodland, each with four patterned fabrics
• Every fabric in a set has its own pattern, so matching fabrics stand out without relying on colour
• Spools buy fabric sets and handy tools: Unpick takes back a patch, New patches deals a fresh tray and Snip cuts out one square

RELAX
• No timers, no lives and no energy: sew as long as you like
• Your quilts are saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: a second chance for a full quilt, double spools or free spools
• Ad breaks only come after a finished quilt, at most one every five minutes, and never in your first quilts. No Ad Breaks turns them off for good.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your quilts in the cloud and take them to a new phone

Quilt Nook is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: a second chance for a full quilt, double spools or free spools
• Ad breaks only come after a finished quilt, at most one every five minutes, and never in your first quilts
• Nothing is for sale: everything is earned by playing.

Quilt Nook is in English and Thai.`,
    },
  },
  th: {
    title: 'Quilt Nook: พัซเซิลต่อผ้าห่ม',
    shortDescription: 'ต่อชิ้นผ้าลงบนผ้าห่มแสนอบอุ่น แล้วเย็บแถวที่เต็มให้กลายเป็นตะเข็บ',
    about: `เย็บผ้าห่มแสนอบอุ่นทีละชิ้น ลากชิ้นผ้าลงบนผ้าห่มขนาด 8 x 8 ช่อง เมื่อแถวหรือคอลัมน์เต็ม จะถูกเย็บเป็นตะเข็บและเปิดที่ว่างให้ชิ้นต่อไป

เย็บและทำคะแนน
• ชิ้นผ้ามาทีละสามชิ้น มีมากกว่าสามสิบรูปทรง
• ตะเข็บที่เป็นผ้าลายเดียวกันทั้งแถวคือตะเข็บสมบูรณ์แบบ ได้คะแนนสองเท่าและได้หลอดด้าย
• เย็บตะเข็บต่อเนื่องกันเพื่อทำสตรีค คูณคะแนนตะเข็บได้สูงสุดสี่เท่า
• ทำให้ผ้าห่มว่างทั้งผืนเพื่อรับโบนัสก้อนใหญ่

ผ้าห่มผืนใหม่ทุกวัน
• ผ้าห่มประจำวันมีเป้าหมาย ทำให้ถึงเพื่อรับหลอดด้ายและรักษาการเล่นต่อเนื่องรายวันไว้
• สมุดงานเย็บมีงานสั่งทำที่ให้หลอดด้ายเป็นรางวัล

แต่งให้เป็นแบบของคุณ
• ลายผ้าหกชุด ตั้งแต่บ้านไร่จนถึงป่าไม้ แต่ละชุดมีผ้าสี่ลาย
• ผ้าทุกผืนในชุดมีลวดลายของตัวเอง จึงแยกผ้าที่เข้าชุดกันได้โดยไม่ต้องพึ่งสี
• ใช้หลอดด้ายซื้อลายผ้าและเครื่องมือ: เลาะคืนเอาชิ้นล่าสุดกลับมา ชิ้นผ้าใหม่เปลี่ยนชิ้นผ้าในถาด และตัดเอาออกหนึ่งช่อง

ผ่อนคลาย
• ไม่มีเวลาจำกัด ไม่มีชีวิต และไม่มีพลังงาน เย็บได้นานเท่าที่ต้องการ
• ผ้าห่มของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: โอกาสที่สองเมื่อผ้าห่มเต็ม หลอดด้ายสองเท่า หรือหลอดด้ายฟรี
• โฆษณาคั่นจะขึ้นหลังเย็บผ้าห่มเสร็จเท่านั้น ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในผ้าห่มผืนแรก ๆ ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บผ้าห่มไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Quilt Nook มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: โอกาสที่สองเมื่อผ้าห่มเต็ม หลอดด้ายสองเท่า หรือหลอดด้ายฟรี
• โฆษณาคั่นจะขึ้นหลังเย็บผ้าห่มเสร็จเท่านั้น ไม่เกินหนึ่งครั้งทุก 5 นาที และไม่ขึ้นในผ้าห่มผืนแรก ๆ
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Quilt Nook มีภาษาอังกฤษและภาษาไทย`,
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
