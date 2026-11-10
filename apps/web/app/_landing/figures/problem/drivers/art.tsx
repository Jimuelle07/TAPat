import * as React from "react";
import { Dots, FaceText, Line, Solid } from "@/app/_landing/iso/react/draw";
import { REST, readoutOf } from "./model";
import { compactArt } from "../../compact";
import { staticG } from "../../static";
import * as G from "./geometry";
import { DriversLive } from "./live";
import { HEIGHT, WIDTH, stripShift } from "./view";

/* Static art goes out compacted: relative commands, one decimal. */
const {
  BASE_ART,
  BEAM_ART,
  COUNTER_ART,
  DIGITS,
  DIGIT_SIZE,
  HEAD_ART,
  LABEL_ART,
  PEG_ART,
  ROW_SPOTS,
  TRAY_ART,
} = compactArt({
  BASE_ART: G.BASE_ART,
  BEAM_ART: G.BEAM_ART,
  COUNTER_ART: G.COUNTER_ART,
  DIGITS: G.DIGITS,
  DIGIT_SIZE: G.DIGIT_SIZE,
  HEAD_ART: G.HEAD_ART,
  LABEL_ART: G.LABEL_ART,
  PEG_ART: G.PEG_ART,
  ROW_SPOTS: G.ROW_SPOTS,
  TRAY_ART: G.TRAY_ART,
});

