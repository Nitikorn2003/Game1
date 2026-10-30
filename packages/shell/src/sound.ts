/** A game's sound effects by name. */
export interface Sound<N extends string> {
  play(name: N): void;
  setEnabled(enabled: boolean): void;
}

export const silentSound: Sound<string> = { play: () => undefined, setEnabled: () => undefined };

/** What a sound recipe can play, starting `at` seconds on the audio clock. */
export interface Voice {
  tone(at: number, type: OscillatorType, from: number, to: number, length: number, volume: number): void;
  /** Filtered noise: scrapes, whooshes, cracks. */
  hiss(at: number, filter: BiquadFilterType, from: number, to: number, length: number, volume: number): void;
  /** A short tune, one triangle-wave note after the other. */
  notes(at: number, freqs: readonly number[], gap: number, length: number, volume: number): void;
}

export interface SoundRecipe {
  /** Shortest time between two plays of the sound in seconds, so fast play does not turn into noise. */
  gap: number;
  play(voice: Voice, at: number): void;
}

/**
 * Sound effects synthesized with Web Audio, so a game ships no audio files. Browsers only
 * allow sound after the player touches the page, so the audio starts on the first touch.
 */
export function webSound<N extends string>(recipes: Readonly<Record<N, SoundRecipe>>): Sound<N> {
  const Ctor =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = true;
  const last = new Map<N, number>();

  const ensure = (): AudioContext | null => {
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

  const voice = (c: AudioContext, out: AudioNode): Voice => {
    const tone: Voice['tone'] = (at, type, from, to, length, volume) => {
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
    return {
      tone,
      hiss: (at, filter, from, to, length, volume) => {
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
      },
      notes: (at, freqs, gap, length, volume) => {
        freqs.forEach((f, i) => {
          tone(at + i * gap, 'triangle', f, f, length, volume);
        });
      },
    };
  };

  return {
    play(name) {
      const c = enabled ? ctx : null;
      if (!c || !master || c.state !== 'running') return;
      const t = c.currentTime;
      const recipe = recipes[name];
      if (t - (last.get(name) ?? -1) < recipe.gap) return;
      last.set(name, t);
      recipe.play(voice(c, master), t);
    },
    setEnabled(on) {
      enabled = on;
      if (!on && ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
      if (on && ctx) ensure();
    },
  };
}
