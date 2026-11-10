import { pathOf } from "@/app/_landing/iso/iso-kit";
import { circle, cyl, dotsAt, discY, faceRingY, seam, seg, slab } from "./h";
import { dots, join, line, solid, type Item } from "./item";
import { DIAL, GAUGE, X1 } from "./consts";
import { dialAngle, onFace, R_FACE } from "./dyn";
import { at } from "./view";

/* 01: the price sensor. A dial gauge on a stand reads the diesel price from a simulated feed; the trigger
   price carries the one lit tick. */

const TAU = Math.PI / 180;
const FACE_Y = GAUGE.y;

function ticks() {
  const minor: string[] = [];
  const major: string[] = [];
  for (let step = 0; step <= DIAL.hi - DIAL.lo; step++) {
    const big = step % 5 === 0;
    const a = dialAngle(DIAL.lo + step);
    (big ? major : minor).push(pathOf([onFace(R_FACE, a), onFace(R_FACE - (big ? 3.4 : 1.8), a)]));
  }
  return { minor: minor.join(""), major: major.join("") };
}

const TICKS = ticks();

const PED = { x: X1 - 26, y: -60, w: 52, d: 34 };
const FRONT = PED.y + PED.d;

export const S1: Item[] = [
  {
    id: "s1",
    layer: 1,
    c: [X1, -44, 20],
    specs: [
      solid(slab(X1 - 31, -65, 62, 44, 0, 1.6, 3, 4, 0.4), "lo"),
      dots(dotsAt([[X1 - 27, -61], [X1 + 27, -61], [X1 - 27, -25], [X1 + 27, -25]], 1.6), 0.5, "mid"),
      solid(slab(PED.x, PED.y, PED.w, PED.d, 1.6, 6.4, 3, 4, 0.6), "mid", "faint", { inner: seam(PED.x, PED.y, PED.w, PED.d, 3, 5.4, 4) }),
      dots(dotsAt([[PED.x + 5, PED.y + 5], [PED.x + PED.w - 5, PED.y + 5], [PED.x + 5, FRONT - 5], [PED.x + PED.w - 5, FRONT - 5]], 8), 0.45, "mid"),
      // the feed lamp plate: three dots that blink while the simulated feed runs
      solid(slab(X1 + 4, FRONT, 18, 0.9, 2.6, 4, 0.5, 2, 0), "lo", "none"),
      dots([at([X1 + 8, FRONT + 0.9, 4.6]), at([X1 + 13, FRONT + 0.9, 4.6]), at([X1 + 18, FRONT + 0.9, 4.6])], 0.8, "hi", true),
      solid(slab(X1 - 22, FRONT, 22, 0.9, 2.6, 4, 0.5, 2, 0), "lo", "none"),
      line(join(seg([X1 - 19, FRONT + 0.9, 3.6], [X1 - 8, FRONT + 0.9, 3.6]), seg([X1 - 19, FRONT + 0.9, 4.8], [X1 - 4, FRONT + 0.9, 4.8])), "lo", { free: true }),
      // stem and gauge
      solid(cyl(X1, GAUGE.y - 5, 5.6, 8, 1.4, 24), "mid"),
      solid(cyl(X1, GAUGE.y - 5, 4.2, 9.4, 4.6, 20), "mid", "none"),
      solid(discY(X1, GAUGE.y - 10, GAUGE.z, GAUGE.r, 10), "hi", "faint"),
      line(faceRingY(X1, FACE_Y, GAUGE.z, GAUGE.r - 1, 56), "lo"),
      line(faceRingY(X1, FACE_Y, GAUGE.z, R_FACE, 56), "faint"),
      line(TICKS.minor, "lo"),
      line(TICKS.major, "mid"),
      line(pathOf([onFace(R_FACE, dialAngle(65)), onFace(R_FACE - 3.4, dialAngle(65))]), "lit"),
      { k: "dline", name: "needle", tone: "hi", cls: "as-needle", free: "start" },
      line(faceRingY(X1, FACE_Y, GAUGE.z, 1.7, 14), "lo"),
      dots([at([X1, FACE_Y, GAUGE.z])], 0.55, "hi"),
      // lug and crown on top
      solid(slab(X1 - 3, GAUGE.y - 7, 6, 4, GAUGE.z + GAUGE.r - 0.4, 3.2, 1.2, 3, 0.3), "mid"),
      solid(cyl(X1, GAUGE.y - 5, 2.6, GAUGE.z + GAUGE.r + 2.8, 3.4, 18), "mid"),
      line(circle(X1, GAUGE.y - 5, 1.4, GAUGE.z + GAUGE.r + 6.2, 12), "lo"),
      // the cap on the bezel: two small hex-screw dots either side of the face
      dots([onFace(GAUGE.r - 1.6, 135 * TAU), onFace(GAUGE.r - 1.6, 45 * TAU)], 0.5, "mid"),
    ],
  },
];

