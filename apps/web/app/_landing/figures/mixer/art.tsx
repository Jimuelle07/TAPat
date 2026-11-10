import * as React from "react";
import type { SolidPaths, Tone } from "../../iso/iso-kit";
import { Dots, FaceText, IsoFigure, Line, Solid } from "../../iso/react/draw";
import { compactArt, compactPath, compactSolid } from "../compact";
import { staticG } from "../static";
import { frameOf } from "./frame";
import * as G from "./geometry";
import { DIGIT_SIZE } from "./layout";
import { MixerLive } from "./live";
import { REST_STATE } from "./rest";
import { HEIGHT, WIDTH } from "./view";

/* Static art goes out compacted: relative commands, one decimal. */
const {
  ARC_ART,
  CAL_ART,
  GEAR_PLATE_ART,
  ARC_STANDOFFS,
  ARM_ART,
  AXLE_ART,
  BASE_ART,
  CAM_ART,
  CARRIAGE_ART,
  COUNTER_ART,
  DIAL_ART,
  DRUM_ART,
  FLOAT_ART,
  GAUGE_ART,
  GEAR_STATIC,
  GUIDE_ART,
  HINGE_ART,
  LADDER_ART,
  RACK_ART,
  SHOE_ART,
  WALL_ART,
  WEEK_ART,
  WEIGHTS_ART,
} = compactArt({
  ARC_ART: G.ARC_ART,
  CAL_ART: G.CAL_ART,
  GEAR_PLATE_ART: G.GEAR_PLATE_ART,
  ARC_STANDOFFS: G.ARC_STANDOFFS,
  ARM_ART: G.ARM_ART,
  AXLE_ART: G.AXLE_ART,
  BASE_ART: G.BASE_ART,
  CAM_ART: G.CAM_ART,
  CARRIAGE_ART: G.CARRIAGE_ART,
  COUNTER_ART: G.COUNTER_ART,
  DIAL_ART: G.DIAL_ART,
  DRUM_ART: G.DRUM_ART,
  FLOAT_ART: G.FLOAT_ART,
  GAUGE_ART: G.GAUGE_ART,
  GEAR_STATIC: G.GEAR_STATIC,
  GUIDE_ART: G.GUIDE_ART,
  HINGE_ART: G.HINGE_ART,
  LADDER_ART: G.LADDER_ART,
  RACK_ART: G.RACK_ART,
  SHOE_ART: G.SHOE_ART,
  WALL_ART: G.WALL_ART,
  WEEK_ART: G.WEEK_ART,
  WEIGHTS_ART: G.WEIGHTS_ART,
});

const KEYED = (key: string, ...children: React.ReactNode[]) => <g key={key}>{children}</g>;

const BASE = KEYED(
  "base",
  <path key="halo" className="iso-halo" d={BASE_ART.halo} />,
  ...BASE_ART.feet.map((parts, index) => (
    <g key={`foot${index}`}>
      {parts.map((paths, part) => (
        <Solid key={part} paths={paths} tone={part ? "mid" : "lo"} />
      ))}
    </g>
  )),
  <Solid key="slab" paths={BASE_ART.slab} tone="mid" />,
  <Line key="groove" d={BASE_ART.groove} tone="lo" />,
  <Line key="rings" d={BASE_ART.screwRings} tone="lo" />,
  <Dots key="screws" points={BASE_ART.screws} size={0.5} tone="mid" />,
  <Solid key="plate" paths={BASE_ART.plate} tone="lo" crease="none" />,
  <Line key="plateline" d={BASE_ART.plateLine} tone="faint" />,
  <Line key="platerule" d={BASE_ART.plateRule} tone="lo" free />,
  <Dots key="platescrews" points={BASE_ART.plateScrews} size={0.45} tone="mid" />,
  <Solid key="week" paths={WEEK_ART.strip} tone="lo" />,
  <Line key="weekbase" d={WEEK_ART.base} tone="faint" />,
  <Line key="weekminor" d={WEEK_ART.minor} tone="lo" />,
  <Line key="weekmajor" d={WEEK_ART.major} tone="mid" />,
  <Dots key="weekscrews" points={WEEK_ART.screws} size={0.45} tone="mid" />,
);

const RIDER = KEYED(
  "rider",
  <Solid key="body" paths={WEEK_ART.rider} tone="hi" />,
  <Line key="line" d={WEEK_ART.riderLine} tone="hi" />,
);

