"use client";

import * as React from "react";
import { asksForStillness, follow, useInView, useLoop, useReadout } from "@/app/_landing/iso/react/live";
import { drawOf, poseAt, stationU, tourAt, tourU, TOUR_LENGTH, U_END, U_REST, type Draw } from "./frame";
import type { Truth } from "./truth";
import { STATION, WIDTH, at } from "./view";

const FIRST = 1.4;
const QUIET = 3600;
const GLIDE = 0.32;
const HOLD_U = 8.2;
const STOPS = [...STATION.map((_, i) => stationU(i)), HOLD_U];
const SCREEN_X = STATION.map((x) => at([x, 0, 0])[0]);
const FREEZE_STATION = 5;
const DECIDED = 5.0;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Nodes {
  moves: Array<[string, SVGGElement]>;
  lines: Array<[string, SVGPathElement]>;
  solids: Array<[string, SVGGElement]>;
  flags: Array<[string, Element]>;
  vis: Array<[string, SVGGElement]>;
}

const collect = (root: HTMLElement): Nodes => ({
  moves: [...root.querySelectorAll<SVGGElement>("[data-m]")].map((node) => [node.dataset.m!, node]),
  lines: [...root.querySelectorAll<SVGPathElement>("[data-d]")].map((node) => [node.dataset.d!, node]),
  solids: [...root.querySelectorAll<SVGGElement>("[data-solid]")].map((node) => [node.dataset.solid!, node]),
  flags: [...root.querySelectorAll("[data-flag]")].map((node) => [node.getAttribute("data-flag")!, node]),
  vis: [...root.querySelectorAll<SVGGElement>("[data-vis]")].map((node) => [node.dataset.vis!, node]),
});

function write(nodes: Nodes, draw: Draw, seen: Map<string, string>) {
  const put = (key: string, value: string, apply: () => void) => {
    if (seen.get(key) === value) return;
    seen.set(key, value);
    apply();
  };
  nodes.moves.forEach(([name, node], index) => {
    const transform = draw.move[name];
    if (transform === undefined) return;
    put(`m:${name}:${index}`, transform, () => node.setAttribute("transform", transform));
    if (name.startsWith("chip")) put(`o:${name}:${index}`, `${draw.opacity}`, () => (node.style.opacity = `${draw.opacity}`));
  });
  for (const [name, node] of nodes.lines) {
    const d = draw.lines[name];
    if (d !== undefined) put(`d:${name}`, d, () => node.setAttribute("d", d));
  }
  for (const [name, node] of nodes.solids) {
    const paths = draw.solids[name];
    if (!paths) continue;
    const values: Record<string, string> = { fill: paths.fill, outline: paths.outline, top: paths.top, s0: paths.shades[0] ?? "", s1: paths.shades[1] ?? "", s2: paths.shades[2] ?? "", s3: paths.shades[3] ?? "" };
    for (const part of node.querySelectorAll<SVGPathElement>("[data-f]")) {
      const key = part.dataset.f!;
      const value = values[key];
      if (value !== undefined) put(`s:${name}:${key}`, value, () => part.setAttribute("d", value));
    }
  }
  for (const [spec, node] of nodes.vis) {
    const negate = spec.startsWith("!");
    const on = draw.flags[negate ? spec.slice(1) : spec];
    if (on === undefined) continue;
    const shown = negate ? !on : on;
    put(`v:${spec}`, shown ? "1" : "0", () => (node.style.display = shown ? "" : "none"));
  }
  nodes.flags.forEach(([name, node], index) => {
    const on = draw.flags[name];
    if (on === undefined) return;
    put(`f:${name}:${index}`, on ? "1" : "0", () => {
      if (node.tagName === "path") node.setAttribute("data-tone", on ? "lit" : (node.getAttribute("data-tone0") ?? "lo"));
      else if (node.querySelector(".iso-wire")) node.querySelector(".iso-line")?.toggleAttribute("data-flow", on);
      else node.firstElementChild?.toggleAttribute("data-lit", on);
    });
  });
}

