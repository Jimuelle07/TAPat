import { memo, type ReactElement } from "react";
import { translateAlong } from "../../iso/iso-kit";
import { DAYS, LAYERS } from "./tranche.gen";
import { keySvg, needleSvg, pegSvg } from "./tranche-frame";
import type { TrancheFrame } from "./tranche-model";
import { GATE_LIFT, P, REST_PHP, REST_PROB, TOKEN_X0, TOKEN_X1, xOfProb, PX_PER_PHP } from "./tranche-view";

export { DAYS };

const RIDE_TOKEN = TOKEN_X1 - TOKEN_X0;

/*
 * Every layer is a memoised group whose props are primitives, so React skips the ones that did not change this frame. The static layers are
 * elements built once at module load (the same element object each frame), the rebuilt ones look their markup up in a per-value cache.
 */
const Html = memo(function Html({ svg }: { svg: string }) {
  return <g dangerouslySetInnerHTML={{ __html: svg }} />;
});

const Moved = memo(function Moved({ svg, transform, opacity }: { svg: string; transform?: string; opacity?: number }) {
  return <g transform={transform} opacity={opacity} dangerouslySetInnerHTML={{ __html: svg }} />;
});

const Peg = memo(function Peg({ k, u }: { k: number; u: number }) {
  return <g dangerouslySetInnerHTML={{ __html: pegSvg(k, u) }} />;
});
const Key = memo(function Key({ k, u }: { k: number; u: number }) {
  return <g dangerouslySetInnerHTML={{ __html: keySvg(k, u) }} />;
});
const Needle = memo(function Needle({ deg }: { deg: number }) {
  return <g dangerouslySetInnerHTML={{ __html: needleSvg(deg) }} />;
});

type Layer =
  | { kind: "static"; element: ReactElement }
  | { kind: "peg" | "key"; index: number }
  | { kind: "token" | "chip"; index: number; svg: string }
  | { kind: "needle" }
  | { kind: "move"; slot: string; svg: string };

const PARTS: Layer[] = LAYERS.map(([slot, svg], i): Layer => {
  if (slot === "") return { kind: "static", element: <Html key={i} svg={svg} /> };
  const rebuilt = /^@(peg|key)(\d)$/.exec(slot);
  if (rebuilt) return { kind: rebuilt[1] as "peg" | "key", index: Number(rebuilt[2]) };
  if (slot.startsWith("@")) return { kind: "needle" };
  const token = /^token(\d)$/.exec(slot);
  if (token) return { kind: "token", index: Number(token[1]), svg };
  const chip = /^chip(\d)$/.exec(slot);
  if (chip) return { kind: "chip", index: Number(chip[1]), svg };
  return { kind: "move", slot, svg };
});

/** The finished drawing for one frame: static art as given strings, moved groups for the cursor, slider, gate, tokens and card chips. */
export function TrancheScene({ state }: { state: TrancheFrame }) {
  return (
    <>
      {PARTS.map((layer, i) => {
        switch (layer.kind) {
          case "static":
            return layer.element;
          case "peg":
            return <Peg key={i} k={layer.index} u={state.pegs[layer.index]!} />;
          case "key":
            return <Key key={i} k={layer.index} u={state.keys[layer.index]!} />;
          case "needle":
            return <Needle key={i} deg={state.needle} />;
          case "token": {
            const t = state.tokens[layer.index]!;
            return <Moved key={i} svg={layer.svg} transform={translateAlong(P, [RIDE_TOKEN * t.u, 0, 0])} opacity={t.alpha} />;
          }
          case "chip":
            return <Moved key={i} svg={layer.svg} opacity={state.chips[layer.index]} />;
          default: {
            const { slot } = layer;
            const transform =
              slot === "cursor"
                ? translateAlong(P, [0, 0, (state.price - REST_PHP) * PX_PER_PHP])
                : slot === "slider"
                  ? translateAlong(P, [xOfProb(state.cp) - xOfProb(REST_PROB), 0, 0])
                  : slot === "gate"
                    ? translateAlong(P, [0, 0, GATE_LIFT * state.gate])
                    : undefined;
            return <Moved key={i} svg={layer.svg} transform={transform} />;
          }
        }
      })}
    </>
  );
}
