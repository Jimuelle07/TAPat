"use client";

import * as React from "react";
import { IsoFigure } from "@/app/_landing/iso/react/draw";
import { follow, useInView, useLoop, useReadout, useStillness } from "@/app/_landing/iso/react/live";
import { orderOf, wiltOf } from "./frame";
import { REST_TIME, readoutOf, stateAt } from "./model";
import { POOL, here, shift, wispAt } from "./view";

interface Props {
  label: string;
  width: number;
  height: number;
  rest: string;
  back: React.ReactNode;
  crowd: React.ReactNode;
  front: React.ReactNode;
}

interface Nodes {
  layer: SVGGElement;
  people: Array<{ person: SVGGElement; wilt: SVGGElement; sweat: SVGPathElement }>;
  pool: SVGElement | null;
  rings: SVGElement | null;
  beams: SVGElement | null;
  bulb: SVGElement | null;
  wisps: SVGPathElement[];
}

const WISPS = 5;
const [POOL_SX, POOL_SY] = here(POOL);
const REST_HEAT = stateAt(REST_TIME).people.map((person) => person.heat);

export function QueueLive(props: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const still = useStillness();
  const run = React.useRef({ clock: REST_TIME, said: "", order: "", heat: REST_HEAT.slice(), nodes: null as Nodes | null });

  useLoop((dt) => {
    const root = anchor.current;
    if (!root) return false;
    const state = run.current;
    if (!state.nodes) {
      const layer = root.querySelector<SVGGElement>("[data-person]")?.parentElement as SVGGElement | null;
      if (!layer) return false;
      const people: Nodes["people"] = [];
      layer.querySelectorAll<SVGGElement>("[data-person]").forEach((person) => {
        people[Number(person.dataset.person)] = {
          person,
          wilt: person.querySelector<SVGGElement>("[data-wilt]") as SVGGElement,
          sweat: person.querySelector<SVGPathElement>("[data-sweat]") as SVGPathElement,
        };
      });
      state.nodes = {
        layer,
        people,
        pool: root.querySelector<SVGElement>("[data-pool]"),
        rings: root.querySelector<SVGElement>("[data-rings]"),
        beams: root.querySelector<SVGElement>("[data-beams]"),
        bulb: root.querySelector<SVGElement>("[data-bulb]"),
        wisps: Array.from(root.querySelectorAll<SVGPathElement>("[data-wisp]")),
      };
    }
    const { layer, people, pool, rings, beams, bulb, wisps } = state.nodes;
    state.clock += dt;
    const now = stateAt(state.clock);
    now.people.forEach((person, id) => {
      const node = people[id];
      // heat arrives and leaves over about a second, so a person sags and straightens gradually
      const heat = person.alpha < 1 ? person.heat : follow(state.heat[id], person.heat, dt, 0.45);
      state.heat[id] = heat;
      node.person.setAttribute("transform", shift(person.x, person.y, person.z));
      node.person.style.opacity = person.alpha === 1 ? "" : `${person.alpha}`;
      node.wilt.setAttribute("transform", wiltOf(heat));
      node.sweat.style.opacity = `${heat}`;
    });
    // the lamp breathes: bulb, beams and the pool's rings swell and ease together
    const beat = 0.5 + 0.5 * Math.sin(state.clock * 2.1);
    bulb?.style.setProperty("opacity", `${0.6 + 0.4 * beat}`);
    beams?.style.setProperty("opacity", `${0.35 + 0.65 * beat}`);
    pool?.style.setProperty("opacity", `${0.72 + 0.28 * beat}`);
    rings?.setAttribute("transform", `translate(${POOL_SX} ${POOL_SY}) scale(${0.93 + 0.1 * beat}) translate(${-POOL_SX} ${-POOL_SY})`);
    // heat shimmer: wavy wisps rising over the pool
    wisps.forEach((wisp, index) => {
      const phase = state.clock * 0.9 + index * 0.37;
      wisp.setAttribute("d", wispAt(index, WISPS, state.clock * 2.2));
      wisp.style.opacity = `${0.55 * Math.pow(Math.sin(Math.PI * (phase % 1)), 1.5)}`;
    });
    const order = orderOf(now);
    const key = order.join(",");
    if (key !== state.order) {
      for (const id of order) layer.appendChild(people[id].person);
      state.order = key;
    }
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
        {props.back}
        {props.crowd}
        <g>
          {Array.from({ length: WISPS }, (_, index) => (
            <path key={index} className="iso-line" data-tone="mid" data-free="" data-wisp="" style={{ opacity: 0 }} />
          ))}
        </g>
        {props.front}
      </IsoFigure>
    </div>
  );
}
