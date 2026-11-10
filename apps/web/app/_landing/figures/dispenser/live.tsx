"use client";

import * as React from "react";
import type { SolidPaths } from "../../iso/iso-kit";
import { IsoFigure } from "../../iso/react/draw";
import { useLoop, useReadout } from "../../iso/react/live";
import { arcShift, boxLiquid, cardLiquid, glyphOf, latchPaths, leverPaths, shiftOf, translate } from "./frame";
import { NOTCH_DEG } from "./kin";
import {
  angleNow,
  BEAT_LENGTH,
  BEAT_NAME,
  BEATS,
  CAP,
  CARD_PESO,
  type Copy,
  FUNDED,
  gateShare,
  machineAt,
  type Machine,
  MARK,
  priceShare,
  readoutOf,
  step,
  TAP_NO,
  TAP_OK,
  targetsAt,
  wheelText,
} from "./model";
import { askX, ASK_MAX, HEIGHT, PIECES, SLIDE_RATE, WIDTH, at } from "./view";
import { MAX_DEG, CATCH_U, LEVER_L, WEIGHT_U } from "./kin";

const TOUR_FIRST = 1.4;
const TOUR_BACK = 3.6;

interface SolidNodes {
  group: SVGGElement;
  fill: SVGPathElement | null;
  shades: Array<SVGPathElement | null>;
  top: SVGPathElement | null;
  crease: SVGPathElement | null;
  edge: SVGPathElement | null;
  /** The inputs the paths were last built from; skip the rebuild when they repeat. */
  ka: number;
  kb: number;
}

interface Item {
  node: SVGGElement;
  key: number;
  lift: number;
  piece: string;
}

interface Dom {
  items: Item[];
  layer: SVGGElement;
  pieces: Map<string, SVGGElement[]>;
  moved: Map<string, string>;
  sig: number[];
  wheelAt: number[];
  overPrice: number;
  overWheels: string;
  glyphs: SVGTextElement[][];
  lever: SolidNodes | null;
  latch: SolidNodes | null;
  liquids: Array<SolidNodes | null>;
  box: SolidNodes | null;
  lamp: Element | null;
  paid: Element | null;
  declined: Element | null;
  line1: SVGTextElement | null;
  line2: SVGTextElement | null;
  plunger: Element | null;
  cord: SVGGElement | null;
  cordParts: Array<Element | undefined>;
  cordOpacity: string;
  cordPlunger: number;
  cordAsk: number;
  hint: Element | null;
}

const solidNodes = (group: SVGGElement | null): SolidNodes | null =>
  group
    ? {
        group,
        fill: group.querySelector(".iso-fill"),
        shades: [0, 1, 2, 3].map((shade) => group.querySelector(`.iso-shade[data-shade="${shade}"]`)),
        top: group.querySelector(".iso-top"),
        crease: group.querySelector(".iso-crease"),
        edge: group.querySelector(".iso-edge"),
        ka: NaN,
        kb: NaN,
      }
    : null;

const written = new WeakMap<Element, string>();

/** Set `d` only when it differs from what was last written. */
function put(node: Element | null | undefined, name: string, value: string) {
  if (!node) return;
  const key = name === "d" ? value : `${name}=${value}`;
  if (written.get(node) === key) return;
  written.set(node, key);
  node.setAttribute(name, value);
}

function writeSolid(nodes: SolidNodes | null, paths: SolidPaths) {
  if (!nodes) return;
  put(nodes.fill, "d", paths.fill);
  nodes.shades.forEach((node, shade) => put(node, "d", paths.shades[shade] ?? ""));
  put(nodes.top, "d", paths.top);
  put(nodes.crease, "d", paths.crease);
  put(nodes.edge, "d", paths.outline);
}

const set = (node: Element | null | undefined, name: string, value: string | null) => {
  if (!node) return;
  if (value === null) node.removeAttribute(name);
  else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
};

