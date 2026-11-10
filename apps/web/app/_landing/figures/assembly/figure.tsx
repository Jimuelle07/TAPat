import { Plate } from "@/app/_landing/iso/react/draw";
import "@/app/_landing/iso/iso.css";
import { AssemblyArt } from "./art";
import { poseAt, U_REST } from "./frame";
import { TRUTH } from "./truth";
import "./assembly.css";

const REST = poseAt(U_REST, false, 0, TRUTH);

export function AssemblyFigure() {
  return (
    <div className="iso as-root" data-theme="light">
      <Plate
        fig="Fig 4"
        title="How it's built"
        hint="Hover or ← → to step · F freezes the card"
        readout={REST.say}
        keys={[
          { mark: "lit", label: "The ₱1,500 tranche as three ₱500 chips" },
          { mark: "raised", label: "Eight stations, 01 to 08" },
          { mark: "dashed", label: "Freeze signal to the claim() latch" },
        ]}
        caption={
          <>
            Agents decide; the Noir contract on Stellar Testnet has the last word. Velo verifies the budget checkout and sponsors network fees; it does not verify individual taps. The diesel price is a simulated
            feed and the Tranche Agent&apos;s decision was precomputed by the real agent code. Press F to see a frozen card held at the latch.
          </>
        }
      >
        <AssemblyArt />
      </Plate>
    </div>
  );
}

