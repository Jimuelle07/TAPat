"use client";

import * as React from "react";
import type { SolidPaths } from "../../iso/iso-kit";
import { follow, useInView, useLoop, useReadout } from "../../iso/react/live";
import { frameOf, type Digit, type Frame } from "./frame";
import { WEEKS_PER_YEAR, WEEK_S, YEAR_S, describeOf, readoutOf, simulateDieselYear, stateAt, type DieselWeek } from "./model";
import { REST_TEXT, YEAR_ONE } from "./rest";

const PAUSE_AFTER_TOUCH_MS = 7000;

// ---------------------------------------------------------------------------------------------- the nodes the server drew, found by attribute

/** A node and the last value written to it (starting at what the server drew), so an unchanged value costs a string compare, not a style invalidation. */
interface Slot {
  node: Element;
  last: string;
}

const slotOf = (node: Element | undefined, attr: string): Slot | undefined => (node ? { node, last: node.getAttribute(attr) ?? "" } : undefined);

function put(slot: Slot | undefined, attr: string, value: string) {
  if (!slot || slot.last === value) return;
  slot.last = value;
  slot.node.setAttribute(attr, value);
}

/** Every `d` of one solid, in the order `setSolid` writes them. */
interface SolidSlots {
  fill?: Slot;
  shades: (Slot | undefined)[];
  top?: Slot;
  crease?: Slot;
  bevel?: Slot;
  edge?: Slot;
  drawn: SolidPaths | null;
}

interface Moved {
  nodes: Slot[];
  key: MovedKey;
}

interface DigitSlot {
  node: SVGTextElement;
  transform: string;
  opacity: string;
}

interface PinSlot {
  node: SVGCircleElement;
  x: number;
  y: number;
}

type MovedKey = "float" | "guide" | "carriage" | "rack" | "bead" | "follower" | "rider" | "calendar";
const MOVED_KEYS: MovedKey[] = ["float", "guide", "carriage", "rack", "bead", "follower", "rider", "calendar"];
const SOLIDS = ["lever", "beam", "pinion", "gearA", "gearB", "pointer", "dialWheel", "cam"] as const;
type SolidKey = (typeof SOLIDS)[number];
const LINES = ["leverSlots", "leverGroove", "beamGroove", "beamRings", "gearASpokes", "gearBSpokes", "dialMinor", "dialMajor", "camMinor", "camMajor"] as const;
type LineKey = (typeof LINES)[number];

interface Cache {
  moved: Moved[];
  solids: Record<SolidKey, SolidSlots | undefined>;
  lines: Record<LineKey, Slot | undefined>;
  digits: (DigitSlot | undefined)[][];
  pins: PinSlot[];
  bead: Element | null;
  /** the corner readout and what it says now */
  readout: Element | null;
  said: string;
  above: boolean;
  /** what the last frame drew, to skip the parts that hold still */
  digitsDrawn: Digit[][] | null;
}

function collect(root: Element): Cache {
  const found: Record<string, Slot[]> = {};
  root.querySelectorAll("[data-mx]").forEach((node) => {
    const key = node.getAttribute("data-mx") ?? "";
    (found[key] ??= []).push({ node, last: node.getAttribute("transform") ?? "" });
  });
  const moved = MOVED_KEYS.map((key) => ({ key, nodes: found[key] ?? [] }));
  const solids = {} as Record<SolidKey, SolidSlots | undefined>;
  root.querySelectorAll("[data-mx-solid]").forEach((node) => {
    const name = node.getAttribute("data-mx-solid") as SolidKey;
    const parts: Record<string, Element | undefined> = {};
    node.querySelectorAll("[data-p]").forEach((part) => {
      parts[part.getAttribute("data-p") ?? ""] = part;
    });
    solids[name] = {
      fill: slotOf(parts.fill, "d"),
      shades: [0, 1, 2, 3].map((shade) => slotOf(parts[`s${shade}`], "d")),
      top: slotOf(parts.top, "d"),
      crease: slotOf(parts.crease, "d"),
      bevel: slotOf(parts.bevel, "d"),
      edge: slotOf(parts.edge, "d"),
      drawn: null,
    };
  });
  const lines = {} as Record<LineKey, Slot | undefined>;
  root.querySelectorAll("[data-mx-d]").forEach((node) => {
    lines[(node.getAttribute("data-mx-d") ?? "") as LineKey] = { node, last: node.getAttribute("d") ?? "" };
  });
  const digits: (DigitSlot | undefined)[][] = [];
  root.querySelectorAll<SVGTextElement>("[data-mx-digit]").forEach((node) => {
    const [wheel, digit] = (node.getAttribute("data-mx-digit") ?? "0-0").split("-").map(Number) as [number, number];
    (digits[wheel] ??= [])[digit] = { node, transform: node.getAttribute("transform") ?? "", opacity: node.getAttribute("opacity") ?? "" };
  });
  const pins = Array.from(root.querySelectorAll<SVGCircleElement>("[data-mx-pin]"), (node) => ({
    node,
    x: Number(node.getAttribute("cx")),
    y: Number(node.getAttribute("cy")),
  }));
  const bead = root.querySelector("[data-mx='bead'] .iso-solid");
  const readout = root.closest(".iso-plate")?.querySelector("[data-readout]") ?? null;
  return { moved, solids, lines, digits, pins, bead, readout, said: readout?.textContent ?? "", above: bead?.hasAttribute("data-lit") ?? false, digitsDrawn: null };
}