interface Props {
  truth: Truth;
  rest: string;
}

/* Renders nothing but a hidden marker: the art is server HTML in the .as-live node just before it, so none of it is
   sent again as props. This drives that node by name and listens on it. */
export function AssemblyLive({ truth, rest }: Props) {
  const { anchor: anchorRef, say } = useReadout<HTMLDivElement>();
  const nodes = React.useRef<Nodes | null>(null);
  const seen = React.useRef(new Map<string, string>());
  const visible = useInView(anchorRef);
  const spoken = React.useRef(rest);

  const state = React.useRef({
    u: U_REST,
    target: U_REST,
    frozen: false,
    clock: 0,
    tour: false,
    tourT: tourAt(U_REST),
    pending: null as null | { frozen: boolean; resume: number },
    pan: 0,
    mark: "",
    placed: false,
    latch: 0,
    stopped: false,
  });

  const frame = React.useCallback(
    (dt: number, calm: boolean) => {
      const s = state.current;
      const root = anchorRef.current;
      if (!root) return false;
      if (!nodes.current) nodes.current = collect(root);
      s.clock += calm ? 0 : dt;
      if (s.tour && !calm) {
        s.tourT += dt;
        if (s.tourT >= TOUR_LENGTH) {
          s.tourT -= TOUR_LENGTH;
          s.frozen = !s.frozen;
        }
        s.u = tourU(s.tourT);
        s.target = s.u;
      } else {
        if (s.pending) {
          s.target = Math.min(s.target, DECIDED);
          if (s.u <= DECIDED + 0.01) {
            s.frozen = s.pending.frozen;
            s.target = s.pending.resume;
            s.pending = null;
          }
        }
        s.u = calm ? s.target : follow(s.u, s.target, dt, GLIDE, false);
      }
      const pose = poseAt(s.u, s.frozen, s.clock, truth);
      write(nodes.current, drawOf(pose), seen.current);
      say(pose.say);
      const mark = `${pose.step}:${s.frozen}`;
      if (s.mark !== mark) {
        s.mark = mark;
        const final = poseAt(stationU(pose.step), s.frozen, 0, truth).say;
        if (final !== spoken.current) {
          spoken.current = final;
          root.setAttribute("aria-valuetext", final);
          root.setAttribute("aria-valuenow", `${pose.step + 1}`);
        }
      }
      const box = root.firstElementChild as HTMLElement | null;
      if (box) {
        const over = box.offsetWidth - root.clientWidth;
        if (over > 1) {
          const head = pose.chips[0] ?? { x: 0, y: 0 };
          const focus = at([head.x, head.y, 0])[0] / WIDTH;
          const want = clamp(focus * box.offsetWidth - root.clientWidth / 2, 0, over);
          s.pan = calm || !s.placed ? want : follow(s.pan, want, dt, 0.4, false);
          s.placed = true;
          box.style.transform = `translateX(${-Math.round(s.pan * 10) / 10}px)`;
        } else if (s.pan !== 0) {
          s.pan = 0;
          box.style.transform = "";
        }
      }
      return !calm;
    },
    [anchorRef, say, truth],
  );

  const kick = useLoop(frame, visible);

  /* The idle tour: starts a moment after the figure is seen, and comes back a while after the reader lets go. */
  const resume = React.useCallback(
    (after: number) => {
      const s = state.current;
      clearTimeout(s.latch);
      s.latch = window.setTimeout(() => {
        if (asksForStillness()) return;
        s.tourT = tourAt(clamp(s.u, 0, U_END));
        s.tour = true;
        kick();
      }, after);
    },
    [kick],
  );

  React.useEffect(() => {
    const s = state.current;
    if (!visible) {
      s.tour = false;
      clearTimeout(s.latch);
      return;
    }
    frame(1 / 60, true);
    if (!s.tour && !s.stopped && !asksForStillness()) resume(FIRST * 1000);
    return () => {
      clearTimeout(s.latch);
    };
  }, [visible, resume, frame]);

  const take = React.useCallback(() => {
    const s = state.current;
    s.tour = false;
    resume(QUIET);
  }, [resume]);

  const stepTo = React.useCallback(
    (u: number) => {
      const s = state.current;
      s.stopped = false;
      take();
      s.target = clamp(u, 0, U_END);
      kick();
    },
    [take, kick],
  );

  const toggleFrozen = React.useCallback(() => {
    const s = state.current;
    take();
    const resumeAt = s.pending ? s.pending.resume : s.target;
    s.pending = { frozen: !(s.pending ? s.pending.frozen : s.frozen), resume: resumeAt };
    kick();
  }, [take, kick]);

  React.useEffect(() => {
    const root = anchorRef.current;
    if (!root) return;
    const stationAt = (clientX: number) => {
      const box = root.querySelector("svg")?.getBoundingClientRect();
      if (!box || !box.width) return null;
      const sx = ((clientX - box.left) / box.width) * WIDTH;
      let best = 0;
      SCREEN_X.forEach((x, i) => {
        if (Math.abs(x - sx) < Math.abs((SCREEN_X[best] ?? 0) - sx)) best = i;
      });
      return best;
    };
    const here = () => {
      const s = state.current;
      return Math.min(7, Math.floor(s.u) + (s.u - Math.floor(s.u) >= 0.82 ? 1 : 0));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const i = stationAt(event.clientX);
      if (i !== null) stepTo(stationU(i));
    };
    const onPointerDown = (event: PointerEvent) => {
      const i = stationAt(event.clientX);
      if (i === null) return;
      if (i === FREEZE_STATION && here() === FREEZE_STATION && event.pointerType !== "mouse") toggleFrozen();
      else stepTo(stationU(i));
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") resume(900);
    };
    const onKey = (event: KeyboardEvent) => {
      const s = state.current;
      const stops = STOPS;
      const index = stops.findIndex((u) => Math.abs(u - s.target) < 0.05);
      const at0 = index >= 0 ? index : here();
      if (event.key === "ArrowRight" || event.key === "ArrowUp") stepTo(stops[(at0 + 1) % stops.length] ?? stops[0]!);
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") stepTo(stops[(at0 + stops.length - 1) % stops.length] ?? stops[0]!);
      else if (event.key === "Home") stepTo(stops[0]!);
      else if (event.key === "End") stepTo(stops[STATION.length]!);
      else if (event.key === "f" || event.key === "F") toggleFrozen();
      else if (event.key === " " || event.key === "Enter") {
        if (s.tour) {
          s.stopped = true;
          s.tour = false;
          clearTimeout(s.latch);
        } else {
          s.stopped = false;
          s.tourT = tourAt(clamp(s.u, 0, U_END));
          s.tour = true;
          kick();
        }
      } else if (event.key === "Escape") {
        s.stopped = false;
        resume(0);
      } else return;
      event.preventDefault();
    };
    const onFocus = () => take();
    const onBlur = () => resume(900);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("keydown", onKey);
    root.addEventListener("focus", onFocus);
    root.addEventListener("blur", onBlur);
    return () => {
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("focus", onFocus);
      root.removeEventListener("blur", onBlur);
    };
  }, [anchorRef, stepTo, take, toggleFrozen, resume, kick]);

  React.useEffect(() => {
    if (asksForStillness()) {
      const s = state.current;
      s.tour = false;
      kick();
    }
  }, [kick]);

  /* The art is server HTML: the figure's node sits just before this marker. */
  const bind = React.useCallback(
    (marker: HTMLSpanElement | null) => {
      anchorRef.current = (marker?.previousElementSibling as HTMLDivElement | null) ?? null;
    },
    [anchorRef],
  );

  return <span hidden ref={bind} />;
}

