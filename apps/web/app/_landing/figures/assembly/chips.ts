import { circleRing, knurl, onTop, topMatrix } from "@/app/_landing/iso/iso-kit";
import { cyl } from "./h";
import { line, solid, type Item } from "./item";
import { X7 as X7_C } from "./consts";
import { CHIP_H, CHIP_R, CHIP_Z, P } from "./view";

/* The ₱1,500 tranche as three ₱500 chips. Built at x = 0, y = 0 and moved by the live loop; chip 0 is the bottom one. */

const specsOf = (z: number) => [
    solid(cyl(0, 0, CHIP_R, z, CHIP_H, 36, 0.5), "hi", "faint", { lit: true }),
    line(knurl(0, 0, CHIP_R, z, z + CHIP_H, 30, P, 0.5), "lo"),
    line(onTop(circleRing(0, 0, 6.8, 32), z + CHIP_H, P, true), "faint"),
    { k: "text" as const, tf: topMatrix([0, 2.9], z + CHIP_H, P, "x"), text: "₱", size: 8.4, tone: "hi" as const, anchor: "middle" as const },
];

export const CHIPS: Item[] = CHIP_Z.map((z, k) => ({ id: `chip${k}`, layer: 2, c: [0, 0, z], m: `chip${k}`, vis: k === 2 ? "!chipBack" : undefined, specs: specsOf(z) }));

/* The top chip also has a twin that is painted behind the claim latch: it shows once the chip has slid past the gate. */
export const CHIP_BEHIND: Item = { id: "chip2b", layer: 1, c: [X7_C, -18.5, 8], bias: 0.05, m: "chip2", vis: "chipBack", specs: specsOf(CHIP_Z[2]!) };
