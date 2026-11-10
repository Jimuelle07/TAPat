import { DEFAULT_PHP_PER_XLM, phpToStroops } from "@tapat/shared";
import { php } from "@/lib/format";
import { Plate } from "../../iso/react/draw";
import "../../iso/iso.css";
import { RecorderBody } from "./art";
import { RecorderLive } from "./live";
import { type LandingScenario, RESTING_READOUT, perLitre } from "./model";
import "./recorder.css";

const money = (n: number) => php(phpToStroops(n), DEFAULT_PHP_PER_XLM).replace("PHP ", "₱");

interface Props {
  scenario: LandingScenario;
  position: number;
  count: number;
  thresholdPhp: number;
  tranchePhp: number;
  cards: number;
}

export function RecorderFigure({ scenario, position, count, thresholdPhp, tranchePhp, cards }: Props) {
  const label =
    `A strip-chart recorder on a bench replaying "${scenario.title}". A pen on a carriage draws each day's simulated diesel price on a roll of ruled paper, ` +
    `above or below a taut ${perLitre(thresholdPhp)} per litre wire. A ratchet wheel steps one tooth for each day the price closes at or above the wire and springs back on a dip; ` +
    `a dial shows the changepoint probability and number wheels count the day. On day ${scenario.fireIdx}, the day the precomputed Tranche Agent run releases funds, ` +
    `a solenoid lifts the stop bar and ${cards} tokens of ${money(tranchePhp)} slide down a chute into ${cards} card trays. ${scenario.story}`;
  return (
    <div className="iso rc-figure" data-theme="light">
      <Plate
        fig="Fig 3"
        title={scenario.title}
        hint="Move across or use ← → to step days"
        readout={RESTING_READOUT}
        keys={[
          { mark: "lit", label: "The pen and the price it draws" },
          { mark: "edge", label: `The ${perLitre(thresholdPhp)}/L wire and the ratchet that counts days above it` },
          { mark: "raised", label: `${money(tranchePhp)} tokens, one per card` },
        ]}
        caption={
          <>
            Scenario {position} of {count}, picked at random on each visit. Prices are simulated; the release decisions were precomputed by the real Tranche Agent code (Bayesian Online Changepoint
            Detection), so the recorder replays them and decides nothing itself. {scenario.story} The precomputed run released funds on day {scenario.fireIdx}: {scenario.reason}.
          </>
        }
      >
        <RecorderLive scenario={scenario} thresholdPhp={thresholdPhp}>
          <RecorderBody scenario={scenario} label={label} />
        </RecorderLive>
      </Plate>
    </div>
  );
}