const WALL = KEYED(
  "wall",
  <Solid key="plate" paths={WALL_ART.plate} tone="lo" />,
  <Solid key="skirt" paths={WALL_ART.skirt} tone="lo" />,
  <Dots key="skirtscrews" points={WALL_ART.skirtScrews} size={0.45} tone="mid" />,
  ...WALL_ART.ribs.map((paths, index) => <Solid key={`rib${index}`} paths={paths} tone="mid" />),
  <Dots key="ribscrews" points={WALL_ART.ribScrews} size={0.4} tone="mid" />,
  <Solid key="rail" paths={WALL_ART.rail} tone="mid" />,
  <Dots key="railscrews" points={WALL_ART.railScrews} size={0.5} tone="mid" />,
);

const ARC = KEYED(
  "arc",
  ...ARC_STANDOFFS.map((one, index) => (
    <g key={`standoff${index}`}>
      <Solid paths={one.washer} tone="mid" />
      <Solid paths={one.rod} tone="mid" />
    </g>
  )),
  <Solid key="strip" paths={ARC_ART.strip} tone="mid" />,
  <Line key="rim" d={ARC_ART.rimInner} tone="faint" />,
  <Line key="minor" d={ARC_ART.minor} tone="lo" />,
  <Line key="major" d={ARC_ART.major} tone="mid" />,
  <Dots key="endscrews" points={ARC_ART.endScrews} size={0.5} tone="mid" />,
  <Solid key="lug" paths={ARC_ART.indexLug} tone="hi" />,
  <Line key="index" d={ARC_ART.indexLine} tone="hi" />,
);

const GEAR_PLATE = KEYED(
  "gear-plate",
  <Solid key="plate" paths={GEAR_PLATE_ART.plate} tone="mid" />,
  <Line key="groove" d={GEAR_PLATE_ART.groove} tone="faint" />,
  <Dots key="screws" points={GEAR_PLATE_ART.screws} size={0.5} tone="mid" />,
  ...AXLE_ART.map((one, index) => (
    <g key={`standoff${index}`}>
      <Solid paths={one.washer} tone="mid" />
      <Solid paths={one.standoff} tone="mid" crease="none" />
    </g>
  )),
);

const CALENDAR = KEYED(
  "calendar",
  <Solid key="plate" paths={CAL_ART.plate} tone="mid" />,
  <Line key="groove" d={CAL_ART.groove} tone="faint" />,
  <Line key="cells" d={CAL_ART.cells} tone="lo" />,
  <Line key="rules" d={CAL_ART.rules} tone="lo" free />,
  <Dots key="screws" points={CAL_ART.screws} size={0.45} tone="mid" />,
);

const MARKER = KEYED("marker", <Solid key="marker" paths={CAL_ART.marker} tone="hi" />);

const HINGE_BACK = KEYED(
  "hinge-back",
  <Solid key="foot" paths={HINGE_ART.foot} tone="lo" />,
  <Dots key="footscrews" points={HINGE_ART.footScrews} size={0.45} tone="mid" />,
  <Solid key="back" paths={HINGE_ART.back} tone="mid" />,
);

const HINGE_FRONT = KEYED(
  "hinge-front",
  <Solid key="front" paths={HINGE_ART.front} tone="mid" />,
  <Dots key="cheekscrews" points={HINGE_ART.cheekScrews} size={0.4} tone="mid" />,
  <Solid key="pin" paths={HINGE_ART.pin} tone="hi" />,
  <Line key="pincap" d={HINGE_ART.pinCap} tone="lo" />,
  <Line key="pinring" d={HINGE_ART.pinRing} tone="mid" />,
);

const GEAR_A_RIM = KEYED("gear-a-rim", <Line key="arim" d={GEAR_STATIC.aRim} tone="faint" />);

const GEAR_B_RIM = KEYED(
  "gear-b-rim",
  <Line key="brim" d={GEAR_STATIC.bRim} tone="faint" />,
  <Line key="bhub" d={GEAR_STATIC.bHub} tone="lo" />,
);

const AXLES = AXLE_ART.map((one, index) => (
  <g key={`axle${index}`}>
    <Solid paths={one.head} tone="mid" />
    <Line d={one.headRing} tone="lo" />
    <Dots points={one.headDot} size={0.5} tone="hi" />
  </g>
));

