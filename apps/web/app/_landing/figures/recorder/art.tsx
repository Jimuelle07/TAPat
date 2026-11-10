import * as React from "react";
import { sideMatrix, type SolidPaths } from "../../iso/iso-kit";
import { Dots, FaceText, IsoFigure, Line, Solid } from "../../iso/react/draw";
import type { Part } from "./parts";
import type { LandingScenario } from "./model";
import { WINDOW_H } from "./dyn";
import { needleAt, paperAt, ratchetAt } from "./frame";
import { HEIGHT, P, WIDTH } from "./view";
import {
  BAR_BOSS,
  BAR_END_BACK,
  BAR_END_FRONT,
  BASE_PARTS,
  BRIDGE_LEFT,
  BRIDGE_RIGHT,
  CARRIAGE_BACK,
  CARRIAGE_FRONT,
  COIL_CAP,
  COUNTER_PARTS,
  DESK_PARTS,
  DIAL_HUB,
  DIAL_PARTS,
  GANTRY_BACK_POST,
  GANTRY_BAR,
  GANTRY_FRONT_POST,
  HOLD_DOWN,
  HOLD_DOWN_FRONT,
  LABEL_TEXT,
  LAMP_PART,
  LANE_ART,
  PLATE_TEXT,
  PLATEN_BACK_RAIL,
  PLATEN_BED,
  PLATEN_FRONT,
  PLATEN_PAPER,
  PLUNGER_CLIP,
  PLUNGER_PARTS,
  RAIL_ART,
  RATCHET_NUTS,
  RATCHET_PARTS,
  RIGHT_TAIL,
  SOLENOID_PARTS,
  SUPPLY_ROLL,
  TAKEUP,
  TOKEN_ART,
  TRESTLES,
  WIRE_PARTS,
  TURN,
  WINDOW,
  resetCoil,
} from "./geometry";

function partEl(part: Part, key: number) {
  switch (part.kind) {
    case "halo":
      return <path key={key} className="iso-halo" d={part.d} />;
    case "solid":
      return (
        <Solid
          key={key}
          paths={part.paths}
          tone={part.tone}
          crease={part.crease}
          lit={part.lit}
          flat={part.flat}
          inner={part.inner ? <Line d={part.inner} tone="faint" /> : undefined}
        />
      );
    case "line":
      return <Line key={key} d={part.d} tone={part.tone} dotted={part.dotted} free={part.free} />;
    case "dots":
      return <Dots key={key} points={part.points} size={part.size} tone={part.tone} />;
    case "path":
      return <path key={key} className={part.className} d={part.d} />;
  }
}

const group = (key: string, parts: Part[]) => <g key={key}>{parts.map(partEl)}</g>;

const RESET_COIL = group("reset-coil", resetCoil([125.5, 67.5]));