/** Writes only the parts that differ from what is already there: a solid built by the same call is the same object. */
function setSolid(slots: SolidSlots | undefined, paths: SolidPaths) {
  if (!slots || slots.drawn === paths) return;
  slots.drawn = paths;
  put(slots.fill, "d", paths.fill);
  for (let shade = 0; shade < 4; shade++) put(slots.shades[shade], "d", paths.shades[shade] ?? "");
  put(slots.top, "d", paths.top);
  put(slots.crease, "d", paths.crease);
  put(slots.bevel, "d", paths.bevel ?? "");
  put(slots.edge, "d", paths.outline);
}

function apply(cache: Cache, frame: Frame) {
  for (const { key, nodes } of cache.moved) {
    const transform = frame[key];
    for (const slot of nodes) put(slot, "transform", transform);
  }
  for (const name of SOLIDS) setSolid(cache.solids[name], frame[name]);
  for (const name of LINES) put(cache.lines[name], "d", frame[name]);
  const pins = frame.beamPins;
  for (let index = 0; index < pins.length; index++) {
    const pin = cache.pins[index];
    if (!pin) continue;
    const x = Math.round(pins[index]![0] * 10) / 10;
    const y = Math.round(pins[index]![1] * 10) / 10;
    if (pin.x !== x) {
      pin.x = x;
      pin.node.setAttribute("cx", `${x}`);
    }
    if (pin.y !== y) {
      pin.y = y;
      pin.node.setAttribute("cy", `${y}`);
    }
  }
  if (cache.digitsDrawn !== frame.digits) {
    cache.digitsDrawn = frame.digits;
    frame.digits.forEach((wheel, w) =>
      wheel.forEach((digit, d) => {
        const slot = cache.digits[w]?.[d];
        if (!slot) return;
        if (digit.opacity === 0) {
          if (slot.opacity !== "0") {
            slot.opacity = "0";
            slot.node.setAttribute("opacity", "0");
          }
          return;
        }
        const opacity = `${Math.round(digit.opacity * 100) / 100}`;
        if (slot.transform !== digit.transform) {
          slot.transform = digit.transform;
          slot.node.setAttribute("transform", digit.transform);
        }
        if (slot.opacity !== opacity) {
          slot.opacity = opacity;
          slot.node.setAttribute("opacity", opacity);
        }
      }),
    );
  }
  if (cache.bead && cache.above !== frame.above) {
    cache.above = frame.above;
    if (frame.above) cache.bead.setAttribute("data-lit", "");
    else cache.bead.removeAttribute("data-lit");
  }
}

// ---------------------------------------------------------------------------------------------- the figure

interface Props {
  /** The machine's SVG, drawn on the server (MixerArt). */
  children: React.ReactNode;
}

interface Run {
  seed: number;
  clock: number;
  target: number | null;
  hover: boolean;
  focus: boolean;
  holdUntil: number;
  week: number;
  amb: number; // seconds of motion, for the float's swell
  still: boolean;
}

