"use client";

import * as React from "react";
import { axisVector, holdStill, translateAlong, type SolidPaths } from "../../iso/iso-kit";
import { asksForStillness, follow, spring, useInView, useLoop, useReadout, type Spring } from "../../iso/react/live";
import { TOKEN_TRAVEL, TURN_CENTRE, WINDOW_H, tokenShift } from "./dyn";
import { faceTurn, needleAt, paperAt, ratchetAt } from "./frame";
import { type LandingScenario, RESTING_READOUT, SECONDS_PER_DAY, cpOn, dayOf, readoutOn, releasedOn, stepped, stillDayOf, teethOn } from "./model";
import { BAR_LIFT, DAY_UNITS, P, REEL, SUPPLY, TEETH, TOKEN_S0 } from "./view";

/* ------------------------------------------------------------------------------------------------ constants */

const FOLLOW = 0.16;
const TOUR_START = 0.4;
const TOUR_HOLD = 1;
const TOUR_REWIND = 1.8;
const TOUR_REST = 0.3;
const TOUR_BACK = 3.6;
const SLIDE_TIME = 1.25;
const DIGIT_STEP = WINDOW_H;
const PITCH_RAD = (2 * Math.PI) / TEETH;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const smooth01 = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
const easeInOut = (t: number) => {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
};

/** The idle tour: play the days, hold the finished chart, rewind the paper, pause, repeat. */
function tourClock(t: number, days: number) {
  const play = (days - 1) * SECONDS_PER_DAY;
  const loop = TOUR_START + play + TOUR_HOLD + TOUR_REWIND + TOUR_REST;
  const at = t % loop;
  if (at < TOUR_START) return 1;
  if (at < TOUR_START + play) return 1 + (at - TOUR_START) / SECONDS_PER_DAY;
  if (at < TOUR_START + play + TOUR_HOLD) return days;
  if (at < TOUR_START + play + TOUR_HOLD + TOUR_REWIND) return days - (days - 1) * easeInOut((at - TOUR_START - play - TOUR_HOLD) / TOUR_REWIND);
  return 1;
}

/** Distance a token has slid down the chute `t` seconds after its gate lifted: gravity, then a small rebound off the bumper. */
function slideOf(t: number) {
  if (t <= 0) return 0;
  const u = t / SLIDE_TIME;
  if (u < 1) return TOKEN_TRAVEL * u * u;
  const after = t - SLIDE_TIME;
  return TOKEN_TRAVEL - 3.4 * Math.exp(-4.5 * after) * Math.abs(Math.sin(11 * after));
}

/* ------------------------------------------------------------------------------------------------ the markup the server drew */

interface Nodes {
  trace: Element | null;
  gridMinor: Element | null;
  gridMajor: Element | null;
  holes: Element | null;
  carBack: Element | null;
  carFront: Element | null;
  reelSpin: Element | null;
  supplySpin: Element | null;
  tens: Element | null;
  units: Element | null;
  needle: Element | null;
  wheelHoles: Element | null;
  wheelTicks: Element | null;
  pawlHole: Element | null;
  barBack: Element | null;
  barFront: Element | null;
  barSegs: Array<Element | null>;
  plunger: SVGGElement | null;
  lamp: SVGGElement | null;
  tokens: Array<SVGGElement | null>;
  wheelGroup: Element | null;
  pawlGroup: Element | null;
}

/** The server-rendered figure marks every moving part with `data-rc`; find each one once. */
function collect(root: HTMLElement): Nodes {
  const find = <T extends Element>(name: string) => root.querySelector<T>(`[data-rc="${name}"]`);
  return {
    trace: find("trace"),
    gridMinor: find("minor"),
    gridMajor: find("major"),
    holes: find("holes"),
    carBack: find("carBack"),
    carFront: find("carFront"),
    reelSpin: find("reel"),
    supplySpin: find("supply"),
    tens: find("tens"),
    units: find("units"),
    needle: find("needle"),
    wheelHoles: find("wheelHoles"),
    wheelTicks: find("wheelTicks"),
    pawlHole: find("pawlHole"),
    barBack: find("barBack"),
    barFront: find("barFront"),
    barSegs: [0, 1, 2].map((index) => find(`seg${index}`)),
    plunger: find<SVGGElement>("plunger"),
    lamp: find<SVGGElement>("lamp"),
    tokens: [0, 1, 2].map((index) => find<SVGGElement>(`token${index}`)),
    wheelGroup: find("wheel"),
    pawlGroup: find("pawl"),
  };
}

