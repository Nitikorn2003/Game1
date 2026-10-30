export type NumberStyle = 'short' | 'scientific';

const NAMED = ['', 'K', 'M', 'B', 'T'];

/** Suffix for 10^(3 * tier): K, M, B, T, then aa, ab, ... az, ba, ... */
export function tierSuffix(tier: number): string {
  if (tier < NAMED.length) return NAMED[tier] ?? '';
  const index = tier - NAMED.length;
  return String.fromCharCode(97 + Math.floor(index / 26)) + String.fromCharCode(97 + (index % 26));
}

/**
 * Formats a game number with three significant digits. Digits are cut, never rounded up,
 * so the screen never shows a player more than they have (999,999 is "999K", not "1.00M").
 */
export function formatNumber(value: number, style: NumberStyle = 'short'): string {
  if (Number.isNaN(value)) return '0';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) {
    if (abs < 10 && !Number.isInteger(abs)) return sign + trimZeros(cut(abs, 1).toFixed(1));
    return sign + String(Math.min(999, cut(abs, 0)));
  }
  let exponent = Math.floor(Math.log10(abs));
  // log10 can land one below the true exponent for exact powers of ten.
  if (abs >= 10 ** (exponent + 1)) exponent += 1;
  if (style === 'scientific' && exponent >= 6) {
    let mantissa = cut(abs / 10 ** exponent, 2);
    if (mantissa >= 10) {
      exponent += 1;
      mantissa = cut(mantissa / 10, 2);
    }
    return `${sign}${mantissa.toFixed(2)}e${exponent}`;
  }
  let tier = Math.floor(exponent / 3);
  let scaled = abs / 10 ** (tier * 3);
  // Values just under a boundary (1e23 is stored as 9.999...e22) can cut to "100.0" or
  // "1000"; step to the next bracket and format again.
  for (;;) {
    const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    const shown = cut(scaled, decimals);
    if (shown >= 1000) {
      tier += 1;
      scaled = shown / 1000;
    } else if ((shown < 10 ? 2 : shown < 100 ? 1 : 0) !== decimals) {
      scaled = shown;
    } else {
      return `${sign}${shown.toFixed(decimals)}${tierSuffix(tier)}`;
    }
  }
}

function cut(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // The small epsilon keeps 1.23 (stored as 1.2299999) from showing as 1.22.
  return Math.floor(value * factor + 1e-9) / factor;
}

function trimZeros(text: string): string {
  return text.replace(/\.0+$/, '');
}

export interface DurationUnits {
  d: string;
  h: string;
  m: string;
  s: string;
}

const SHORT_UNITS: DurationUnits = { d: 'd', h: 'h', m: 'm', s: 's' };

/** "45s", "3m 05s", "2h 07m", "3d 4h"; other languages pass their own unit labels. */
export function formatDuration(totalSeconds: number, units: DurationUnits = SHORT_UNITS): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (days > 0) return `${days}${units.d} ${hours}${units.h}`;
  if (hours > 0) return `${hours}${units.h} ${pad(minutes)}${units.m}`;
  if (minutes > 0) return `${minutes}${units.m} ${pad(seconds)}${units.s}`;
  return `${seconds}${units.s}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
