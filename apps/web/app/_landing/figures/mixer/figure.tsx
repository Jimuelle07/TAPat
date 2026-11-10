import { Plate } from "../../iso/react/draw";
import "../../iso/iso.css";
import { MixerArt } from "./art";
import { REST_READOUT } from "./rest";
import { DIESEL_CRACK_FACTOR, DIESEL_EXCISE_PHP, DIESEL_MARGIN_PHP, DIESEL_VAT_RATE, INDEX_PHP, LITRES_PER_BARREL, perLitre } from "./model";
import "./mixer.css";

const vat = `${Math.round((1 + DIESEL_VAT_RATE) * 100) / 100}`;

export function MixerFigure() {
  return (
    <div className="iso mx-fig" data-theme="light">
      <Plate
        fig="Fig 5"
        title="A simulated year of diesel"
        hint="Hover to hold · click or ← → to step"
        readout={REST_READOUT}
        keys={[
          { mark: "lit", label: "Pump-price counter: steps only on Tuesdays" },
          { mark: "raised", label: "Crude float and peso dial set the lever" },
          { mark: "edge", label: `Pointer: today's price, ahead of the counter; ${perLitre(INDEX_PHP)} index` },
          { mark: "dotted", label: "Weeks of the year on the front rule" },
        ]}
        caption={`Simulated, not DOE data; the model is simplified. Each Tuesday the pump price follows last week's benchmark: ((crude US$/bbl × ₱/US$ ÷ ${LITRES_PER_BARREL} L/bbl) × ${DIESEL_CRACK_FACTOR} + ${perLitre(DIESEL_EXCISE_PHP)} excise + ${perLitre(DIESEL_MARGIN_PHP)} margin) × ${vat} VAT. The machine plays one invented year per seed, seed 1, 2, 3 and on; ${perLitre(INDEX_PHP)} is the demo trigger price.`}
      >
        <MixerArt />
      </Plate>
    </div>
  );
}
