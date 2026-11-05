// docs/algorithms.md §5.5 + §9.2: the labeled CRC calibration set (pure; the CLI is scripts/gen-calibration.ts).
// 400 pairs drawn in this order: 320 genuine, then 60 ghosts, then 20 hard negatives
// (so a later count change at the end keeps the stream).
import { mulberry32 } from './rng';

export interface CalibrationPerson {
  last: string;
  first: string;
  middle: string; // '' when missing
  suffix: string | null;
  birthdate: string | null; // null when dropped on one side of a ghost pair
  barangay: string;
}

export interface CalibrationRecord {
  id: string;
  label: 'genuine' | 'ghost';
  a: CalibrationPerson;
  b: CalibrationPerson;
}

export interface CalibrationFixture {
  source: 'simulated';
  generator: 'gen-calibration.ts';
  seed: number;
  alpha: number;
  beta: number;
  counts: { genuine: number; ghost: number; hardNegative: number };
  records: CalibrationRecord[];
}

export const COUNTS = { genuine: 320, ghost: 60, hardNegative: 20 } as const;

/** 24 surnames, including the particle and Sta./Sto. forms that ghosts vary. */
const SURNAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Garcia', 'Villanueva',
  'Mendoza', 'Torres', 'Ramos', 'Aquino', 'Castillo', 'Flores',
  'Gonzales', 'De los Santos', 'San Jose', 'Navarro', 'Del Rosario', 'Mercado',
  'Pascual', 'Domingo', 'Salazar', 'Fernandez', 'Santa Maria', 'Santo Tomas',
];

/** 20 first names, including the "Maria ..." forms that ghosts abbreviate to "Ma. ...". */
const FIRST_NAMES = [
  'Juan', 'Maria', 'Teresa', 'Pedro', 'Ana', 'Lito', 'Ramon', 'Jose', 'Antonio', 'Rosario',
  'Carmela', 'Eduardo', 'Ricardo', 'Lourdes', 'Rodrigo', 'Elena', 'Danilo', 'Maria Teresa', 'Maria Luisa', 'Maria Cristina',
];

const BARANGAYS = ['San Roque', 'Rotonda', 'Poblacion', 'San Isidro', 'Bagong Silang', 'Santo Nino', 'Malanday', 'Concepcion'];

/** Same surname, written the ways a masterlist clerk writes it. */
const PARTICLE_VARIANTS: Array<{ canonical: string; variants: string[] }> = [
  { canonical: 'Dela Cruz', variants: ['De la Cruz', 'Delacruz'] },
  { canonical: 'De los Santos', variants: ['Delos Santos', 'Delossantos'] },
  { canonical: 'Del Rosario', variants: ['Delrosario', 'Del rosario'] },
  { canonical: 'San Jose', variants: ['Sanjose', 'San jose'] },
];

/** `ma` / `sto` / `sta` abbreviations (algorithms.md §3.2 step 5). */
const ABBREVIATIONS: Array<{ field: 'first' | 'last'; full: string; short: string }> = [
  { field: 'first', full: 'Maria Teresa', short: 'Ma. Teresa' },
  { field: 'first', full: 'Maria Luisa', short: 'Ma. Luisa' },
  { field: 'first', full: 'Maria Cristina', short: 'Ma. Cristina' },
  { field: 'last', full: 'Santa Maria', short: 'Sta. Maria' },
  { field: 'last', full: 'Santo Tomas', short: 'Sto. Tomas' },
];

const FIRST_YEAR = 1960;
const LAST_YEAR = 2005;
const DAY_MS = 86_400_000;

type Rand = () => number;

