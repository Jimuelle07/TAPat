"use client";

import * as React from "react";
import { IsoFigure } from "@/app/_landing/iso/react/draw";
import { useInView, useLoop, useReadout, useStillness } from "@/app/_landing/iso/react/live";
import { dialAt } from "./frame";
import { REST_TIME, readoutOf, stateAt } from "./model";
import { gateShift, plateShift, shift } from "./view";
import { setAttr, setDisplay, setOpacity } from "../write";

interface Props {
  label: string;
  width: number;
  height: number;
  rest: string;
  base: React.ReactNode;
  pusher: React.ReactNode;
  pusherAt: string;
  inside: React.ReactNode;
  rails: React.ReactNode;
  gate: React.ReactNode;
  gateAt: string;
  topRail: React.ReactNode;
  chute: React.ReactNode;
  outside: React.ReactNode;
  front: React.ReactNode;
}

interface Nodes {
  coins: Array<{ in: SVGGElement; out: SVGGElement }>;
  minor: SVGPathElement | null;
  major: SVGPathElement | null;
  pointer: SVGPathElement | null;
  ribs: SVGPathElement[];
}

export function UnpaidLive(props: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const still = useStillness();
  const pusher = React.useRef<SVGGElement>(null);
  const gate = React.useRef<SVGGElement>(null);
  const run = React.useRef({ clock: REST_TIME, said: "", nodes: null as Nodes | null });

  useLoop((dt) => {
    const root = anchor.current;
    if (!root) return false;
    const state = run.current;
    if (!state.nodes) {
      const inside = Array.from(root.querySelectorAll<SVGGElement>('[data-layer="in"]'));
      const outside = Array.from(root.querySelectorAll<SVGGElement>('[data-layer="out"]'));
      const dial = root.querySelector("[data-rib]")?.closest("g");
      const tick = root.querySelectorAll<SVGPathElement>("[data-dial] > path");
      state.nodes = {
        coins: inside.map((node, index) => ({ in: node, out: outside[index] })),
        minor: tick[0] ?? null,
        major: tick[1] ?? null,
        pointer: root.querySelector<SVGPathElement>("[data-pointer]"),
        ribs: Array.from(dial?.querySelectorAll<SVGPathElement>("[data-rib]") ?? []),
      };
    }
    const { coins, minor, major, pointer, ribs } = state.nodes;
    state.clock += dt;
    const now = stateAt(state.clock);
    setAttr(pusher.current, "transform", plateShift(now.plate));
    setAttr(gate.current, "transform", gateShift(now.gate));
    now.coins.forEach((coin, index) => {
      const pair = coins[index];
      if (!pair) return;
      const onFloor = coin.place === "floor";
      const active = onFloor ? pair.in : pair.out;
      const idle = onFloor ? pair.out : pair.in;
      setDisplay(idle, "none");
      setDisplay(active, "");
      // while the dial counts, a wave runs along the idle coins: each lifts a little and glints as it passes
      const wave = onFloor && now.phase === "idle" ? Math.pow(0.5 + 0.5 * Math.sin(state.clock * 2.6 - (index % 5) * 0.9 - Math.floor(index / 5) * 2), 2) : 0;
      setAttr(active, "transform", shift(coin.offset[0], coin.offset[1], coin.offset[2] + 1.1 * wave));
      const glint = onFloor && now.phase === "idle" ? 0.6 + 0.4 * wave : coin.alpha;
      setOpacity(active, glint === 1 ? "" : `${glint}`);
    });
    const dial = dialAt(now.months);
    setAttr(minor, "d", dial.minor);
    setAttr(major, "d", dial.major);
    setAttr(pointer, "d", dial.pointer);
    dial.ribs.forEach((rib, index) => {
      setAttr(ribs[index], "d", rib.d);
      setOpacity(ribs[index], `${rib.alpha}`);
    });
    const text = readoutOf(now);
    if (text !== state.said) {
      say(text);
      state.said = text;
    }
    return true;
  }, visible && !still);

  return (
    <div ref={anchor} className="pf-live">
      <IsoFigure width={props.width} height={props.height} label={props.label}>
        {props.base}
        <g ref={pusher} transform={props.pusherAt}>
          {props.pusher}
        </g>
        {props.inside}
        {props.rails}
        <g ref={gate} transform={props.gateAt}>
          {props.gate}
        </g>
        {props.topRail}
        {props.chute}
        {props.outside}
        {props.front}
      </IsoFigure>
    </div>
  );
}