const solidOf = new WeakMap<Element, Element | null>();

const setLit = (node: Element | null | undefined, on: boolean) => {
  if (!node) return;
  let solid = solidOf.get(node);
  if (solid === undefined) {
    solid = node.matches(".iso-solid") ? node : node.querySelector(".iso-solid");
    solidOf.set(node, solid);
  }
  set(solid, "data-lit", on ? "" : null);
};

function collect(root: HTMLElement): Dom {
  const layer = root.querySelector<SVGGElement>("[data-layer]")!;
  const items = Array.from(layer.children).map((child) => {
    const node = child as SVGGElement;
    return { node, key: Number(node.dataset.k), lift: Number(node.dataset.m ?? 0), piece: node.dataset.piece ?? "" };
  });
  const pieces = new Map<string, SVGGElement[]>();
  for (const item of items) if (item.piece) pieces.set(item.piece, [...(pieces.get(item.piece) ?? []), item.node]);
  const live = (name: string) => root.querySelector<SVGGElement>(`[data-live="${name}"]`);
  const cord = root.querySelector<SVGGElement>("[data-cord]");
  return {
    items,
    layer,
    pieces,
    moved: new Map<string, string>(),
    sig: [NaN, NaN, NaN, NaN],
    wheelAt: [NaN, NaN, NaN, NaN],
    overPrice: NaN,
    overWheels: "",
    glyphs: [0, 1, 2, 3].map((wheel) => Array.from(root.querySelectorAll<SVGTextElement>(`[data-live="wheel${wheel}"] [data-glyph]`))),
    lever: solidNodes(live("lever")?.querySelector(".iso-solid") ?? null),
    latch: solidNodes(live("latch")?.querySelector(".iso-solid") ?? null),
    liquids: [0, 1, 2].map((card) => solidNodes(live(`liquid${card}`)?.querySelector(".iso-solid") ?? null)),
    box: solidNodes(live("boxLiquid")?.querySelector(".iso-solid") ?? null),
    lamp: live("lamp"),
    paid: live("lampPaid"),
    declined: live("lampDecl"),
    line1: root.querySelector<SVGTextElement>('[data-live="line1"]'),
    line2: root.querySelector<SVGTextElement>('[data-live="line2"]'),
    plunger: root.querySelector('[data-id="reader.plunger"]'),
    cord,
    cordParts: cord ? [cord.querySelector("path") ?? undefined, ...Array.from(cord.querySelectorAll("circle"))] : [],
    cordOpacity: "",
    cordPlunger: NaN,
    cordAsk: NaN,
    hint: root.closest(".iso-plate")?.querySelector('[data-corner="hint"]') ?? null,
  };
}

interface Run {
  beat: number;
  t: number;
  mode: "rest" | "tour" | "play";
  quiet: number;
  engaged: boolean;
  machine: Machine;
  shown: string;
  order: string;
  announced: number;
  clock: number; // seconds of motion, for the ambient sway and shimmer
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function DispenserLive({ art, copy, label }: { art: string; copy: Copy; label: string }) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const dom = React.useRef<Dom | null>(null);
  const announce = React.useRef<HTMLSpanElement | null>(null);
  const run = React.useRef<Run>({ beat: 0, t: 0, mode: "rest", quiet: 0, engaged: false, machine: machineAt(0), shown: "", order: "", announced: -1, clock: 0 });
  const onscreen = React.useRef(false);

  const money = (pesos: number) => copy.money[clamp(Math.round(pesos / 100), 0, copy.money.length - 1)]!;