export function MixerLive({ children }: Props) {
  const { anchor } = useReadout<HTMLDivElement>();
  const cache = React.useRef<Cache | null>(null);
  const run = React.useRef<Run>({ seed: 1, clock: 0, target: null, hover: false, focus: false, holdUntil: 0, week: 1, amb: 0, still: true });
  const years = React.useRef(new Map<number, DieselWeek[]>([[1, YEAR_ONE]]));
  const timer = React.useRef(0);
  const visible = useInView(anchor);

  const yearOf = React.useCallback((seed: number) => {
    let year = years.current.get(seed);
    if (!year) {
      year = simulateDieselYear(seed);
      years.current.set(seed, year);
      if (years.current.size > 3) years.current.delete(years.current.keys().next().value as number);
    }
    return year;
  }, []);

  const draw = React.useCallback(() => {
    const node = anchor.current;
    if (!node) return;
    cache.current ??= collect(node);
    const r = run.current;
    const state = stateAt(yearOf(r.seed), r.clock);
    // The float rides a swell and the cam follower rebounds once as it seats in the Tuesday notch, whatever the speed the year plays at.
    const seated = (state.phase - 0.085) * WEEK_S;
    const bob = r.still ? 0 : 1.1 * Math.sin(r.amb * 3.1) + 0.5 * Math.sin(r.amb * 5.3 + 1);
    const click = r.still || state.note !== "week" || seated < 0 ? 0 : Math.exp(-seated / 0.07) * Math.cos(seated * 55);
    apply(cache.current, frameOf(state, bob, click));
    const said = readoutOf(state, r.seed);
    if (cache.current.readout && cache.current.said !== said) {
      cache.current.said = said;
      cache.current.readout.textContent = said;
    }
    if (state.week !== r.week) {
      r.week = state.week;
      node.setAttribute("aria-valuenow", `${state.week}`);
      node.setAttribute("aria-valuetext", describeOf(state, r.seed));
    }
  }, [anchor, yearOf]);

  const tick = React.useCallback(
    (dt: number, calm: boolean) => {
      const r = run.current;
      r.still = calm;
      if (!calm) r.amb += dt;
      const playing = !calm && !r.hover && !r.focus && performance.now() >= r.holdUntil;
      if (r.target !== null) {
        r.clock = follow(r.clock, r.target, dt, 0.14, calm);
        if (r.clock === r.target) r.target = null;
      } else if (playing) {
        r.clock += dt;
        if (r.clock >= YEAR_S) {
          r.seed += 1;
          r.clock -= YEAR_S;
        }
      }
      draw();
      return r.target !== null || playing;
    },
    [draw],
  );

  const kick = useLoop(tick, visible);

  React.useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  /** Move to the Tuesday of a week of this year, and hold there for a while. */
  const go = (week: number) => {
    const r = run.current;
    const next = Math.min(WEEKS_PER_YEAR, Math.max(1, week));
    r.target = (next - 1) * WEEK_S + WEEK_S * 0.34;
    r.holdUntil = performance.now() + PAUSE_AFTER_TOUCH_MS;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(kick, PAUSE_AFTER_TOUCH_MS + 60);
    kick();
  };

  const now = () => Math.max(1, stateAt(yearOf(run.current.seed), run.current.clock).week);

  const onKey = (event: React.KeyboardEvent) => {
    const r = run.current;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") go(now() + (event.shiftKey ? 4 : 1));
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") go(now() - (event.shiftKey ? 4 : 1));
    else if (event.key === "Home") go(1);
    else if (event.key === "End") go(WEEKS_PER_YEAR);
    else if (event.key === " " || event.key === "Enter") {
      if (r.holdUntil === Infinity) {
        r.holdUntil = 0;
        kick();
      } else {
        r.holdUntil = Infinity;
        window.clearTimeout(timer.current);
      }
    } else if (event.key === "Escape") {
      r.holdUntil = 0;
      kick();
    } else return;
    event.preventDefault();
  };

  return (
    <div
      ref={anchor}
      className="mx"
      role="slider"
      tabIndex={0}
      aria-label="Diesel price-mixing machine, one simulated year: arrow keys step the week, Space holds or plays"
      aria-valuemin={1}
      aria-valuemax={WEEKS_PER_YEAR}
      aria-valuenow={1}
      aria-valuetext={REST_TEXT}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") run.current.hover = true;
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        run.current.hover = false;
        kick();
      }}
      onFocus={() => {
        run.current.focus = true;
      }}
      onBlur={() => {
        run.current.focus = false;
        kick();
      }}
      onClick={() => go(now() + 1)}
      onKeyDown={onKey}
    >
      {children}
    </div>
  );
}
