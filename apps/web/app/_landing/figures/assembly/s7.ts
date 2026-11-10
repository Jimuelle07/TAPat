import { dotsAt, prismYZ, seam, seg, slab } from "./h";
import { dots, line, solid, type Item } from "./item";
import { CLAIM, PUSH_TIP, X7 } from "./consts";
import { SIGNAL_FROM } from "./s6";
import { BELT_Z, CHIP_H, at } from "./view";

/* 07: claim(). A pusher bar at the front shoves the top chip across the lane onto the settlement chute, which runs
   down into the station's till. When the Freeze Agent freezes the card, the signal cable drops the hold latch
   (a portcullis) over the chute mouth and the pusher never fires. */

const { y0, z0, y1, z1 } = CLAIM.ramp;
const PUSH_Z = BELT_Z + CHIP_H * 2 + 0.2; // the bar rides on the guide at the top chip's height
const POST_L = X7 - 18.1;
const POST_R = X7 + 15.1;
const GATE_Z = 20; // carrier bar bottom when closed
const BEAM_Z = 41;

/* A cable between two connectors, sagging a little under its own weight. It runs behind the near connector's post and ends
   on the connector's left face, so the post is painted over its last stretch. */
type V3 = [number, number, number];
const SHELL_TO: V3 = [POST_L, -15.8, 24.5];
export const CABLE_POINTS: V3[] = Array.from({ length: 15 }, (_, i) => {
  const t = i / 14;
  const a = SIGNAL_FROM;
  const b = SHELL_TO;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - 4 * Math.sin(Math.PI * t)];
});
const CABLE_FLAT = CABLE_POINTS.map((point) => at(point));
const CABLE = { from: CABLE_FLAT[0]!, to: CABLE_FLAT[14]!, via: CABLE_FLAT.slice(1, 14) };

