import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMOB_TEST_UNITS, AdMobAds, type AdMobPlugin } from '../src/admob.js';

type Script = 'reward_then_close' | 'close_early' | 'close_then_reward' | 'fail_to_show' | 'never_close';

/** Behaves like @capacitor-community/admob on Android, driven by a script per ad. */
class FakeAdMob implements AdMobPlugin {
  consent = { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
  consentAfterForm = { status: 'OBTAINED', isConsentFormAvailable: true, canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' };
  consentFails = false;
  loadFails = false;
  loadDelayMs = 0;
  script: Script = 'reward_then_close';
  calls: string[] = [];
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private prepared = { rewarded: false, interstitial: false };

  initialize(options?: { initializeForTesting?: boolean }): Promise<void> {
    this.calls.push(`initialize testing=${String(options?.initializeForTesting)}`);
    return Promise.resolve();
  }
  requestConsentInfo() {
    this.calls.push('requestConsentInfo');
    return this.consentFails ? Promise.reject(new Error('offline')) : Promise.resolve(this.consent);
  }
  showConsentForm() {
    this.calls.push('showConsentForm');
    this.consent = this.consentAfterForm;
    return Promise.resolve(this.consent);
  }
  showPrivacyOptionsForm(): Promise<void> {
    this.calls.push('showPrivacyOptionsForm');
    return Promise.resolve();
  }
  prepareRewardVideoAd(options: { adId: string; isTesting?: boolean }): Promise<unknown> {
    return this.prepare('rewarded', options);
  }
  prepareInterstitial(options: { adId: string; isTesting?: boolean }): Promise<unknown> {
    return this.prepare('interstitial', options);
  }
  showRewardVideoAd(): Promise<unknown> {
    this.calls.push('showRewardVideoAd');
    if (!this.prepared.rewarded) return Promise.reject(new Error('No Reward Video Ad can be shown.'));
    this.prepared.rewarded = false;
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.script === 'fail_to_show') { this.emit('onRewardedVideoAdFailedToShow', { code: 1 }); return; }
        if (this.script === 'reward_then_close') {
          this.emit('onRewardedVideoAdReward', { type: 'coins', amount: 1 });
          resolve({ type: 'coins', amount: 1 });
          this.emit('onRewardedVideoAdDismissed', undefined);
        }
        if (this.script === 'close_then_reward') {
          this.emit('onRewardedVideoAdDismissed', undefined);
          setTimeout(() => {
            this.emit('onRewardedVideoAdReward', { type: 'coins', amount: 1 });
            resolve({ type: 'coins', amount: 1 });
          }, 100);
        }
        // The plugin never settles this promise when the ad is closed before the reward.
        if (this.script === 'close_early') this.emit('onRewardedVideoAdDismissed', undefined);
      }, 1000);
    });
  }
  showInterstitial(): Promise<void> {
    this.calls.push('showInterstitial');
    if (!this.prepared.interstitial) return Promise.reject(new Error('not prepared'));
    this.prepared.interstitial = false;
    setTimeout(() => {
      if (this.script === 'fail_to_show') this.emit('interstitialAdFailedToShow', { code: 1 });
      else if (this.script !== 'never_close') this.emit('interstitialAdDismissed', undefined);
    }, 1000);
    return Promise.resolve();
  }
  addListener(eventName: string, listener: (data: unknown) => void) {
    const set = this.listeners.get(eventName) ?? new Set();
    set.add(listener);
    this.listeners.set(eventName, set);
    return Promise.resolve({
      remove: () => {
        set.delete(listener);
        return Promise.resolve();
      },
    });
  }
  listenerCount(): number {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
  private emit(eventName: string, data: unknown): void {
    for (const listener of this.listeners.get(eventName) ?? []) listener(data);
  }
  private prepare(kind: 'rewarded' | 'interstitial', options: { adId: string; isTesting?: boolean }): Promise<unknown> {
    this.calls.push(`prepare ${kind} ${options.adId} testing=${String(options.isTesting)}`);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.loadFails) {
          reject(new Error('No fill'));
          return;
        }
        this.prepared[kind] = true;
        resolve({ adUnitId: options.adId });
      }, this.loadDelayMs);
    });
  }
}

