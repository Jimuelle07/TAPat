import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHP_PER_XLM,
  formatPhp,
  phpToStroops,
  STROOPS_PER_XLM,
  stroopsToPhp,
  stroopsToXlmString,
} from './src/money';

describe('money', () => {
  it('uses the demo rate of 10 PHP per XLM and 10^7 stroops per XLM', () => {
    expect(DEFAULT_PHP_PER_XLM).toBe(10);
    expect(STROOPS_PER_XLM).toBe(10_000_000n);
  });

  it('converts 350 PHP -> 35 XLM -> 350000000 stroops -> "₱350.00"', () => {
    const stroops = phpToStroops(350);
    expect(stroops).toBe(350_000_000n);
    expect(stroops / STROOPS_PER_XLM).toBe(35n);
    expect(formatPhp(stroops)).toBe('₱350.00');
    expect(stroopsToPhp(stroops)).toBe(350);
  });

  it('has no float drift on 480 and 1,500', () => {
    expect(phpToStroops(480)).toBe(480_000_000n);
    expect(phpToStroops(1500)).toBe(1_500_000_000n);
    expect(formatPhp(480_000_000n)).toBe('₱480.00');
    expect(formatPhp('1500000000')).toBe('₱1,500.00');
    expect(phpToStroops(0.1 + 0.2)).toBe(300_000n); // 0.30000000000000004 PHP rounds to 0.3 PHP worth of stroops
    expect(phpToStroops(122.4)).toBe(122_400_000n);
  });

  it('formats demo totals with grouping, and without the symbol on request', () => {
    expect(formatPhp(3_190_000_000n)).toBe('₱3,190.00');
    expect(formatPhp('10000000000', { withSymbol: false })).toBe('10,000.00');
    expect(formatPhp(0n)).toBe('₱0.00');
    expect(formatPhp(1_150_000_000n, { phpPerXlm: 20 })).toBe('₱2,300.00');
  });

  it('rounds half up to the centavo', () => {
    expect(formatPhp(5_000n)).toBe('₱0.01'); // exactly half a centavo
    expect(formatPhp(4_999n)).toBe('₱0.00');
    expect(stroopsToPhp(1_234_565_000n)).toBe(1234.57);
    expect(formatPhp(-5_000n)).toBe('-₱0.01');
  });

  it('produces the Velo checkout amount with exactly 2 decimals', () => {
    expect(stroopsToXlmString(10_000_000_000n)).toBe('1000.00');
    expect(stroopsToXlmString(phpToStroops(10000))).toBe('1000.00');
    expect(stroopsToXlmString('350000000')).toBe('35.00');
    expect(stroopsToXlmString(123_456_789n)).toBe('12.35');
  });

  it('rejects non-integer stroop strings and a non-positive rate', () => {
    expect(() => formatPhp('12.5')).toThrow(RangeError);
    expect(() => phpToStroops(1, 0)).toThrow(RangeError);
    expect(() => phpToStroops(Number.NaN)).toThrow(RangeError);
  });
});
