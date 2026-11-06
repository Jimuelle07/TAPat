// Filipino name normalization (docs/algorithms.md §3): one canonical string per field, a middle initial and an
// extracted suffix. Pure and deterministic — no clock, no I/O, no locale-aware comparison.

export interface RawName {
  last: string;
  first: string;
  middle: string;
  suffix: string | null;
  birthdate: string;
  plate: string;
  toda: string;
  barangay: string;
}

/** The five suffixes §3.2 step 6 extracts; any other value normalizes to `null`. */
export type NameSuffix = 'jr' | 'sr' | 'ii' | 'iii' | 'iv';

export interface NormalizedName {
  /** Canonical surname, space-separated after particle merging. */
  last: string;
  first: string;
  middle: string;
  /** First character of the canonical middle name, or `null` when the middle name is empty. */
  middleInitial: string | null;
  suffix: NameSuffix | null;
  /** Canonical surname tokens, kept for the UI and debugging. */
  tokens: string[];
}

/** §3.2 step 6. */
const SUFFIXES: Readonly<Record<string, true>> = { jr: true, sr: true, ii: true, iii: true, iv: true };

/** §3.3. A run is a maximal sequence of consecutive particle tokens. */
const PARTICLES: Readonly<Record<string, true>> = {
  de: true,
  del: true,
  dela: true,
  la: true,
  los: true,
  delos: true,
  san: true,
};

/** §3.2 step 5, applied token by token after punctuation removal. */
const ABBREVIATIONS: Readonly<Record<string, string>> = { ma: 'maria', sto: 'santo', sta: 'santa' };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Ymd {
  year: number;
  month: number;
  day: number;
}

/** NFD-decompose, then drop every combining mark, so `ñ` → `n` and `é` → `e`. */
export function stripDiacritics(input: string): string {
  return (input ?? '').normalize('NFD').replace(/\p{M}+/gu, '');
}

/** §3.3: concatenate each particle run with the token that follows it. */
function mergeParticles(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] as string;
    if (PARTICLES[token] !== true) {
      out.push(token);
      i += 1;
      continue;
    }
    let run = '';
    while (i < tokens.length && PARTICLES[tokens[i] as string] === true) {
      run += tokens[i] as string;
      i += 1;
    }
    if (i < tokens.length) {
      run += tokens[i] as string;
      i += 1;
    }
    out.push(run);
  }
  return out;
}

/** §3.2 steps 1–5: diacritics, lowercase, punctuation to spaces, split, abbreviations. */
function canonicalTokens(raw: string): string[] {
  const cleaned = stripDiacritics(raw).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens: string[] = [];
  for (const token of cleaned.split(/\s+/)) {
    if (token === '') continue;
    tokens.push(ABBREVIATIONS[token] ?? token);
  }
  return tokens;
}

interface FieldParts {
  tokens: string[];
  suffix: NameSuffix | null;
}

/** §3.2 steps 6–7: pop trailing suffixes (each pop overwrites, so the leftmost of a run survives), merge particles. */
function fieldParts(raw: string): FieldParts {
  const tokens = canonicalTokens(raw);
  let suffix: NameSuffix | null = null;
  while (tokens.length > 0 && SUFFIXES[tokens[tokens.length - 1] as string] === true) {
    suffix = tokens.pop() as NameSuffix;
  }
  return { tokens: mergeParticles(tokens), suffix };
}

/** Steps 1–7 on one field. A trailing suffix token is dropped here; `normalizePerson` reports it. */
export function normalizeToken(raw: string): string {
  return fieldParts(raw).tokens.join(' ');
}

/** `Dela Cruz`, `De la Cruz` and `Delacruz` all become `{ value: 'delacruz', tokens: ['delacruz'] }`. */
export function normalizeSurname(raw: string): { value: string; tokens: string[] } {
  const { tokens } = fieldParts(raw);
  return { value: tokens.join(' '), tokens };
}

/**
 * One canonical identity per field. Empty or missing fields become `''` (never `undefined`) so the matcher handles
 * one shape. The suffix comes from the `suffix` field when it names one of the five known suffixes, else from the
 * first of `last` / `first` / `middle` that carried a trailing suffix token.
 */
export function normalizePerson(raw: RawName): NormalizedName {
  const last = fieldParts(raw.last);
  const first = fieldParts(raw.first);
  const middle = fieldParts(raw.middle);
  const declared = fieldParts(raw.suffix ?? '');
  const middleValue = middle.tokens.join(' ');
  return {
    last: last.tokens.join(' '),
    first: first.tokens.join(' '),
    middle: middleValue,
    middleInitial: middleValue.length > 0 ? (middleValue[0] as string) : null,
    suffix: declared.suffix ?? last.suffix ?? first.suffix ?? middle.suffix,
    tokens: last.tokens,
  };
}

/** `"abc 1234"`, `"ABC-1234"` and `" Abc1234 "` all become `"ABC1234"`. */
export function normalizePlate(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseDate(value: string): Ymd | null {
  const match = DATE_RE.exec((value ?? '').trim());
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const back = new Date(Date.UTC(year, month - 1, day));
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Completed years on `onDate`, both `YYYY-MM-DD` read as UTC; `null` when the birthdate is missing or unparseable. */
export function ageOn(birthdate: string, onDate: string): number | null {
  const birth = parseDate(birthdate);
  const on = parseDate(onDate);
  if (birth === null || on === null) return null;
  let age = on.year - birth.year;
  if (on.month < birth.month || (on.month === birth.month && on.day < birth.day)) age -= 1;
  return age;
}