  const paint = () => {
    const d = dom.current;
    if (!d) return;
    const r = run.current;
    const m = r.machine;
    const targets = targetsAt(r.beat, Math.min(r.t, BEAT_LENGTH[r.beat]!));

    // Wheels.
    m.wheel.forEach((position, wheel) => {
      if (d.wheelAt[wheel] === position) return;
      d.wheelAt[wheel] = position;
      d.glyphs[wheel]?.forEach((node, digit) => {
        const glyph = glyphOf(wheel, digit, position);
        set(node, "transform", glyph.transform);
        set(node, "opacity", `${Math.round(glyph.opacity * 100) / 100}`);
      });
    });
    if (d.overPrice !== m.price || d.overWheels !== wheelText(m)) {
      d.overPrice = m.price;
      d.overWheels = wheelText(m);
      setLit(d.lamp, Number(d.overWheels) >= MARK && m.price >= MARK - 0.01);
    }

    // Moving parts: each piece has a share of its full travel.
    const angle = angleNow(m);
    const rideShare = clamp((angle - NOTCH_DEG[0]!) / (MAX_DEG - NOTCH_DEG[0]!), 0, 1);
    const shareOf = (piece: string) =>
      piece === "index" ? priceShare(m) : piece === "ask" ? m.ask / ASK_MAX : piece === "plunger" ? m.plunger / CAP : piece === "gate" ? gateShare(m) : piece === "weight" || piece === "tip" || piece === "catch" ? rideShare : 0;
    for (const [piece, nodes] of d.pieces) {
      let offset: [number, number];
      if (piece === "weight") {
        // The weight hangs a little behind the lever (a spring, kicked by the lever's own motion) and never quite stops swaying.
        const [dx, dy] = arcShift(NOTCH_DEG[0]!, angle, WEIGHT_U);
        const [sx, sy] = shiftOf(0, 0, m.sway.at + (r.clock > 0 ? 1.0 * Math.sin(r.clock * 3.4) : 0));
        offset = [dx + sx, dy + sy];
      } else if (piece === "tip") offset = arcShift(NOTCH_DEG[0]!, angle, LEVER_L);
      else if (piece === "catch") offset = arcShift(NOTCH_DEG[0]!, angle, CATCH_U);
      else {
        const share = shareOf(piece);
        const vector = PIECES[piece]!;
        offset = shiftOf(vector[0] * share, vector[1] * share, vector[2] * share);
      }
      const text = translate(offset);
      if (d.moved.get(piece) === text) continue;
      d.moved.set(piece, text);
      for (const node of nodes) set(node, "transform", text || null);
    }

    set(anchor.current, "data-flowing", targets.flow ? "" : null);

    // Rebuilt solids: lever, latch, the levels.
    const shimmer = (phase: number, busy: number) => (r.clock > 0 ? (0.45 + 1.1 * busy) * (Math.sin(r.clock * 7.3 + phase) * 0.6 + Math.sin(r.clock * 11.9 + phase * 2.1) * 0.4) : 0);
    if (d.lever && d.lever.ka !== angle) {
      d.lever.ka = angle;
      writeSolid(d.lever, leverPaths(angle));
    }
    if (d.latch && d.latch.ka !== m.latch) {
      d.latch.ka = m.latch;
      writeSolid(d.latch, latchPaths(m.latch));
    }
    m.fill.forEach((pesos, card) => {
      const nodes = d.liquids[card];
      if (!nodes) return;
      const ripple = pesos > 1 ? shimmer(card * 2.1, clamp(Math.abs(targets.fill[card]! - pesos) / 150, 0, 1)) : 0;
      if (nodes.ka === pesos && nodes.kb === ripple) return;
      nodes.ka = pesos;
      nodes.kb = ripple;
      writeSolid(nodes, cardLiquid(card, pesos, CARD_PESO, ripple));
    });
    if (d.box) {
      const ripple = m.box > 1 ? shimmer(5, clamp(Math.abs(targets.box - m.box) / 150, 0, 1)) : 0;
      if (d.box.ka !== m.box || d.box.kb !== ripple) {
        d.box.ka = m.box;
        d.box.kb = ripple;
        writeSolid(d.box, boxLiquid(m.box, FUNDED, ripple));
      }
    }

    // Lamps, display, tension cord.
    setLit(d.paid, m.paid > 0.5);
    setLit(d.declined, m.declined > 0.5);
    const asking = m.want > 0;
    const line1 = m.declined > 0.5 ? money(TAP_NO) : m.paid > 0.5 ? money(TAP_OK) : asking ? money(m.want) : `STOP ${money(CAP)}`;
    const line2 = m.declined > 0.5 ? "DECLINED" : m.paid > 0.5 ? "PAID" : asking ? "TAP …" : "TAP CARD";
    if (d.line1 && d.line1.textContent !== line1) d.line1.textContent = line1;
    if (d.line2 && d.line2.textContent !== line2) d.line2.textContent = line2;
    const gap = (m.ask - m.plunger) * SLIDE_RATE;
    if (d.cord) {
      const alpha = clamp((gap - 0.6) / 2.4, 0, 1);
      const opacity = `${Math.round(alpha * 100) / 100}`;
      if (d.cordOpacity !== opacity) {
        d.cordOpacity = opacity;
        d.cord.style.opacity = opacity;
      }
      if (alpha > 0 && (d.cordPlunger !== m.plunger || d.cordAsk !== m.ask)) {
        d.cordPlunger = m.plunger;
        d.cordAsk = m.ask;
        const head = at([askX(m.plunger), 13.4, 61]);
        const flag = at([askX(m.ask), 10.4, 53.5]);
        const [path, a, b] = d.cordParts;
        put(path, "d", `M${head[0].toFixed(1)} ${head[1].toFixed(1)}L${flag[0].toFixed(1)} ${flag[1].toFixed(1)}`);
        put(a, "cx", head[0].toFixed(1));
        put(a, "cy", head[1].toFixed(1));
        put(b, "cx", flag[0].toFixed(1));
        put(b, "cy", flag[1].toFixed(1));
      }
    }

    // The one lit accent: the part the beat is about.
    const lit = (node: Element | null | undefined, on: boolean) => setLit(node, on);
    lit(d.lever?.group, r.beat === 0);
    d.liquids.forEach((nodes, card) => lit(nodes?.group, r.beat === 1 && m.fill[card]! > 1 && m.fill[card]! < CARD_PESO - 1));
    lit(d.plunger, r.beat === 2);
    lit(d.box?.group, r.beat === 3);

    // Painter's order for the parts that move: key + lift × share, re-append only when it changes. Keys depend on four shares only.
    const sig = d.sig;
    const priceNow = priceShare(m);
    const askNow = m.ask / ASK_MAX;
    const plungerNow = m.plunger / CAP;
    if (sig[0] !== priceNow || sig[1] !== askNow || sig[2] !== plungerNow || sig[3] !== rideShare) {
      sig[0] = priceNow;
      sig[1] = askNow;
      sig[2] = plungerNow;
      sig[3] = rideShare;
      const sortShare = (piece: string) => (piece === "index" ? priceNow : piece === "ask" ? askNow : piece === "plunger" ? plungerNow : piece === "gate" || piece === "weight" || piece === "tip" || piece === "catch" ? rideShare : 0);
      const keys = d.items.map((item) => item.key + (item.piece ? item.lift * sortShare(item.piece) : 0));
      const order = d.items
        .map((_, index) => index)
        .sort((a, b) => keys[a]! - keys[b]! || a - b)
        .join(",");
      if (order !== r.order) {
        r.order = order;
        const fragment = document.createDocumentFragment();
        for (const index of order.split(",")) fragment.appendChild(d.items[Number(index)]!.node);
        d.layer.appendChild(fragment);
      }
    }

    const text = readoutOf(m, r.beat, copy);
    if (text !== r.shown) {
      r.shown = text;
      say(text);
    }
  };

