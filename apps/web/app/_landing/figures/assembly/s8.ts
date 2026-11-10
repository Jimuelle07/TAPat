import { sideMatrix } from "@/app/_landing/iso/iso-kit";
import { ball, discY, dotsAt, faceRingY, prismXZ, prismYZ, seg, slab } from "./h";
import { dots, line, solid, type Item } from "./item";
import { SWEEP, X8 } from "./consts";
import { leverAt } from "./dyn";
import { at, BELT_X1, BELT_Z, P } from "./view";

/* 08: sweep_on_revoke(). A lever pulls and the stop plate lifts; the chips ride off the belt end, down a chute,
   into the LGU's lockbox. The lockbox lid stands open; the front wall carries a hasp and padlock. */

const RAD = Math.PI / 180;
const { lever } = SWEEP;
const POST_X = X8 + 10.2;

const REST = leverAt(lever.from);
const SLEEVE0 = 23.7;
const BOX = { x: SWEEP.rampX1, y: -22, w: 44, d: 44 };
const BOX_FLOOR = 2.4;
const WALL = 3.2;
const WALL_H = 13;
const LID_DEG = 100;

/* The open lid: a plate hinged on top of the back wall, leaning back past vertical. */
const lidPoly = (): Array<[number, number]> => {
  const t = LID_DEG * RAD;
  const dir: [number, number] = [Math.cos(t), Math.sin(t)];
  const side: [number, number] = [-Math.sin(t), Math.cos(t)];
  const hinge: [number, number] = [BOX.y + WALL, BOX_FLOOR + WALL_H];
  const length = 26;
  const thick = 2.2;
  const corner = (s: number, w: number): [number, number] => [hinge[0] + dir[0] * s + side[0] * w, hinge[1] + dir[1] * s + side[1] * w];
  return [corner(0, 0), corner(length, 0), corner(length, thick), corner(0, thick)];
};

const FRONT = BOX.y + BOX.d;