/** Every static layer, as keyed elements placed in painter's order by RecorderBody. */
const ART = {
  base: (
    <g key="base">
      {BASE_PARTS.map(partEl)}
      <FaceText transform={PLATE_TEXT.transform} size={3.4} tone="mid">
        {LABEL_TEXT}
      </FaceText>
    </g>
  ),
  takeupBack: group("takeup-back", TAKEUP.back),
  takeupBody: group("takeup-body", [...TAKEUP.body, ...TAKEUP.hub]),
  bed: group("bed", PLATEN_BED),
  backRail: group("back-rail", PLATEN_BACK_RAIL),
  bridgeLeftBack: group("bridge-left-back", BRIDGE_LEFT.back),
  bridgeRightBack: group("bridge-right-back", BRIDGE_RIGHT.back),
  gantryBackPost: group("gantry-back-post", GANTRY_BACK_POST),
  paper: group("paper", PLATEN_PAPER),
  frontRail: group("front-rail", PLATEN_FRONT),
  wireCoilBack: <Line key="coil-back" d={WIRE_PARTS.coilBack} tone="lo" />,
  wire: group("wire", [WIRE_PARTS.wire, WIRE_PARTS.dots]),
  wireCoilFront: (
    <g key="coil-front">
      {COIL_CAP.map(partEl)}
      <Line d={WIRE_PARTS.coilFront} tone="mid" />
    </g>
  ),
  rightTail: group("right-tail", RIGHT_TAIL),
  holdDown: group("hold-down", HOLD_DOWN),
  bridgeLeftBar: group("bridge-left-bar", BRIDGE_LEFT.bar),
  bridgeRightBar: group("bridge-right-bar", BRIDGE_RIGHT.bar),
  bridgeLeftFront: group("bridge-left-front", BRIDGE_LEFT.front),
  bridgeRightFront: group("bridge-right-front", BRIDGE_RIGHT.front),
  carriageBack: group("carriage-back", CARRIAGE_BACK),
  gantryBar: group("gantry-bar", GANTRY_BAR),
  carriageFront: group("carriage-front", CARRIAGE_FRONT),
  gantryFrontPost: group("gantry-front-post", GANTRY_FRONT_POST),
  holdDownFront: group("hold-down-front", HOLD_DOWN_FRONT),
  supplyBack: group("supply-back", SUPPLY_ROLL.back),
  supplyBody: group("supply-body", [...SUPPLY_ROLL.body, ...SUPPLY_ROLL.hub]),
  desk: group("desk", DESK_PARTS),
  dial: group("dial", DIAL_PARTS),
  dialHub: group("dial-hub", DIAL_HUB),
  counter: group("counter", COUNTER_PARTS),
  ratchet: group("ratchet", RATCHET_PARTS),
  ratchetNuts: group("ratchet-nuts", RATCHET_NUTS),
  trestles: group("trestles", TRESTLES),
  boss: group("boss", BAR_BOSS),
  barBack: group("bar-back", BAR_END_BACK),
  barFront: group("bar-front", BAR_END_FRONT),
  solenoid: group("solenoid", SOLENOID_PARTS),
  plunger: group("plunger", PLUNGER_PARTS),
  lamp: group("lamp", [LAMP_PART]),
  rails: RAIL_ART.map((parts, index) => group(`rail-${index}`, parts)),
  lanes: LANE_ART.map((lane, index) => ({
    rail: group(`rail-lane-${index}`, lane.rail),
    deck: group(`deck-${index}`, lane.deck),
    card: group(`card-${index}`, lane.card),
    bumper: group(`bumper-${index}`, lane.bumper),
    bar: group(`bar-${index}`, lane.bar),
    token: group(`token-${index}`, TOKEN_ART[index]!),
  })),
};

/* ------------------------------------------------------------------------------------------------ the parts the live component moves */

/** A solid whose shape changes each frame: the same markup as the kit's Solid, painted by child index (fill, 4 shades, top, crease, bevel, edge). */
function DynSolid({ name, rest, tone = "hi" }: { name: string; rest: SolidPaths; tone?: "hi" | "mid" }) {
  return (
    <g data-rc={name} className="iso-solid">
      <path className="iso-fill" d={rest.fill} />
      {[0, 1, 2, 3].map((index) => (
        <path key={index} className="iso-shade" data-shade={index} d={rest.shades[index] ?? ""} />
      ))}
      <path className="iso-top" d={rest.top} />
      <path className="iso-line iso-crease" data-tone="faint" d={rest.crease} />
      <path className="iso-line iso-bevel" data-tone="faint" d={rest.bevel ?? ""} />
      <path className="iso-line iso-edge" data-tone={tone} d={rest.outline} />
    </g>
  );
}

const WINDOW_MATRICES = WINDOW.xs.map((x) => sideMatrix([x, WINDOW.y], WINDOW.z0, P, "left"));
const DIGIT_STEP = WINDOW_H;
const TENS = ["0", "1", "2", "3", "4", "5"];
const UNITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function Digits({ glyphs, name, matrix, id }: { glyphs: string[]; name: string; matrix: string; id: string }) {
  return (
    <g transform={matrix}>
      <clipPath id={id}>
        <rect x={0} y={0} width={WINDOW.w} height={WINDOW.h} />
      </clipPath>
      <rect className="rc-window" x={0} y={0} width={WINDOW.w} height={WINDOW.h} />
      <g clipPath={`url(#${id})`}>
        <g data-rc={name}>
          {glyphs.map((glyph, index) => (
            <text key={index} className="iso-face-text rc-digit" data-tone="hi" x={WINDOW.w / 2} y={WINDOW.h / 2 + 3.3 + index * DIGIT_STEP} textAnchor="middle" fontSize={9.4}>
              {glyph}
            </text>
          ))}
        </g>
        <rect className="rc-drum" x={0} y={0} width={WINDOW.w} height={2.2} />
        <rect className="rc-drum" x={0} y={WINDOW.h - 2.2} width={WINDOW.w} height={2.2} />
      </g>
    </g>
  );
}

