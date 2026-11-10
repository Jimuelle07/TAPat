import { translateAlong } from "../../iso/iso-kit";
import { DAYS, LAYERS } from "./tranche.gen";
import { keySvg, needleSvg, pegSvg } from "./tranche-frame";
import type { TrancheFrame } from "./tranche-model";
import { GATE_LIFT, P, REST_PHP, REST_PROB, TOKEN_X0, TOKEN_X1, xOfProb, PX_PER_PHP } from "./tranche-view";

export { DAYS };

const RIDE_TOKEN = TOKEN_X1 - TOKEN_X0;

/** The finished drawing for one frame: static art as given strings, moved groups for the cursor, slider, gate, tokens and card chips. */
export function TrancheScene({ state }: { state: TrancheFrame }) {
  const move = (slot: string): { transform?: string; opacity?: number } => {
    if (slot === "cursor") return { transform: translateAlong(P, [0, 0, (state.price - REST_PHP) * PX_PER_PHP]) };
    if (slot === "slider") return { transform: translateAlong(P, [xOfProb(state.cp) - xOfProb(REST_PROB), 0, 0]) };
    if (slot === "gate") return { transform: translateAlong(P, [0, 0, GATE_LIFT * state.gate]) };
    const token = /^token(\d)$/.exec(slot);
    if (token) {
      const t = state.tokens[Number(token[1])]!;
      return { transform: translateAlong(P, [RIDE_TOKEN * t.u, 0, 0]), opacity: t.alpha };
    }
    const chip = /^chip(\d)$/.exec(slot);
    if (chip) return { opacity: state.chips[Number(chip[1])] };
    return {};
  };

  const rebuilt = (slot: string): string => {
    const peg = /^@peg(\d)$/.exec(slot);
    if (peg) return pegSvg(Number(peg[1]), state.pegs[Number(peg[1])]!);
    const key = /^@key(\d)$/.exec(slot);
    if (key) return keySvg(Number(key[1]), state.keys[Number(key[1])]!);
    return needleSvg(state.needle);
  };

  return (
    <>
      {LAYERS.map(([slot, svg], index) =>
        slot.startsWith("@") ? (
          <g key={index} dangerouslySetInnerHTML={{ __html: rebuilt(slot) }} />
        ) : slot === "" ? (
          <g key={index} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <g key={index} {...move(slot)} dangerouslySetInnerHTML={{ __html: svg }} />
        ),
      )}
    </>
  );
}