export const S8: Item[] = [
  {
    id: "s8-lever",
    layer: 1,
    c: [X8, -42, 10],
    bias: 0,
    specs: [
      solid(slab(X8 - 17, -53, 30, 22, 0, 1.6, 3, 4, 0.4), "lo"),
      dots(dotsAt([[X8 - 13, -49], [X8 + 9, -49], [X8 - 13, -35], [X8 + 9, -35]], 1.6), 0.5, "mid"),
      solid(slab(X8 - 12, -50, 20, 14, 1.6, 7.4, 2, 3, 0.5), "mid"),
      solid(slab(X8 - 7, -46, 10, 10, 9, 11.4, 1.5, 3, 0.4), "mid"),
      solid(discY(lever.x, lever.y - 2, lever.z, 3.6, 2), "mid"),
      line(faceRingY(lever.x, lever.y, lever.z, 2.2, 16), "lo"),
      { k: "dline", name: "lever", tone: "hi", cls: "as-lever" },
      dots([at([lever.x, lever.y, lever.z])], 0.6, "hi"),
    ],
  },
  { id: "s8-knob", layer: 1, c: [X8, -42, 10], bias: 0.01, m: "knob", specs: [solid(ball(...REST.tip, 3.2), "hi", "none")] },
  {
    id: "s8-post",
    layer: 1,
    c: [POST_X + 3, -17.5, 20],
    specs: [
      solid(slab(POST_X - 2, -23.5, 10, 9.5, 0, 1.6, 1.4, 3, 0.3), "lo"),
      solid(slab(POST_X, -20.5, 6, 6, 1.6, 40.4, 1, 3, 0.4), "mid"),
      line(seg([POST_X + 3, -14.5, 1.6], [POST_X + 3, -14.5, 42]), "faint"),
      solid(slab(POST_X - 1, -21.5, 8, 8, 42, 2, 1.2, 3, 0.3), "mid"),
    ],
  },
  {
    id: "s8-stop",
    layer: 3,
    c: [X8 + 12, -20, 20],
    bias: 0.5,
    m: "stop8",
    specs: [
      solid(slab(POST_X - 1.3, -14.5, 8.6, 2.5, SLEEVE0 - 4.5, 9, 0.8, 2, 0.3), "mid"),
      solid(slab(X8 + 11, -12.2, 2.6, 1.4, SLEEVE0 - 4, 4, 0.4, 2, 0.2), "mid"),
      solid(slab(X8 + 11, -11, 2.6, 22, BELT_Z + 0.4, SLEEVE0 - BELT_Z - 0.4, 0.8, 2, 0.3), "hi"),
      line(seg([X8 + 11, 11, SLEEVE0 - 3], [X8 + 11, -11, SLEEVE0 - 3]), "faint"),
    ],
  },
  {
    id: "s8-chute",
    layer: 2,
    c: [BELT_X1 + 14, 0, 4],
    bias: 0,
    specs: [
      solid(prismXZ(-12, 12, [[SWEEP.rampX0, BELT_Z - 2.4], [SWEEP.rampX0, BELT_Z - 0.2], [SWEEP.rampX1, BOX_FLOOR], [SWEEP.rampX1, 0]]), "mid"),
      solid(prismXZ(-14, -12, [[SWEEP.rampX0 - 1, BELT_Z - 2.4], [SWEEP.rampX0 - 1, BELT_Z + 4.8], [SWEEP.rampX1, BOX_FLOOR + 4.8], [SWEEP.rampX1, 0]]), "mid"),
      solid(prismXZ(12, 14, [[SWEEP.rampX0 - 1, BELT_Z - 2.4], [SWEEP.rampX0 - 1, BELT_Z + 4.8], [SWEEP.rampX1, BOX_FLOOR + 4.8], [SWEEP.rampX1, 0]]), "mid"),
    ],
  },
  {
    id: "s8-box",
    layer: 2,
    c: [BOX.x + 22, -18, 6],
    bias: 12,
    specs: [
      solid(slab(BOX.x, BOX.y, BOX.w, BOX.d, 0, BOX_FLOOR, 2.5, 4, 0.4), "lo"),
      solid(slab(BOX.x, BOX.y, BOX.w, WALL, BOX_FLOOR, WALL_H, 1, 3, 0.5), "mid"),
      line(seg([BOX.x, BOX.y + WALL, 8], [BOX.x + BOX.w - WALL, BOX.y + WALL, 8]), "faint"),
      solid(slab(BOX.x, BOX.y + WALL, WALL, 8 - WALL, BOX_FLOOR, WALL_H, 0.8, 2, 0.4), "mid"),
      solid(slab(BOX.x, FRONT - 8, WALL, 8 - WALL, BOX_FLOOR, WALL_H, 0.8, 2, 0.4), "mid"),
      solid(prismYZ(BOX.x + 4, BOX.x + BOX.w - 4, lidPoly()), "hi"),
      solid(slab(BOX.x + 3, BOX.y - 1, 38, 2, BOX_FLOOR + WALL_H, 1.2, 0.8, 2, 0.3), "mid"),
    ],
  },
  {
    id: "s8-box-front",
    layer: 3,
    c: [BOX.x + 22, 20, 6],
    bias: 0,
    specs: [
      solid(slab(BOX.x + BOX.w - WALL, BOX.y + WALL, WALL, BOX.d - WALL * 2, BOX_FLOOR, WALL_H, 0.8, 2, 0.5), "mid"),
      solid(slab(BOX.x, FRONT - WALL, BOX.w - WALL, WALL, BOX_FLOOR, WALL_H, 1, 3, 0.5), "mid"),
      line(seg([BOX.x, FRONT - WALL, 5], [BOX.x + BOX.w - WALL, FRONT - WALL, 5]), "faint"),
      // hasp and padlock
      solid(slab(BOX.x + 18, FRONT, 8, 0.9, 6.4, 8.4, 0.5, 2, 0.2), "lo"),
      solid(slab(BOX.x + 19, FRONT + 0.9, 6, 2.6, 5, 5, 1, 2, 0.3), "hi"),
      line(faceRingY(BOX.x + 22, FRONT + 3.5, 11.6, 2.2, 16), "mid"),
      dots([at([BOX.x + 22, FRONT + 3.5, 7.4])], 0.5, "lo"),
      // the one engraved label
      { k: "text", tf: sideMatrix([BOX.x + 9, FRONT], 7.4, P, "left"), text: "LGU", size: 4.4, tone: "hi", anchor: "middle" },
    ],
  },
];