/** Paints a solid by child index (fill, 4 shades, top, crease, bevel, edge). */
function paintSolid(group: Element | null, paths: SolidPaths) {
  if (!group) return;
  const [fill, s0, s1, s2, s3, top, crease, bevel, edge] = Array.from(group.children);
  fill?.setAttribute("d", paths.fill);
  [s0, s1, s2, s3].forEach((node, index) => node?.setAttribute("d", paths.shades[index] ?? ""));
  top?.setAttribute("d", paths.top);
  crease?.setAttribute("d", paths.crease);
  bevel?.setAttribute("d", paths.bevel ?? "");
  edge?.setAttribute("d", paths.outline);
}

/* ------------------------------------------------------------------------------------------------ the live figure */

interface Props {
  scenario: LandingScenario;
  thresholdPhp: number;
  /** The figure's SVG, drawn on the server (RecorderBody). */
  children: React.ReactNode;
}

interface Sim {
  t: number;
  d: number;
  target: number;
  mode: "tour" | "user";
  tourT: number;
  idle: number;
  engaged: number;
  teeth: number;
  wheelFrom: number;
  wheelTo: number;
  wheelStart: number;
  wheelDur: number;
  lift: number;
  bar: Spring;
  relAt: number | null;
  fade: number;
  pan: number;
  shown: number;
  still: boolean;
}

const startSim = (d: number): Sim => ({
  t: 0,
  d,
  target: d,
  mode: "tour",
  tourT: 0,
  idle: 0,
  engaged: 0,
  teeth: 0,
  wheelFrom: 0,
  wheelTo: 0,
  wheelStart: 0,
  wheelDur: 0.2,
  lift: 0,
  bar: { at: 0, rate: 0 },
  relAt: null,
  fade: 1,
  pan: 0,
  shown: 0,
  still: true,
});

