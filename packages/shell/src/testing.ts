import type { FrameScheduler } from '@game1/engine';
import type { AdOutcome, AdsService } from '@game1/platform';

/**
 * Helpers for a game's unit tests, which run without a browser, an ad network or a store.
 * Games import them from `@game1/shell/testing`; the app itself never does.
 */

/** The frame loop never runs by itself in tests; they call the game's pump() after moving the clock. */
export const manualFrames: FrameScheduler = { request: () => 0, cancel: () => undefined };

/** An ad network that answers every rewarded ad with `next`, and remembers what it showed. */
export class FakeAds implements AdsService {
  readonly name = 'admob' as const;
  next: AdOutcome = 'rewarded';
  rewarded: string[] = [];
  interstitials = 0;
  init(): Promise<void> {
    return Promise.resolve();
  }
  showRewarded(placement: string): Promise<AdOutcome> {
    this.rewarded.push(placement);
    return Promise.resolve(this.next);
  }
  showInterstitial(): Promise<boolean> {
    this.interstitials += 1;
    return Promise.resolve(true);
  }
  privacyOptionsRequired(): boolean {
    return false;
  }
  showPrivacyOptions(): Promise<void> {
    return Promise.resolve();
  }
}

/** Lets pending saves and purchase syncs finish. */
export async function settle(session: { syncPurchases(quiet: boolean): Promise<boolean> }): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await session.syncPurchases(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
