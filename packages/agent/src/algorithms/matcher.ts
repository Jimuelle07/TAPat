// Jaro-Winkler pair matching, genuineness scoring and the intake hard rules (docs/algorithms.md §4). Pure and
// deterministic: no clock, no I/O, no locale-aware comparison.
import { crcDecide } from './crc';
import { ageOn, normalizePerson, normalizePlate } from './names';
import type { NormalizedName } from './names';

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

/** A file row after normalization, plus the two fields the pair probability reads. */
export interface MatchRecord extends NormalizedName {
  birthdate: string | null;
  barangay: string | null;
  /** `normalizePlate(plate)`; `''` means "no plate", so the record never joins a plate group (§4.4). */
  plate: string;
}

/** What a CSV row or an OCR row provides; `toMatchRecord` normalizes it. */
export interface PersonInput {
  last: string;
  first: string;
  middle: string;
  suffix: string | null;
  birthdate: string | null;
  plate?: string | null;
  barangay: string | null;
}

function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeBarangay(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}

/** Normalizes one input row into the shape the pair functions read. */
export function toMatchRecord(input: PersonInput): MatchRecord {
  const person = normalizePerson({
    last: input.last,
    first: input.first,
    middle: input.middle,
    suffix: input.suffix,
    birthdate: present(input.birthdate) ?? '',
    plate: input.plate ?? '',
    toda: '',
    barangay: input.barangay ?? '',
  });
  return {
    ...person,
    birthdate: present(input.birthdate),
    barangay: present(input.barangay),
    plate: normalizePlate(input.plate ?? ''),
  };
}

/** §4.1, exactly: half-length window, first-free-match scan, then the transposition walk. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatch = new Array<boolean>(a.length).fill(false);
  const bMatch = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(b.length - 1, i + window);
    for (let j = lo; j <= hi; j += 1) {
      if (!bMatch[j] && a[i] === b[j]) {
        aMatch[i] = true;
        bMatch[j] = true;
        matches += 1;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let half = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k += 1;
    if (a[i] !== b[k]) half += 1;
    k += 1;
  }
  const transpositions = half / 2;
  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

/** §4.1: prefix boost scale 0.1, prefix capped at 4 — constants, not parameters. */
export function jaroWinkler(a: string, b: string): number {
  const value = jaro(a, b);
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  return value + prefix * 0.1 * (1 - value);
}

/** §4.2: `1` equal, `0.5` when either initial is missing, `0` when both are present and differ. */
export function middleInitialScore(a: string | null, b: string | null): number {
  if (a === null || b === null) return 0.5;
  return a === b ? 1 : 0;
}

/** §4.2: guarded so `Math.exp` never overflows. */
export function sigmoid(x: number): number {
  if (x <= -30) return 0;
  if (x >= 30) return 1;
  return 1 / (1 + Math.exp(-x));
}

/** §4.2. The suffix penalty lands after the sigmoid, so a Jr/Sr pair with an otherwise perfect name caps at 0.2. */
export function pairProbability(a: MatchRecord, b: MatchRecord): number {
  const nameSim =
    0.5 * jaroWinkler(a.last, b.last) +
    0.35 * jaroWinkler(a.first, b.first) +
    0.15 * middleInitialScore(a.middleInitial, b.middleInitial);
  let x = 10 * (nameSim - 0.85);
  if (a.birthdate !== null && b.birthdate !== null) x += a.birthdate === b.birthdate ? 2.5 : -2.5;
  if (a.barangay !== null && b.barangay !== null) {
    const left = normalizeBarangay(a.barangay);
    if (left !== '' && left === normalizeBarangay(b.barangay)) x += 1.5;
  }
  let p = sigmoid(x);
  if (a.suffix !== null && b.suffix !== null && a.suffix !== b.suffix) p *= 0.2;
  return round6(Math.min(1, Math.max(0, p)));
}

/** §4.3: `s[0] = 1`, `s[i] = 1 - max(p(i, j))` over the rows before it, in file order. */
export function genuinenessScores(records: readonly MatchRecord[]): number[] {
  const scores: number[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const current = records[i] as MatchRecord;
    let best = 0;
    for (let j = 0; j < i; j += 1) {
      const p = pairProbability(current, records[j] as MatchRecord);
      if (p > best) best = p;
    }
    scores.push(i === 0 ? 1 : round6(1 - best));
  }
  return scores;
}

export type HardRuleCode = 'UNDERAGE' | 'PLATE_MULTI_NAME' | 'DUPLICATE_PLATE';