const RACK = KEYED(
  "rack",
  <Solid key="rack" paths={RACK_ART.rack} tone="mid" />,
  <Solid key="stop" paths={RACK_ART.stop} tone="mid" />,
  <Dots key="screws" points={RACK_ART.yokeScrews} size={0.45} tone="mid" />,
);

const GUIDE = KEYED(
  "guide",
  <Solid key="rod" paths={GUIDE_ART.rod} tone="mid" crease="none" />,
  <Line key="marks" d={GUIDE_ART.rodMarks} tone="lo" />,
  <Solid key="cap" paths={GUIDE_ART.cap} tone="mid" />,
);

const LINK = KEYED(
  "link",
  <Solid key="link" paths={DIAL_ART.link} tone="mid" />,
  <Line key="line" d={DIAL_ART.linkLine} tone="faint" />,
  <Dots key="screws" points={DIAL_ART.linkScrews} size={0.45} tone="mid" />,
  <Solid key="rack" paths={DIAL_ART.rack} tone="mid" />,
  <Line key="rail" d={DIAL_ART.rackRail} tone="faint" />,
  <Solid key="foot" paths={GUIDE_ART.foot} tone="mid" />,
);

const CARRIAGE_BACK = KEYED(
  "carriage-back",
  <Solid key="back" paths={SHOE_ART.back} tone="mid" />,
  <Solid key="left" paths={SHOE_ART.left} tone="mid" />,
);

const CARRIAGE = KEYED(
  "carriage",
  <Solid key="right" paths={SHOE_ART.right} tone="mid" />,
  <Solid key="body" paths={CARRIAGE_ART.body} tone="hi" />,
  <Line key="bodyline" d={CARRIAGE_ART.bodyLine} tone="faint" />,
  <Line key="pinhead" d={CARRIAGE_ART.pinHead} tone="lo" />,
  <Dots key="pindot" points={CARRIAGE_ART.pinDot} size={0.6} tone="hi" />,
  <Line key="index" d={CARRIAGE_ART.index} tone="hi" />,
  <Line key="indexbelow" d={CARRIAGE_ART.indexBelow} tone="hi" />,
  <Dots key="rivets" points={CARRIAGE_ART.rivets} size={0.4} tone="mid" />,
  <Solid key="column" paths={CARRIAGE_ART.column} tone="mid" />,
  <Solid key="tower" paths={CARRIAGE_ART.tower} tone="mid" />,
  <Line key="slot" d={CARRIAGE_ART.towerSlot} tone="lo" />,
  <Line key="bevel" d={CARRIAGE_ART.towerBevel} tone="faint" />,
  <Dots key="towerscrews" points={CARRIAGE_ART.towerScrews} size={0.45} tone="mid" />,
);

const WEIGHTS = KEYED(
  "weights",
  <Solid key="foot" paths={WEIGHTS_ART.foot} tone="lo" />,
  <Dots key="footscrews" points={WEIGHTS_ART.footScrews} size={0.45} tone="mid" />,
  <Solid key="post" paths={WEIGHTS_ART.post} tone="mid" />,
  <Line key="postline" d={WEIGHTS_ART.postLine} tone="faint" />,
  <Solid key="margin" paths={WEIGHTS_ART.margin} tone="hi" inner={<Line d={WEIGHTS_ART.marginSeam} tone="faint" />} />,
  <FaceText key="marginlabel" transform={WEIGHTS_ART.marginLabel} size={4.6} tone="hi" anchor="middle">
    9.50
  </FaceText>,
  <Solid key="excise" paths={WEIGHTS_ART.excise} tone="hi" inner={<Line d={WEIGHTS_ART.exciseSeam} tone="faint" />} />,
  <FaceText key="exciselabel" transform={WEIGHTS_ART.exciseLabel} size={4.2} tone="hi" anchor="middle">
    6.00
  </FaceText>,
  <Solid key="bracket" paths={WEIGHTS_ART.bracket} tone="mid" />,
  <Line key="slot" d={WEIGHTS_ART.bracketSlot} tone="lo" />,
  <Dots key="bracketscrews" points={WEIGHTS_ART.bracketScrews} size={0.45} tone="mid" />,
);

