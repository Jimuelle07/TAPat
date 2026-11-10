import { depthOf } from "@/app/_landing/iso/iso-kit";
import { BASE_ITEM, BELT_BACK, BELT_FRONT, PLATES } from "./bench";
import { CHIPS, CHIP_BEHIND } from "./chips";
import type { Item } from "./item";
import { S1 } from "./s1";
import { S2 } from "./s2";
import { S3 } from "./s3";
import { S4 } from "./s4";
import { S5 } from "./s5";
import { S6 } from "./s6";
import { S7 } from "./s7";
import { S8 } from "./s8";
import { P } from "./view";

/* The painter's order, back to front: the bench, what stands behind the chips, the chips, what stands in front. */

const keyOf = (item: Item) => depthOf(item.c, P) + (item.bias ?? 0);
const byDepth = (items: Item[]) => [...items].sort((a, b) => keyOf(a) - keyOf(b));
const layerOf = (items: Item[], layer: number) => items.filter((item) => item.layer === layer);

const STATIONS = [...S1, ...S2, ...S3, ...S4, ...S5, ...S6, ...S7, ...S8];

export const BENCH: Item[] = [BASE_ITEM, ...PLATES];
export const BEHIND = [...byDepth([...layerOf(STATIONS, 1), CHIP_BEHIND]), ...BELT_BACK];
const FRONT = byDepth(layerOf(STATIONS, 3));
/* The stop plate stands between the chips and the front rail, so it is painted before the rail. */
export const INFRONT = [...FRONT.filter((item) => item.id === "s8-stop" || item.id === "s2-lift"), ...BELT_FRONT, ...FRONT.filter((item) => item.id !== "s8-stop" && item.id !== "s2-lift")];
export const AFTER = byDepth(layerOf(STATIONS, 2)).sort((a, b) => (a.bias ?? 0) - (b.bias ?? 0));
export const PAINT: Item[] = [...BENCH, ...BEHIND, ...AFTER, ...CHIPS, ...INFRONT];
