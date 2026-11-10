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

/** The finished drawing for one frame: static art as given strings, moved groups for the shutter, tokens and lamps, rebuilt columns and needle. */
export function FreezeScene({ state }: { state: FreezeFrame }) {
  const rebuilt = (slot: string): string => {
    const col = /^@col(\d)_(\d+)$/.exec(slot);
    if (col) {
      const row = Number(col[1]);
      const c = Number(col[2]);
      return colSvg(row, c, state.cols[row * COLS + c]!);
    }
    return needleSvg(state.score);
  };

  return (
    <>
      <defs>
        <clipPath id={CLIP_ID}>
          <path d={CLIP} />
        </clipPath>
      </defs>
      {LAYERS.map(([slot, svg], index) => {
        if (slot.startsWith("@")) return <g key={index} dangerouslySetInnerHTML={{ __html: rebuilt(slot) }} />;
        if (slot === "") return <g key={index} dangerouslySetInnerHTML={{ __html: svg }} />;
        if (slot === "shutter")
          return (
            <g key={index} clipPath={`url(#${CLIP_ID})`}>
              <g transform={translateAlong(P, [0, 0, SHUTTER_UP * (1 - state.shutter)])} dangerouslySetInnerHTML={{ __html: svg }} />
            </g>
          );
        if (slot === "sense") return <g key={index} opacity={state.sense} dangerouslySetInnerHTML={{ __html: svg }} />;
        if (slot === "lamp") return <g key={index} opacity={state.lamp} dangerouslySetInnerHTML={{ __html: svg }} />;
        const tap = /^tap(\d+)(n?)$/.exec(slot);
        if (tap && Number(tap[1]) < POOL) {
          const t = state.taps[Number(tap[1])];
          const here = t && t.near === (tap[2] === "n");
          return (
            <g
              key={index}
              display={here ? undefined : "none"}
              opacity={here ? t.alpha : undefined}
              transform={here ? translateAlong(P, [(TAP_X1 - TAP_X0) * t.u, 0, 0]) : undefined}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          );
        }
        return <g key={index} dangerouslySetInnerHTML={{ __html: svg }} />;
      })}
    </>
  );
}
