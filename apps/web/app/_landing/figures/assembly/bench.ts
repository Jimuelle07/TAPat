import { insetPlan, planOutline, topMatrix, topTicks, depthOf, type Plane } from "@/app/_landing/iso/iso-kit";
import { cyl, circle, dotsAt, discY, faceRingY, slab, slabP } from "./h";
import { dots, join, solid, line, type Item } from "./item";
import { BASE, BASE_H, BELT_X0, BELT_X1, BELT_Z, FOOT_H, LANE, P, PIT_HALF, RAIL_H, RAIL_IN, RAIL_OUT, STATION } from "./view";

/* The bench: base on feet, a ruler strip along the front edge, eight station plates, and the conveyor. */

const FEET: Plane[] = [14, 300, 586].flatMap((x) => [-62, 58].map((y): Plane => [x, y]));
const byDepth = (points: Plane[]) => [...points].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));

const CORNERS: Plane[] = [
  [BASE.x + 10, BASE.y + 10],
  [BASE.x + BASE.w - 10, BASE.y + 10],
  [BASE.x + 10, BASE.y + BASE.d - 10],
  [BASE.x + BASE.w - 10, BASE.y + BASE.d - 10],
];

const STRIP = { x: 14, y: 60, w: 572, d: 8, r: 1 };
const TICKS = topTicks(18, 582, 6.2, 10, STRIP.y, 0.6, [2, 3.6], P);

const PLATE_Y = 46;
const plateOf = (x: number) => ({ x: x - 9, y: PLATE_Y, w: 18, d: 10, r: 1.5 });

const feet = byDepth(FEET).flatMap(([x, y]) => [
  solid(cyl(x, y, 7, -BASE_H - FOOT_H, 1.6, 28), "lo"),
  solid(cyl(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, 28), "mid"),
]);

export const BASE_ITEM: Item = {
  id: "base",
  layer: 0,
  c: [0, 0, -4],
  specs: [
    { k: "halo", d: slabP(BASE, -BASE_H - FOOT_H, BASE_H, 8, 0).fill },
    ...feet,
    solid(slabP(BASE, -BASE_H, BASE_H, 8, 1.6), "mid"),
    line(planOutline(insetPlan(BASE, 5), 0, P, 8), "faint"),
    line(join(...CORNERS.map(([x, y]) => circle(x, y, 2.2, 0, 16))), "lo"),
    dots(dotsAt(CORNERS, 0), 0.5, "mid"),
    solid(slabP(STRIP, 0, 0.6, 3, 0), "lo", "none"),
    line(TICKS.minor, "lo"),
    line(TICKS.major, "mid"),
  ],
};

/* Eight station plates, numbered; the plate of the station the chips are at turns lit. */
export const PLATES: Item[] = STATION.map((x, i) => {
  const plan = plateOf(x);
  return {
    id: `plate${i}`,
    layer: 0,
    c: [x, PLATE_Y + 5, 0.6],
    specs: [
      solid(slabP(plan, 0, 1.2, 3, 0.3), "mid", "faint", { flag: `plate${i}` }),
      line(planOutline(insetPlan(plan, 1.4), 1.2, P, 3), "faint"),
      { k: "text", tf: topMatrix([x, PLATE_Y + 6.4], 1.2, P, "x"), text: String(i + 1).padStart(2, "0"), size: 5.2, tone: "hi", anchor: "middle" },
    ],
  };
});

/* The conveyor. The pit at the vault station (3) is where the drawer comes out; the back rail also opens at station 7,
   where the settlement chute leaves the lane. Rollers stand clear of the bed's two ends. */
const PIT_A = STATION[2] - PIT_HALF;
const PIT_B = STATION[2] + PIT_HALF;
const CHUTE_A = STATION[6] - 18.5;
const CHUTE_B = STATION[6] + 18.5;
const RUNS: Array<[number, number]> = [
  [BELT_X0, PIT_A],
  [PIT_B, BELT_X1],
];
const FRONT_RUNS: Array<[number, number]> = [
  [BELT_X0, PIT_A],
  [PIT_B, STATION[6] - 12],
  [STATION[6] + 12, BELT_X1],
];
const BACK_RUNS: Array<[number, number]> = [
  [BELT_X0, PIT_A],
  [PIT_B, CHUTE_A],
  [CHUTE_B, BELT_X1],
];

const bed = RUNS.map(([a, b]) => slab(a, -RAIL_IN, b - a, RAIL_IN * 2, 0, BELT_Z - 0.6, 1, 2, 0.4));
const belt = RUNS.map(([a, b]) => slab(a + 0.4, -LANE, b - a - 0.8, LANE * 2, BELT_Z - 0.6, 0.6, 0.6, 2, 0));

const railPlan = (y0: number, y1: number, a: number, b: number) => ({ x: a, y: y0, w: b - a, d: y1 - y0, r: 0.8 });
const railScrews = (y: number, a: number, b: number) => {
  const pts: Plane[] = [];
  for (let x = Math.ceil((a + 8) / 31) * 31; x < b - 6; x += 31) pts.push([x, y]);
  return dotsAt(pts, RAIL_H);
};

const MID = (BELT_X0 + BELT_X1) / 2;

/* Painted after the stations behind the lane and before the chips. */
export const BELT_BACK: Item[] = [
  {
    id: "roller-in",
    layer: 1,
    c: [MID, 0, 4],
    specs: [solid(discY(BELT_X0 - 3.6, -12, 3.6, 3.6, 24), "mid"), line(faceRingY(BELT_X0 - 3.6, 12, 3.6, 1.6, 16), "lo")],
  },
  {
    id: "rail-back",
    layer: 1,
    c: [MID, -12.6, 4],
    specs: BACK_RUNS.flatMap(([a, b]) => [solid(slabP(railPlan(-RAIL_OUT, -RAIL_IN, a, b), 0, RAIL_H, 2, 0.4), "mid"), dots(railScrews(-12.6, a, b), 0.45, "mid")]),
  },
  { id: "bed", layer: 1, c: [MID, 0, 3], specs: [...bed.map((paths) => solid(paths, "mid")), ...belt.map((paths) => solid(paths, "lo", "none"))] },
  { id: "cleats", layer: 1, c: [MID, 0, BELT_Z], specs: [{ k: "dline", name: "cleats", tone: "lo" }] },
  {
    id: "roller-out",
    layer: 1,
    c: [MID, 0, 4],
    specs: [solid(discY(BELT_X1 + 3.6, -12, 3.6, 3.6, 24), "mid"), line(faceRingY(BELT_X1 + 3.6, 12, 3.6, 1.6, 16), "lo")],
  },
];

/* Painted after the chips, with what stands in front of them. */
export const BELT_FRONT: Item[] = [
  {
    id: "rail-front",
    layer: 3,
    c: [MID, 12.6, 4],
    specs: FRONT_RUNS.flatMap(([a, b]) => [solid(slabP(railPlan(RAIL_IN, RAIL_OUT, a, b), 0, RAIL_H, 2, 0.4), "mid"), dots(railScrews(12.6, a, b), 0.45, "mid")]),
  },
];
