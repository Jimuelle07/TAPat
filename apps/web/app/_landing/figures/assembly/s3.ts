import { circle, dotsAt, rectY, seam, slab, top } from "./h";
import { dots, join, line, solid, type Item } from "./item";
import { X3 } from "./consts";
import { at } from "./view";

/* 03: fund_escrow(). The belt has a pit; a drawer slides out of the vault into it, takes the chips in under the
   canopy, and slides back out with the tranche escrowed. The drawer is built open; the live loop moves it in. */

const WALL = 4;
const LID_Z = 40;
const SLOTS = [-10, 3, 16];

const slots = join(...SLOTS.map((c) => rectY(X3 + c - 4.8, X3 + c + 4.8, -60 + WALL, 12, 34)));

export const S3: Item[] = [
  {
    id: "s3-a",
    layer: 1,
    c: [X3, -36, 10],
    bias: 0,
    specs: [
      solid(slab(X3 - 24, -60, 48, 44, 0, 3, 3, 4, 0.5), "lo"),
      dots(dotsAt([[X3 - 20, -56], [X3 + 20, -56], [X3 - 20, -16], [X3 + 20, -16]], 3), 0.5, "mid"),
      solid(slab(X3 - 14, -56, 4, 75, 3, 1.2, 0.5, 2, 0.1), "mid", "faint"),
      solid(slab(X3 + 10, -56, 4, 75, 3, 1.2, 0.5, 2, 0.1), "mid", "faint"),
      solid(slab(X3 - 24, -60, 48, WALL, 3, LID_Z - 3, 1, 3, 0.5), "mid", "faint", { inner: seam(X3 - 24, -60, 48, WALL, 1, 8, 3) }),
      line(slots, "faint"),
      dots(SLOTS.map((c) => at([X3 + c, -60 + WALL, 9])), 0.6, "mid"),
      solid(slab(X3 - 24, -56, WALL, 34, 3, LID_Z - 3, 1, 3, 0.5), "mid"),
    ],
  },
  {
    id: "s3-tray",
    layer: 2,
    c: [X3, -36, 10],
    bias: 0.01,
    m: "tray",
    specs: [
      solid(slab(X3 - 17, -18, 34, 36, 4.2, 3, 2, 4, 0.4), "mid"),
      line(top([[X3 - 13, -14], [X3 + 13, -14], [X3 + 13, 14], [X3 - 13, 14]], 7.2, true), "faint"),
      dots(dotsAt([[X3 - 14.4, -15.4], [X3 + 14.4, -15.4], [X3 - 14.4, 15.4], [X3 + 14.4, 15.4]], 7.2), 0.45, "mid"),
    ],
  },
  {
    id: "s3-tray-front",
    layer: 3,
    c: [X3, 20, 10],
    bias: 0,
    m: "tray",
    specs: [
      solid(slab(X3 - 17, 18, 34, 2.4, 4.2, 6.8, 0.8, 2, 0.3), "hi"),
      solid(slab(X3 - 8, 20.4, 16, 2.2, 6.2, 3.2, 0.8, 2, 0.2), "mid"),
      dots([at([X3 - 13.5, 20.4, 8.2]), at([X3 + 13.5, 20.4, 8.2])], 0.5, "mid"),
    ],
  },
  {
    id: "s3-b",
    layer: 2,
    c: [X3, -36, 10],
    bias: 0.05,
    specs: [
      solid(slab(X3 + 20, -26, 4, 4, 3, LID_Z - 3, 0.8, 2, 0.3), "mid"),
      solid(slab(X3 - 24, -60, 48, 38, LID_Z, 4, 2.5, 4, 0.6), "mid"),
      dots(dotsAt([[X3 - 20, -56], [X3 + 20, -56], [X3 - 20, -26], [X3 + 20, -26]], LID_Z + 4), 0.5, "mid"),
      solid(slab(X3 - 10, -48, 22, 12, LID_Z + 4, 0.8, 1.2, 3, 0), "lo", "none"),
      line(join(...[0, 1, 2].map((row) => top([[X3 - 6, -45 + row * 3], [X3 + (row === 1 ? 4 : 8), -45 + row * 3]], LID_Z + 4.8))), "lo", { free: true }),
      line(circle(X3 + 7, -42, 1.2, LID_Z + 4.8, 12), "lo"),
    ],
  },
];