export function RecorderLive({ scenario, thresholdPhp, children }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const days = scenario.points.length;
  const sim = React.useRef<Sim | null>(null);
  if (sim.current === null) sim.current = startSim(1);

  const nodes = React.useRef<Nodes | null>(null);

  const draw = React.useCallback(() => {
    if (!nodes.current && anchor.current) nodes.current = collect(anchor.current);
    const n = nodes.current;
    if (!n) return;
    const s = sim.current!;
    const day = dayOf(scenario, s.d);
    const paper = paperAt(scenario, s.d);
    n.trace?.setAttribute("d", paper.trace);
    n.gridMinor?.setAttribute("d", paper.minor);
    n.gridMajor?.setAttribute("d", paper.major);
    n.holes?.setAttribute("d", paper.holes);
    // The nib never rests on the ink: it tracks with a slight hunt, in the paper's own plane.
    const hunt = s.still ? 0 : 0.7 * (0.6 * Math.sin(s.t * 6.1) + 0.4 * Math.sin(s.t * 17.3));
    const pen = translateAlong(P, [0, paper.penY + hunt, 0]);
    n.carBack?.setAttribute("transform", pen);
    n.carFront?.setAttribute("transform", pen);

    const travel = (clamp(s.d, 1, days) - 1) * DAY_UNITS;
    n.reelSpin?.setAttribute("transform", faceTurn(TURN_CENTRE.reel, travel / REEL.r));
    n.supplySpin?.setAttribute("transform", faceTurn(TURN_CENTRE.supply, travel / SUPPLY.r));

    const clock = stepped(clamp(s.d, 1, days));
    const unitsAt = clock % 10;
    const tensAt = Math.floor(clock / 10) + Math.max(0, unitsAt - 9);
    n.units?.setAttribute("transform", `translate(0 ${-unitsAt * DIGIT_STEP})`);
    n.tens?.setAttribute("transform", `translate(0 ${-tensAt * DIGIT_STEP})`);

    n.needle?.setAttribute("d", needleAt(cpOn(scenario, day)));

    // Each time the wheel lands, the pawl drops into its tooth and the wheel rocks back once: a click.
    const landedFor = s.t - (s.wheelStart + s.wheelDur);
    const rock = s.still || s.wheelStart === 0 || landedFor < 0 ? 0 : 0.1 * Math.exp(-landedFor / 0.09) * Math.sin(landedFor * 42);
    const frame = ratchetAt((s.teeth + rock) * PITCH_RAD, s.lift);
    paintSolid(n.wheelGroup, frame.wheel);
    paintSolid(n.pawlGroup, frame.pawl);
    n.wheelHoles?.setAttribute("d", frame.holes);
    n.wheelTicks?.setAttribute("d", frame.ticks);
    n.pawlHole?.setAttribute("d", frame.pawlHole);

    const lift = clamp(s.bar.at, 0, 1.2) * BAR_LIFT;
    const up = translateAlong(P, [0, 0, lift]);
    for (const node of [n.barBack, n.barFront, ...n.barSegs]) node?.setAttribute("transform", up);
    const [shiftX, shiftY] = axisVector(P, [0, 0, lift]);
    if (n.plunger) {
      n.plunger.setAttribute("transform", up);
      holdStill(n.plunger, [shiftX, shiftY]);
    }
    if (n.lamp) {
      if (s.relAt !== null) n.lamp.dataset.on = "";
      else delete n.lamp.dataset.on;
    }

    const sinceFire = s.relAt === null ? 0 : s.t - s.relAt;
    n.tokens.forEach((node, index) => {
      if (!node) return;
      const slid = slideOf(sinceFire - (0.14 + 0.07 * index));
      const onto = smooth01((TOKEN_S0 + slid - 58) / 10);
      const [dx, dy] = axisVector(P, tokenShift(slid, 0.9 * onto));
      node.setAttribute("transform", `translate(${dx} ${dy})`);
      node.style.opacity = s.fade >= 1 ? "" : `${s.fade}`;
    });

    if (s.shown !== day) {
      s.shown = day;
      say(readoutOn(scenario, day));
      const node = anchor.current;
      if (node && s.mode === "user") {
        node.setAttribute("aria-valuenow", `${day}`);
        node.setAttribute("aria-valuetext", readoutOn(scenario, day));
      }
    }
    anchor.current?.style.setProperty("--rc-pan", s.pan.toFixed(3));
  }, [anchor, days, say, scenario]);

  /** Advance every moving part by dt seconds, then paint. */
  const advance = React.useCallback(
    (dt: number, calm: boolean) => {
      const s = sim.current!;
      s.t += dt;
      s.still = calm;
      if (s.mode === "tour" && !calm) {
        s.tourT += dt;
        s.d = tourClock(s.tourT, days);
      } else {
        s.d = follow(s.d, s.target, dt, FOLLOW, calm);
        if (!calm && s.mode === "user" && s.engaged === 0) {
          s.idle += dt;
          if (s.idle > TOUR_BACK) {
            s.mode = "tour";
            s.tourT = TOUR_START + clamp((s.d - 1) * SECONDS_PER_DAY, 0, (days - 1) * SECONDS_PER_DAY);
          }
        }
      }
      const day = dayOf(scenario, s.d);

      const want = teethOn(scenario, day, thresholdPhp);
      if (want !== s.wheelTo) {
        s.wheelFrom = s.teeth;
        s.wheelTo = want;
        s.wheelStart = s.t;
        s.wheelDur = want > s.wheelFrom ? 0.16 * Math.sqrt(want - s.wheelFrom) : 0.28 + 0.03 * (s.wheelFrom - want);
      }
      const u = calm ? 1 : (s.t - s.wheelStart) / s.wheelDur;
      s.teeth = u >= 1 ? s.wheelTo : s.wheelFrom + (s.wheelTo - s.wheelFrom) * easeInOut(u);
      const unwinding = s.wheelTo < s.wheelFrom && u < 1;
      s.lift = follow(s.lift, unwinding ? 1 : 0, dt, 0.05, calm);

      const rel = releasedOn(scenario, day);
      spring(s.bar, rel ? 1 : 0, dt, 520, 34, calm);
      if (rel) {
        if (s.relAt === null) s.relAt = calm ? s.t - 10 : s.t;
        s.fade = 1;
      } else if (s.relAt !== null) {
        s.fade = calm ? 0 : Math.max(0, s.fade - dt / 0.2);
        if (s.fade <= 0) s.relAt = null;
      } else {
        s.fade = calm ? 1 : Math.min(1, s.fade + dt / 0.25);
      }
      s.pan = follow(s.pan, rel ? 1 : 0, dt, 0.7, calm);
      draw();
    },
    [days, draw, scenario, thresholdPhp],
  );

  const kick = useLoop((dt, calm) => {
    advance(dt, calm);
    return true;
  }, visible && !asksForStillness());

  // Rest pose is the markup; paint the first frame (or the still frame under reduced motion) once mounted.
  React.useEffect(() => {
    const s = sim.current!;
    Object.assign(s, startSim(1));
    if (asksForStillness()) {
      s.mode = "user";
      s.d = stillDayOf(scenario);
      s.target = s.d;
    }
    advance(0, asksForStillness());
  }, [advance, scenario]);

  const take = () => {
    const s = sim.current!;
    if (s.mode === "tour") {
      s.mode = "user";
      s.target = s.d;
    }
    s.idle = 0;
  };

  const aim = (day: number) => {
    take();
    sim.current!.target = clamp(day, 1, days);
    if (asksForStillness()) advance(0, true);
    else kick();
  };

  const dayAtPointer = (clientX: number) => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box || !box.width) return null;
    return 1 + clamp((clientX - box.left) / box.width, 0, 1) * (days - 1);
  };

  const engage = (by: number) => {
    const s = sim.current!;
    s.engaged = Math.max(0, s.engaged + by);
    if (by < 0) s.idle = 0;
  };

  const startAria = `Strip-chart recorder replaying ${scenario.title}: arrow keys step the day, Home and End jump, Space pauses.`;

  return (
    <div
      ref={anchor}
      className="rc"
      role="slider"
      tabIndex={0}
      aria-label={startAria}
      aria-valuemin={1}
      aria-valuemax={days}
      aria-valuenow={1}
      aria-valuetext={RESTING_READOUT}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") engage(1);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") engage(-1);
      }}
      onPointerMove={(event) => {
        const day = dayAtPointer(event.clientX);
        if (day === null) return;
        if (event.pointerType === "mouse" || event.currentTarget.hasPointerCapture(event.pointerId)) aim(day);
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        engage(1);
        const day = dayAtPointer(event.clientX);
        if (day !== null) aim(day);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        engage(-1);
      }}
      onPointerCancel={() => engage(-1)}
      onFocus={() => engage(1)}
      onBlur={() => engage(-1)}
      onKeyDown={(event) => {
        const s = sim.current!;
        const here = Math.floor(s.d + 1e-6);
        const by = event.shiftKey ? 5 : 1;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") aim(here + by);
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") aim(here - by);
        else if (event.key === "Home") aim(1);
        else if (event.key === "End") aim(days);
        else if (event.key === " " || event.key === "Enter") {
          if (s.mode === "tour") aim(here);
          else {
            s.mode = "tour";
            s.tourT = TOUR_START + clamp((s.d - 1) * SECONDS_PER_DAY, 0, (days - 1) * SECONDS_PER_DAY);
            if (asksForStillness()) advance(0, true);
            else kick();
          }
        } else return;
        event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