export const S7: Item[] = [
  // the pusher's guide and rear stop, in front of the lane
  {
    id: "s7-guide",
    layer: 3,
    c: [X7, 38, 6],
    bias: 0,
    specs: [
      solid(slab(X7 - 15, 15, 30, 30, 0, 1.6, 3, 4, 0.4), "lo"),
      dots(dotsAt([[X7 - 11, 19], [X7 + 11, 19], [X7 - 11, 41], [X7 + 11, 41]], 1.6), 0.5, "mid"),
      solid(slab(X7 - 11, 18, 22, 20, 1.6, PUSH_Z - 1.6, 2, 3, 0.4), "mid"),
      solid(slab(X7 - 11, 18, 3, 20, PUSH_Z, 2.6, 0.6, 2, 0.3), "mid"),
    ],
  },
  {
    id: "s7-guide-r",
    layer: 3,
    c: [X7, 38, 6],
    bias: 0.2,
    specs: [
      solid(slab(X7 + 8, 18, 3, 20, PUSH_Z, 2.6, 0.6, 2, 0.3), "mid"),
      solid(slab(X7 - 9, 38, 18, 6, 1.6, 21, 2, 3, 0.5), "mid", "faint", { inner: seam(X7 - 9, 38, 18, 6, 2, 8, 3) }),
      dots([at([X7 - 5, 41, 22.6]), at([X7 + 5, 41, 22.6])], 0.5, "mid"),
    ],
  },
  {
    id: "s7-pusher",
    layer: 3,
    c: [X7, 38, 6],
    bias: 0.1,
    m: "pusher",
    specs: [
      solid(slab(X7 - 3.5, PUSH_TIP + 2.6, 7, 20, PUSH_Z, 2.8, 1, 2, 0.4), "hi"),
      line(seg([X7, PUSH_TIP + 2.6, PUSH_Z + 2.8], [X7, PUSH_TIP + 22.6, PUSH_Z + 2.8]), "faint"),
      solid(slab(X7 - 7, PUSH_TIP, 14, 2.8, PUSH_Z, 2.8, 1, 3, 0.4), "hi"),
    ],
  },
  // the chute, its far guide and the till behind the lane (the near guide is left off so the chips stay in view)
  {
    id: "s7-chute",
    layer: 1,
    c: [X7, -18.5, 8],
    bias: 0,
    specs: [
      solid(prismYZ(X7 - 12, X7 + 12, [[y0, 9], [y0, z0], [y1, z1], [y1, 2.6]]), "mid"),
      solid(prismYZ(X7 - 14, X7 - 12, [[y0, 9], [y0, z0 + 4.6], [y1, z1 + 4.6], [y1, 2.6]]), "mid"),
      ...[-24, -38].flatMap((y) => [-14, 11].map((x) => solid(slab(X7 + x, y, 3, 3, 0, 9 + (2.6 - 9) * ((y0 - y) / (y0 - y1)) - 0.0, 0.6, 2, 0.3), "lo"))),
    ],
  },
  {
    id: "s7-bin",
    layer: 1,
    c: [X7, -61, 3],
    bias: 0,
    specs: [
      solid(slab(X7 - 18, -73, 36, 24, 0, CLAIM.bin.floor, 2, 3, 0.4), "lo"),
      solid(slab(X7 - 18, -73, 36, 2.6, CLAIM.bin.floor, 8, 0.8, 2, 0.3), "mid"),
      line(seg([X7 - 18, -70.4, 5.6], [X7 + 18, -70.4, 5.6]), "faint"),
      solid(slab(X7 - 18, -70.4, 2.6, 17.8, CLAIM.bin.floor, 8, 0.8, 2, 0.3), "mid"),
      solid(slab(X7 + 15.4, -70.4, 2.6, 17.8, CLAIM.bin.floor, 8, 0.8, 2, 0.3), "mid"),
      solid(slab(X7 - 18, -52.6, 3.6, 2.6, CLAIM.bin.floor, 8, 0.8, 2, 0.3), "mid"),
      solid(slab(X7 + 14.4, -52.6, 3.6, 2.6, CLAIM.bin.floor, 8, 0.8, 2, 0.3), "mid"),
    ],
  },
  // the hold latch: two posts, a beam and a portcullis that rides between them
  {
    id: "s7-post-l",
    layer: 1,
    c: [X7, -18.5, 8],
    bias: -0.3,
    specs: [
      { k: "wire", from: CABLE.from, to: CABLE.to, via: CABLE.via, tone: "mid", flag: "signal" },
      solid(slab(POST_L - 1.5, -22, 6, 8, 0, 1.6, 1.2, 3, 0.3), "lo"),
      solid(slab(POST_L, -20, 3, 3, 1.6, BEAM_Z - 1.6, 0.6, 2, 0.3), "mid"),
      line(seg([POST_L + 3, -17, 1.6], [POST_L + 3, -17, BEAM_Z]), "faint"),
      solid(slab(POST_L, -17, 3, 2.4, 22, 5, 0.6, 2, 0.2), "lo"),
    ],
  },
  {
    id: "s7-gate",
    layer: 1,
    c: [X7, -18.5, 8],
    bias: 0.1,
    m: "gate7",
    specs: [
      solid(slab(POST_L + 3, -20, POST_R - POST_L - 3, 3, GATE_Z, 2.6, 0.5, 2, 0.2), "mid", "faint", { flag: "gate7" }),
      solid(slab(X7 - 11.8, -19, 23.6, 2, GATE_Z - 7.8, 7.8, 0.5, 2, 0.3), "hi", "faint", { flag: "gate7p" }),
      line(seg([X7 - 11.8, -17, GATE_Z - 6.4], [X7 + 11.8, -17, GATE_Z - 6.4]), "faint"),
    ],
  },
  {
    id: "s7-post-r",
    layer: 1,
    c: [X7, -18.5, 8],
    bias: 0.3,
    specs: [
      solid(slab(POST_R - 1.5, -22, 6, 8, 0, 1.6, 1.2, 3, 0.3), "lo"),
      solid(slab(POST_R, -20, 3, 3, 1.6, BEAM_Z - 1.6, 0.6, 2, 0.3), "mid"),
      solid(slab(POST_L - 0.5, -20.6, POST_R - POST_L + 4, 4.2, BEAM_Z, 3, 0.8, 2, 0.4), "mid"),
      solid(slab(X7 - 14, -20.6, 10, 4.2, BEAM_Z + 3, 6, 1, 3, 0.4), "lo"),
      dots([at([X7 - 12, -16.4, BEAM_Z + 6]), at([X7 - 6, -16.4, BEAM_Z + 6])], 0.5, "mid"),
    ],
  },
];
