/**
 * The privacy policy shown in the game. The same text must be published at the URL given in
 * Google Play Console. Review it against the final build before every release: it has to
 * match what the app and its SDKs really do.
 */
export const PRIVACY_UPDATED = '2026-10-29';

export const PRIVACY_POLICY: readonly { heading: string; body: string }[] = [
  {
    heading: 'Who we are',
    body: 'Lodelings is an independent game. You can reach us at the contact e-mail address shown on the game’s Google Play page.',
  },
  {
    heading: 'Game progress',
    body: 'Your progress is saved on your device. If you sign in, a copy is also stored on our server so you can restore it on another device. The copy holds your game data and an account id; it does not hold your name, e-mail address or contacts.',
  },
  {
    heading: 'Sign-in',
    body: 'The Android app can create an anonymous account for cloud saves through Google Firebase Authentication. If you choose to link a Google account, we receive the account id and e-mail address that Google shares for sign-in, and use them only to recognise your account.',
  },
  {
    heading: 'Purchases',
    body: 'Purchases are made through Google Play. We receive the purchase token and order details from Google to check that a purchase is real and to deliver it. We never see your card or payment details.',
  },
  {
    heading: 'Ads',
    body: 'The Android app shows ads from Google AdMob. Google may collect your device’s advertising id, IP address and how you interact with ads, to show and measure ads. Where the law requires it (for example in the EEA, the UK and Switzerland) the app asks for your consent first, and you can change your choice any time under Settings, Ad privacy choices. You can also reset or delete your advertising id in your device settings. Buying No Ad Breaks turns off ad breaks; rewarded ads you choose to watch are then not needed for rewards.',
  },
  {
    heading: 'Browser version',
    body: 'The browser version keeps your save in your browser’s local storage only. It shows no real ads, sells nothing and sends no game data anywhere.',
  },
  {
    heading: 'Children',
    body: 'Lodelings is not directed at children under 13, and we do not knowingly collect personal data from them.',
  },
  {
    heading: 'Keeping and deleting data',
    body: 'Cloud saves are kept while your account exists. You can delete your account and its cloud save in the app’s settings, or ask us by e-mail, and we delete them within 30 days. Uninstalling the app deletes the save on your device.',
  },
  {
    heading: 'Changes',
    body: 'If this policy changes, the new version is shown in the game and on its Google Play page, with the date it was updated.',
  },
];
