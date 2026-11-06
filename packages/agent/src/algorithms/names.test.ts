import { describe, expect, it } from 'vitest';
import { ageOn, normalizePerson, normalizePlate, normalizeSurname, normalizeToken, stripDiacritics } from './names';
import type { RawName } from './names';

function rawName(overrides: Partial<RawName> = {}): RawName {
  return {
    last: 'Dela Cruz',
    first: 'Juan',
    middle: 'Santos',
    suffix: null,
    birthdate: '1980-03-02',
    plate: 'ABC 1234',
    toda: 'San Roque TODA',
    barangay: 'San Roque',
    ...overrides,
  };
}

describe('surname normalization (docs/algorithms.md §12.1)', () => {
  it("normalizeSurname('Dela Cruz').value is 'delacruz'", () => {
    expect(normalizeSurname('Dela Cruz').value).toBe('delacruz');
  });

  it("normalizeSurname('De la Cruz').value is 'delacruz'", () => {
    expect(normalizeSurname('De la Cruz').value).toBe('delacruz');
  });

  it("normalizeSurname('Delacruz').value is 'delacruz'", () => {
    expect(normalizeSurname('Delacruz').value).toBe('delacruz');
  });

  it("normalizeSurname('Dela Cruz Santos').tokens is ['delacruz', 'santos']", () => {
    expect(normalizeSurname('Dela Cruz Santos').tokens).toEqual(['delacruz', 'santos']);
  });

  it('merges the §3.3 traces exactly', () => {
    expect(normalizeSurname('San Roque').tokens).toEqual(['sanroque']);
    expect(normalizeToken('De los Reyes')).toBe('delosreyes');
    expect(normalizeToken('Maria Theresa')).toBe('maria theresa');
  });
});

describe('person normalization (docs/algorithms.md §12.1)', () => {
  it("normalizePerson({ first: 'Ma. Teresa' }).first is 'maria teresa'", () => {
    expect(normalizePerson(rawName({ first: 'Ma. Teresa' })).first).toBe('maria teresa');
  });

  it("normalizePerson({ last: 'Peña' }).last is 'pena'", () => {
    expect(normalizePerson(rawName({ last: 'Peña' })).last).toBe('pena');
  });

  it("normalizePerson({ last: 'Dela Cruz', suffix: 'Jr.' }).suffix is 'jr'", () => {
    expect(normalizePerson(rawName({ suffix: 'Jr.' })).suffix).toBe('jr');
  });

  it("normalizePerson({ first: 'Sto. Nino' }).first is 'santo nino'", () => {
    expect(normalizePerson(rawName({ first: 'Sto. Nino' })).first).toBe('santo nino');
  });

  it("extracts a suffix written on the surname field: 'Juan Dela Cruz Jr' -> jr", () => {
    const person = normalizePerson(rawName({ last: 'Dela Cruz Jr' }));
    expect(person.suffix).toBe('jr');
    expect(person.last).toBe('delacruz');
    expect(person.tokens).toEqual(['delacruz']);
  });

  it('keeps the middle initial and the raw tokens', () => {
    const person = normalizePerson(rawName({ middle: 'Castro' }));
    expect(person.middle).toBe('castro');
    expect(person.middleInitial).toBe('c');
    expect(person.tokens).toEqual(['delacruz']);
  });

  it('turns empty fields into empty strings and a null initial', () => {
    const person = normalizePerson(rawName({ middle: '', suffix: null }));
    expect(person.middle).toBe('');
    expect(person.middleInitial).toBeNull();
    expect(person.suffix).toBeNull();
  });
});

describe('plate and diacritics helpers (docs/algorithms.md §3.4)', () => {
  it("normalizePlate('abc 1234') is 'ABC1234'", () => {
    expect(normalizePlate('abc 1234')).toBe('ABC1234');
  });

  it("normalizePlate('ABC-1234') is 'ABC1234'", () => {
    expect(normalizePlate('ABC-1234')).toBe('ABC1234');
  });

  it("normalizePlate(' Abc1234 ') is 'ABC1234'", () => {
    expect(normalizePlate(' Abc1234 ')).toBe('ABC1234');
  });

  it("stripDiacritics('Ángeles Peña') is 'Angeles Pena'", () => {
    expect(stripDiacritics('Ángeles Peña')).toBe('Angeles Pena');
  });
});

describe('ageOn (docs/algorithms.md §12.1)', () => {
  it("ageOn('2008-01-02', '2026-11-05') is 18 (the birthday already passed)", () => {
    expect(ageOn('2008-01-02', '2026-11-05')).toBe(18);
  });

  it("ageOn('2008-11-06', '2026-11-05') is 17 (the birthday is tomorrow)", () => {
    expect(ageOn('2008-11-06', '2026-11-05')).toBe(17);
  });

  it("ageOn('', '2026-11-05') is null", () => {
    expect(ageOn('', '2026-11-05')).toBeNull();
  });

  it('returns null for an unparseable date and for a date that does not exist', () => {
    expect(ageOn('not-a-date', '2026-11-05')).toBeNull();
    expect(ageOn('1980-02-30', '2026-11-05')).toBeNull();
  });
});