function pick<T>(rand: Rand, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** A different element than `except` (one draw over the remaining items). */
function pickOther<T>(rand: Rand, items: readonly T[], except: T): T {
  const others = items.filter((item) => item !== except);
  return others[Math.floor(rand() * others.length)];
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysInYear(year: number): number {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
}

/** Uniform over 1960-01-01 .. 2005-12-31. */
function birthdate(rand: Rand): string {
  const start = Date.UTC(FIRST_YEAR, 0, 1);
  const days = (Date.UTC(LAST_YEAR + 1, 0, 1) - start) / DAY_MS;
  return isoDate(start + Math.floor(rand() * days) * DAY_MS);
}

/** Uniform within a year drawn from 1960..2005 minus `exceptYear`, so genuine pairs never share a birth year. */
function birthdateInOtherYear(rand: Rand, exceptYear: number): string {
  let year = FIRST_YEAR + Math.floor(rand() * (LAST_YEAR - FIRST_YEAR));
  if (year >= exceptYear) year += 1;
  return isoDate(Date.UTC(year, 0, 1) + Math.floor(rand() * daysInYear(year)) * DAY_MS);
}

function person(rand: Rand): CalibrationPerson {
  return {
    last: pick(rand, SURNAMES),
    first: pick(rand, FIRST_NAMES),
    middle: pick(rand, SURNAMES), // Filipino middle name = mother's maiden surname
    suffix: null,
    birthdate: birthdate(rand),
    barangay: pick(rand, BARANGAYS),
  };
}

/** Two different people: different surnames, or the same surname with a different first name; never the same birth year. */
function genuinePair(rand: Rand): [CalibrationPerson, CalibrationPerson] {
  const a = person(rand);
  const sameSurname = rand() < 0.25;
  const year = Number(a.birthdate?.slice(0, 4));
  const b: CalibrationPerson = {
    last: sameSurname ? a.last : pickOther(rand, SURNAMES, a.last),
    first: sameSurname ? pickOther(rand, FIRST_NAMES, a.first) : pick(rand, FIRST_NAMES),
    middle: pick(rand, SURNAMES),
    suffix: null,
    birthdate: birthdateInOtherYear(rand, year),
    barangay: pick(rand, BARANGAYS),
  };
  return [a, b];
}

/** One person written twice with exactly one variation on side b. */
function ghostPair(rand: Rand): [CalibrationPerson, CalibrationPerson] {
  const variation = Math.floor(rand() * 4);
  const a = person(rand);
  const b = { ...a };
  if (variation === 0) {
    const entry = pick(rand, PARTICLE_VARIANTS);
    a.last = entry.canonical;
    b.last = pick(rand, entry.variants);
  } else if (variation === 1) {
    const entry = pick(rand, ABBREVIATIONS);
    a[entry.field] = entry.full;
    b[entry.field] = entry.short;
  } else if (variation === 2) {
    b.middle = '';
  } else {
    b.birthdate = null;
  }
  return [a, b];
}

/** Father and son: same name and birthdate, Jr vs Sr. Different people, so the label is genuine. */
function hardNegativePair(rand: Rand): [CalibrationPerson, CalibrationPerson] {
  const a = person(rand);
  return [
    { ...a, suffix: 'Jr' },
    { ...a, suffix: 'Sr' },
  ];
}

export function generateCalibration(seed: number): CalibrationFixture {
  const rand = mulberry32(seed);
  const records: CalibrationRecord[] = [];
  const add = (label: CalibrationRecord['label'], [a, b]: [CalibrationPerson, CalibrationPerson]) => {
    records.push({ id: `c${String(records.length + 1).padStart(4, '0')}`, label, a, b });
  };
  for (let i = 0; i < COUNTS.genuine; i++) add('genuine', genuinePair(rand));
  for (let i = 0; i < COUNTS.ghost; i++) add('ghost', ghostPair(rand));
  for (let i = 0; i < COUNTS.hardNegative; i++) add('genuine', hardNegativePair(rand));
  return {
    source: 'simulated',
    generator: 'gen-calibration.ts',
    seed,
    alpha: 0.05,
    beta: 0.02,
    counts: { ...COUNTS },
    records,
  };
}
