import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, tierSuffix } from '../src/format.js';

describe('formatNumber', () => {
  it('shows small numbers as whole numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(999.99)).toBe('999');
    expect(formatNumber(2.56)).toBe('2.5');
    expect(formatNumber(3)).toBe('3');
  });

  it('does not let float error cut a digit off', () => {
    expect(formatNumber(Math.exp(Math.log(5)))).toBe('5');
    expect(formatNumber(6.8 - 1e-13)).toBe('6.8');
    expect(formatNumber(41.99999999999)).toBe('42');
  });

  it('uses three significant digits with a suffix and never rounds up', () => {
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(12_345)).toBe('12.3K');
    expect(formatNumber(999_999)).toBe('999K');
    expect(formatNumber(1_000_000)).toBe('1.00M');
    expect(formatNumber(4.567e9)).toBe('4.56B');
    expect(formatNumber(1e12)).toBe('1.00T');
    expect(formatNumber(1e15)).toBe('1.00aa');
    expect(formatNumber(2.5e18)).toBe('2.50ab');
    expect(formatNumber(1.23e15)).toBe('1.23aa');
  });

  it('handles exact powers of ten across the whole double range', () => {
    for (let e = 3; e <= 306; e++) {
      const text = formatNumber(10 ** e);
      expect(text, `1e${e}`).toMatch(/^(1\.00|10\.0|100)[a-zA-Z]+$/);
    }
    expect(formatNumber(Number.MAX_VALUE)).toMatch(/^[0-9.]+[a-z]{2}$/);
  });

  it('supports scientific style and odd inputs', () => {
    expect(formatNumber(1.234e45, 'scientific')).toBe('1.23e45');
    expect(formatNumber(12_345, 'scientific')).toBe('12.3K');
    expect(formatNumber(-1500)).toBe('-1.50K');
    expect(formatNumber(Number.NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('∞');
  });

  it('names tiers in order', () => {
    expect(['', 'K', 'M', 'B', 'T'].map((_, i) => tierSuffix(i))).toEqual(['', 'K', 'M', 'B', 'T']);
    expect(tierSuffix(5)).toBe('aa');
    expect(tierSuffix(30)).toBe('az');
    expect(tierSuffix(31)).toBe('ba');
  });
});

describe('formatDuration', () => {
  it('picks the two largest units', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45.9)).toBe('45s');
    expect(formatDuration(185)).toBe('3m 05s');
    expect(formatDuration(2 * 3600 + 7 * 60 + 9)).toBe('2h 07m');
    expect(formatDuration(3 * 86_400 + 4 * 3600)).toBe('3d 4h');
    expect(formatDuration(-5)).toBe('0s');
  });

  it('uses the unit labels it is given', () => {
    const thai = { d: ' วัน', h: ' ชม.', m: ' นาที', s: ' วิ' };
    expect(formatDuration(185, thai)).toBe('3 นาที 05 วิ');
    expect(formatDuration(2 * 3600 + 7 * 60, thai)).toBe('2 ชม. 07 นาที');
  });
});
