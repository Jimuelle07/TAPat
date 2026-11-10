import type { SolidPaths } from "../iso/iso-kit";

/*
 * Lossless-at-0.1 path compaction for static figure art. The kit emits absolute `M x y L x y … Z` strings at one decimal
 * (arcs and curves from the lathe carry full floats). This rewrites them as relative commands with one decimal, no
 * leading zeros, no redundant separators and no repeated command letters: the same drawing in about 60% of the bytes.
 * Deltas are taken between already-rounded absolute points, so rounding never drifts along a path.
 * Only static strings go through here; the per-frame paths the live components write stay as they are.
 */

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, T: 2, S: 4, C: 6, A: 7, Z: 0 };
const TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

const tenth = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
};

/** A number as short as it can be written: `0.5` → `.5`, `-0.5` → `-.5`. */
const short = (value: number) => {
  const text = String(value);
  if (text.startsWith("0.")) return text.slice(1);
  if (text.startsWith("-0.")) return `-${text.slice(2)}`;
  return text;
};

/** Whether two written numbers need a space between them: a minus sign or a second decimal point already splits them. */
const splits = (previous: string, text: string) => text.startsWith("-") || (text.startsWith(".") && previous.includes("."));

export function compactPath(d: string): string {
  if (!d) return d;
  const tokens = d.match(TOKEN);
  if (!tokens) return d;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let last = "";
  let previous = "";
  let out = "";
  let at = 0;
  const emit = (letter: string, values: string[]) => {
    // A second pair after `m` would be read as a lineto, so moves always carry their letter.
    if (letter !== last || letter === "m") {
      out += letter;
      previous = "";
    }
    for (const text of values) {
      if (previous && !splits(previous, text)) out += " ";
      out += text;
      previous = text;
    }
    last = letter;
  };
  while (at < tokens.length) {
    const command = tokens[at++]!;
    const letter = command.toUpperCase();
    const size = ARITY[letter];
    if (size === undefined || command !== letter) return d; // anything this does not know is left as the kit drew it
    if (letter === "Z") {
      out += "z";
      last = "z";
      cx = sx;
      cy = sy;
      continue;
    }
    const args = tokens.slice(at, at + size).map(Number);
    at += size;
    if (args.length < size || args.some((n) => !Number.isFinite(n))) return d;
    const rx = (x: number) => short(tenth(tenth(x) - cx));
    const ry = (y: number) => short(tenth(tenth(y) - cy));
    switch (letter) {
      case "M": {
        emit("m", [rx(args[0]!), ry(args[1]!)]);
        cx = sx = tenth(args[0]!);
        cy = sy = tenth(args[1]!);
        break;
      }
      case "L": {
        const x = tenth(args[0]!);
        const y = tenth(args[1]!);
        if (y === cy) emit("h", [rx(x)]);
        else if (x === cx) emit("v", [ry(y)]);
        else emit("l", [rx(x), ry(y)]);
        cx = x;
        cy = y;
        break;
      }
      case "H": {
        emit("h", [rx(args[0]!)]);
        cx = tenth(args[0]!);
        break;
      }
      case "V": {
        emit("v", [ry(args[0]!)]);
        cy = tenth(args[0]!);
        break;
      }
      case "Q":
      case "S":
      case "C":
      case "T": {
        const lower = letter.toLowerCase();
        const values: string[] = [];
        for (let i = 0; i < size; i += 2) values.push(rx(args[i]!), ry(args[i + 1]!));
        emit(lower, values);
        cx = tenth(args[size - 2]!);
        cy = tenth(args[size - 1]!);
        break;
      }
      case "A": {
        const x = tenth(args[5]!);
        const y = tenth(args[6]!);
        emit("a", [short(tenth(args[0]!)), short(tenth(args[1]!)), short(tenth(args[2]!)), String(args[3]), String(args[4]), short(tenth(x - cx)), short(tenth(y - cy))]);
        cx = x;
        cy = y;
        break;
      }
    }
  }
  return out;
}

/** The same solid with every static path compacted. */
export function compactSolid(paths: SolidPaths): SolidPaths {
  return {
    ...paths,
    fill: compactPath(paths.fill),
    shades: paths.shades.map(compactPath),
    top: compactPath(paths.top),
    crease: compactPath(paths.crease),
    outline: compactPath(paths.outline),
    ...(paths.bevel === undefined ? {} : { bevel: compactPath(paths.bevel) }),
  };
}

const PATH_STRING = /^M[-\d.\sMLHVQCSTAZ]*\d[-\d.\sMLHVQCSTAZ]*$/;

/** Every path string inside a plain object of static art, compacted. Numbers, flags, transforms and text pass through untouched. */
export function compactArt<T>(value: T): T {
  if (typeof value === "string") return (PATH_STRING.test(value) ? compactPath(value) : value) as T;
  if (Array.isArray(value)) return value.map(compactArt) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = compactArt(item);
    return out as T;
  }
  return value;
}
