import { POLICY_UPDATED, privacyPolicy } from '@game1/shell';

/**
 * The privacy policy shown in the game, the same as every Game1 game's (see @game1/shell).
 * `tools/store-assets.ts` writes it to the page whose address goes into Google Play Console.
 */
export const PRIVACY_POLICY = privacyPolicy('Rice Field Art');
export const PRIVACY_UPDATED = POLICY_UPDATED;
