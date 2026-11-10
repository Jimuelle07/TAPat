import { Plate } from "../../iso/react/draw";
import { SCENE_HTML } from "./art";
import { COPY } from "./copy";
import { DispenserLive } from "./live";
import { BEAT_NAME, BEATS, CAP, CARD_PESO, FUNDED, machineAt, readoutOf, RETURNED, TAP_NO, TAP_OK } from "./model";
import "../../iso/iso.css";
import "./dispenser.css";

const money = (pesos: number) => COPY.money[Math.round(pesos / 100)]!;

const LABEL = `A roadside fuel-aid dispenser cabinet drawn open. A price drum of number wheels rolls up past a ${COPY.mark} mark. A weighted lever climbs a notched quadrant one notch for each day the price holds, and a latch lets it go on the fourth, which lifts the release gate. Three card cartridges then fill with ${money(CARD_PESO)} each. A card reader with a mechanical stop at ${money(CAP)} accepts a ${money(TAP_OK)} tap and refuses a ${money(TAP_NO)} tap, because the stop blocks its plunger. A return chute empties ${money(RETURNED)}, the ${money(FUNDED)} funded less the ${money(TAP_OK)} spent, into an LGU lockbox.`;

export function DispenserFigure() {
  return (
    <div className="iso dp" data-theme="light">
      <Plate
        fig="Fig 1"
        title="TAPat in one breath · illustration, sample data"
        hint={`1 / ${BEATS} · ${BEAT_NAME[0]}`}
        readout={readoutOf(machineAt(0), 0, COPY)}
      >
        <DispenserLive art={SCENE_HTML} copy={COPY} label={LABEL} />
      </Plate>
    </div>
  );
}