  const announceBeat = (beat: number) => {
    const r = run.current;
    if (r.announced === beat) return;
    r.announced = beat;
    const d = dom.current;
    const name = `${beat + 1} / ${BEATS} · ${BEAT_NAME[beat]}`;
    if (d?.hint) d.hint.textContent = name;
    if (announce.current) announce.current.textContent = `Step ${beat + 1} of ${BEATS}: ${BEAT_NAME[beat]}`;
    anchor.current?.setAttribute("aria-label", `${label} Step ${beat + 1} of ${BEATS}: ${BEAT_NAME[beat]}. Press to go to the next step.`);
  };

  const kick = useLoop((dt, calm) => {
    if (!onscreen.current) return false;
    const r = run.current;
    if (!dom.current) dom.current = anchor.current ? collect(anchor.current) : null;
    r.quiet = r.engaged ? 0 : r.quiet + dt;
    if (!calm) r.clock += dt;
    if (calm) {
      // Still frame: each beat shows its finished state at once.
      step(r.machine, targetsAt(r.beat, BEAT_LENGTH[r.beat]!), 0, true);
      r.t = BEAT_LENGTH[r.beat]!;
      announceBeat(r.beat);
      paint();
      return false;
    }
    if (r.mode === "rest" && r.quiet >= TOUR_FIRST) {
      r.mode = "tour";
      r.beat = 0;
      r.t = 0;
    } else if (r.mode === "play" && r.quiet >= TOUR_BACK && r.t >= BEAT_LENGTH[r.beat]!) {
      r.mode = "tour";
      r.beat = (r.beat + 1) % BEATS;
      r.t = 0;
    }
    if (r.mode === "play" || (r.mode === "tour" && !r.engaged)) r.t += dt;
    const length = BEAT_LENGTH[r.beat]!;
    if (r.t >= length) {
      if (r.mode === "tour") {
        r.t -= length;
        r.beat = (r.beat + 1) % BEATS;
      } else r.t = length;
    }
    announceBeat(r.mode === "rest" ? 0 : r.beat);
    step(r.machine, targetsAt(r.beat, r.t), dt, false);
    paint();
    return true;
  }, true);

