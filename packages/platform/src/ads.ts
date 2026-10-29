import { showOverlay } from './overlay.js';

/** rewarded: the network confirmed the reward. skipped: closed early. unavailable: no ad to show. */
export type AdOutcome = 'rewarded' | 'skipped' | 'unavailable';

export interface AdsService {
  readonly name: 'test' | 'admob';
  init(): Promise<void>;
  /** Shows a rewarded ad. Only 'rewarded' may give the player anything. */
  showRewarded(placement: string): Promise<AdOutcome>;
  /** Shows an interstitial if one is loaded. Resolves whether one was shown. */
  showInterstitial(placement: string): Promise<boolean>;
  /** Whether privacy law requires a "privacy options" entry point (Google UMP). */
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;
}

export interface TestAdsText {
  tag: string;
  rewardedTitle: string;
  rewardedBody: string;
  interstitialTitle: string;
  interstitialBody: string;
  claim: string;
  close: string;
}

const ENGLISH: TestAdsText = {
  tag: 'TEST AD',
  rewardedTitle: 'Rewarded ad',
  rewardedBody: 'A real ad plays here in the Android app. Wait for the countdown to get the reward.',
  interstitialTitle: 'Ad break',
  interstitialBody: 'A real full-screen ad plays here in the Android app.',
  claim: 'Get reward',
  close: 'Close',
};

/** Simulated ads for the browser version and tests. Nothing is loaded from any ad network. */
export class TestAds implements AdsService {
  readonly name = 'test' as const;
  shown: { kind: 'rewarded' | 'interstitial'; placement: string }[] = [];

  constructor(
    private readonly text: () => TestAdsText = () => ENGLISH,
    private readonly seconds = 5,
  ) {}

  init(): Promise<void> {
    return Promise.resolve();
  }

  async showRewarded(placement: string): Promise<AdOutcome> {
    this.shown.push({ kind: 'rewarded', placement });
    const t = this.text();
    const pressed = await showOverlay({
      tag: t.tag,
      title: t.rewardedTitle,
      body: t.rewardedBody,
      countdown: this.seconds,
      testId: 'test-ad',
      buttons: [
        { label: t.close, testId: 'test-ad-close' },
        { label: t.claim, primary: true, testId: 'test-ad-claim' },
      ],
    });
    return pressed === 1 ? 'rewarded' : 'skipped';
  }

  async showInterstitial(placement: string): Promise<boolean> {
    this.shown.push({ kind: 'interstitial', placement });
    const t = this.text();
    await showOverlay({ tag: t.tag, title: t.interstitialTitle, body: t.interstitialBody, testId: 'test-interstitial', buttons: [{ label: t.close, testId: 'test-ad-close' }] });
    return true;
  }

  privacyOptionsRequired(): boolean {
    return false;
  }

  showPrivacyOptions(): Promise<void> {
    return Promise.resolve();
  }
}
