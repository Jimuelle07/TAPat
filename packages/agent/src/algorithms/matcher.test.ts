import { describe, expect, it } from 'vitest';
import {
  applyHardRules,
  decideIntake,
  genuinenessScores,
  jaroWinkler,
  middleInitialScore,
  pairProbability,
  sigmoid,
  toMatchRecord,
} from './matcher';
import type { MatchRecord } from './matcher';
import type { PersonInput } from './matcher';

function record(overrides: Partial<PersonInput> = {}): MatchRecord {
  return toMatchRecord({
    last: 'Dela Cruz',
    first: 'Juan',
    middle: 'Santos',
    suffix: null,
    birthdate: '1980-03-02',
    plate: 'ABC 1234',
    barangay: 'San Roque',
    ...overrides,
  });
}

describe('Jaro-Winkler (docs/algorithms.md §12.2)', () => {
  it("jaroWinkler('martha', 'marhta') is 0.961 ± 0.0005", () => {
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
  });

  it("jaroWinkler('dixon', 'dicksonx') is 0.813 ± 0.0005", () => {
    expect(jaroWinkler('dixon', 'dicksonx')).toBeCloseTo(0.813, 3);
  });

  it("jaroWinkler('juan', 'juan') is 1", () => {
    expect(jaroWinkler('juan', 'juan')).toBe(1);
  });

  it("jaroWinkler('a', 'b') is 0", () => {
    expect(jaroWinkler('a', 'b')).toBe(0);
  });

  it('caps the prefix boost at 4 characters', () => {
    // "abcdef" vs "abcdex" shares a 5-character prefix; only 4 count towards the boost. Uncapped this would be 0.9444.
    expect(jaroWinkler('abcdef', 'abcdex')).toBeCloseTo(0.9333333, 6);
  });
});

describe('pair probability (docs/algorithms.md §12.2)', () => {
  it('scores every Dela Cruz / De la Cruz / Delacruz pairing at or above 0.9', () => {
    const variants = [record(), record({ last: 'De la Cruz' }), record({ last: 'Delacruz' })];
    for (let i = 0; i < variants.length; i += 1) {
      for (let j = i + 1; j < variants.length; j += 1) {
        const p = pairProbability(variants[i] as MatchRecord, variants[j] as MatchRecord);
        expect(p).toBeGreaterThanOrEqual(0.9);
        expect(p).toBeCloseTo(0.99593, 5);
      }
    }
  });

  it('a Jr/Sr pair with the same name and birthdate scores below 0.5 (the suffix penalty lands after the sigmoid)', () => {
    const jr = record({ suffix: 'Jr' });
    const sr = record({ suffix: 'Sr' });
    const p = pairProbability(jr, sr);
    expect(p).toBeLessThan(0.5);
    expect(p).toBeCloseTo(0.199186, 6);
  });

  it('scores a surname-only match lower than a full match', () => {
    const other = record({ first: 'Pedro', middle: 'Reyes', birthdate: '1975-06-15' });
    expect(pairProbability(record(), other)).toBeLessThan(0.05);
  });

  it('middleInitialScore is 1 / 0.5 / 0', () => {
    expect(middleInitialScore('c', 'c')).toBe(1);
    expect(middleInitialScore(null, 'c')).toBe(0.5);
    expect(middleInitialScore('c', 's')).toBe(0);
  });

  it('sigmoid is guarded past ±30', () => {
    expect(sigmoid(-40)).toBe(0);
    expect(sigmoid(40)).toBe(1);
    expect(sigmoid(0)).toBe(0.5);
  });
});

describe('genuineness scores (docs/algorithms.md §4.3)', () => {
  it('scores two identical records [1, 1 - p]: p tops out at sigmoid(5.5) = 0.99593, so the duplicate scores 0.00407', () => {
    expect(genuinenessScores([record(), record()])).toEqual([1, 0.00407]);
  });

  it("scores the first row 1 and a later row 1 - max(p) against the rows before it", () => {
    const rows = [record(), record({ last: 'Reyes', first: 'Pedro' }), record({ last: 'De la Cruz' })];
    const scores = genuinenessScores(rows);
    expect(scores[0]).toBe(1);
    expect(scores[1]).toBeCloseTo(1 - pairProbability(rows[1] as MatchRecord, rows[0] as MatchRecord), 6);
    // The third row is the ghost of the first: its closest earlier record is row 0, not row 1.
    expect(scores[2]).toBeCloseTo(1 - pairProbability(rows[2] as MatchRecord, rows[0] as MatchRecord), 6);
  });

  it('scores an unrelated pair just below 1 (only an exactly zero pair probability ever reaches 1)', () => {
    const other = record({ last: 'Xyzzy', first: 'Qwerty', middle: '', birthdate: '1988-12-05', barangay: 'Baguio' });
    expect(genuinenessScores([record(), other])).toEqual([1, 0.999965]);
  });
});

