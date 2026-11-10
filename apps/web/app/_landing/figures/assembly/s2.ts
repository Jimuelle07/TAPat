import { ball, circle, cyl, dotsAt, halfCircle, halfRing, seam, slab } from "./h";
import { dots, line, solid, type Item } from "./item";
import { GOV, X2 } from "./consts";
import { governorAt } from "./dyn";
import { at, BELT_Z } from "./view";

/* 02: the Tranche Agent as a fly-ball governor. When the shift is real the balls swing out, the sleeve rises and
   lifts the stop plate that holds the chips back. The arms and links are rebuilt each frame; the balls, sleeve
   and plate move as rigid groups. The sleeve wraps the spindle, so it is split: its back half is painted before
   the spindle and its front half after it. */

const REST = governorAt(GOV.from);
const SLEEVE0 = REST.sleeve;
export const SPINDLE_R = 2.2;
const SLEEVE_TOP = SLEEVE0 + GOV.sleeveH / 2;
const SLEEVE_Z = SLEEVE0 - GOV.sleeveH / 2;

export const S2: Item[] = [
  {
    id: "s2",
    layer: 1,
    c: [X2, -38, 26],
    bias: 0,
    specs: [
      solid(slab(X2 - 23, -57, 46, 38, 0, 1.6, 3, 4, 0.4), "lo"),
      dots(dotsAt([[X2 - 19, -53], [X2 + 19, -53], [X2 - 19, -23], [X2 + 19, -23]], 1.6), 0.5, "mid"),
      solid(slab(X2 - 18, -52, 36, 28, 1.6, 4.4, 3, 4, 0.6), "mid", "faint", { inner: seam(X2 - 18, -52, 36, 28, 3, 4, 4) }),
      solid(cyl(X2, GOV.spindleY, 5.4, 6, 8, 24), "mid"),
      line(circle(X2, GOV.spindleY, 3.8, 14), "lo"),
      solid(cyl(X2, GOV.spindleY, 3.4, 14, 2, 20), "mid"),
    ],
  },
  {
    id: "s2-sleeve-back",
    layer: 1,
    c: [X2, -38, 26],
    bias: 0.002,
    m: "govlift",
    specs: [solid(halfRing(X2, GOV.spindleY, SPINDLE_R, GOV.sleeveR, SLEEVE_Z, GOV.sleeveH, -1), "mid"), line(halfCircle(X2, GOV.spindleY, GOV.sleeveR - 1.2, SLEEVE_TOP, -1), "lo")],
  },
  {
    id: "s2-spindle",
    layer: 1,
    c: [X2, -38, 26],
    bias: 0.004,
    specs: [
      solid(cyl(X2, GOV.spindleY, SPINDLE_R, 16, 33.4, 16), "mid", "none"),
      solid(slab(X2 - 9, GOV.spindleY - 2.6, 18, 5.2, GOV.pivotZ - 2.6, 5.2, 1.2, 3, 0.4), "mid"),
      dots([at([X2 - GOV.pivotX, GOV.y, GOV.pivotZ]), at([X2 + GOV.pivotX, GOV.y, GOV.pivotZ])], 0.7, "hi"),
    ],
  },
  {
    id: "s2-arms",
    layer: 3,
    c: [X2 + 12, -20, 20],
    bias: 0.7,
    specs: [
      { k: "dline", name: "armL", tone: "hi", cls: "as-rod" },
      { k: "dline", name: "armR", tone: "hi", cls: "as-rod" },
    ],
  },
  { id: "s2-ball-l", layer: 1, c: [X2, -38, 26], bias: 0.02, m: "ballL", specs: [solid(ball(...REST.left.ball, GOV.ball), "hi", "none")] },
  { id: "s2-ball-r", layer: 1, c: [X2, -38, 26], bias: 0.03, m: "ballR", specs: [solid(ball(...REST.right.ball, GOV.ball), "hi", "none")] },
  {
    id: "s2-lift",
    layer: 3,
    c: [X2 + 12, -20, 20],
    bias: 0.5,
    m: "govlift",
    specs: [
      solid(halfRing(X2, GOV.spindleY, SPINDLE_R, GOV.sleeveR, SLEEVE_Z, GOV.sleeveH, 1), "mid"),
      line(halfCircle(X2, GOV.spindleY, GOV.sleeveR - 1.2, SLEEVE_TOP, 1), "lo"),
      solid(slab(X2 + 3.5, GOV.spindleY - 1.3, 7.5, 2.6, SLEEVE0 - 1.3, 2.6, 0.6, 2, 0.3), "mid"),
      solid(slab(X2 + 11, GOV.spindleY - 1.3, 2.6, 28.3, SLEEVE0 - 1.3, 2.6, 0.6, 2, 0.3), "mid"),
      solid(slab(X2 + 11, -11, 2.6, 22, BELT_Z + 0.4, SLEEVE0 - BELT_Z - 0.4, 0.8, 2, 0.3), "hi", "faint", { inner: seam(X2 + 11, -11, 2.6, 22, 0.8, SLEEVE0 - 3, 2) }),
      dots([at(REST.left.meet), at(REST.right.meet)], 0.6, "hi"),
    ],
  },
  /* The links run from the arms to the sleeve's surface, so they are painted after the sleeve's front half. */
  {
    id: "s2-links",
    layer: 3,
    c: [X2 + 12, -20, 20],
    bias: 0.6,
    specs: [
      { k: "dline", name: "linkL", tone: "mid", cls: "as-rod" },
      { k: "dline", name: "linkR", tone: "mid", cls: "as-rod" },
    ],
  },
];