const units = { rewarded: ADMOB_TEST_UNITS.rewarded, interstitial: ADMOB_TEST_UNITS.interstitial };

async function started(fake: FakeAdMob, testing = true): Promise<AdMobAds> {
  const ads = new AdMobAds(fake, { units, testing });
  await ads.init();
  await vi.advanceTimersByTimeAsync(10);
  return ads;
}

async function settle<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AdMob ads', () => {
  it('asks for consent first, then starts the ads SDK in test mode and loads both ads', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    await started(fake);
    expect(fake.calls).toEqual([
      'requestConsentInfo',
      'initialize testing=true',
      `prepare rewarded ${units.rewarded} testing=true`,
      `prepare interstitial ${units.interstitial} testing=true`,
    ]);
  });

  it('shows the consent form when consent is required and offers privacy options afterwards', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    fake.consent = { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: 'UNKNOWN' };
    const ads = await started(fake);
    expect(fake.calls.slice(0, 3)).toEqual(['requestConsentInfo', 'showConsentForm', 'initialize testing=true']);
    expect(ads.privacyOptionsRequired()).toBe(true);
    await ads.showPrivacyOptions();
    expect(fake.calls).toContain('showPrivacyOptionsForm');
  });

  it('requests no ads at all when consent does not allow it or cannot be checked', async () => {
    vi.useFakeTimers();
    const refused = new FakeAdMob();
    refused.consent = { status: 'REQUIRED', isConsentFormAvailable: false, canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' };
    const a = await started(refused);
    expect(await a.showRewarded('gem_crate')).toBe('unavailable');
    const offline = new FakeAdMob();
    offline.consentFails = true;
    const b = await started(offline);
    expect(await b.showInterstitial('break')).toBe(false);
    expect([...refused.calls, ...offline.calls].some((c) => c.startsWith('initialize') || c.startsWith('prepare'))).toBe(false);
  });

  it('pays a rewarded ad only when the SDK reports the reward', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    const ads = await started(fake);
    expect(await settle(ads.showRewarded('gem_crate'))).toBe('rewarded');
    fake.script = 'close_early';
    expect(await settle(ads.showRewarded('gem_crate'))).toBe('skipped');
    fake.script = 'fail_to_show';
    expect(await settle(ads.showRewarded('gem_crate'))).toBe('unavailable');
    expect(fake.listenerCount()).toBe(0);
  });

  it('still pays a reward reported just after the ad closed', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    fake.script = 'close_then_reward';
    const ads = await started(fake);
    expect(await settle(ads.showRewarded('gem_crate'))).toBe('rewarded');
  });

  it('waits a little for a rewarded ad that is still loading, then gives up', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    fake.loadDelayMs = 3000;
    const slow = new AdMobAds(fake, { units, testing: true, loadTimeoutMs: 5000 });
    await slow.init();
    const first = slow.showRewarded('gem_crate');
    // The next ad, loaded after this one, takes longer than a player waits.
    fake.loadDelayMs = 60_000;
    expect(await settle(first)).toBe('rewarded');
    const second = slow.showRewarded('gem_crate');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await second).toBe('unavailable');
    expect(fake.calls.filter((c) => c === 'showRewardVideoAd')).toHaveLength(1);
  });

  it('shows an ad break only when one is already loaded, and never two at once', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    fake.loadDelayMs = 2000;
    const ads = new AdMobAds(fake, { units, testing: false });
    await ads.init();
    expect(await ads.showInterstitial('break')).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    const first = ads.showInterstitial('break');
    const second = ads.showInterstitial('break');
    expect(await settle(first)).toBe(true);
    expect(await second).toBe(false);
    expect(fake.calls.filter((c) => c === 'showInterstitial')).toHaveLength(1);
    expect(fake.calls).toContain(`prepare interstitial ${units.interstitial} testing=false`);
  });

  it('gives up on an ad that never reports closing', async () => {
    vi.useFakeTimers();
    const fake = new FakeAdMob();
    const ads = new AdMobAds(fake, { units, testing: true, maxShowMs: 60_000 });
    await ads.init();
    await vi.advanceTimersByTimeAsync(10);
    fake.script = 'never_close';
    expect(await settle(ads.showInterstitial('break'), 61_000)).toBe(true);
    expect(fake.listenerCount()).toBe(0);
  });
});