const DRUM = KEYED(
  "drum",
  <path key="halo" className="iso-halo" d={DRUM_ART.halo} />,
  <Solid key="pallet" paths={DRUM_ART.pallet} tone="lo" />,
  <Line key="palletgroove" d={DRUM_ART.palletGroove} tone="faint" />,
  <Dots key="palletscrews" points={DRUM_ART.palletScrews} size={0.45} tone="mid" />,
  <Solid key="body" paths={DRUM_ART.body} tone="hi" />,
  ...DRUM_ART.hoops.map((hoop, index) => <Solid key={`hoop${index}`} paths={hoop.paths} tone="mid" inner={<Line d={hoop.seam} tone="faint" />} />),
  <Line key="ribs" d={DRUM_ART.ribs} tone="faint" />,
  <Line key="topring" d={DRUM_ART.topRing} tone="lo" />,
  <Line key="topring2" d={DRUM_ART.topRing2} tone="faint" />,
  ...DRUM_ART.bungs.map((bung, index) => (
    <g key={`bung${index}`}>
      <Solid paths={bung.cap} tone="mid" />
      <Line d={bung.knurl} tone="lo" />
      <Line d={bung.ring} tone="lo" />
      <Line d={bung.slot} tone="hi" />
    </g>
  )),
  <Solid key="spigotflange" paths={DRUM_ART.spigotFlange} tone="mid" />,
  <Solid key="spigot" paths={DRUM_ART.spigot} tone="mid" />,
  <Solid key="handle" paths={DRUM_ART.spigotHandle} tone="mid" />,
  <Solid key="handlecap" paths={DRUM_ART.spigotHandleCap} tone="mid" />,
);

const GAUGE_BACK = KEYED(
  "gauge-back",
  <Solid key="foot" paths={GAUGE_ART.foot} tone="lo" />,
  <Dots key="footscrews" points={GAUGE_ART.footScrews} size={0.45} tone="mid" />,
  <Solid key="left" paths={GAUGE_ART.left} tone="mid" />,
  <Solid key="lefttop" paths={GAUGE_ART.leftTop} tone="mid" />,
  <Line key="tickbase" d={GAUGE_ART.tickBase} tone="faint" />,
  <Line key="minor" d={GAUGE_ART.ticksMinor} tone="lo" />,
  <Line key="major" d={GAUGE_ART.ticksMajor} tone="mid" />,
);

const ARM_REAR = KEYED(
  "arm-rear",
  <Solid key="rear" paths={ARM_ART.rear} tone="mid" />,
  <Line key="rearline" d={ARM_ART.rearLine} tone="faint" />,
  <Dots key="reardots" points={ARM_ART.rearDots} size={0.5} tone="hi" />,
);

const FLOAT = KEYED(
  "float",
  <Solid key="float" paths={FLOAT_ART.float} tone="hi" />,
  <Line key="band" d={FLOAT_ART.floatBand} tone="lo" />,
  <Line key="ring" d={FLOAT_ART.floatRing} tone="lo" />,
  <Solid key="stem" paths={ARM_ART.stem} tone="mid" crease="none" />,
  <Line key="marks" d={ARM_ART.stemMarks} tone="lo" />,
  <Solid key="mid" paths={ARM_ART.mid} tone="mid" />,
  <Line key="midline" d={ARM_ART.midLine} tone="faint" />,
);

const GAUGE_FRONT = KEYED(
  "gauge-front",
  <Solid key="right" paths={GAUGE_ART.right} tone="mid" />,
  <Solid key="righttop" paths={GAUGE_ART.rightTop} tone="mid" />,
  <Dots key="railscrews" points={GAUGE_ART.railScrews} size={0.4} tone="mid" />,
);

const DIAL_BASE = KEYED(
  "dial-base",
  <path key="halo" className="iso-halo" d={DIAL_ART.halo} />,
  <Solid key="plate" paths={DIAL_ART.plate} tone="lo" />,
  <Line key="groove" d={DIAL_ART.plateGroove} tone="faint" />,
  <Dots key="screws" points={DIAL_ART.plateScrews} size={0.45} tone="mid" />,
  ...DIAL_ART.runners.map((paths, index) => <Solid key={`runner${index}`} paths={paths} tone="lo" />),
  <Line key="runnerlines" d={DIAL_ART.runnerLines} tone="faint" />,
  ...DIAL_ART.bearings.map((paths, index) => <Solid key={`bearing${index}`} paths={paths} tone="mid" />),
  <Dots key="bearingscrews" points={DIAL_ART.bearingScrews} size={0.4} tone="mid" />,
);

