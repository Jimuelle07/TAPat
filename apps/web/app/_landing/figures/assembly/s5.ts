import { towardViewer } from "@/app/_landing/iso/iso-kit";
import { cyl, discX, dotsAt, faceRingX, rectY, seam, slab } from "./h";
import { dots, join, line, poly, solid, type Item } from "./item";
import { LOCK, X5 } from "./consts";
import { BAR_Z, PIN, PIN_X, SHEAR } from "./dyn";
import { P, at } from "./view";

/* 05: authorize(), a three-pin tumbler gate. The pins stand for the cap, the expiry and the nonce. Each key pin must
   rise until the break between key pin and driver pin sits on the shear line; only then can the plug turn, and
   the gate arm on its end swings up out of the lane. The arm, the keyway and the springs are rebuilt each frame. */

const { plugY, plugZ, plugR } = LOCK;
const BODY = { x: X5 - 28, y: -44, w: 40, d: 28 };
const { r: PIN_R, driver: DRIVER, key: KEY, cap: CAP_H } = PIN;

const chambers = join(...PIN_X.map((px) => rectY(px - 3.4, px + 3.4, BODY.y + 3, SHEAR + 0.2, BAR_Z)));
const pips = PIN_X.flatMap((px, index) => Array.from({ length: index + 1 }, (_, n): [number, number] => [px + (n - index / 2) * 2.4, plugY]));

/* The pins pass into the plug, so each is drawn twice, cut at the plug's top by a clip along the front edge of the cut circle:
   the part below it is painted before the plug (the plug covers it), the part above it after the plug. */
const PLUG_X = X5 - 25;
const PLUG_LEN = 35;
const CUT_W = 12;
const clipOf = (index: number, side: "above" | "below") => {
  const px = PIN_X[index] ?? X5;
  const [vx, vy] = towardViewer(P);
  const mid = Math.atan2(vy, vx);
  const arc = Array.from({ length: 13 }, (_, i) => mid - Math.PI / 2 + (Math.PI * i) / 12)
    .map((a) => at([px + PIN_R * Math.cos(a), plugY + PIN_R * Math.sin(a), SHEAR]))
    .sort((a, b) => a[0] - b[0]);
  const first = arc[0]!;
  const last = arc[arc.length - 1]!;
  const far = side === "below" ? 500 : -60;
  return { id: `as-pin-${side}${index}`, d: poly([[first[0] - CUT_W, far], [first[0] - CUT_W, first[1]], ...arc, [last[0] + CUT_W, last[1]], [last[0] + CUT_W, far]], true) };
};
export const PIN_CLIPS = [0, 1, 2].flatMap((index) => [clipOf(index, "below"), clipOf(index, "above")]);

const pinItem = (index: number, side: "above" | "below"): Item => {
  const px = PIN_X[index] ?? X5;
  return {
    id: side === "below" ? `s5-pin${index}-in` : `s5-pin${index}`,
    layer: 1,
    c: [X5, plugY, 20],
    bias: (side === "below" ? 0.03 : 0.055) + index * 0.001,
    m: `pin${index}`,
    clip: `as-pin-${side}${index}`,
    specs: [
      solid(cyl(px, plugY, PIN_R, SHEAR - KEY, KEY, 16), "mid", "faint"),
      solid(cyl(px, plugY, PIN_R, SHEAR, DRIVER, 16), "hi", "faint"),
      ...(side === "above" ? [solid(cyl(px, plugY, PIN_R + 0.5, SHEAR + DRIVER, CAP_H, 16), "mid", "faint")] : []),
    ],
  };
};

export const S5: Item[] = [
  {
    id: "s5-a",
    layer: 1,
    c: [X5 - 8, plugY, 20],
    bias: 0,
    specs: [
      solid(slab(BODY.x - 3, BODY.y - 3, BODY.w + 6, BODY.d + 4, 0, 1.6, 3, 4, 0.4), "lo"),
      dots(dotsAt([[BODY.x, BODY.y], [BODY.x + BODY.w, BODY.y], [BODY.x, BODY.y + BODY.d], [BODY.x + BODY.w, BODY.y + BODY.d]], 1.6), 0.5, "mid"),
      solid(slab(BODY.x, BODY.y, BODY.w, BODY.d, 1.6, 1.6, 2, 3, 0.3), "mid"),
      solid(slab(X5 - 24, -36, 5, 12, 3.2, plugZ - plugR - 3.2, 0.8, 2, 0.2), "mid"),
      solid(slab(X5 + 3, -36, 5, 12, 3.2, plugZ - plugR - 3.2, 0.8, 2, 0.2), "mid"),
      solid(slab(BODY.x, BODY.y, BODY.w, 3, 3.2, 47, 0.8, 2, 0.4), "mid", "faint", { inner: seam(BODY.x, BODY.y, BODY.w, 3, 0.8, SHEAR, 2) }),
      line(chambers, "faint"),
      solid(slab(BODY.x, BODY.y + 3, 3, BODY.d - 3, 3.2, 47, 0.8, 2, 0.4), "mid"),
    ],
  },
  ...[0, 1, 2].map((index) => ({ id: `s5-back${index}`, layer: 1 as const, c: [X5, plugY, 20] as [number, number, number], bias: 0.02, specs: [{ k: "dline" as const, name: `sb${index}`, tone: "mid" as const, cls: "as-coil" }] })),
  {
    id: "s5-bar",
    layer: 1,
    c: [X5, plugY, 20],
    bias: 0.025,
    specs: [
      solid(slab(X5 - 25, plugY - 3, 34, 6, BAR_Z, 4, 1.2, 3, 0.4), "mid"),
      dots(pips.map(([x, y]) => at([x, y, BAR_Z + 4])), 0.55, "hi"),
    ],
  },
  ...[0, 1, 2].map((index) => pinItem(index, "below")),
  ...[0, 1, 2].map((index) => ({ id: `s5-front${index}`, layer: 1 as const, c: [X5, plugY, 20] as [number, number, number], bias: 0.06, specs: [{ k: "dline" as const, name: `sf${index}`, tone: "mid" as const, cls: "as-coil" }] })),
  {
    id: "s5-plug",
    layer: 1,
    c: [X5, plugY, 20],
    bias: 0.05,
    specs: [
      solid(discX(PLUG_X, plugY, plugZ, plugR, PLUG_LEN), "hi", "faint"),
      line(faceRingX(X5 + 10, plugY, plugZ, plugR - 1.2, 28), "lo"),
      line(faceRingX(X5 - 26 + 6, plugY, plugZ, plugR, 28), "faint"),
      { k: "dline", name: "keyway", tone: "hi", cls: "as-key" },
      solid(discX(X5 + 10, plugY, plugZ, 3.4, 5.2), "mid", "faint"),
    ],
  },
  ...[0, 1, 2].map((index) => pinItem(index, "above")),
  {
    id: "s5-arm",
    layer: 3,
    c: [X5 + 16.6, plugY, plugZ],
    bias: 0.5,
    specs: [
      { k: "dsolid", name: "gate", tone: "hi" },
      solid(discX(X5 + LOCK.armX + 3.2, plugY, plugZ, 3.4, 1.4), "mid", "faint"),
      dots([at([X5 + LOCK.armX + 4.6, plugY, plugZ])], 0.6, "hi"),
    ],
  },
];

