/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_WINS, rewarded ad limits in AD_LIMITS, the
 * tools, sand dollars and looks in sim/content.ts, the zones and levels in sim/levels.ts,
 * the extra moves and the stars in sim/dive.ts).
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
    title: 'Tide Garden: Reef Match 3',
    shortDescription: 'Swap reef pieces, wash away the sand and help baby turtles down to the sea.',
    about: `Tide Garden is a match-three puzzle game on a coral reef. Swap two pieces side by side to line up three or more of a kind, reach each level's goals before the moves run out, and bring the reef's creatures home one zone at a time.

SWAP AND SPLASH
• Line up coral, shells, starfish, sea glass, bubbles and urchins
• Four in a line make a wave, an L or a T a bubble bomb, and five a pearl
• Swap two special pieces together for a bigger splash
• Swipe a piece onto its neighbour, or tap one and then the other

96 LEVELS IN EIGHT ZONES
• Sunlit Shallows, Seagrass Meadow, Kelp Forest, Coral Garden, Turtle Beach, Old Shipwreck, Lantern Caves and Pearl Lagoon
• Wash away sand, cut pieces free of kelp, crack rocks and help baby turtles crawl down to the sea
• Reach every level of a zone to bring its creature home, with 150 sand dollars and a tool of each kind
• Earn up to three stars on every level. After the reef, the open sea plays its boards again in new colours
• The daily dive is a new level every day, the same for everyone. Reach it for 60 sand dollars, and 10 more on each day your streak goes on, up to 110

TOOLS IN YOUR BAG
• The claw picks off one piece, the tide washes a row clear, and the hermit crab swaps any two neighbours
• Tools take no move. You start with six, get more for every zone you finish, and can buy them with sand dollars
• Out of moves? Take 5 more and keep diving

MAKE IT YOURS
• Four waters: Sunlit shallows, Sunset, Moonlight and Glowing night
• Four buddies to swim beside the board: Clownfish, Seal pup, Manta ray and Leafy sea dragon
• Looks only change how the reef is drawn, never the game

RELAX
• No timers and no energy: play as long as you like
• Every kind of piece has its own shape as well as its own colour
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: more moves, a tool, double sand dollars or free sand dollars
• Ad breaks only come after a level ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have reached three levels. No Ad Breaks turns them off for good and gives you the rewards of reward videos without watching them.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Tide Garden is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: more moves, a tool, double sand dollars or free sand dollars
• Ad breaks only come after a level ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have reached three levels
• Nothing is for sale: everything is earned by playing.

Tide Garden is in English and Thai.`,
    },
  },
  th: {
    title: 'Tide Garden: เรียงสามใต้ทะเล',
    shortDescription: 'สลับชิ้นบนแนวปะการัง ล้างทราย และช่วยลูกเต่าคลานลงทะเล',
    about: `Tide Garden คือเกมปริศนาเรียงสามบนแนวปะการัง สลับสองชิ้นที่อยู่ติดกันให้ชิ้นแบบเดียวกันเรียงกันสามชิ้นขึ้นไป ทำเป้าหมายของแต่ละด่านให้ครบก่อนตาเดินหมด แล้วพาสัตว์ทะเลกลับบ้านทีละโซน

สลับแล้วกระจาย
• เรียงปะการัง เปลือกหอย ดาวทะเล แก้วทะเล ฟองอากาศ และเม่นทะเล
• เรียงสี่ชิ้นเป็นแถวได้คลื่น เรียงเป็นรูปตัว L หรือ T ได้ระเบิดฟอง และเรียงห้าชิ้นได้ไข่มุก
• สลับชิ้นพิเศษสองชิ้นเข้าหากันจะกระจายแรงกว่าเดิม
• ปัดชิ้นไปทางชิ้นข้าง ๆ หรือแตะชิ้นหนึ่งแล้วแตะอีกชิ้น

96 ด่านในแปดโซน
• น้ำตื้นแสงแดด ทุ่งหญ้าทะเล ป่าสาหร่าย สวนปะการัง หาดเต่าทะเล ซากเรือเก่า ถ้ำโคมไฟ และลากูนไข่มุก
• ล้างทราย ตัดสาหร่าย ทุบหิน และช่วยลูกเต่าคลานลงทะเล
• ผ่านทุกด่านในโซนเพื่อพาสัตว์ประจำโซนกลับบ้าน พร้อมรับ 150 เหรียญทะเล และเครื่องมือทุกแบบอย่างละชิ้น
• เก็บได้ถึงสามดาวในทุกด่าน และเมื่อผ่านแนวปะการังครบแล้ว ทะเลกว้างจะนำกระดานเดิมกลับมาในสีสันใหม่
• ดำน้ำประจำวันเป็นด่านใหม่ทุกวัน เหมือนกันสำหรับทุกคน ผ่านด่านรับ 60 เหรียญทะเล และเพิ่มอีก 10 เหรียญในทุกวันที่ดำต่อเนื่อง สูงสุด 110 เหรียญ

เครื่องมือในกระเป๋า
• ก้ามหนีบคีบออกหนึ่งชิ้น กระแสน้ำเคลียร์หนึ่งแถว และปูเสฉวนสลับสองชิ้นที่อยู่ติดกันได้เสมอ
• เครื่องมือไม่เสียตาเดิน เริ่มต้นมีหกชิ้น ได้เพิ่มทุกครั้งที่ผ่านครบโซน และซื้อด้วยเหรียญทะเลได้
• ตาเดินหมด? รับเพิ่มอีก 5 ตาแล้วดำน้ำต่อ

แต่งให้เป็นแบบของคุณ
• น้ำทะเลสี่แบบ: แดดส่องน้ำตื้น ยามอาทิตย์ตก แสงจันทร์ และค่ำคืนเรืองแสง
• เพื่อนดำน้ำสี่ตัวที่ว่ายอยู่ข้างกระดาน: ปลาการ์ตูน ลูกแมวน้ำ ปลากระเบนราหู และมังกรทะเลใบไม้
• หน้าตาเปลี่ยนแค่การวาดแนวปะการัง ไม่เปลี่ยนตัวเกม

ผ่อนคลาย
• ไม่มีเวลาจำกัดและไม่มีพลังงาน เล่นได้นานเท่าที่ต้องการ
• ชิ้นแต่ละแบบมีรูปทรงของตัวเองนอกจากสี
• ความคืบหน้าของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: ตาเดินเพิ่ม เครื่องมือ เหรียญทะเลสองเท่า หรือเหรียญทะเลฟรี
• โฆษณาคั่นจะขึ้นหลังจบด่านเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณผ่านครบสามด่านแล้ว ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด และรับรางวัลของวิดีโอรางวัลได้โดยไม่ต้องดู
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Tide Garden มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: ตาเดินเพิ่ม เครื่องมือ เหรียญทะเลสองเท่า หรือเหรียญทะเลฟรี
• โฆษณาคั่นจะขึ้นหลังจบด่านเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณผ่านครบสามด่านแล้ว
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Tide Garden มีภาษาอังกฤษและภาษาไทย`,
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
