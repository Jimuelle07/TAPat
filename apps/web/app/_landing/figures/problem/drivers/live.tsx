"use client";

import * as React from "react";
import { IsoFigure } from "@/app/_landing/iso/react/draw";
import { follow, useInView, useLoop, useReadout, useStillness } from "@/app/_landing/iso/react/live";
import { COLS, FADE_ROWS, FILLED_AT, HOLD, NO_WIPE, PEGS, REST, readoutOf, stateAt } from "./model";
import { beamShift, dropShift, headShift, stripShift } from "./view";
import { setAttr } from "../write";

/** Where the tour starts: the finished board, with a moment left before the sweep. */
const START = FILLED_AT + HOLD - 0.8;

/** A dropped peg's flight: it falls from the loader tip, lands, and bounces once. */
const FLIGHT = 0.42;
const DROP = 14;
const BOUNCE = 1.8;
const SLOTS = 12;

const heightAt = (age: number) => {
  const a = age / FLIGHT;
  if (a < 0.6) {
    const s = a / 0.6;
    return DROP * (1 - s * s);
  }
  const s = (a - 0.6) / 0.4;
  return BOUNCE * 4 * s * (1 - s);
};

/** Signed shortest distance between two positions on a ten-digit wheel. */
const around = (gap: number) => ((((gap + 5) % 10) + 10) % 10) - 5;

interface Flight {
  index: number;
  at: number;
}

interface Props {
  label: string;
  width: number;
  height: number;
  rest: string;
  base: React.ReactNode;
  tray: React.ReactNode;
  plate: React.ReactNode;
  pegs: React.ReactNode;
  beamShadow: React.ReactNode;
  beam: React.ReactNode;
  head: React.ReactNode;
  counter: React.ReactNode;
  clips: React.ReactNode;
  strips: React.ReactNode[];
}

export function DriversLive(props: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const still = useStillness();
  const beam = React.useRef<SVGGElement>(null);
  const shadow = React.useRef<SVGGElement>(null);
  const head = React.useRef<SVGGElement>(null);
  const run = React.useRef({
    clock: START,
    /** Pegs shown standing in their holes (the ones still dropping are not). */
    shown: PEGS,
    /** Pegs released so far, standing or in flight. */
    placed: PEGS,
    said: PEGS,
    sweeping: false,
    flights: [] as Flight[],
    wheels: [REST.n % 10, Math.floor(REST.n / 10) % 10, Math.floor(REST.n / 100) % 10],
    rows: null as SVGGElement[] | null,
    fades: null as number[] | null,
    strips: null as SVGGElement[] | null,
    slots: null as SVGUseElement[] | null,
  });

  useLoop((dt) => {
    const state = run.current;
    const root = anchor.current;
    if (!root) return false;
    state.rows ??= Array.from(root.querySelectorAll<SVGGElement>(".pf-row"));
    state.strips ??= Array.from(root.querySelectorAll<SVGGElement>("[data-strip]"));
    state.slots ??= Array.from(root.querySelectorAll<SVGUseElement>(".pf-fly"));
    state.fades ??= state.rows.map(() => 1);
    state.clock += dt;
    const now = stateAt(state.clock);
    const rows = state.rows;

    const showRows = (from: number, to: number, count: number) => {
      for (let row = Math.floor(from / COLS); row <= Math.floor((to - 1) / COLS); row++) {
        rows[row]?.setAttribute("data-n", `${Math.max(0, Math.min(COLS, count - row * COLS))}`);
      }
    };

    if (now.wipe < NO_WIPE) {
      // Sweep: the beam runs back down the board and each row fades a little behind it.
      state.sweeping = true;
      rows.forEach((row, index) => {
        const lag = Math.min(1, Math.max(0, (index - now.wipe) / FADE_ROWS));
        const fade = 1 - lag * lag * (3 - 2 * lag);
        if (fade !== state.fades![index]) {
          state.fades![index] = fade;
          row.style.opacity = fade === 1 ? "" : `${fade}`;
        }
      });
    } else if (state.sweeping) {
      // The board is bare: forget the faded rows so the refill starts clean.
      state.sweeping = false;
      rows.forEach((row, index) => {
        row.setAttribute("data-n", "0");
        row.style.opacity = "";
        state.fades![index] = 1;
      });
      state.shown = 0;
      state.placed = 0;
      state.flights = [];
    }

    if (!state.sweeping) {
      // New pegs leave the loader tip now and land FLIGHT later; a row shows only the ones that have landed.
      for (let index = state.placed; index < now.n; index++) state.flights.push({ index, at: state.clock });
      state.placed = now.n;
      state.flights = state.flights.filter((flight) => state.clock - flight.at < FLIGHT);
      const landed = state.placed - state.flights.length;
      if (landed !== state.shown) {
        const [from, to] = landed > state.shown ? [state.shown, landed] : [landed, state.shown];
        showRows(from, to, landed);
        state.shown = landed;
      }
      state.slots.forEach((slot, index) => {
        const flight = state.flights[index];
        if (!flight) {
          if (!slot.hasAttribute("data-hidden")) slot.setAttribute("data-hidden", "");
          return;
        }
        const spot = rows[Math.floor(flight.index / COLS)]?.children[flight.index % COLS];
        if (!spot) return;
        setAttr(slot, "x", spot.getAttribute("x") ?? "0");
        setAttr(slot, "y", spot.getAttribute("y") ?? "0");
        setAttr(slot, "transform", dropShift(heightAt(state.clock - flight.at)));
        slot.removeAttribute("data-hidden");
      });
    }

    if (now.n !== state.said) {
      state.said = now.n;
      say(readoutOf(now.n));
    }

    const shift = beamShift(now.row);
    setAttr(beam.current, "transform", shift);
    setAttr(shadow.current, "transform", shift);
    setAttr(head.current, "transform", headShift(now.col));

    // tally counter: three geared wheels, each turning the short way round to its digit
    const targets = [now.n, Math.floor(now.n / 10), Math.floor(now.n / 100)];
    targets.forEach((target, wheel) => {
      const was = state.wheels[wheel];
      const next = follow(0, around(target - was), dt, wheel === 0 ? 0.06 : 0.14);
      state.wheels[wheel] = (((was + next) % 10) + 10) % 10;
      setAttr(state.strips?.[2 - wheel], "transform", stripShift(state.wheels[wheel]));
    });
    return true;
  }, visible && !still);

  return (
    <div ref={anchor} className="pf-live">
      <IsoFigure width={props.width} height={props.height} label={props.label}>
        {props.base}
        {props.tray}
        {props.plate}
        <g ref={shadow} transform={beamShift(REST.row)}>
          {props.beamShadow}
        </g>
        {props.pegs}
        <g>
          {Array.from({ length: SLOTS }, (_, slot) => (
            <use key={slot} className="pf-fly" href="#pf-dr-peg" data-hidden="" />
          ))}
        </g>
        <g ref={beam} transform={beamShift(REST.row)}>
          {props.beam}
          <g ref={head} transform={headShift(REST.col)}>
            {props.head}
          </g>
        </g>
        {props.counter}
        {props.clips}
        {props.strips.map((strip, wheel) => (
          <g key={wheel}>{strip}</g>
        ))}
      </IsoFigure>
    </div>
  );
}
