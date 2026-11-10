import { insetPlan, planOutline, ring, sideSeam } from "../../iso/iso-kit";
import { dots, dotsX, dotsY, dotsZ, line, onX, onY, rrect, type Scene } from "./build";
import { BACK_Y, DECK, DECK_H, DECK_Z, FLOOR, P, PLINTH, PLINTH_H, ROOF_H, WALL_TOP } from "./view";

// Concrete pad, anchor bolts, deck, walls, posts, roof and the two bay dividers.
export function baseParts(s: Scene) {
  const ringOn = (cx: number, cy: number, r: number, z: number) => ring(cx, cy, r, z, P, 14);

  s.slab("pad", PLINTH, 0, PLINTH_H, {
    tone: "lo",
    bevel: 0.8,
    ground: true,
    halo: true,
    steps: 4,
    lines: [line(planOutline(insetPlan(PLINTH, 4), PLINTH_H, P, 4), "faint")],
  });

  const bolts: Array<[number, number]> = [
    [-166, -39],
    [-166, 39],
    [218, -39],
    [218, 39],
  ];
  for (const [index, [x, y]] of bolts.entries()) {
    s.cyl(`pad.washer${index}`, x, y, 3.4, PLINTH_H, 0.8, { tone: "lo", steps: 16 });
    s.cyl(`pad.nut${index}`, x, y, 2.4, PLINTH_H + 0.8, 2.2, { tone: "mid", steps: 6, crease: "faint", lines: [line(ringOn(x, y, 1.2, PLINTH_H + 3), "lo")] });
  }

  s.slab("deck", DECK, DECK_Z, DECK_H, {
    tone: "mid",
    bevel: 0.8,
    steps: 3,
    inner: sideSeam(DECK, DECK_Z + 3.4, P, 3),
    lines: [line(planOutline(insetPlan(DECK, 5), FLOOR, P, 3), "faint")],
    dots: [dots(dotsZ(FLOOR, [[-154, -30], [-154, 30], [154, -30], [154, 30]]), 0.5, "mid")],
  });

  const wallH = WALL_TOP - FLOOR;
  const louvres: Array<[number, number]> = [];
  for (let x = -146; x <= 140; x += 24) louvres.push([x, 79]);
  s.slab("wall.back", { x: -160, y: -36, w: 312, d: 4, r: 0 }, FLOOR, wallH, {
    tone: "mid",
    steps: 1,
    lines: [
      line(onY(BACK_Y, [[-156, 64], [152, 64]]), "faint"),
      ...louvres.map(([x, z]) => line(onY(BACK_Y, rrect(x, z, 14, 3, 1.5, 3), true), "lo")),
    ],
    dots: [dots(dotsY(BACK_Y, [[-152, 20], [-152, 84], [148, 20], [148, 84]]), 0.5, "mid")],
  });

  s.slab("wall.left", { x: -160, y: -32, w: 4, d: 60, r: 0 }, FLOOR, wallH, {
    tone: "mid",
    steps: 1,
    lines: [line(onX(-156, [[-32, 64], [28, 64]]), "faint")],
    dots: [dots(dotsX(-156, [[-24, 20], [-24, 84], [20, 20], [20, 84]]), 0.5, "mid")],
  });

  const posts: Array<[string, number, number]> = [
    ["post.frontLeft", -160, 28],
    ["post.frontRight", 152, 28],
    ["post.backRight", 152, -36],
  ];
  for (const [id, x, y] of posts) {
    s.slab(id, { x, y, w: 8, d: 8, r: 1 }, FLOOR, wallH, {
      tone: "mid",
      steps: 2,
      bevel: 0.6,
      lines: [line(onY(y + 8, [[x + 2.6, FLOOR], [x + 2.6, WALL_TOP]]), "faint")],
    });
  }

  // Open rain-hood frame (back and both sides), so the roof does not hide the mechanism from the front.
  const hood = [
    ["roof.back", { x: -166, y: -42, w: 332, d: 10, r: 1.5 }],
    ["roof.left", { x: -166, y: -32, w: 10, d: 64, r: 0.8 }],
    ["roof.right", { x: 156, y: -32, w: 10, d: 64, r: 0.8 }],
  ] as const;
  for (const [id, plan] of hood) {
    s.slab(id, plan, WALL_TOP, ROOF_H, {
      tone: "mid",
      bevel: 0.9,
      steps: 3,
      lines: [line(planOutline(insetPlan(plan, 2.2), WALL_TOP + ROOF_H, P, 2), "faint")],
      dots: [dots(dotsZ(WALL_TOP + ROOF_H, plan.w > plan.d ? [[plan.x + 8, plan.y + plan.d / 2], [plan.x + plan.w - 8, plan.y + plan.d / 2]] : [[plan.x + plan.w / 2, plan.y + 8], [plan.x + plan.w / 2, plan.y + plan.d - 8]]), 0.5, "mid")],
    });
  }

  // Divider between the price drum and the governor, back wall to deck.
  for (const [id, x] of [["divider.ab", -97.5]] as const) {
    s.slab(id, { x, y: BACK_Y, w: 3, d: 52, r: 0 }, FLOOR, 66, {
      tone: "mid",
      steps: 1,
      lines: [line(onX(x + 3, [[BACK_Y, 70], [BACK_Y + 52, 70]]), "faint")],
      dots: [dots(dotsX(x + 3, [[-24, 20], [16, 20], [-24, 74], [16, 74]]), 0.45, "mid")],
    });
  }
}
