import { sideArc, sideSeam } from "@/app/_landing/iso/iso-kit";
import { ball, circle, cyl, dotsAt, rectY, seg, slab } from "./h";
import { dots, join, line, solid, type Item } from "./item";
import { POST, X6 } from "./consts";
import { RADAR } from "./dyn";
import { P, at } from "./view";

/* 06: the Freeze Agent's watch post. A cabin with a window on a platform, a mast with a radar bar that turns while it
   watches, and a beacon and a signal connector for when it freezes a card. */

const CABIN = { x: X6 - 16, y: -58, w: 30, d: 24, r: 2 };
const ROOF_Z = 28;
const MAST_BASE = ROOF_Z + 3;
export const SIGNAL_FROM: [number, number, number] = [X6 + 16.6, -44.5, 14];

export const S6: Item[] = [
  {
    id: "s6",
    layer: 1,
    c: [X6, -46, 20],
    bias: 0,
    specs: [
      solid(slab(X6 - 24, -64, 48, 46, 0, 4, 3, 4, 0.6), "lo"),
      dots(dotsAt([[X6 - 20, -60], [X6 + 20, -60], [X6 - 20, -22], [X6 + 20, -22]], 4), 0.5, "mid"),
      solid(slab(X6 - 23, -22.4, 2.4, 2.4, 4, 8.4, 0.5, 2, 0.2), "mid"),
      solid(slab(X6 + 20.6, -22.4, 2.4, 2.4, 4, 8.4, 0.5, 2, 0.2), "mid"),
      solid(slab(X6 - 23, -22.4, 46, 2.4, 12.4, 1.6, 0.6, 2, 0.2), "mid"),
      solid(slab(CABIN.x, CABIN.y, CABIN.w, CABIN.d, 4, ROOF_Z - 4, 2, 3, 0.6), "mid", "faint", { inner: sideSeam(CABIN, 10, P, 3) }),
      solid(slab(X6 - 9, -34, 16, 0.7, 12, 11.5, 0.5, 2, 0.2), "lo", "none"),
      line(rectY(X6 - 10.2, X6 + 8.2, -33.3, 10.8, 24.7), "mid"),
      line(seg([X6 - 1, -33.3, 10.8], [X6 - 1, -33.3, 24.7]), "faint"),
      dots([at([X6 - 6, -33.3, 8]), at([X6 + 4, -33.3, 8])], 0.45, "mid"),
      solid(slab(X6 + 14, -48, 2.6, 7, 11, 6, 0.8, 2, 0.2), "lo"),
      dots([at([X6 + 16.6, -46.5, 14]), at([X6 + 16.6, -49.5, 14])], 0.4, "mid"),
      solid(slab(X6 - 19, -61, 36, 30, ROOF_Z, 3, 2.5, 4, 0.6), "mid"),
      dots(dotsAt([[X6 - 15, -57], [X6 + 13, -57], [X6 - 15, -35], [X6 + 13, -35]], ROOF_Z + 3), 0.5, "mid"),
      // the beacon
      solid(cyl(X6 + 10, -53, 3.4, ROOF_Z + 3, 1.4, 20), "lo"),
      solid(cyl(X6 + 10, -53, 2.6, ROOF_Z + 4.4, 5, 18), "mid", "faint", { flag: "beacon" }),
      line(circle(X6 + 10, -53, 1.4, ROOF_Z + 9.4, 12), "lo"),
      // the mast
      solid(cyl(POST.mastX, POST.mastY, 3.6, MAST_BASE, 2, 20), "mid"),
      solid(cyl(POST.mastX, POST.mastY, 1.8, MAST_BASE + 2, RADAR.z - MAST_BASE - 2, 14), "mid", "none"),
      line(join(...[40, 46, 52].map((z) => sideArc(POST.mastX, POST.mastY, 1.8, z, P, 10))), "faint"),
    ],
  },
  {
    id: "s6-radar",
    layer: 1,
    c: [X6, -46, 40],
    bias: 0.1,
    specs: [
      { k: "dsolid", name: "radar", tone: "hi" },
      solid(cyl(POST.mastX, POST.mastY, 2.4, RADAR.z + 2.4, 2.6, 16), "mid"),
      solid(ball(POST.mastX, POST.mastY, RADAR.z + 2.4 + 2.6 + 2.6, 2.6), "hi", "none"),
    ],
  },
];
