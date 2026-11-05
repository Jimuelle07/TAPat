import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateCalibration } from './calibration';
import { REPO_ROOT, fixtureJson } from './fixture-file';

/** The committed fixture; core.autocrlf may check it out as CRLF, the generator writes LF. */
function committed(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

describe('generateCalibration (docs/algorithms.md §9.2)', () => {
  it('is byte-identical across runs for seed 42 and equals the committed fixture', () => {
    const first = fixtureJson(generateCalibration(42));
    expect(fixtureJson(generateCalibration(42))).toBe(first);
    expect(first).toBe(committed('fixtures/calibration/labeled.json'));
  });

  it('has 400 records c0001..c0400 with the documented counts, alpha, beta and source', () => {
    const fixture = generateCalibration(42);
    expect(fixture.source).toBe('simulated');
    expect(fixture.alpha).toBe(0.05);
    expect(fixture.beta).toBe(0.02);
    expect(fixture.counts).toEqual({ genuine: 320, ghost: 60, hardNegative: 20 });
    expect(fixture.records.map((r) => r.id)).toEqual(
      Array.from({ length: 400 }, (_, i) => `c${String(i + 1).padStart(4, '0')}`),
    );
  });

  it('draws 320 genuine pairs with different birth years, then 60 ghosts, then 20 Jr/Sr hard negatives', () => {
    const { records } = generateCalibration(42);

    for (const r of records.slice(0, 320)) {
      expect(r.label).toBe('genuine');
      expect(r.a.birthdate?.slice(0, 4)).not.toBe(r.b.birthdate?.slice(0, 4));
    }
    for (const r of records.slice(320, 380)) expect(r.label).toBe('ghost');
    for (const r of records.slice(380, 400)) {
      expect(r.label).toBe('genuine');
      expect(r.a.suffix).toBe('Jr');
      expect(r.b.suffix).toBe('Sr');
      expect({ ...r.b, suffix: 'Jr' }).toEqual(r.a);
    }
  });
});
