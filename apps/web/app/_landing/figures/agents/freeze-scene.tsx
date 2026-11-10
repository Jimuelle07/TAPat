import { memo, type ReactElement } from "react";
import { iso, pathOf, translateAlong } from "../../iso/iso-kit";
import { colSvg, needleSvg } from "./freeze-frame";
import { POOL, type FreezeFrame } from "./freeze-model";
import { CLIP_TOP, COLS, P, SHUTTER, SHUTTER_UP, TAP_X0, TAP_X1 } from "./freeze-view";
import { LAYERS } from "./freeze.gen";

/** The shutter is clipped to its opening on the shutter plane: below the fascia's lower edge it shows, above it is rolled away. */
const CLIP_ID = "ag-freeze-shutter";
const CLIP = pathOf(
  [
    iso([SHUTTER.x, SHUTTER.y, 0], P),
    iso([SHUTTER.x + SHUTTER.w, SHUTTER.y, 0], P),
    iso([SHUTTER.x + SHUTTER.w, SHUTTER.y, CLIP_TOP], P),
    iso([SHUTTER.x, SHUTTER.y, CLIP_TOP], P),
  ],
  true,
);

/*
 * Every layer is a memoised group whose props are primitives, so React skips the ones that did not change this frame. The static layers are
 * elements built once at module load (the same element object each frame); the columns and needle look their markup up in a per-value cache.
 */
const Html = memo(function Html({ svg }: { svg: string }) {
  return <g dangerouslySetInnerHTML={{ __html: svg }} />;
});

const Col = memo(function Col({ row, col, count }: { row: number; col: number; count: number }) {
  return <g dangerouslySetInnerHTML={{ __html: colSvg(row, col, count) }} />;
});

const Needle = memo(function Needle({ score }: { score: number }) {
  return <g dangerouslySetInnerHTML={{ __html: needleSvg(score) }} />;
});

const Shutter = memo(function Shutter({ svg, transform }: { svg: string; transform: string }) {
  return (
    <g clipPath={`url(#${CLIP_ID})`}>
      <g transform={transform} dangerouslySetInnerHTML={{ __html: svg }} />
    </g>
  );
});

const Faded = memo(function Faded({ svg, opacity }: { svg: string; opacity: number }) {
  return <g opacity={opacity} dangerouslySetInnerHTML={{ __html: svg }} />;
});

const Tap = memo(function Tap({ svg, here, opacity, transform }: { svg: string; here: boolean; opacity?: number; transform?: string }) {
  return <g display={here ? undefined : "none"} opacity={opacity} transform={transform} dangerouslySetInnerHTML={{ __html: svg }} />;
});

type Layer =
  | { kind: "static"; element: ReactElement }
  | { kind: "col"; row: number; col: number }
  | { kind: "needle" }
  | { kind: "shutter" | "sense" | "lamp"; svg: string }
  | { kind: "tap"; index: number; near: boolean; svg: string };

const PARTS: Layer[] = LAYERS.flatMap(([slot, svg], i): Layer[] => {
  if (slot === "") return [{ kind: "static", element: <Html key={i} svg={svg} /> }];
  const col = /^@col(\d)_(\d+)$/.exec(slot);
  if (col) return [{ kind: "col", row: Number(col[1]), col: Number(col[2]) }];
  if (slot.startsWith("@")) return [{ kind: "needle" }];
  if (slot === "shutter" || slot === "sense" || slot === "lamp") return [{ kind: slot, svg }];
  const tap = /^tap(\d+)(n?)$/.exec(slot);
  if (tap) return Number(tap[1]) < POOL ? [{ kind: "tap", index: Number(tap[1]), near: tap[2] === "n", svg }] : [{ kind: "static", element: <Html key={i} svg={svg} /> }];
  return [{ kind: "static", element: <Html key={i} svg={svg} /> }];
});

const RIDE = TAP_X1 - TAP_X0;

/** The finished drawing for one frame: static art as given strings, moved groups for the shutter, tokens and lamps, rebuilt columns and needle. */
export function FreezeScene({ state }: { state: FreezeFrame }) {
  return (
    <>
      <defs>
        <clipPath id={CLIP_ID}>
          <path d={CLIP} />
        </clipPath>
      </defs>
      {PARTS.map((layer, i) => {
        switch (layer.kind) {
          case "static":
            return layer.element;
          case "col":
            return <Col key={i} row={layer.row} col={layer.col} count={state.cols[layer.row * COLS + layer.col]!} />;
          case "needle":
            return <Needle key={i} score={state.score} />;
          case "shutter":
            return <Shutter key={i} svg={layer.svg} transform={translateAlong(P, [0, 0, SHUTTER_UP * (1 - state.shutter)])} />;
          case "sense":
            return <Faded key={i} svg={layer.svg} opacity={state.sense} />;
          case "lamp":
            return <Faded key={i} svg={layer.svg} opacity={state.lamp} />;
          case "tap": {
            const t = state.taps[layer.index];
            const live = t != null && t.near === layer.near ? t : null;
            return <Tap key={i} svg={layer.svg} here={live !== null} opacity={live?.alpha} transform={live ? translateAlong(P, [RIDE * live.u, 0, 0]) : undefined} />;
          }
        }
      })}
    </>
  );
}
