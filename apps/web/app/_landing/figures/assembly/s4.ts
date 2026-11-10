import { circle, dotsAt, seam, seg, slab } from "./h";
import { dots, line, solid, type Item } from "./item";
import { READER, X4 } from "./consts";
import { at } from "./view";

/* 04: the card reader. A card on a z-slide comes down onto the reader pad and the tap rings light. */

const PAD_TOP = 20.4;
const HOVER_Z = PAD_TOP + READER.stroke;
const Y_POST = -60;
const RINGS = [3.4, 6.4, 9.4];

export const S4: Item[] = [
  {
    id: "s4",
    layer: 1,
    c: [X4, -42, 10],
    bias: 0,
    specs: [
      solid(slab(X4 - 18, -64, 36, 44, 0, 1.6, 3, 4, 0.4), "lo"),
      dots(dotsAt([[X4 - 14, -60], [X4 + 14, -60], [X4 - 14, -24], [X4 + 14, -24]], 1.6), 0.5, "mid"),
      solid(slab(X4 - 3.5, Y_POST, 7, 6, 1.6, 62.4, 1.2, 3, 0.5), "mid"),
      line(seg([X4, Y_POST + 6, 1.6], [X4, Y_POST + 6, 64]), "faint"),
      solid(slab(X4 - 14, -50, 28, 26, 1.6, 16.4, 3, 4, 0.6), "mid", "faint", { inner: seam(X4 - 14, -50, 28, 26, 3, 8, 4) }),
      solid(slab(X4 - 12, -48, 24, 22, 18, 2.4, 2.5, 4, 0.4), "hi"),
      { k: "line", d: RINGS.map((r) => circle(X4, READER.padY, r, PAD_TOP, 28)).join(""), tone: "lo", flag: "tap" },
      dots([at([X4, READER.padY, PAD_TOP])], 0.7, "hi"),
      // the screen on the front face, with three status dots under it
      solid(slab(X4 - 10, -24, 20, 1.2, 8.4, 8, 0.6, 2, 0.2), "mid"),
      solid(slab(X4 - 8, -22.8, 16, 0.6, 10, 4.6, 0.4, 2, 0), "lo", "none"),
      dots([at([X4 - 4, -22.2, 11.8]), at([X4, -22.2, 11.8]), at([X4 + 4, -22.2, 11.8])], 0.6, "hi", true),
      dots([at([X4 - 6, -22.8, 5.4]), at([X4 + 6, -22.8, 5.4])], 0.5, "mid"),
    ],
  },
  {
    id: "s4-card",
    layer: 1,
    c: [X4, -40, 40],
    bias: 0.01,
    m: "card",
    specs: [
      solid(slab(X4 - 10, Y_POST + 6, 20, 8.8, HOVER_Z + 0.8, 9.6, 1.2, 3, 0.4), "mid"),
      solid(slab(X4 - 2, Y_POST + 14.8, 4, 9, HOVER_Z + 0.8, 2.6, 0.8, 2, 0.2), "mid"),
      solid(slab(X4 - 10.5, READER.padY - 6.75, 21, 13.5, HOVER_Z, 0.8, 1.6, 3, 0), "hi", "faint"),
      solid(slab(X4 - 8, READER.padY - 4.2, 4.6, 3.6, HOVER_Z + 0.8, 0.5, 0.6, 2, 0), "hi", "none"),
      line(seg([X4 - 10.5, READER.padY + 3.6, HOVER_Z + 0.8], [X4 + 10.5, READER.padY + 3.6, HOVER_Z + 0.8]), "lo"),
    ],
  },
];
