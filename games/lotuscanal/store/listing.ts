/**
 * The Google Play store listing in each language. Every claim here must stay true of the
 * game: check it against the code before each release (ad break limits are in the shell's
 * INTERSTITIAL_DEFAULTS and AD_BREAKS_AFTER_WINS, rewarded ad limits in AD_LIMITS, the rules
 * in sim/table.ts, the level ramp in sim/levels.ts, the canals, help and looks in
 * sim/content.ts).
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
    title: 'Lotus Canal Solitaire',
    shortDescription: 'Clear cards one rank up or down and sail your boat through a floating market.',
    about: `Lotus Canal is a peaks solitaire card game on a boat trip through a floating market. Clear the cards from the table one rank at a time, and every level you clear takes your boat one stop further along the canals.

PLAY AND CLEAR
• Tap a face-up card one rank higher or lower than the open card. Kings and aces go together too, so a run can go round
• When nothing fits, turn the next card from the stock
• A card turns face up once every card lying on it is played
• Only ranks matter. The four suits, lotus, mango, fish and leaf, each have their own colour and shape
• Twelve table shapes, among them twin peaks, a pyramid, a boat, a bridge and a lotus
• Every deal is made so that it can be cleared, and later levels ask for a little more care

RUNS AND COINS
• Every card you play puts a coin in the deal's pot, and every fifth card in a row pays five more
• A cleared deal pays its pot, the level's pay and two coins for every card still in the stock

HELP WHEN YOU WANT IT
• Two free undos on every deal
• A lotus wild goes onto the open card, and any face-up card can go onto it
• When the stock runs out, add five more cards, up to twice a deal

A TRIP ALONG THE CANALS
• Twelve canals of ten stops each, from the Old Landing to Sunrise Mouth
• The end of every canal pays 100 coins and a postcard with a little story of the place
• After the last canal the levels go on in open water
• The daily deal is a new deal every day, the same for everyone. Clear it for 40 coins and keep your daily streak going

MAKE IT YOURS
• Four card backs: Lotus, Waves, Elephant and Kanok flame
• Four scenes: Morning market, Sunset, Monsoon rain and Lantern night
• Looks only change how the cards and the canal are drawn, never the game

RELAX
• No timers, no lives and no energy: play as long as you like
• Your progress is saved on your phone as you play`,
    playYourWay: {
      full: `PLAY YOUR WAY
• Reward videos are always your choice: more undos, a lotus wild, five more cards, double coins or free coins
• Ad breaks only come after a deal ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have cleared five deals. No Ad Breaks turns them off for good and gives you the rewards of reward videos without watching them.
• Nothing for sale is random. Purchases are optional.
• Link your Google account to keep your progress in the cloud and take it to a new phone

Lotus Canal is in English and Thai.`,
      'ads-only': `PLAY YOUR WAY
• Reward videos are always your choice: more undos, a lotus wild, five more cards, double coins or free coins
• Ad breaks only come after a deal ends, never in the first five minutes after you open the game, at most one every five minutes, and not until you have cleared five deals
• Nothing is for sale: everything is earned by playing.

Lotus Canal is in English and Thai.`,
    },
  },
  th: {
    title: 'Lotus Canal: โซลิแทร์ล่องเรือ',
    shortDescription: 'เล่นไพ่ที่สูงหรือต่ำกว่าหนึ่งแต้มจนหมดโต๊ะ แล้วล่องเรือผ่านตลาดน้ำ',
    about: `Lotus Canal คือเกมไพ่โซลิแทร์แบบยอดเขาบนเรือที่ล่องผ่านตลาดน้ำ เก็บไพ่บนโต๊ะทีละแต้มจนหมด ทุกด่านที่ผ่านจะพาเรือของคุณแล่นไปอีกหนึ่งท่าตามลำคลอง

เล่นและเก็บไพ่
• แตะไพ่ที่หงายอยู่ซึ่งสูงหรือต่ำกว่าไพ่ที่เปิดหนึ่งแต้ม K กับ A ก็ต่อกันได้ ไพ่จึงต่อกันวนเป็นรอบได้
• ถ้าไม่มีใบไหนลงได้ ให้เปิดไพ่ใบถัดไปจากกองไพ่
• ไพ่จะหงายขึ้นเมื่อไพ่ทุกใบที่ทับอยู่ถูกเล่นไปแล้ว
• สำคัญแค่แต้มเท่านั้น ไพ่สี่ดอก บัว มะม่วง ปลา และใบไม้ แต่ละดอกมีสีและรูปของตัวเอง
• โต๊ะไพ่สิบสองแบบ เช่น ยอดเขาคู่ พีระมิด เรือ สะพาน และดอกบัว
• ทุกตาจัดไพ่ให้เก็บหมดได้เสมอ และด่านหลัง ๆ ต้องคิดให้รอบคอบขึ้นอีกนิด

ต่อไพ่และเก็บเหรียญ
• ไพ่ทุกใบที่เล่นได้เพิ่มหนึ่งเหรียญในกองเหรียญของตา และทุกใบที่ห้าที่เล่นต่อกันได้เพิ่มอีกห้าเหรียญ
• ตาที่เก็บหมดจะได้กองเหรียญของตา ค่าผ่านด่าน และสองเหรียญต่อไพ่ทุกใบที่ยังเหลือในกองไพ่

ตัวช่วยเมื่อคุณต้องการ
• ย้อนได้ฟรีสองครั้งในทุกตา
• บัววิเศษวางทับไพ่ที่เปิดอยู่ ไพ่ที่หงายอยู่ใบไหนก็ลงบนมันได้
• เมื่อกองไพ่หมด เพิ่มไพ่ได้อีกห้าใบ สูงสุดสองครั้งต่อตา

ล่องเรือตามลำคลอง
• สิบสองคลอง คลองละสิบท่า ตั้งแต่ท่าน้ำเก่าไปจนถึงปากคลองตะวันขึ้น
• สุดทางแต่ละคลองรับ 100 เหรียญและโปสการ์ดหนึ่งใบพร้อมเรื่องเล่าสั้น ๆ ของที่นั่น
• ผ่านคลองสุดท้ายแล้ว ด่านยังมีต่อไปเรื่อย ๆ ในแม่น้ำกว้าง
• ไพ่ประจำวันเป็นไพ่ชุดใหม่ทุกวัน เหมือนกันสำหรับทุกคน เก็บหมดรับ 40 เหรียญ และรักษาการเล่นต่อเนื่องรายวันไว้

แต่งให้เป็นแบบของคุณ
• หลังไพ่สี่แบบ: ดอกบัว คลื่นน้ำ ช้าง และลายกนก
• ฉากสี่แบบ: ตลาดยามเช้า ยามเย็น ฝนมรสุม และคืนโคมไฟ
• หน้าตาเปลี่ยนแค่การวาดไพ่และคลอง ไม่เปลี่ยนตัวเกม

ผ่อนคลาย
• ไม่มีเวลาจำกัด ไม่มีชีวิต และไม่มีพลังงาน เล่นได้นานเท่าที่ต้องการ
• ความคืบหน้าของคุณถูกบันทึกไว้ในโทรศัพท์ระหว่างที่เล่น`,
    playYourWay: {
      full: `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: ย้อนเพิ่ม บัววิเศษ ไพ่เพิ่มห้าใบ เหรียญสองเท่า หรือเหรียญฟรี
• โฆษณาคั่นจะขึ้นหลังจบตาเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณเก็บไพ่หมดครบห้าตาแล้ว ซื้อ "ไม่มีโฆษณาคั่น" เพื่อปิดไปตลอด และรับรางวัลของวิดีโอรางวัลได้โดยไม่ต้องดู
• ไม่มีของขายที่เป็นการสุ่ม การซื้อเป็นทางเลือกเท่านั้น
• เชื่อมบัญชี Google เพื่อเก็บความคืบหน้าไว้บนคลาวด์และย้ายไปเล่นต่อในโทรศัพท์เครื่องใหม่

Lotus Canal มีภาษาอังกฤษและภาษาไทย`,
      'ads-only': `เล่นในแบบของคุณ
• จะดูวิดีโอเพื่อรับรางวัลหรือไม่ คุณเลือกเองเสมอ: ย้อนเพิ่ม บัววิเศษ ไพ่เพิ่มห้าใบ เหรียญสองเท่า หรือเหรียญฟรี
• โฆษณาคั่นจะขึ้นหลังจบตาเท่านั้น ไม่ขึ้นในห้านาทีแรกหลังเปิดเกม ไม่เกินหนึ่งครั้งทุก 5 นาที และจะเริ่มขึ้นหลังจากคุณเก็บไพ่หมดครบห้าตาแล้ว
• ไม่มีอะไรต้องซื้อ ทุกอย่างได้จากการเล่น

Lotus Canal มีภาษาอังกฤษและภาษาไทย`,
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
