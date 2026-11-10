import { clamp, smooth } from "../shared";

/** 723,000 drivers slated for the subsidy (PNA). One peg stands for 1,000 of them. */
export const DRIVERS = 723_000;
export const PER_PEG = 1_000;
export const PEGS = DRIVERS / PER_PEG;
export const COLS = 31;
export const ROWS = Math.ceil(PEGS / COLS);
/** Pegs in row `k`: every row is full except the last. */
export const rowCount = (k: number) => Math.min(COLS, PEGS - k * COLS);

const FILL = 1.5;
const GAP = 0.45;
const LEAD = 0.7;
/** The finished board stands a moment, then the loader runs home and the beam sweeps the pegs away. */
export const HOLD = 2.4;
const SWEEP = 3.4;
/** Share of the sweep the loader head spends running back to column 0 before the beam starts. */
const HEAD_HOME = 0.22;
/** A row fades over this many rows of beam travel after the beam passes it. */
export const FADE_ROWS = 1.5;
const startOf = (k: number) => LEAD + k * (FILL + GAP);
export const FILLED_AT = startOf(ROWS - 1) + (FILL * rowCount(ROWS - 1)) / COLS;
export const LOOP = FILLED_AT + HOLD + SWEEP;
/** `wipe` while no sweep runs: past the last row, so no row fades. */
export const NO_WIPE = ROWS + 3;

export interface State {
  /** Pegs standing (or still dropping in) on the board. */
  n: number;
  /** The row the beam is over (fractional while it steps). */
  row: number;
  /** The head's column position along that row (fractional). */
  col: number;
  /** Sweep position in rows: rows more than FADE_ROWS behind it have faded. NO_WIPE when no sweep runs. */
  wipe: number;
}

/** The finished board: every peg placed, the beam and head parked at the last peg. */
export const REST: State = { n: PEGS, row: ROWS - 1, col: rowCount(ROWS - 1) - 0.5, wipe: NO_WIPE };

/** The filling cycle as a pure function of time. */
export function stateAt(time: number): State {
  const t = ((time % LOOP) + LOOP) % LOOP;
  if (t >= FILLED_AT + HOLD) {
    const s = (t - FILLED_AT - HOLD) / SWEEP;
    const home = smooth(s / HEAD_HOME);
    const p = (ROWS - 1 + FADE_ROWS) * (1 - smooth((s - HEAD_HOME) / (1 - HEAD_HOME))) - FADE_ROWS;
    const n = Math.min(PEGS, Math.max(0, Math.ceil(p + FADE_ROWS) * COLS));
    return { n, row: clamp(p, 0, ROWS - 1), col: REST.col * (1 - home), wipe: p };
  }
  if (t >= FILLED_AT) return REST;
  let k = Math.max(0, Math.min(ROWS - 1, Math.floor((t - LEAD) / (FILL + GAP))));
  if (t < LEAD) k = 0;
  const count = rowCount(k);
  const into = t - startOf(k);
  const span = (FILL * count) / COLS;
  if (into <= span || k === ROWS - 1) {
    const u = Math.max(0, Math.min(1, into / span));
    const col = u * count;
    return { n: k * COLS + Math.min(count, Math.floor(col + 0.5)), row: k, col, wipe: NO_WIPE };
  }
  // The gap: the head runs back to column 0 while the beam steps one row on.
  const g = smooth((into - span) / (FILL + GAP - span));
  return { n: k * COLS + count, row: k + g, col: count * (1 - g), wipe: NO_WIPE };
}

export const thousands = (value: number) => value.toLocaleString("en-US");
export const readoutOf = (n: number) => `${n} pegs · ${thousands(n * PER_PEG)} drivers`;
