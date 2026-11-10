import "@/app/_landing/iso/iso.css";
import "./problem.css";
import { Plate } from "@/app/_landing/iso/react/draw";
import { DriversArt } from "./drivers/art";
import { readoutOf as driversReadout, REST } from "./drivers/model";
import { LeakArt } from "./leak/art";
import { readoutOf as leakReadout, REST_TIME, stateAt as leakAt } from "./leak/model";
import { QueueArt } from "./queue/art";
import { readoutOf as queueReadout, REST_TIME as QUEUE_REST, stateAt as queueAt } from "./queue/model";
import { UnpaidArt } from "./unpaid/art";
import { readoutOf as unpaidReadout, REST_TIME as UNPAID_REST, stateAt as unpaidAt } from "./unpaid/model";
import type { ProblemKind } from "./shared";

interface Frame {
  fig: string;
  theme: "dark" | "light";
  readout: string;
  art: React.ReactNode;
}

const FRAMES: Record<ProblemKind, Frame> = {
  drivers: { fig: "Fig 2.1", theme: "dark", readout: driversReadout(REST.n), art: <DriversArt /> },
  leak: { fig: "Fig 2.2", theme: "light", readout: leakReadout(leakAt(REST_TIME).leaked), art: <LeakArt /> },
  unpaid: { fig: "Fig 2.3", theme: "light", readout: unpaidReadout(unpaidAt(UNPAID_REST)), art: <UnpaidArt /> },
  queue: { fig: "Fig 2.4", theme: "light", readout: queueReadout(queueAt(QUEUE_REST)), art: <QueueArt /> },
};

/** One problem tile's instrument: a minimal plate (figure number and live readout) around the art. */
export function ProblemFigure({ kind }: { kind: ProblemKind }) {
  const frame = FRAMES[kind];
  return (
    <div className="iso pf" data-theme={frame.theme}>
      <Plate fig={frame.fig} title="illustration" readout={frame.readout}>
        {frame.art}
      </Plate>
    </div>
  );
}
