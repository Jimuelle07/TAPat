import * as A from "@/app/_landing/iso/audit.mjs";
import { GOV, LOCK, POST, SWEEP, X5 } from "./consts";
import { BAR_Z, PIN, PIN_X, RADAR, SHEAR, governorAt, leverAt } from "./dyn";
import { drawOf, poseAt } from "./frame";
import { shapeOf, type Shape } from "./h";
import type { Item } from "./item";
import { PAINT } from "./order";
import { CABLE_POINTS } from "./s7";
import { TRUTH } from "./truth";
import { BELT_X0, BELT_X1, BELT_Z, CHIP_Z, LANE, P, PIT_HALF, STATION } from "./view";

/* Audit: records every solid at a pose and checks painter order and supports with the vendored kit. Never imported by the app.
   Run: pnpm --filter server exec tsx ../web/app/_landing/figures/assembly/audit.ts --audit [u ...]  (a trailing f freezes the card: 8f) */

type V3 = [number, number, number];
/* Parts of one assembly share an owner, so a rod that ends inside a ball, a hub or a sleeve is a mount and not a collision. */
const ownerOf = (id: string) => {
  if (id.startsWith("s5-pin") || id.startsWith("s5-plug") || id.startsWith("s5-back") || id.startsWith("s5-front")) return "s5.lock";
  if (id.startsWith("s2")) return "s2.governor";
  if (id === "s8-lever" || id === "s8-knob") return "s8.lever";
  return undefined;
};

function shapeFor(shape: Shape, name: string, owner: string | undefined, ground: boolean) {
  const meta = { name, ground, owner };
  switch (shape.k) {
    case "slab":
      return A.slab(shape.plan, shape.z, shape.h, meta, shape.steps);
    case "poly":
      return A.extruded(shape.ring, shape.z, shape.h, meta);
    case "cyl":
      return A.cylinder(shape.cx, shape.cy, shape.r, shape.z, shape.h, meta);
    case "disc":
      return A.disc(shape.F, shape.s0, shape.s1, shape.r, meta);
    case "prism":
      return A.prism(shape.F, shape.polygon, shape.s0, shape.s1, meta);
    case "ball":
      return A.ball(shape.c, shape.r, meta);
  }
}

function offsets(u: number, frozen: boolean) {
  const p = poseAt(u, frozen, 0, TRUTH);
  const g = governorAt(p.gov);
  const rest = governorAt(GOV.from);
  const lever = leverAt(p.lever);
  const lever0 = leverAt(SWEEP.lever.from);
  const out: Record<string, V3> = {
    tray: [0, p.tray, 0],
    card: [0, 0, p.card],
    govlift: [0, 0, g.sleeve - rest.sleeve],
    ballL: [g.left.ball[0] - rest.left.ball[0], 0, g.left.ball[2] - rest.left.ball[2]],
    ballR: [g.right.ball[0] - rest.right.ball[0], 0, g.right.ball[2] - rest.right.ball[2]],
    pusher: [0, p.pusher, 0],
    gate7: [0, 0, p.gate7],
    knob: [lever.tip[0] - lever0.tip[0], 0, lever.tip[2] - lever0.tip[2]],
    stop8: [0, 0, p.stop8],
  };
  p.pins.forEach((delta, j) => (out[`pin${j}`] = [0, 0, delta]));
  p.chips.forEach((chip, k) => (out[`chip${k}`] = [chip.x, chip.y, chip.z - CHIP_Z[k]!]));
  return { out, p, g, lever };
}

type Offsets = ReturnType<typeof offsets>;