  // Visibility lives in a ref, never in state: the loop stops itself offscreen and the observer restarts it.
  React.useEffect(() => {
    const node = anchor.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        onscreen.current = Boolean(entries[entries.length - 1]?.isIntersecting);
        if (onscreen.current) kick();
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [anchor, kick]);

  const advance = (to: number) => {
    const r = run.current;
    r.mode = "play";
    r.beat = ((to % BEATS) + BEATS) % BEATS;
    r.t = 0;
    r.quiet = 0;
    kick();
  };

  return (
    <div
      ref={anchor}
      className="dp-stage"
      role="button"
      tabIndex={0}
      aria-label={`${label} Step 1 of ${BEATS}: ${BEAT_NAME[0]}. Press to go to the next step.`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") run.current.engaged = true;
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") run.current.engaged = false;
      }}
      onFocus={() => {
        run.current.engaged = true;
      }}
      onBlur={() => {
        run.current.engaged = false;
      }}
      onClick={() => advance(run.current.mode === "rest" ? 1 : run.current.beat + 1)}
      onKeyDown={(event) => {
        const r = run.current;
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight" || event.key === "ArrowDown") advance(r.mode === "rest" ? 1 : r.beat + 1);
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") advance(r.mode === "rest" ? BEATS - 1 : r.beat - 1);
        else if (event.key === "Home") advance(0);
        else if (event.key === "End") advance(BEATS - 1);
        else return;
        event.preventDefault();
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={label}>
        <g data-layer="" dangerouslySetInnerHTML={{ __html: art }} />
        <g data-cord="" className="iso-wire dp-cord" data-tone="lit" style={{ opacity: 0 }}>
          <path className="iso-line" data-tone="lit" d="" />
          <circle className="iso-wire-end" r={1} cx={0} cy={0} />
          <circle className="iso-wire-end" r={1} cx={0} cy={0} />
        </g>
      </IsoFigure>
      <span ref={announce} className="dp-sr" aria-live="polite" />
    </div>
  );
}

