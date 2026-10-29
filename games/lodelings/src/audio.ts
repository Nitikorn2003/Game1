import type { Sound, SoundName } from './game.js';

/**
 * Sound effects synthesized with Web Audio, so the game ships no audio files. Browsers only
 * allow sound after the player touches the page, so the context starts on the first touch.
 */
export function webSound(): Sound {
  type Ctx = AudioContext;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = true;
  const last = new Map<SoundName, number>();

  const ensure = (): Ctx | null => {
    if (!Ctor || !enabled) return null;
    if (!ctx) {
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(
      'pointerdown',
      () => {
        ensure();
      },
      { capture: true, passive: true },
    );
  }

  const tone = (c: Ctx, out: AudioNode, at: number, type: OscillatorType, from: number, to: number, length: number, volume: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.02);
  };

  const hiss = (c: Ctx, out: AudioNode, at: number, filter: BiquadFilterType, from: number, to: number, length: number, volume: number) => {
    if (!noise) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const band = c.createBiquadFilter();
    band.type = filter;
    band.frequency.setValueAtTime(from, at);
    band.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(band).connect(gain).connect(out);
    src.start(at, Math.random() * 0.5, length + 0.05);
  };

  const notes = (c: Ctx, out: AudioNode, at: number, freqs: readonly number[], gap: number, length: number, volume: number) => {
    freqs.forEach((f, i) => {
      tone(c, out, at + i * gap, 'triangle', f, f, length, volume);
    });
  };

  /** Shortest time between two plays of a sound, so fast mining does not turn into noise. */
  const MIN_GAP: Record<SoundName, number> = {
    tap: 0.035,
    crit: 0.05,
    break: 0.09,
    gem: 0.1,
    egg: 0.3,
    hatch: 0.5,
    guardian: 0.5,
    win: 0.5,
    lose: 0.5,
    buy: 0.05,
    skill: 0.15,
    claim: 0.12,
  };

  const play = (name: SoundName, c: Ctx, out: AudioNode, t: number) => {
    switch (name) {
      case 'tap':
        hiss(c, out, t, 'bandpass', 1800, 900, 0.05, 0.35);
        tone(c, out, t, 'sine', 150, 70, 0.07, 0.35);
        break;
      case 'crit':
        hiss(c, out, t, 'bandpass', 2400, 1200, 0.06, 0.4);
        tone(c, out, t, 'sine', 170, 60, 0.09, 0.45);
        tone(c, out, t, 'triangle', 1900, 1600, 0.12, 0.18);
        break;
      case 'break':
        hiss(c, out, t, 'lowpass', 1400, 300, 0.18, 0.5);
        tone(c, out, t, 'sine', 110, 40, 0.16, 0.45);
        break;
      case 'gem':
        tone(c, out, t, 'sine', 1320, 1320, 0.08, 0.2);
        tone(c, out, t + 0.07, 'sine', 1760, 1760, 0.14, 0.2);
        break;
      case 'egg':
        tone(c, out, t, 'triangle', 520, 880, 0.16, 0.22);
        break;
      case 'hatch':
        notes(c, out, t, [523, 659, 784, 1046], 0.08, 0.16, 0.2);
        break;
      case 'guardian':
        tone(c, out, t, 'sawtooth', 90, 70, 0.45, 0.12);
        tone(c, out, t, 'sine', 60, 40, 0.5, 0.4);
        break;
      case 'win':
        notes(c, out, t, [392, 523, 659, 784], 0.09, 0.2, 0.2);
        tone(c, out, t + 0.36, 'triangle', 1046, 1046, 0.4, 0.16);
        break;
      case 'lose':
        tone(c, out, t, 'triangle', 330, 196, 0.45, 0.2);
        break;
      case 'buy':
        tone(c, out, t, 'square', 988, 988, 0.05, 0.06);
        tone(c, out, t + 0.05, 'square', 1319, 1319, 0.1, 0.06);
        break;
      case 'skill':
        hiss(c, out, t, 'bandpass', 400, 2600, 0.28, 0.4);
        break;
      case 'claim':
        tone(c, out, t, 'sine', 880, 880, 0.3, 0.18);
        tone(c, out, t + 0.06, 'sine', 1320, 1320, 0.35, 0.14);
        break;
    }
  };

  return {
    play(name) {
      const c = enabled ? ctx : null;
      if (!c || !master || c.state !== 'running') return;
      const t = c.currentTime;
      if (t - (last.get(name) ?? -1) < MIN_GAP[name]) return;
      last.set(name, t);
      play(name, c, master, t);
    },
    setEnabled(on) {
      enabled = on;
      if (!on && ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
      if (on && ctx) ensure();
    },
  };
}
