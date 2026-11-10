"use client";

import * as React from "react";
import { IsoFigure } from "@/app/_landing/iso/react/draw";
import { useInView, useLoop, useReadout, useStillness } from "@/app/_landing/iso/react/live";
import { heapShown, levelPath, mouthShown } from "./frame";
import { HOP, REST_TIME, STREAMS, fallTime, readoutOf, stateAt } from "./model";
import { drawerShift, flightShift } from "./view";
import { setAttr, setDisplay, setOpacity } from "../write";

interface Props {
  label: string;
  width: number;
  height: number;
  rest: string;
  parts: React.ReactNode;
}

interface Nodes {
  flights: Map<string, SVGGElement>;
  heap: Array<{ node: SVGElement; threshold: number }>;
  mouth: SVGElement[];
  level: SVGPathElement | null;
  drawers: SVGElement[][];
}

/** A drawer's rock when a coin lands: a quick damped swing along its runners. */
const rock = (since: number) => 0.75 * Math.exp(-since * 9) * Math.sin(since * 2 * Math.PI * 7);

export function LeakLive({ label, width, height, parts }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const still = useStillness();
  const run = React.useRef({ clock: REST_TIME, said: "", level: "", rocks: ["", "", ""], nodes: null as Nodes | null });

  useLoop((dt) => {
    const root = anchor.current;
    if (!root) return false;
    const state = run.current;
    state.nodes ??= {
      flights: new Map(Array.from(root.querySelectorAll<SVGGElement>("[data-flight]")).map((node) => [node.dataset.flight ?? "", node])),
      heap: Array.from(root.querySelectorAll<SVGElement>("[data-heap]")).map((node) => ({ node, threshold: Number(node.getAttribute("data-threshold")) })),
      mouth: Array.from(root.querySelectorAll<SVGElement>("[data-mouth]")),
      level: root.querySelector<SVGPathElement>("[data-level]"),
      drawers: [0, 1, 2].map((index) => Array.from(root.querySelectorAll<SVGElement>(`[data-drawer="${index}"]`))),
    };
    const { flights, heap, mouth, level, drawers } = state.nodes;
    state.clock += dt;
    const now = stateAt(state.clock);
    const flying = new Map(now.flights.map((f) => [`${f.stream}-${f.slot}`, f]));
    for (const [key, node] of flights) {
      const flight = flying.get(key);
      if (!flight) {
        setDisplay(node, "none");
        continue;
      }
      setDisplay(node, "");
      setAttr(node, "transform", flightShift(flight.stream, flight.age));
      const settle = (flight.age - fallTime(STREAMS[flight.stream])) / HOP;
      setOpacity(node, settle > 0.8 ? `${Math.max(0, (1 - settle) / 0.2)}` : "");
    }
    const rocking = [0, 0, 0];
    for (const flight of now.flights) {
      const stream = STREAMS[flight.stream];
      const since = flight.age - fallTime(stream);
      if (since > 0) rocking[stream.drawer] += rock(since);
    }
    for (let index = 0; index < 3; index++) {
      const value = Math.abs(rocking[index]) < 0.01 ? "" : drawerShift(rocking[index]);
      if (value === state.rocks[index]) continue;
      state.rocks[index] = value;
      for (const node of drawers[index]) {
        if (value) node.setAttribute("transform", value);
        else node.removeAttribute("transform");
      }
    }
    for (const { node, threshold } of heap) {
      const shown = heapShown(threshold, now.leaked);
      const hidden = node.style.display === "none";
      if (shown === hidden) node.style.display = shown ? "" : "none";
    }
    mouth.forEach((node, index) => {
      const value = mouthShown(index, mouth.length, now.leaked) ? "" : "0";
      if (node.style.opacity !== value) node.style.opacity = value;
    });
    const d = levelPath(1 - now.leaked);
    if (level && d !== state.level) {
      level.setAttribute("d", d);
      state.level = d;
    }
    const text = readoutOf(now.leaked);
    if (text !== state.said) {
      say(text);
      state.said = text;
    }
    return true;
  }, visible && !still);

  return (
    <div ref={anchor} className="pf-live">
      <IsoFigure width={width} height={height} label={label}>
        {parts}
      </IsoFigure>
    </div>
  );
}