/* The parts that are rebuilt each frame. */
function dynamic(item: Item, name: string, { p }: Offsets) {
  if (item.id === "s6-radar" && name === "radar") {
    const t = (p.radar * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const corner = (u: number, v: number): [number, number] => [POST.mastX + u * c - v * s, POST.mastY + u * s + v * c];
    const ring = [corner(-RADAR.half, -1.5), corner(RADAR.half, -1.5), corner(RADAR.half, 1.5), corner(-RADAR.half, 1.5)];
    return A.extruded(ring, RADAR.z, RADAR.bar, { name: "s6-radar.bar" });
  }
  if (item.id === "s5-arm" && name === "gate") {
    const t = (p.plug * Math.PI) / 180;
    const dir = [Math.cos(t), Math.sin(t)];
    const side = [-Math.sin(t), Math.cos(t)];
    const corner = (s: number, w: number): [number, number] => [LOCK.plugY + dir[0]! * s + side[0]! * w, LOCK.plugZ + dir[1]! * s + side[1]! * w];
    const polygon = [corner(-LOCK.tail, -2.2), corner(LOCK.arm, -2.2), corner(LOCK.arm, 2.2), corner(-LOCK.tail, 2.2)];
    const F = { o: [X5 + LOCK.armX, 0, 0] as V3, a: [1, 0, 0] as V3, u: [0, 1, 0] as V3, v: [0, 0, 1] as V3 };
    return A.prism(F, polygon, 0, 3.2, { name: "s5-arm.gate" });
  }
  return null;
}

/* The pins are drawn twice, cut at the plug's top (z = SHEAR) by a clip: the "-in" copy keeps what is below it, the other what is above.
   A copy with nothing left on its side of the cut draws nothing. */
function pinCut(item: Item, shape: Shape, pins: number[]): Shape | null {
  const index = /^s5-pin(\d)(-in)?$/.exec(item.id);
  if (!index || shape.k !== "cyl") return shape;
  const cut = SHEAR - (pins[Number(index[1])] ?? 0);
  const [z0, z1] = index[2] ? [shape.z, Math.min(shape.z + shape.h, cut)] : [Math.max(shape.z, cut), shape.z + shape.h];
  return z1 - z0 > 1e-6 ? { ...shape, z: z0, h: z1 - z0 } : null;
}

/* Items that are drawn as lines only: their true shape is a thin tube (a rod, a coil half, the cable) or a film (the cleats). */
function lines(item: Item, { p, g, lever }: Offsets): unknown[] {
  const tube = (name: string, points: V3[], r: number) => A.tube(points, r, { name: `${item.id}.${name}`, owner: ownerOf(item.id), joined: true });
  if (item.id === "s2-arms") return [tube("armL", [g.left.pivot, g.left.rim], 0.7), tube("armR", [g.right.pivot, g.right.rim], 0.7)];
  if (item.id === "s2-links") return [tube("linkL", [g.left.foot, g.left.meet], 0.5), tube("linkR", [g.right.foot, g.right.meet], 0.5)];
  if (item.id === "s8-lever") return [tube("rod", [[SWEEP.lever.x, SWEEP.lever.y, SWEEP.lever.z], lever.tip], 1)];
  if (item.id === "s7-post-l") return [A.tube(CABLE_POINTS, 0.5, { name: "s7-cable.run" })];
  const coil = /^s5-(back|front)(\d)$/.exec(item.id);
  if (coil) {
    const index = Number(coil[2]);
    const near = coil[1] === "front";
    const z0 = SHEAR + PIN.driver + PIN.cap + (p.pins[index] ?? 0);
    const z1 = BAR_Z;
    const turns = 5;
    const count = turns * 12;
    const vx = Math.cos((P.azimuth ?? 45) * (Math.PI / 180));
    const vy = Math.sin((P.azimuth ?? 45) * (Math.PI / 180));
    const runs: V3[][] = [];
    let run: V3[] = [];
    for (let k = 0; k <= count; k++) {
      const share = k / count;
      const angle = share * turns * Math.PI * 2;
      const facing = Math.cos(angle) * vx + Math.sin(angle) * vy > 0;
      if (facing === near) run.push([PIN_X[index]! + PIN.spring * Math.cos(angle), LOCK.plugY + PIN.spring * Math.sin(angle), z0 + (z1 - z0) * share]);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
    return runs.filter((r) => r.length > 1).map((r, n) => tube(`c${n}`, r, 0.3));
  }
  if (item.id === "cleats") {
    /* The belt runs either side of the vault pit; the cleats are clipped to it. */
    const pit = [STATION[2]! - PIT_HALF, STATION[2]! + PIT_HALF];
    return [
      A.slab({ x: BELT_X0, y: -LANE, w: pit[0]! - BELT_X0, d: LANE * 2, r: 0.6 }, BELT_Z, 0.1, { name: "cleats.film" }, 2),
      A.slab({ x: pit[1]!, y: -LANE, w: BELT_X1 - pit[1]!, d: LANE * 2, r: 0.6 }, BELT_Z, 0.1, { name: "cleats.film#2" }, 2),
    ];
  }
  return [];
}

/* The kit is plain JS; this is the part of its recorder that the audit uses. */
interface Recorder {
  items: Array<{ key: number }>;
  tubes: unknown[];
  solid: (shape: unknown) => unknown;
  put: (item: { name: string; at: V3; key: number; piece: string; shapes: unknown[] }) => unknown;
  route: (name: string, points: V3[], radius: number, options: { owner: string; piece: string }) => unknown;
}

function run(u: number, frozen: boolean) {
  const at = offsets(u, frozen);
  const { out, p } = at;
  const R = A.recorder(P, { order: [] }) as unknown as Recorder;
  const flags = drawOf(p).flags;
  PAINT.forEach((item: Item, index: number) => {
    if (item.vis && (item.vis.startsWith("!") ? flags[item.vis.slice(1)] === true : flags[item.vis] !== true)) return;
    const by = item.m ? out[item.m] : undefined;
    const put = (shape: unknown) => R.solid(by ? A.moved(shape, by) : shape);
    const shapes = item.specs.flatMap((spec, n) => {
      if (spec.k === "dsolid") {
        const built = dynamic(item, spec.name, at);
        return built ? [put(built)] : [];
      }
      if (spec.k !== "solid") return [];
      const shape = shapeOf(spec.paths);
      const cut = shape && pinCut(item, shape, p.pins);
      return cut ? [put(shapeFor(cut, `${item.id}.${n}`, ownerOf(item.id), item.id === "base"))] : [];
    });
    /* A pin copy with nothing on its side of the cut draws nothing. */
    if (shapes.length === 0 && /^s5-pin\d-in$/.test(item.id)) return;
    const rods = lines(item, at);
    if (["s2-arms", "s2-links", "s8-lever"].includes(item.id)) R.tubes.push(...(rods as never[]));
    if (process.argv.includes("--solids")) {
      /* Debug: every solid its own item, to find which parts of an item interlock. */
      [...shapes, ...rods].forEach((shape, n) => R.put({ name: `${item.id}[${n}]`, at: [0, 0, 0], key: index + n / 1000, piece: item.id, shapes: [shape] }));
      return;
    }
    R.put({ name: item.id, at: [0, 0, 0], key: index, piece: item.id, shapes: [...shapes, ...rods] });
  });
  /* Each spring is one route from its pin's cap to the bar, so the pin it holds is supported by it. It leaves and meets
     both surfaces square-on, with a short straight lead at each end. */
  PIN_X.forEach((px, j) => {
    const z0 = SHEAR + PIN.driver + PIN.cap + (p.pins[j] ?? 0);
    const lead = 0.8;
    const at3 = (angle: number, z: number): V3 => [px + PIN.spring * Math.cos(angle), LOCK.plugY + PIN.spring * Math.sin(angle), z];
    const turns = Array.from({ length: 61 }, (_, k) => at3((k / 60) * 5 * Math.PI * 2, z0 + lead + ((BAR_Z - z0 - lead * 2) * k) / 60));
    R.route(`s5.spring${j}`, [at3(0, z0), ...turns, at3(0, BAR_Z)], 0.3, { owner: `s5.spring${j}`, piece: `s5-back${j}` });
  });

  console.log(`== u=${u} frozen=${frozen}`);
  /* The figure paints in PAINT order, not by solved keys: settle measures the overlaps, then the keys go back to the painted order so the audit judges what is drawn. */
  A.settle(R, P);
  R.items.forEach((item, n) => (item.key = n));
  A.auditOrExit(R, P);
}

/* Nothing runs on import: only when this file is the script. */
if (process.argv[1]?.endsWith("audit.ts")) {
  const poses = process.argv.slice(2).filter((a) => /^[0-9.]+f?$/.test(a));
  for (const pose of poses.length ? poses : ["4.62"]) run(Number.parseFloat(pose), pose.endsWith("f"));
}
