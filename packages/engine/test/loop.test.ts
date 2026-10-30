import { describe, expect, it } from 'vitest';
import { FixedStepLoop, type FrameScheduler } from '../src/loop.js';
import { ManualClock, daysBetween, localDayKey } from '../src/time.js';
import { isNewDay } from '../src/daily.js';
import { Emitter } from '../src/events.js';
import { createTranslator, matchLocale } from '../src/i18n.js';

function manualScheduler() {
  const callbacks = new Map<number, () => void>();
  let next = 1;
  const scheduler: FrameScheduler = {
    request(cb) {
      callbacks.set(next, cb);
      return next++;
    },
    cancel(handle) {
      callbacks.delete(handle);
    },
  };
  return {
    scheduler,
    frame() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const cb of pending) cb();
    },
    get pending() {
      return callbacks.size;
    },
  };
}

describe('FixedStepLoop', () => {
  it('runs fixed steps regardless of frame timing and carries the remainder', () => {
    const clock = new ManualClock(1000);
    const frames = manualScheduler();
    const steps: number[] = [];
    const gaps: number[] = [];
    const loop = new FixedStepLoop({
      clock,
      scheduler: frames.scheduler,
      stepMs: 100,
      maxCatchUpMs: 5000,
      onStep: (dt, now) => steps.push(Math.round(dt * 1000) + now),
      onGap: (gap) => gaps.push(gap),
    });
    loop.start();
    clock.advance(250);
    frames.frame();
    expect(steps).toEqual([100 + 1100, 100 + 1200]);
    clock.advance(60);
    frames.frame();
    expect(steps).toHaveLength(3);
    clock.advance(4000);
    frames.frame();
    expect(steps).toHaveLength(43);
    expect(gaps).toEqual([]);
  });

  it('hands long gaps to onGap and ignores a clock that goes backwards', () => {
    const clock = new ManualClock(0);
    const frames = manualScheduler();
    let steps = 0;
    const gaps: number[] = [];
    const loop = new FixedStepLoop({
      clock,
      scheduler: frames.scheduler,
      stepMs: 100,
      maxCatchUpMs: 1000,
      onStep: () => (steps += 1),
      onGap: (gap) => gaps.push(gap),
    });
    loop.start();
    clock.advance(3_600_000);
    frames.frame();
    expect(gaps).toEqual([3_600_000]);
    expect(steps).toBe(0);
    clock.advance(-50_000);
    frames.frame();
    expect(steps).toBe(0);
    clock.advance(200);
    frames.frame();
    expect(steps).toBe(2);
  });

  it('stops cleanly', () => {
    const frames = manualScheduler();
    const loop = new FixedStepLoop({
      clock: new ManualClock(),
      scheduler: frames.scheduler,
      stepMs: 100,
      maxCatchUpMs: 1000,
      onStep: () => undefined,
      onGap: () => undefined,
    });
    loop.start();
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
    frames.frame();
    expect(frames.pending).toBe(0);
  });
});

describe('days', () => {
  it('uses the local calendar day', () => {
    // 2026-10-29 20:00 UTC is already 2026-10-30 in Bangkok (UTC+7).
    const t = Date.UTC(2026, 9, 29, 20, 0, 0);
    expect(localDayKey(t, 0)).toBe('2026-10-29');
    expect(localDayKey(t, -420)).toBe('2026-10-30');
    expect(daysBetween('2026-10-29', '2026-11-02')).toBe(4);
    expect(daysBetween('2026-11-02', '2026-10-29')).toBe(-4);
  });

  it('allows a daily claim only on a later day', () => {
    expect(isNewDay(null, '2026-10-29')).toBe(true);
    expect(isNewDay('2026-10-29', '2026-10-29')).toBe(false);
    expect(isNewDay('2026-10-29', '2026-10-30')).toBe(true);
    expect(isNewDay('2026-10-29', '2026-10-01')).toBe(false);
  });
});

describe('Emitter and i18n', () => {
  it('delivers events until unsubscribed', () => {
    const events = new Emitter<{ hit: number }>();
    const seen: number[] = [];
    const off = events.on('hit', (n) => seen.push(n));
    events.emit('hit', 1);
    off();
    events.emit('hit', 2);
    expect(seen).toEqual([1]);
  });

  it('translates with fallback and parameters', () => {
    const base = { hello: 'Hello {name}', bye: 'Bye' } as const;
    const th = createTranslator<keyof typeof base>(base, { hello: 'สวัสดี {name}' }, 'th');
    expect(th.t('hello', { name: 'Ploy' })).toBe('สวัสดี Ploy');
    expect(th.t('bye')).toBe('Bye');
    expect(th.t('hello')).toBe('สวัสดี {name}');
    expect(matchLocale(['th-TH', 'en-US'], ['en', 'th'], 'en')).toBe('th');
    expect(matchLocale(['fr-FR'], ['en', 'th'], 'en')).toBe('en');
  });
});
