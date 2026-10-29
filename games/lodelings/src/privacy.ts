/**
 * The privacy policy shown in the game. `tools/store-assets.ts` writes the same text to the
 * page whose address goes into Google Play Console. Review it against the final build before
 * every release: it has to match what the app and its SDKs really do.
 */
import type { Locale } from './i18n/index.js';

export const PRIVACY_UPDATED = '2026-10-29';

/**
 * Where players write about their data. Set it before the first release: Google Play wants a
 * privacy contact in the policy, and the same address goes on the store listing.
 */
export const CONTACT_EMAIL = '' as string;

export interface PolicySection {
  /** The same in every language; the published page links to sections by it. */
  id: string;
  heading: string;
  body: string;
}

const EN: readonly PolicySection[] = [
  {
    id: 'who',
    heading: 'Who we are',
    body: CONTACT_EMAIL
      ? `Lodelings is an independent game. You can reach us at ${CONTACT_EMAIL}.`
      : 'Lodelings is an independent game. You can reach us at the contact e-mail address shown on the game’s Google Play page.',
  },
  {
    id: 'progress',
    heading: 'Game progress',
    body: 'Your progress is saved on your device. If you sign in, a copy is also stored on our server so you can restore it on another device. The copy holds your game data and an account id; it does not hold your name, e-mail address or contacts.',
  },
  {
    id: 'sign-in',
    heading: 'Sign-in',
    body: 'The Android app can create an anonymous account for cloud saves through Google Firebase Authentication. If you choose to link a Google account, we receive the account id and e-mail address that Google shares for sign-in, and use them only to recognise your account.',
  },
  {
    id: 'purchases',
    heading: 'Purchases',
    body: 'Purchases are made through Google Play. We receive the purchase token and order details from Google to check that a purchase is real and to deliver it. We never see your card or payment details.',
  },
  {
    id: 'ads',
    heading: 'Ads',
    body: 'The Android app shows ads from Google AdMob. Google may collect your device’s advertising id, IP address and how you interact with ads, to show and measure ads. Where the law requires it (for example in the EEA, the UK and Switzerland) the app asks for your consent first, and you can change your choice any time under Settings, Ad privacy choices. You can also reset or delete your advertising id in your device settings. Buying No Ad Breaks turns off ad breaks; rewarded ads you choose to watch are then not needed for rewards.',
  },
  {
    id: 'browser',
    heading: 'Browser version',
    body: 'The browser version keeps your save in your browser’s local storage only. It shows no real ads, sells nothing and sends no game data anywhere.',
  },
  {
    id: 'children',
    heading: 'Children',
    body: 'Lodelings is not directed at children under 13, and we do not knowingly collect personal data from them.',
  },
  {
    id: 'deleting',
    heading: 'Keeping and deleting data',
    body: 'Cloud saves are kept while your account exists. You can delete your account in the app’s settings (Delete account and data), or ask us by e-mail, and we delete it within 30 days. That removes the sign-in account and its cloud saves in every game of ours that uses it. Records of purchases (product, date, order and purchase token) are kept after that, because Google can still report a refund for them and payment records must be kept for accounting. Uninstalling the app deletes the save on your device.',
  },
  {
    id: 'rights',
    heading: 'Your rights',
    body: 'You can copy your save from the app’s settings at any time. You can also e-mail us to ask for a copy of your data, to correct it or to delete it, and you can complain to the data protection authority where you live.',
  },
  {
    id: 'changes',
    heading: 'Changes',
    body: 'If this policy changes, the new version is shown in the game and on its Google Play page, with the date it was updated.',
  },
];

