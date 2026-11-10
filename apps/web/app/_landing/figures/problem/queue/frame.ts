import { depthOf, iso } from "@/app/_landing/iso/iso-kit";
import type { State } from "./model";
import { GROUND_FOOT, P } from "./view";

/** Person ids, far to near, so nearer people paint over farther ones. */
export const orderOf = (state: State) =>
  state.people
    .map((person, id) => ({ id, key: depthOf([person.x, person.y, 0], P) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.id);

/** A person under the lamp sags: squashed about a fifth about the feet, which stay put. */
export const squashOf = (heat: number) => 1 - 0.2 * heat;
export const wiltOf = (heat: number) => {
  const s = squashOf(heat);
  return `matrix(1 0 0 ${Math.round(s * 1000) / 1000} 0 ${Math.round(iso([0, 0, GROUND_FOOT], P)[1] * (1 - s) * 100) / 100})`;
};