const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((parts, index) => (
      <g key={index}>
        <Solid paths={parts[0]} tone="lo" crease="faint" />
        <Solid paths={parts[1]} tone="mid" crease="faint" />
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="lo" crease="faint" />
    <Line d={BASE_ART.groove} tone="faint" />
    <Line d={BASE_ART.screwRings} tone="lo" />
    <Dots points={BASE_ART.screws} size={0.5} tone="mid" />
  </g>
);

const TRAY = (
  <g key="tray">
    <Solid paths={TRAY_ART.plate} tone="mid" crease="faint" />
    <Solid paths={TRAY_ART.back} tone="mid" crease="faint" />
    <Solid paths={TRAY_ART.left} tone="mid" crease="faint" />
    <Solid paths={TRAY_ART.board} tone="mid" crease="faint" />
    <Line d={TRAY_ART.boardGroove} tone="faint" />
    <Dots points={TRAY_ART.boardScrews} size={0.5} tone="mid" />
    <path className="pf-hole" d={TRAY_ART.holes} />
    <Solid paths={TRAY_ART.right} tone="mid" crease="faint" />
    <Solid paths={TRAY_ART.strip} tone="lo" crease="none" />
    <Line d={TRAY_ART.ticks.minor} tone="lo" />
    <Line d={TRAY_ART.ticks.major} tone="mid" />
    <Solid paths={TRAY_ART.railLeft} tone="mid" crease="faint" />
    <Line d={TRAY_ART.railTicks.minor} tone="lo" />
    <Line d={TRAY_ART.railTicks.major} tone="mid" />
    <Solid paths={TRAY_ART.railRight} tone="mid" crease="faint" />
    <Dots points={TRAY_ART.railScrews} size={0.45} tone="mid" />
    <Dots points={TRAY_ART.trayScrews} size={0.5} tone="mid" />
    <Solid paths={TRAY_ART.lip} tone="mid" crease="faint" />
    <Dots points={TRAY_ART.lipScrews} size={0.45} tone="mid" />
  </g>
);

const LABEL = (
  <g key="label">
    <Solid paths={LABEL_ART.plate} tone="lo" crease="none" />
    <Line d={LABEL_ART.line} tone="faint" />
    <FaceText transform={LABEL_ART.matrix} size={3.1} tone="hi">
      1 PEG = 1,000 DRIVERS
    </FaceText>
    <Line d={LABEL_ART.rule} tone="lo" free />
    <Dots points={LABEL_ART.screws} size={0.45} tone="mid" />
  </g>
);

const PEGS = (
  <g key="pegs">
    <defs>
      <g id="pf-dr-peg">
        <Solid paths={PEG_ART.peg} tone="mid" crease="faint" />
        <Line d={PEG_ART.bevel} tone="mid" />
      </g>
    </defs>
    {ROW_SPOTS.map((row, r) => (
      <g key={r} className="pf-row">
        {row.map((spot) => (
          <use key={spot.col} href="#pf-dr-peg" x={spot.at[0]} y={spot.at[1]} />
        ))}
      </g>
    ))}
  </g>
);

const BEAM_SHADOW = <path key="beam-shadow" className="iso-halo" d={BEAM_ART.halo} />;

const BEAM = (
  <g key="beam">
    <Solid paths={BEAM_ART.blockLeft} tone="mid" crease="faint" />
    <Solid paths={BEAM_ART.blockRight} tone="mid" crease="faint" />
    <Dots points={BEAM_ART.blockScrews} size={0.5} tone="mid" />
    <Solid paths={BEAM_ART.beam} tone="mid" crease="faint" />
    <Line d={BEAM_ART.ticks.minor} tone="lo" />
    <Line d={BEAM_ART.ticks.major} tone="mid" />
    <Dots points={BEAM_ART.beamScrews} size={0.5} tone="mid" />
  </g>
);

const HEAD = (
  <g key="head">
    <Solid paths={HEAD_ART.carriage} tone="mid" crease="faint" />
    <Dots points={HEAD_ART.screws} size={0.5} tone="mid" />
    <Solid paths={HEAD_ART.magazine} tone="hi" crease="faint" />
    <Line d={HEAD_ART.magazineBand} tone="faint" />
    <Solid paths={HEAD_ART.cap} tone="mid" crease="faint" />
    <Solid paths={HEAD_ART.collar} tone="mid" crease="faint" />
    <Solid paths={HEAD_ART.stem} tone="mid" crease="none" />
    <Solid paths={HEAD_ART.tip} tone="hi" crease="faint" lit />
  </g>
);

const COUNTER_BODY = (
  <g key="counter">
    <Solid paths={COUNTER_ART.body} tone="mid" crease="faint" />
    <Solid paths={COUNTER_ART.topPlate} tone="lo" crease="none" />
    <Line d={COUNTER_ART.topLine} tone="faint" />
    <Solid paths={COUNTER_ART.knob} tone="mid" crease="faint" />
    <Line d={COUNTER_ART.knobKnurl} tone="lo" />
    {COUNTER_ART.frames.map((d, index) => (
      <Line key={index} d={d} tone="lo" />
    ))}
    {COUNTER_ART.windows.map((d, index) => (
      <path key={index} className="pf-hole" d={d} />
    ))}
    <Dots points={COUNTER_ART.screws} size={0.5} tone="mid" />
  </g>
);

const wheelValue = (wheel: number) => Math.floor(REST.n / 10 ** (2 - wheel));

/** One wheel's digit strip, clipped to its window; the live component raises it. */
const STRIPS = DIGITS.map((strip, wheel) => (
  <g key={wheel} clipPath={`url(#pf-dr-clip-${wheel})`}>
    <g data-strip={wheel} transform={stripShift(wheelValue(wheel))}>
      {strip.map(({ digit, matrix }, index) => (
        <FaceText key={index} transform={matrix} size={DIGIT_SIZE} tone="hi" anchor="middle">
          {digit}
        </FaceText>
      ))}
    </g>
  </g>
));

const CLIPS = (
  <defs key="clips">
    {COUNTER_ART.clips.map((d, index) => (
      <clipPath key={index} id={`pf-dr-clip-${index}`}>
        <path d={d} />
      </clipPath>
    ))}
  </defs>
);

const LABEL_TEXT =
  "A pegboard tray with a peg loader on a rail gantry. One peg stands for 1,000 of the 723,000 tricycle drivers slated for the ₱5,000 fuel subsidy; the loader fills the board row by row until 723 pegs stand, while a tally counter on the front apron counts them.";

export function DriversArt() {
  return (
    <DriversLive
      label={LABEL_TEXT}
      width={WIDTH}
      height={HEIGHT}
      rest={readoutOf(REST.n)}
      base={staticG(BASE, "base")}
      tray={staticG(TRAY, "tray")}
      plate={staticG(LABEL, "plate")}
      pegs={staticG(PEGS, "pegs")}
      beamShadow={staticG(BEAM_SHADOW, "beamShadow")}
      beam={staticG(BEAM, "beam")}
      head={staticG(HEAD, "head")}
      counter={staticG(COUNTER_BODY, "counter")}
      clips={staticG(CLIPS, "clips")}
      strips={STRIPS.map((strip, wheel) => staticG(strip, wheel))}
    />
  );
}