/** Record indexes sharing one normalized plate, in file order; `''` (no plate) never groups. */
function plateGroups(records: readonly MatchRecord[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (let i = 0; i < records.length; i += 1) {
    const plate = (records[i] as MatchRecord).plate;
    if (plate === '') continue;
    const group = groups.get(plate);
    if (group === undefined) groups.set(plate, [i]);
    else group.push(i);
  }
  return groups;
}

/**
 * §4.4. Runs before scoring and always blocks: `UNDERAGE` per record, then one plate rule per plate group
 * (`PLATE_MULTI_NAME` for the whole group when any pair scores below 0.5, else `DUPLICATE_PLATE` for the rows after
 * the earliest). `UNDERAGE` wins when both apply.
 */
export function applyHardRules(
  records: readonly MatchRecord[],
  opts: { programStartDate: string },
): Map<number, HardRuleCode> {
  const blocked = new Map<number, HardRuleCode>();
  for (const indexes of plateGroups(records).values()) {
    if (indexes.length < 2) continue;
    let multiName = false;
    for (let x = 0; x < indexes.length && !multiName; x += 1) {
      for (let y = x + 1; y < indexes.length; y += 1) {
        const left = records[indexes[x] as number] as MatchRecord;
        const right = records[indexes[y] as number] as MatchRecord;
        const p = pairProbability(left, right);
        if (p < 0.5) {
          multiName = true;
          break;
        }
      }
    }
    if (multiName) {
      for (const index of indexes) blocked.set(index, 'PLATE_MULTI_NAME');
    } else {
      for (let n = 1; n < indexes.length; n += 1) blocked.set(indexes[n] as number, 'DUPLICATE_PLATE');
    }
  }
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i] as MatchRecord;
    const age = ageOn(record.birthdate ?? '', opts.programStartDate);
    if (age !== null && age < 18) blocked.set(i, 'UNDERAGE');
  }
  return blocked;
}

export type IntakeStatus = 'approved' | 'rejected' | 'uncertain';

export interface IntakeDecision {
  index: number;
  status: IntakeStatus;
  score: number;
  ruleCode: HardRuleCode | null;
  /** Human sentence stored in `beneficiaries.decision_reason` (§4.5 templates). */
  reason: string;
  duplicateOfIndex: number | null;
}

export interface DecideIntakeOptions {
  /** `YYYY-MM-DD` in Asia/Manila; the caller reads the clock, this module never does. */
  programStartDate: string;
  lambdaLo: number;
  lambdaHi: number;
}

/**
 * §4.5: hard rules, then genuineness scores, then the CRC thresholds. `duplicateOfIndex` is the closest earlier row
 * (argmax pair probability) for every record that is not the first exact match, else `null`.
 */
export function decideIntake(records: readonly MatchRecord[], opts: DecideIntakeOptions): IntakeDecision[] {
  const blocked = applyHardRules(records, opts);
  const scores = genuinenessScores(records);
  const groups = plateGroups(records);
  const decisions: IntakeDecision[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i] as MatchRecord;
    const score = scores[i] as number;
    let closest = -1;
    let closestP = -1;
    for (let j = 0; j < i; j += 1) {
      const p = pairProbability(record, records[j] as MatchRecord);
      if (p > closestP) {
        closestP = p;
        closest = j;
      }
    }
    const duplicateOfIndex = score < 1 && closest >= 0 ? closest : null;
    const ruleCode = blocked.get(i) ?? null;
    let status: IntakeStatus;
    let reason: string;
    if (ruleCode === 'UNDERAGE') {
      status = 'rejected';
      reason = `age ${ageOn(record.birthdate ?? '', opts.programStartDate)} is below 18 on ${opts.programStartDate}`;
    } else if (ruleCode === 'PLATE_MULTI_NAME') {
      status = 'rejected';
      reason = `plate ${record.plate} appears on records of different people`;
    } else if (ruleCode === 'DUPLICATE_PLATE') {
      status = 'rejected';
      reason = `plate ${record.plate} duplicates record ${(groups.get(record.plate) as number[])[0]}`;
    } else {
      status = crcDecide(score, opts);
      if (status === 'rejected') {
        reason =
          `genuineness ${score} below reject threshold ${opts.lambdaLo}; ` +
          `closest earlier record ${closest} at p=${round6(Math.max(0, closestP))}`;
      } else if (status === 'uncertain') {
        reason = `genuineness ${score} between ${opts.lambdaLo} and ${opts.lambdaHi}`;
      } else {
        reason = `genuineness ${score} at or above ${opts.lambdaHi}`;
      }
    }
    decisions.push({ index: i, status, score, ruleCode, reason, duplicateOfIndex });
  }
  return decisions;
}