const TH: readonly PolicySection[] = [
  {
    id: 'who',
    heading: 'เราคือใคร',
    body: CONTACT_EMAIL
      ? `Lodelings เป็นเกมอิสระ ติดต่อเราได้ที่ ${CONTACT_EMAIL}`
      : 'Lodelings เป็นเกมอิสระ ติดต่อเราได้ทางอีเมลที่แสดงอยู่ในหน้า Google Play ของเกม',
  },
  {
    id: 'progress',
    heading: 'ความคืบหน้าในเกม',
    body: 'ความคืบหน้าของคุณบันทึกไว้ในอุปกรณ์ หากคุณเข้าสู่ระบบ จะมีสำเนาเก็บไว้บนเซิร์ฟเวอร์ของเราด้วย เพื่อให้กู้คืนบนอุปกรณ์เครื่องอื่นได้ สำเนานี้มีเพียงข้อมูลเกมและรหัสบัญชี ไม่มีชื่อ อีเมล หรือรายชื่อติดต่อของคุณ',
  },
  {
    id: 'sign-in',
    heading: 'การเข้าสู่ระบบ',
    body: 'แอป Android สร้างบัญชีแบบไม่ระบุตัวตนสำหรับบันทึกบนคลาวด์ได้ผ่าน Google Firebase Authentication หากคุณเลือกเชื่อมบัญชี Google เราจะได้รับรหัสบัญชีและอีเมลที่ Google ส่งให้เพื่อการเข้าสู่ระบบ และใช้เพื่อจดจำบัญชีของคุณเท่านั้น',
  },
  {
    id: 'purchases',
    heading: 'การซื้อ',
    body: 'การซื้อทำผ่าน Google Play เราได้รับโทเค็นการซื้อและรายละเอียดคำสั่งซื้อจาก Google เพื่อตรวจว่าการซื้อนั้นเกิดขึ้นจริงและส่งของให้คุณ เราไม่เห็นข้อมูลบัตรหรือข้อมูลการชำระเงินของคุณ',
  },
  {
    id: 'ads',
    heading: 'โฆษณา',
    body: 'แอป Android แสดงโฆษณาจาก Google AdMob ซึ่ง Google อาจเก็บรหัสโฆษณาของอุปกรณ์ ที่อยู่ IP และการโต้ตอบกับโฆษณา เพื่อแสดงและวัดผลโฆษณา ในพื้นที่ที่กฎหมายกำหนด (เช่น EEA สหราชอาณาจักร และสวิตเซอร์แลนด์) แอปจะขอความยินยอมจากคุณก่อน และคุณเปลี่ยนตัวเลือกได้ทุกเมื่อที่ ตั้งค่า > ตัวเลือกความเป็นส่วนตัวของโฆษณา คุณยังรีเซ็ตหรือลบรหัสโฆษณาได้ในการตั้งค่าของอุปกรณ์ เมื่อซื้อ "ไม่มีโฆษณาคั่น" โฆษณาคั่นจะหายไป และรับรางวัลได้โดยไม่ต้องดูโฆษณา',
  },
  {
    id: 'browser',
    heading: 'เวอร์ชันเบราว์เซอร์',
    body: 'เวอร์ชันเบราว์เซอร์เก็บเซฟไว้ในพื้นที่จัดเก็บของเบราว์เซอร์เท่านั้น ไม่มีโฆษณาจริง ไม่มีการขาย และไม่ส่งข้อมูลเกมไปที่ใด',
  },
  {
    id: 'children',
    heading: 'เด็ก',
    body: 'Lodelings ไม่ได้มุ่งเป้าไปที่เด็กอายุต่ำกว่า 13 ปี และเราไม่เก็บข้อมูลส่วนบุคคลของเด็กโดยเจตนา',
  },
  {
    id: 'deleting',
    heading: 'การเก็บและการลบข้อมูล',
    body: 'บันทึกบนคลาวด์จะเก็บไว้ตราบที่บัญชีของคุณยังอยู่ คุณลบบัญชีได้ในการตั้งค่าของแอป (ลบบัญชีและข้อมูล) หรือแจ้งเราทางอีเมล แล้วเราจะลบให้ภายใน 30 วัน การลบนี้จะลบบัญชีที่ใช้เข้าสู่ระบบและบันทึกบนคลาวด์ของบัญชีนั้น ในทุกเกมของเราที่ใช้บัญชีนี้ ส่วนบันทึกการซื้อ (สินค้า วันที่ คำสั่งซื้อ และโทเค็นการซื้อ) จะยังเก็บไว้ เพราะ Google ยังอาจแจ้งการคืนเงินของรายการเหล่านั้นได้ และต้องเก็บหลักฐานการชำระเงินไว้เพื่อการบัญชี การถอนการติดตั้งแอปจะลบเซฟในอุปกรณ์ของคุณ',
  },
  {
    id: 'rights',
    heading: 'สิทธิของคุณ',
    body: 'คุณคัดลอกเซฟได้ทุกเมื่อในการตั้งค่าของแอป และอีเมลถึงเราเพื่อขอสำเนา แก้ไข หรือลบข้อมูลของคุณได้ คุณยังร้องเรียนต่อหน่วยงานคุ้มครองข้อมูลส่วนบุคคลในที่ที่คุณอาศัยอยู่ได้ เช่น สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) ในประเทศไทย',
  },
  {
    id: 'changes',
    heading: 'การเปลี่ยนแปลง',
    body: 'หากนโยบายนี้เปลี่ยนแปลง ฉบับใหม่จะแสดงในเกมและในหน้า Google Play ของเกม พร้อมวันที่ปรับปรุง',
  },
];

export const PRIVACY_POLICY: Record<Locale, readonly PolicySection[]> = { en: EN, th: TH };