const DIAL_TOP = KEYED(
  "dial-top",
  <Line key="face" d={DIAL_ART.face} tone="faint" />,
  <Line key="inner" d={DIAL_ART.inner} tone="faint" />,
  <Solid key="knob" paths={DIAL_ART.knob} tone="hi" />,
  <Line key="knurl" d={DIAL_ART.knobKnurl} tone="lo" />,
  <Line key="ring" d={DIAL_ART.knobRing} tone="lo" />,
  <Solid key="post" paths={DIAL_ART.post} tone="mid" />,
  <Solid key="postcap" paths={DIAL_ART.postCap} tone="mid" />,
  <Solid key="finger" paths={DIAL_ART.finger} tone="hi" />,
  <Line key="fingerline" d={DIAL_ART.fingerLine} tone="hi" />,
);

const COUNTER_BODY = KEYED(
  "counter-body",
  <path key="halo" className="iso-halo" d={COUNTER_ART.halo} />,
  <Solid key="low" paths={COUNTER_ART.low} tone="mid" />,
  <Solid key="back" paths={COUNTER_ART.back} tone="lo" />,
  <Solid key="left" paths={COUNTER_ART.left} tone="mid" />,
);

const COUNTER_WHEELS = KEYED(
  "counter-wheels",
  <path key="recess" className="mx-recess" d={COUNTER_ART.recess} />,
  ...COUNTER_ART.wheels.flatMap((wheel, index) => [
    <Solid key={`wheel${index}`} paths={wheel.body} tone="hi" crease="none" />,
    ...(COUNTER_ART.axles[index] ? [<Solid key={`axle${index}`} paths={COUNTER_ART.axles[index]!} tone="mid" crease="none" />] : []),
  ]),
  <Line key="dividers" d={COUNTER_ART.dividers} tone="faint" />,
);

const COUNTER_FRONT = KEYED(
  "counter-front",
  <Solid key="liplow" paths={COUNTER_ART.lipLow} tone="mid" />,
  <Solid key="liphigh" paths={COUNTER_ART.lipHigh} tone="mid" />,
  <Solid key="right" paths={COUNTER_ART.right} tone="mid" />,
  <Solid key="top" paths={COUNTER_ART.top} tone="mid" />,
  <Line key="inset" d={COUNTER_ART.topInset} tone="faint" />,
  <Line key="vent" d={COUNTER_ART.topVent} tone="lo" />,
  <Dots key="topscrews" points={COUNTER_ART.topScrews} size={0.5} tone="mid" />,
  ...COUNTER_ART.bezel.map((paths, index) => <Solid key={`bezel${index}`} paths={paths} tone="hi" lit />),
  <Dots key="point" points={COUNTER_ART.dotPoint} size={1.2} tone="hi" />,
  <Solid key="plate" paths={COUNTER_ART.plate} tone="lo" crease="none" />,
  <Line key="plateline" d={COUNTER_ART.plateRule} tone="lo" free />,
  <Dots key="platescrews" points={COUNTER_ART.plateScrews} size={0.4} tone="mid" />,
  <Line key="slot" d={COUNTER_ART.slotOutline} tone="lo" />,
  <Dots key="sidescrews" points={COUNTER_ART.sideScrews} size={0.45} tone="mid" />,
);

const LADDER = KEYED(
  "ladder",
  <Solid key="foot" paths={LADDER_ART.foot} tone="lo" />,
  <Dots key="footscrews" points={LADDER_ART.footScrews} size={0.45} tone="mid" />,
  <Solid key="strip" paths={LADDER_ART.strip} tone="mid" />,
  <Line key="base" d={LADDER_ART.base} tone="faint" />,
  <Line key="minor" d={LADDER_ART.ticks.minor} tone="lo" />,
  <Line key="major" d={LADDER_ART.ticks.major} tone="mid" />,
  <Solid key="cap" paths={LADDER_ART.cap} tone="mid" />,
  <Solid key="flag" paths={LADDER_ART.flag} tone="hi" />,
  <FaceText key="label" transform={LADDER_ART.flagLabel} size={3.4} tone="hi" anchor="middle">
    65.00
  </FaceText>,
  <Line key="flagline" d={LADDER_ART.flagLine} tone="hi" />,
  <Dots key="flagscrews" points={LADDER_ART.flagScrews} size={0.4} tone="mid" />,
);

