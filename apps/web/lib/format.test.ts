import { describe, expect, it } from 'vitest';
import { dateTime, fullName, parseAmount, php, phpTile, shortHash, txHash } from './format';
import { ignoredSpike } from './tranche';

describe('money labels', () => {
  it('goes through formatPhp at the given rate', () => {
    expect(php('11500000000', 10)).toBe('PHP 11,500.00');
    expect(php('350000000', 10)).toBe('PHP 350.00');
    expect(php('350000000', 20)).toBe('PHP 700.00');
  });

  it('drops only an empty .00 on tiles', () => {
    expect(phpTile('45000000000', 10)).toBe('PHP 45,000');
    expect(phpTile('45005000000', 10)).toBe('PHP 45,005');
    expect(phpTile('350500000', 10)).toBe('PHP 350.50');
    expect(phpTile('0', 10)).toBe('PHP 0');
  });
});

describe('parseAmount', () => {
  it('accepts what POST /api/taps accepts, including over-cap amounts', () => {
    expect(parseAmount('350')).toBe(350);
    expect(parseAmount(' 800.50 ')).toBe(800.5);
    expect(parseAmount('100000')).toBe(100000);
  });

  it.each(['', '0', '-5', '1.234', 'abc', '100000.01', '1e3', '.5'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});

describe('names and hashes', () => {
  it('composes a full name without gaps', () => {
    expect(fullName({ firstName: 'Maria Teresa', middleName: 'C', lastName: 'Santos', suffix: null })).toBe('Maria Teresa C. Santos');
    expect(fullName({ firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', suffix: 'Jr.' })).toBe('Juan S. Dela Cruz Jr.');
    expect(fullName({ firstName: 'Ana', middleName: '', lastName: 'Reyes', suffix: '' })).toBe('Ana Reyes');
  });

  it('prefers the fee-bump hash, as the COA export does', () => {
    expect(txHash({ outerHash: 'outer', innerHash: 'inner' } as never)).toBe('outer');
    expect(txHash({ outerHash: null, innerHash: 'inner' } as never)).toBe('inner');
    expect(txHash(undefined)).toBeNull();
  });

  it('shortens a hash and leaves a short one alone', () => {
    expect(shortHash('7f3a000000000000c21e')).toBe('7f3a…c21e');
    expect(shortHash('abc')).toBe('abc');
  });

  it('prints dates in Philippine time whatever the browser zone', () => {
    expect(dateTime(Date.parse('2026-11-30T23:59:59+08:00'))).toBe('Nov 30, 2026 · 11:59 PM');
  });
});

describe('ignoredSpike', () => {
  const series = (prices: number[]) => prices.map((pricePhp, i) => ({ programId: 'p', idx: i + 1, pricePhp, simulated: true, cpRecent: null, mapR: null }));

  it('finds a point above the threshold the price fell back from', () => {
    expect(ignoredSpike(series([58, 66, 58, 59]), 65, false)?.idx).toBe(2);
  });

  it('stays quiet while the price is still above the line, or after firing', () => {
    expect(ignoredSpike(series([58, 66]), 65, false)).toBeNull();
    expect(ignoredSpike(series([58, 66, 58]), 65, true)).toBeNull();
    expect(ignoredSpike(series([]), 65, false)).toBeNull();
  });
});
