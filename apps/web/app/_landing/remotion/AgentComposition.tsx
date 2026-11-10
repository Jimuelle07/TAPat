import { useCurrentFrame } from "remotion";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { FreezeScene } from "../figures/agents/freeze-scene";
import { freezeAt } from "../figures/agents/freeze-model";
import { COPY as FREEZE_COPY, TRACE } from "../figures/agents/freeze.gen";
import { HEIGHT as FREEZE_HEIGHT, WIDTH as FREEZE_WIDTH } from "../figures/agents/freeze-view";
import { TrancheScene } from "../figures/agents/tranche-scene";
import { trancheAt } from "../figures/agents/tranche-model";
import { COPY as TRANCHE_COPY, DAYS } from "../figures/agents/tranche.gen";
import { HEIGHT as TRANCHE_HEIGHT, WIDTH as TRANCHE_WIDTH } from "../figures/agents/tranche-view";
import type { AgentProps } from "./agentMeta";

/**
 * Idle loop for one agent: the model maps the current frame to the state of every moving part, and the figure's scene component draws it.
 * A pure function of the frame, so a still frame, the pause and the loop seam all come from Remotion for free. The plate's readout is
 * written from here, on the element the plate renders for it, so the card text always matches the drawing on screen.
 */
function Drawing({ width, height, readout, children }: { width: number; height: number; readout: string; children: ReactNode }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const target = ref.current?.closest(".iso-plate")?.querySelector("[data-readout]");
    if (target && target.textContent !== readout) target.textContent = readout;
  });
  return (
    <svg ref={ref} className="iso-svg ag-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function TrancheDrawing({ frame }: { frame: number }) {
  const state = trancheAt(frame, DAYS, TRANCHE_COPY);
  return (
    <Drawing width={TRANCHE_WIDTH} height={TRANCHE_HEIGHT} readout={state.readout}>
      <TrancheScene state={state} />
    </Drawing>
  );
}

function FreezeDrawing({ frame }: { frame: number }) {
  const state = freezeAt(frame, TRACE, FREEZE_COPY);
  return (
    <Drawing width={FREEZE_WIDTH} height={FREEZE_HEIGHT} readout={state.readout}>
      <FreezeScene state={state} />
    </Drawing>
  );
}

export function AgentComposition({ agent }: AgentProps): React.JSX.Element {
  const frame = useCurrentFrame();
  return agent === "tranche" ? <TrancheDrawing frame={frame} /> : <FreezeDrawing frame={frame} />;
}
