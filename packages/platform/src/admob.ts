import type { AdOutcome, AdsService } from './ads.js';

/** Google's sample ad units. They always serve test ads, which never pay and are safe to tap. */
export const ADMOB_TEST_UNITS = {
  app: 'ca-app-pub-3940256099942544~3347511713',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
} as const;

// Event names of @capacitor-community/admob (RewardAdPluginEvents and InterstitialAdPluginEvents).
const EVENTS = {
  rewarded: 'onRewardedVideoAdReward',
  rewardedDismissed: 'onRewardedVideoAdDismissed',
  rewardedFailedToShow: 'onRewardedVideoAdFailedToShow',
  interstitialDismissed: 'interstitialAdDismissed',
  interstitialFailedToShow: 'interstitialAdFailedToShow',
} as const;

interface ConsentInfo {
  status: string;
  isConsentFormAvailable?: boolean;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: string;
}

interface ListenerHandle {
  remove(): Promise<void>;
}

/** The parts of the AdMob plugin of @capacitor-community/admob that AdMobAds uses. */
export interface AdMobPlugin {
  initialize(options?: { initializeForTesting?: boolean; tagForUnderAgeOfConsent?: boolean }): Promise<void>;
  requestConsentInfo(options?: { tagForUnderAgeOfConsent?: boolean }): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
  showPrivacyOptionsForm(): Promise<void>;
  prepareRewardVideoAd(options: { adId: string; isTesting?: boolean }): Promise<unknown>;
  showRewardVideoAd(): Promise<unknown>;
  prepareInterstitial(options: { adId: string; isTesting?: boolean }): Promise<unknown>;
  showInterstitial(): Promise<void>;
  addListener(eventName: string, listener: (data: unknown) => void): Promise<ListenerHandle>;
}

export interface AdMobOptions {
  units: { rewarded: string; interstitial: string };
  /** True for every build that is not a store release: the ads SDK then only serves test ads. */
  testing: boolean;
  /** How long a player who asked for a rewarded ad waits for one to load. */
  loadTimeoutMs?: number;
  /** A reward can be reported just after the ad closes; this long is still counted. */
  rewardGraceMs?: number;
  /** Gives up on an ad that never reports closing. */
  maxShowMs?: number;
}

type Kind = 'rewarded' | 'interstitial';

/**
 * Rewarded and interstitial ads from Google AdMob on Android. It asks Google's consent SDK (UMP)
 * first and requests no ads at all until it allows them. A reward counts only when the ads SDK
 * reports it, never because an ad was merely shown.
 */
export class AdMobAds implements AdsService {
  readonly name = 'admob' as const;
  private canRequestAds = false;
  private privacyRequired = false;
  private showing = false;
  private readonly loaded: Record<Kind, boolean> = { rewarded: false, interstitial: false };
  private readonly loading: Record<Kind, Promise<boolean> | null> = { rewarded: null, interstitial: null };

  constructor(
    private readonly admob: AdMobPlugin,
    private readonly options: AdMobOptions,
  ) {}

  async init(): Promise<void> {
    await this.refreshConsent(true);
    if (!this.canRequestAds) return;
    await this.admob.initialize({ initializeForTesting: this.options.testing });
    void this.load('rewarded');
    void this.load('interstitial');
  }

  async showRewarded(_placement: string): Promise<AdOutcome> {
    if (!this.canRequestAds || this.showing) return 'unavailable';
    this.showing = true;
    try {
      if (!(await this.ready('rewarded', true))) return 'unavailable';
      return await this.watch<AdOutcome>((finish) => {
        let rewarded = false;
        return {
          listeners: [
            [EVENTS.rewarded, () => (rewarded = true)],
            [
              EVENTS.rewardedDismissed,
              () =>
                setTimeout(() => {
                  finish(rewarded ? 'rewarded' : 'skipped');
                }, this.options.rewardGraceMs ?? 500),
            ],
            [EVENTS.rewardedFailedToShow, () => { finish('unavailable'); }],
          ],
          // The plugin's promise only settles once the reward is earned or the ad failed to start.
          show: () =>
            this.admob.showRewardVideoAd().then(
              () => (rewarded = true),
              () => { finish(rewarded ? 'rewarded' : 'unavailable'); },
            ),
          timedOut: () => (rewarded ? 'rewarded' : 'skipped'),
        };
      });
    } finally {
      this.showing = false;
      void this.load('rewarded');
    }
  }

  async showInterstitial(_placement: string): Promise<boolean> {
    if (!this.canRequestAds || this.showing) return false;
    this.showing = true;
    try {
      // A natural break never waits for an ad: show one only if it is already loaded.
      if (!(await this.ready('interstitial', false))) return false;
      return await this.watch<boolean>((finish) => ({
        listeners: [
          [EVENTS.interstitialDismissed, () => { finish(true); }],
          [EVENTS.interstitialFailedToShow, () => { finish(false); }],
        ],
        show: () => this.admob.showInterstitial().catch(() => { finish(false); }),
        timedOut: () => true,
      }));
    } finally {
      this.showing = false;
      void this.load('interstitial');
    }
  }

  privacyOptionsRequired(): boolean {
    return this.privacyRequired;
  }

  async showPrivacyOptions(): Promise<void> {
    await this.admob.showPrivacyOptionsForm();
    // The player may have withdrawn or given consent.
    await this.refreshConsent(false);
  }

  private async refreshConsent(showFormIfRequired: boolean): Promise<void> {
    try {
      let info = await this.admob.requestConsentInfo();
      if (showFormIfRequired && info.status === 'REQUIRED' && info.isConsentFormAvailable) info = await this.admob.showConsentForm();
      this.canRequestAds = info.canRequestAds;
      this.privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch {
      // Consent could not be checked (for example offline): no ads rather than ads without consent.
      this.canRequestAds = false;
    }
  }

  private load(kind: Kind): Promise<boolean> {
    const pending = this.loading[kind];
    if (pending) return pending;
    this.loaded[kind] = false;
    const options = { adId: this.options.units[kind], isTesting: this.options.testing };
    const request = kind === 'rewarded' ? this.admob.prepareRewardVideoAd(options) : this.admob.prepareInterstitial(options);
    const done = request.then(
      () => true,
      () => false,
    );
    this.loading[kind] = done;
    void done.then((ok) => {
      this.loaded[kind] = ok;
      this.loading[kind] = null;
    });
    return done;
  }

  private async ready(kind: Kind, wait: boolean): Promise<boolean> {
    if (this.loaded[kind]) return true;
    const loading = this.load(kind);
    if (!wait) return false;
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => { resolve(false); }, this.options.loadTimeoutMs ?? 8000));
    return Promise.race([loading, timeout]);
  }

  /** Shows an ad and settles once with what its events report. */
  private async watch<T>(
    plan: (finish: (value: T) => void) => {
      listeners: [string, () => unknown][];
      show: () => Promise<unknown>;
      timedOut: () => T;
    },
  ): Promise<T> {
    let settle: (value: T) => void = () => undefined;
    let settled = false;
    const result = new Promise<T>((resolve) => {
      settle = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
    });
    const steps = plan((value) => {
      settle(value);
    });
    // Listen before showing, so no event can be missed.
    const handles = await Promise.all(steps.listeners.map(([event, listener]) => this.admob.addListener(event, listener)));
    const timer = setTimeout(() => {
      settle(steps.timedOut());
    }, this.options.maxShowMs ?? 5 * 60_000);
    try {
      void steps.show();
      return await result;
    } finally {
      clearTimeout(timer);
      for (const handle of handles) void handle.remove();
    }
  }
}