describe('hard rules (docs/algorithms.md §4.4)', () => {
  it('blocks a record aged 17 with UNDERAGE', () => {
    const rows = [record(), record({ last: 'Tolentino', first: 'Jose', birthdate: '2010-05-12', plate: '' })];
    expect(applyHardRules(rows, { programStartDate: '2026-11-05' }).get(1)).toBe('UNDERAGE');
  });

  it('does not block a record aged exactly 18', () => {
    const rows = [record({ birthdate: '2008-11-05' })];
    expect(applyHardRules(rows, { programStartDate: '2026-11-05' }).size).toBe(0);
  });

  it('blocks both records when one plate is on two different people (PLATE_MULTI_NAME)', () => {
    const rows = [record(), record({ first: 'Pedro', middle: 'Reyes', birthdate: '1975-06-15' })];
    const blocked = applyHardRules(rows, { programStartDate: '2026-11-05' });
    expect(blocked.get(0)).toBe('PLATE_MULTI_NAME');
    expect(blocked.get(1)).toBe('PLATE_MULTI_NAME');
  });

  it('blocks only the later record when one plate is on the same person twice (DUPLICATE_PLATE)', () => {
    const rows = [record(), record({ last: 'De la Cruz' })];
    const blocked = applyHardRules(rows, { programStartDate: '2026-11-05' });
    expect(blocked.has(0)).toBe(false);
    expect(blocked.get(1)).toBe('DUPLICATE_PLATE');
  });

  it('lets UNDERAGE win over a plate rule on the same record', () => {
    const rows = [record(), record({ last: 'De la Cruz', birthdate: '2010-05-12' })];
    expect(applyHardRules(rows, { programStartDate: '2026-11-05' }).get(1)).toBe('UNDERAGE');
  });

  it('never groups an empty plate', () => {
    const rows = [record({ plate: '' }), record({ plate: null, last: 'Reyes', first: 'Pedro' })];
    expect(applyHardRules(rows, { programStartDate: '2026-11-05' }).size).toBe(0);
  });
});

describe('intake decisions (docs/algorithms.md §4.5)', () => {
  const thresholds = { programStartDate: '2026-11-05', lambdaLo: 0.62, lambdaHi: 0.81 };

  // No plate, so the plate rules stay out of the way and the CRC thresholds decide the duplicate.
  const noPlate = (overrides: Partial<PersonInput> = {}): MatchRecord => record({ plate: '', ...overrides });

  it('approves the first row, rejects its duplicate and names the closest earlier record', () => {
    const decisions = decideIntake([noPlate(), noPlate()], thresholds);
    expect(decisions[0]).toMatchObject({ index: 0, status: 'approved', score: 1, ruleCode: null, duplicateOfIndex: null });
    expect(decisions[0]?.reason).toBe('genuineness 1 at or above 0.81');
    expect(decisions[1]).toMatchObject({
      index: 1,
      status: 'rejected',
      score: 0.00407,
      ruleCode: null,
      duplicateOfIndex: 0,
    });
    expect(decisions[1]?.reason).toBe(
      'genuineness 0.00407 below reject threshold 0.62; closest earlier record 0 at p=0.99593',
    );
  });

  it('puts a near-duplicate of a different person in the uncertain band', () => {
    const rows = [
      record({
        last: 'Santos',
        first: 'Maria Teresa',
        middle: 'C',
        birthdate: '1979-07-19',
        plate: 'XYZ 7788',
        barangay: 'Rotonda',
      }),
      record({
        last: 'Santos',
        first: 'Maria Theresa',
        middle: 'C',
        birthdate: '1982-03-04',
        plate: 'BCD 1357',
        barangay: 'Concepcion',
      }),
    ];
    const decisions = decideIntake(rows, thresholds);
    expect(decisions[1]?.status).toBe('uncertain');
    expect(decisions[1]?.reason).toBe('genuineness 0.741513 between 0.62 and 0.81');
    expect(decisions[1]?.duplicateOfIndex).toBe(0);
  });

  it('reports the duplicate-plate reason with the kept record', () => {
    const decisions = decideIntake([record(), record({ last: 'De la Cruz' })], thresholds);
    expect(decisions[1]?.ruleCode).toBe('DUPLICATE_PLATE');
    expect(decisions[1]?.reason).toBe('plate ABC1234 duplicates record 0');
  });

  it('reports the underage reason with the age at program start', () => {
    const decisions = decideIntake(
      [record(), record({ last: 'Tolentino', first: 'Jose', birthdate: '2010-05-12', plate: 'YZA 9012' })],
      thresholds,
    );
    expect(decisions[1]?.ruleCode).toBe('UNDERAGE');
    expect(decisions[1]?.reason).toBe('age 16 is below 18 on 2026-11-05');
  });

  it('reports the multi-name plate reason on every record of the group', () => {
    const rows = [record(), record({ last: 'Navarro', first: 'Elena', birthdate: '1988-12-05' })];
    const decisions = decideIntake(rows, thresholds);
    expect(decisions.map((d) => d.ruleCode)).toEqual(['PLATE_MULTI_NAME', 'PLATE_MULTI_NAME']);
    expect(decisions[0]?.reason).toBe('plate ABC1234 appears on records of different people');
  });

  it('decides every row with an empty uncertain band (lambdaLo === lambdaHi)', () => {
    const decisions = decideIntake([noPlate(), noPlate(), noPlate({ last: 'Reyes', first: 'Pedro' })], {
      programStartDate: '2026-11-05',
      lambdaLo: 0.05,
      lambdaHi: 0.05,
    });
    expect(decisions.map((d) => d.status)).toEqual(['approved', 'rejected', 'approved']);
  });
});

describe('toMatchRecord', () => {
  it('normalizes the row fields and maps missing values to null', () => {
    const r = toMatchRecord({
      last: 'Peña',
      first: 'Ma. Teresa',
      middle: '',
      suffix: 'Jr.',
      birthdate: '',
      plate: 'abc 1234',
      barangay: '',
    });
    expect(r.last).toBe('pena');
    expect(r.first).toBe('maria teresa');
    expect(r.middle).toBe('');
    expect(r.middleInitial).toBeNull();
    expect(r.suffix).toBe('jr');
    expect(r.birthdate).toBeNull();
    expect(r.barangay).toBeNull();
    expect(r.plate).toBe('ABC1234');
  });
});