function Spinner({ name, turn }: { name: string; turn: { spokes: string; rivets: Array<[number, number]> } }) {
  return (
    <g data-rc={name}>
      <path className="iso-line" data-tone="lo" d={turn.spokes} />
      <g className="iso-dots" data-tone="mid">
        {turn.rivets.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={0.5} />
        ))}
      </g>
    </g>
  );
}

/**
 * The whole figure, painter's order exact, with every moving part marked `data-rc`. The live component finds those nodes by selector and only
 * writes attributes, so it imports none of this art or the geometry behind it (the figure itself loads as a lazy client chunk, see ScenarioPlayer).
 */
export function RecorderBody({ scenario, label }: { scenario: LandingScenario; label: string }) {
  const rest = ratchetAt(0, 0);
  const paper = paperAt(scenario, 1);
  return (
    <IsoFigure width={WIDTH} height={HEIGHT} label={label}>
      {ART.base}
      {ART.takeupBack}
      {ART.bridgeLeftBack}
      {ART.bed}
      {ART.takeupBody}
      <Spinner name="reel" turn={TURN.reel} />
      {ART.bridgeRightBack}
      {ART.gantryBackPost}
      {ART.backRail}
      {ART.paper}
      <path data-rc="minor" className="iso-line" data-tone="faint" d={paper.minor} />
      <path data-rc="major" className="iso-line" data-tone="lo" d={paper.major} />
      <path data-rc="holes" className="rc-holes" d={paper.holes} />
      <path data-rc="trace" className="iso-line rc-trace" data-tone="lit" d={paper.trace} />
      {ART.wireCoilBack}
      {ART.wire}
      {ART.holdDown}
      {ART.frontRail}
      {ART.bridgeLeftFront}
      {ART.bridgeLeftBar}
      {ART.wireCoilFront}
      {ART.bridgeRightFront}
      {ART.bridgeRightBar}
      <g data-rc="carBack">{ART.carriageBack}</g>
      {ART.gantryBar}
      <g data-rc="carFront">{ART.carriageFront}</g>
      {ART.gantryFrontPost}
      {ART.holdDownFront}
      {ART.supplyBack}
      {ART.rightTail}
      {ART.supplyBody}
      <Spinner name="supply" turn={TURN.supply} />
      {ART.desk}
      {ART.dial}
      <path data-rc="needle" className="iso-line rc-needle" data-tone="hi" d={needleAt(null)} />
      {ART.dialHub}
      {ART.counter}
      <Digits id="rc-clip-tens" glyphs={TENS} name="tens" matrix={WINDOW_MATRICES[0]!} />
      <Digits id="rc-clip-units" glyphs={UNITS} name="units" matrix={WINDOW_MATRICES[1]!} />
      {ART.ratchet}
      {RESET_COIL}
      <DynSolid name="pawl" rest={rest.pawl} tone="mid" />
      <path data-rc="pawlHole" className="iso-line" data-tone="lo" d={rest.pawlHole} />
      <DynSolid name="wheel" rest={rest.wheel} />
      <path data-rc="wheelHoles" className="iso-line" data-tone="lo" d={rest.holes} />
      <path data-rc="wheelTicks" className="iso-line" data-tone="faint" d={rest.ticks} />
      {ART.ratchetNuts}
      {ART.trestles}
      {ART.boss}
      <g data-rc="barBack">{ART.barBack}</g>
      {ART.lanes.map((lane, index) => (
        <React.Fragment key={index}>
          {lane.deck}
          {lane.rail}
          {index > 0 ? ART.rails[index - 1] : null}
          {lane.card}
          <g data-rc={`token${index}`}>{lane.token}</g>
          {lane.bumper}
          <g data-rc={`seg${index}`}>{lane.bar}</g>
          {index === ART.lanes.length - 1 ? ART.rails[index] : null}
        </React.Fragment>
      ))}
      {ART.solenoid}
      <g data-rc="plunger">
        <clipPath id="rc-plunger">
          <path data-hold="" d={PLUNGER_CLIP} />
        </clipPath>
        <g clipPath="url(#rc-plunger)">{ART.plunger}</g>
      </g>
      <g data-rc="barFront">{ART.barFront}</g>
      <g data-rc="lamp" className="rc-lamp">
        {ART.lamp}
      </g>
    </IsoFigure>
  );
}