const BEAD = KEYED(
  "bead",
  <Solid key="bead" paths={LADDER_ART.bead} tone="hi" />,
  <Line key="line" d={LADDER_ART.beadLine} tone="hi" />,
);

const CAM_BASE = KEYED(
  "cam-base",
  <Solid key="bed" paths={CAM_ART.bed} tone="lo" />,
  <Line key="bedline" d={CAM_ART.bedLine} tone="faint" />,
  <path key="halo" className="iso-halo" d={CAM_ART.halo} />,
  <Solid key="plate" paths={CAM_ART.plate} tone="lo" />,
  <Line key="groove" d={CAM_ART.plateGroove} tone="faint" />,
  <Dots key="screws" points={CAM_ART.plateScrews} size={0.45} tone="mid" />,
  <Solid key="guide0" paths={CAM_ART.guide[0]!} tone="mid" />,
);

const CAM_TOP = KEYED(
  "cam-top",
  <Line key="dayring" d={CAM_ART.dayRing} tone="faint" />,
  <Solid key="hub" paths={CAM_ART.hub} tone="hi" />,
  <Line key="knurl" d={CAM_ART.hubKnurl} tone="lo" />,
  <Line key="ring" d={CAM_ART.hubRing} tone="lo" />,
  <Line key="slot" d={CAM_ART.hubSlot} tone="hi" />,
);

const FOLLOWER = KEYED(
  "follower",
  <Solid key="roller" paths={CAM_ART.roller} tone="hi" />,
  <Line key="rollerring" d={CAM_ART.rollerRing} tone="lo" />,
  <Solid key="rod" paths={CAM_ART.rod} tone="mid" />,
  <Line key="rodline" d={CAM_ART.rodLine} tone="faint" />,
);

const CAM_FRONT = KEYED("cam-front", <Solid key="guide1" paths={CAM_ART.guide[1]!} tone="mid" />);

const LABEL =
  "A bench-top mechanical price computer. A crude-oil drum has a float gauge that sets a lever in US$ per barrel; a peso dial slides a carriage along that lever, so the carriage rises with dollars times pesos. A balance arm rests on the carriage and on two fixed weights, 6.00 pesos of excise and 9.50 of margin, so its middle rises by half the sum. A rack on its middle turns a 14-tooth pinion and a 28-tooth gear that drives a 25-tooth gear: 28 over 25 is 1.12, the VAT. A pointer reads the pump price on a scale with a 65.00 peso index. A counter with number wheels copies that price only when a weekly calendar cam lets it, on a Tuesday, and a price ladder beside it shows the counter against the 65.00 index.";

/* ------------------------------------------------------------------------------------------------ the parts the live component rebuilds */

const REST = frameOf(REST_STATE);

function Shell({ name, paths, tone = "mid", crease = "faint", bevel = false }: { name: string; paths: SolidPaths; tone?: Tone; crease?: Tone | "none"; bevel?: boolean }) {
  const d = compactSolid(paths);
  return (
    <g className="iso-solid" data-mx-solid={name}>
      <path className="iso-fill" data-p="fill" d={d.fill} />
      {[0, 1, 2, 3].map((shade) => (
        <path key={shade} className="iso-shade" data-shade={shade} data-p={`s${shade}`} d={d.shades[shade] ?? ""} />
      ))}
      <path className="iso-top" data-p="top" d={d.top} />
      <path className="iso-line iso-crease" data-tone={crease === "none" ? "faint" : crease} data-p="crease" d={crease === "none" ? "" : d.crease} />
      {bevel ? <path className="iso-line iso-bevel" data-tone="faint" data-p="bevel" d={d.bevel ?? ""} /> : null}
      <path className="iso-line iso-edge" data-tone={tone} data-p="edge" d={d.outline} />
    </g>
  );
}

function Dyn({ name, d, tone = "lo" }: { name: string; d: string; tone?: Tone }) {
  return <path className="iso-line" data-tone={tone} data-mx-d={name} d={compactPath(d)} />;
}

const DIGITS = REST.digits.map((wheel, w) =>
  wheel.map((digit, d) => (
    <text
      key={`${w}-${d}`}
      className="iso-face-text mx-digit"
      data-tone="hi"
      data-mx-digit={`${w}-${d}`}
      fontSize={DIGIT_SIZE}
      textAnchor="middle"
      dy=".36em"
      transform={digit.transform || undefined}
      opacity={digit.opacity}
    >
      {d}
    </text>
  )),
);

