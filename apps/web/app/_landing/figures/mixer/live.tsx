"use client";

import * as React from "react";
import type { SolidPaths } from "../../iso/iso-kit";
import { follow, useInView, useLoop, useReadout } from "../../iso/react/live";
import { frameOf, type Frame } from "./frame";
import { WEEKS_PER_YEAR, WEEK_S, YEAR_S, describeOf, readoutOf, simulateDieselYear, stateAt, type DieselWeek } from "./model";
import { REST_TEXT, YEAR_ONE } from "./rest";

const PAUSE_AFTER_TOUCH_MS = 7000;

// ---------------------------------------------------------------------------------------------- the nodes the server drew, found by attribute

interface Cache {
  moved: Record<string, Element[]>;
  solids: Map<string, Record<string, Element | undefined>>;
  lines: Map<string, Element>;
  digits: SVGTextElement[][];
  pins: SVGCircleElement[];
  bead: Element | null;
}

function collect(root: Element): Cache {
  const moved: Record<string, Element[]> = {};
  root.querySelectorAll("[data-mx]").forEach((node) => {
    const key = node.getAttribute("data-mx") ?? "";
    (moved[key] ??= []).push(node);
  });
  const solids = new Map<string, Record<string, Element | undefined>>();
  root.querySelectorAll("[data-mx-solid]").forEach((node) => {
    const parts: Record<string, Element | undefined> = {};
    node.querySelectorAll("[data-p]").forEach((part) => {
      parts[part.getAttribute("data-p") ?? ""] = part;
    });
    solids.set(node.getAttribute("data-mx-solid") ?? "", parts);
  });
  const lines = new Map<string, Element>();
  root.querySelectorAll("[data-mx-d]").forEach((node) => lines.set(node.getAttribute("data-mx-d") ?? "", node));
  const digits: SVGTextElement[][] = [];
  root.querySelectorAll<SVGTextElement>("[data-mx-digit]").forEach((node) => {
    const [wheel, digit] = (node.getAttribute("data-mx-digit") ?? "0-0").split("-").map(Number) as [number, number];
    (digits[wheel] ??= [])[digit] = node;
  });
  const pins = Array.from(root.querySelectorAll<SVGCircleElement>("[data-mx-pin]"));
  return { moved, solids, lines, digits, pins, bead: root.querySelector("[data-mx='bead'] .iso-solid") };
}

function setSolid(cache: Cache, name: string, paths: SolidPaths) {
  const parts = cache.solids.get(name);
  if (!parts) return;
  parts.fill?.setAttribute("d", paths.fill);
  for (let shade = 0; shade < 4; shade++) parts[`s${shade}`]?.setAttribute("d", paths.shades[shade] ?? "");
  parts.top?.setAttribute("d", paths.top);
  parts.crease?.setAttribute("d", paths.crease);
  parts.bevel?.setAttribute("d", paths.bevel ?? "");
  parts.edge?.setAttribute("d", paths.outline);
}

function apply(cache: Cache, frame: Frame) {
  for (const key of ["float", "guide", "carriage", "rack", "bead", "follower", "rider", "calendar"] as const) {
    for (const node of cache.moved[key] ?? []) node.setAttribute("transform", frame[key]);
  }
  setSolid(cache, "lever", frame.lever);
  setSolid(cache, "beam", frame.beam);
  setSolid(cache, "pinion", frame.pinion);
  setSolid(cache, "gearA", frame.gearA);
  setSolid(cache, "gearB", frame.gearB);
  setSolid(cache, "pointer", frame.pointer);
  setSolid(cache, "dialWheel", frame.dialWheel);
  setSolid(cache, "cam", frame.cam);
  const lines: Record<string, string> = {
    leverSlots: frame.leverSlots,
    leverGroove: frame.leverGroove,
    beamGroove: frame.beamGroove,
    beamRings: frame.beamRings,
    gearASpokes: frame.gearASpokes,
    gearBSpokes: frame.gearBSpokes,
    dialMinor: frame.dialMinor,
    dialMajor: frame.dialMajor,
    camMinor: frame.camMinor,
    camMajor: frame.camMajor,
  };
  for (const [name, d] of Object.entries(lines)) cache.lines.get(name)?.setAttribute("d", d);
  frame.beamPins.forEach(([x, y], index) => {
    cache.pins[index]?.setAttribute("cx", `${Math.round(x * 10) / 10}`);
    cache.pins[index]?.setAttribute("cy", `${Math.round(y * 10) / 10}`);
  });
  frame.digits.forEach((wheel, w) =>
    wheel.forEach((digit, d) => {
      const node = cache.digits[w]?.[d];
      if (!node) return;
      if (digit.opacity === 0) node.setAttribute("opacity", "0");
      else {
        node.setAttribute("transform", digit.transform);
        node.setAttribute("opacity", `${Math.round(digit.opacity * 100) / 100}`);
      }
    }),
  );
  if (cache.bead) {
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
  const { anchor, say } = useReadout<HTMLDivElement>();
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
    say(readoutOf(state, r.seed));
    if (state.week !== r.week) {
      r.week = state.week;
      node.setAttribute("aria-valuenow", `${state.week}`);
      node.setAttribute("aria-valuetext", describeOf(state, r.seed));
    }
  }, [anchor, say, yearOf]);

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