/**
 * The whole machine, painter's order exact, drawn once on the server. The live component only finds the `data-mx*` nodes
 * and writes their transforms and path data each frame, so none of this markup or the geometry behind it ships as client code.
 */
export function MixerArt() {
  return (
    <MixerLive>
      <IsoFigure width={WIDTH} height={HEIGHT} label={LABEL}>
        <defs>
          <clipPath id="mx-window">
            <path d={COUNTER_ART.clip} />
          </clipPath>
        </defs>
        {staticG(BASE)}
        <g data-mx="rider" transform={REST.rider}>
          {staticG(RIDER)}
        </g>
        {staticG(WALL)}
        {staticG(GEAR_PLATE)}
        {staticG(CALENDAR)}
        <g data-mx="calendar" transform={REST.calendar}>
          {staticG(MARKER)}
        </g>
        {staticG(ARC)}
        {staticG(HINGE_BACK)}
        <Shell name="lever" paths={REST.lever} tone="mid" />
        <Dyn name="leverGroove" d={REST.leverGroove} tone="faint" />
        <Dyn name="leverSlots" d={REST.leverSlots} tone="lo" />
        {staticG(HINGE_FRONT)}
        <Shell name="gearA" paths={REST.gearA} tone="mid" />
        {staticG(GEAR_A_RIM)}
        <Dyn name="gearASpokes" d={REST.gearASpokes} tone="faint" />
        <Shell name="gearB" paths={REST.gearB} tone="mid" />
        {staticG(GEAR_B_RIM)}
        <Dyn name="gearBSpokes" d={REST.gearBSpokes} tone="faint" />
        {staticG(DIAL_BASE)}
        <g data-mx="guide" transform={REST.guide}>
          {staticG(LINK)}
        </g>
        <Shell name="dialWheel" paths={REST.dialWheel} tone="mid" />
        <Dyn name="dialMinor" d={REST.dialMinor} tone="lo" />
        <Dyn name="dialMajor" d={REST.dialMajor} tone="mid" />
        {staticG(DIAL_TOP)}
        <g data-mx="carriage" transform={REST.carriage}>
          {staticG(CARRIAGE_BACK)}
        </g>
        <g data-mx="guide" transform={REST.guide}>
          {staticG(GUIDE)}
        </g>
        <g data-mx="rack" transform={REST.rack}>
          {staticG(RACK)}
        </g>
        <Shell name="pinion" paths={REST.pinion} tone="mid" />
        {staticG(AXLES[0])}
        <Shell name="pointer" paths={REST.pointer} tone="hi" />
        {staticG(AXLES[1])}
        <g data-mx="carriage" transform={REST.carriage}>
          {staticG(CARRIAGE)}
        </g>
        {staticG(WEIGHTS)}
        <Shell name="beam" paths={REST.beam} tone="hi" />
        <Dyn name="beamGroove" d={REST.beamGroove} tone="faint" />
        <Dyn name="beamRings" d={REST.beamRings} tone="lo" />
        <g className="iso-dots" data-tone="hi">
          {REST.beamPins.map(([x, y], index) => (
            <circle key={index} data-mx-pin={index} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={0.7} />
          ))}
        </g>
        {staticG(DRUM)}
        <g data-mx="float" transform={REST.float}>
          {staticG(ARM_REAR)}
        </g>
        {staticG(GAUGE_BACK)}
        <g data-mx="float" transform={REST.float}>
          {staticG(FLOAT)}
        </g>
        {staticG(GAUGE_FRONT)}
        {staticG(LADDER)}
        <g data-mx="bead" transform={REST.bead}>
          {staticG(BEAD)}
        </g>
        {staticG(COUNTER_BODY)}
        {staticG(COUNTER_WHEELS)}
        <g clipPath="url(#mx-window)">{DIGITS}</g>
        {staticG(COUNTER_FRONT)}
        {staticG(CAM_BASE)}
        <g data-mx="follower" transform={REST.follower}>
          {staticG(FOLLOWER)}
        </g>
        <Shell name="cam" paths={REST.cam} tone="hi" bevel />
        <Dyn name="camMinor" d={REST.camMinor} tone="lo" />
        <Dyn name="camMajor" d={REST.camMajor} tone="hi" />
        {staticG(CAM_TOP)}
        {staticG(CAM_FRONT)}
      </IsoFigure>
    </MixerLive>
  );
}
