import * as React from "react";
import { Dots, FaceText, Line, Solid } from "@/app/_landing/iso/react/draw";
import { compactArt } from "../../compact";
import { staticG } from "../../static";
import * as G from "./geometry";
import { dialAt } from "./frame";
import { UnpaidLive } from "./live";
import { REST_TIME, readoutOf, stateAt } from "./model";
import { HEIGHT, WIDTH, gateShift, plateShift } from "./view";

/* Static art goes out compacted: relative commands, one decimal. */
const {
  BASE_ART,
  BIN_ART,
  BODY_ART,
  CHUTE_ART,
  COIN,
  COIN_SPOTS,
  DIAL_ART,
  GATE_ART,
  PUSHER_ART,
  RAIL_ART,
} = compactArt({
  BASE_ART: G.BASE_ART,
  BIN_ART: G.BIN_ART,
  BODY_ART: G.BODY_ART,
  CHUTE_ART: G.CHUTE_ART,
  COIN: G.COIN,
  COIN_SPOTS: G.COIN_SPOTS,
  DIAL_ART: G.DIAL_ART,
  GATE_ART: G.GATE_ART,
  PUSHER_ART: G.PUSHER_ART,
  RAIL_ART: G.RAIL_ART,
});

const REST = stateAt(REST_TIME);
const DIAL_REST = dialAt(REST.months);

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
    <Solid paths={BASE_ART.plinth} tone="mid" crease="faint" inner={<Line d={BASE_ART.plinthSeam} tone="faint" />} />
    {BASE_ART.slots.map((d, index) => (
      <path key={index} className="pf-hole" d={d} />
    ))}
  </g>
);

const DEFS = (
  <defs key="defs">
    <g id="pf-up-coin">
      <Solid paths={COIN} tone="hi" crease="faint" lit />
    </g>
  </defs>
);

const LEGS = (
  <g key="legs">
    {CHUTE_ART.legs.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
  </g>
);

const SHELL = (
  <g key="shell">
    <Solid paths={BODY_ART.floor} tone="mid" crease="faint" />
    <Line d={BODY_ART.floorGroove} tone="faint" />
    <Solid paths={BODY_ART.back} tone="mid" crease="faint" />
    <Line d={BODY_ART.backPanel} tone="faint" />
    <Line d={BODY_ART.backMid} tone="faint" />
    <Solid paths={BODY_ART.left} tone="mid" crease="faint" />
    <Line d={BODY_ART.leftPanel} tone="faint" />
    <Solid paths={BODY_ART.bridge} tone="mid" crease="faint" inner={<Line d={BODY_ART.bridgeSeam} tone="faint" />} />
    <Solid paths={BODY_ART.roof} tone="hi" crease="faint" />
    <Line d={BODY_ART.roofGroove} tone="faint" />
    <Dots points={BODY_ART.roofScrews} size={0.5} tone="mid" />
    <Dots points={BODY_ART.lipScrews} size={0.45} tone="mid" />
  </g>
);

const PUSHER = (
  <g key="pusher">
    <Solid paths={PUSHER_ART.plate} tone="mid" crease="faint" />
    <Solid paths={PUSHER_ART.block} tone="mid" crease="faint" />
    <Dots points={PUSHER_ART.dots} size={0.5} tone="hi" />
  </g>
);

const coinLayer = (layer: "in" | "out") => (
  <g key={`coins-${layer}`}>
    {COIN_SPOTS.map(([x, y], index) => {
      const here = layer === "in";
      const hidden = here ? REST.coins[index].place !== "floor" : REST.coins[index].place === "floor";
      return (
        <g key={index} data-coin={index} data-layer={layer} style={hidden ? { display: "none" } : undefined}>
          <use href="#pf-up-coin" x={x} y={y} />
        </g>
      );
    })}
  </g>
);

const COINS_IN = coinLayer("in");
const COINS_OUT = coinLayer("out");

const POST = (
  <g key="post">
    <Solid paths={RAIL_ART.post} tone="mid" crease="faint" />
    <Dots points={RAIL_ART.postScrews} size={0.5} tone="mid" />
    <Solid paths={RAIL_ART.bottom} tone="mid" crease="faint" />
    <Dots points={RAIL_ART.bottomScrews} size={0.5} tone="mid" />
  </g>
);

const GATE = (
  <g key="gate">
    <Solid paths={GATE_ART.bottom} tone="mid" crease="faint" />
    {GATE_ART.stiles.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    {GATE_ART.bars.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    <Solid paths={GATE_ART.backplate} tone="mid" crease="faint" />
    <Solid paths={GATE_ART.top} tone="mid" crease="faint" />
    <Dots points={GATE_ART.rivets} size={0.45} tone="mid" />
    <Solid paths={GATE_ART.lock} tone="hi" crease="faint" />
    <Dots points={GATE_ART.lockScrews} size={0.45} tone="mid" />
    <Solid paths={DIAL_ART.plate} tone="mid" crease="faint" />
    <Solid paths={DIAL_ART.ring} tone="mid" crease="faint" />
    <path className="pf-hole" d={DIAL_ART.face} />
    <g data-dial="">
      <Line d={DIAL_REST.minor} tone="lo" />
      <Line d={DIAL_REST.major} tone="mid" />
    </g>
    <Line d={DIAL_ART.index} tone="lit" />
  </g>
);

/** The knob: it turns with the dial, so its ribs and pointer are redrawn by the live component. */
const KNOB = (
  <g key="knob">
    <Solid paths={DIAL_ART.knob} tone="mid" crease="faint" />
    {DIAL_REST.ribs.map((rib, index) => (
      <path key={index} className="iso-line" data-tone="lo" data-rib={index} d={rib.d} style={{ opacity: rib.alpha }} />
    ))}
    <Solid paths={DIAL_ART.cap} tone="mid" crease="faint" />
    <path className="iso-line" data-tone="lit" data-pointer="" d={DIAL_REST.pointer} />
    <Dots points={[DIAL_ART.hub]} size={0.7} tone="hi" />
  </g>
);

const TOP_RAIL = (
  <g key="top-rail">
    <Solid paths={RAIL_ART.top} tone="mid" crease="faint" />
    <Dots points={RAIL_ART.topScrews} size={0.5} tone="mid" />
  </g>
);

const BIN_BACK = (
  <g key="bin-back">
    <Solid paths={BIN_ART.floor} tone="mid" crease="faint" />
    <Solid paths={BIN_ART.back} tone="mid" crease="faint" />
    <Solid paths={BIN_ART.left} tone="mid" crease="faint" />
  </g>
);

const CHUTE = (
  <g key="chute">
    <Solid paths={CHUTE_ART.plate} tone="lo" crease="faint" />
    <Solid paths={CHUTE_ART.railBack} tone="mid" crease="faint" />
  </g>
);

const CHUTE_FRONT = <Solid key="chute-front" paths={CHUTE_ART.railFront} tone="mid" crease="faint" />;

const BIN_FRONT = (
  <g key="bin-front">
    <Solid paths={BIN_ART.right} tone="mid" crease="faint" />
    <Solid paths={BIN_ART.front} tone="mid" crease="faint" />
    <Line d={BIN_ART.frontPanel} tone="faint" />
    <FaceText transform={BIN_ART.label} size={2.8} tone="hi">
      TREASURY
    </FaceText>
    {BIN_ART.columns.map((column, index) => (
      <g key={index}>
        <Solid paths={column.base} tone="mid" crease="faint" />
        <Solid paths={column.shaft} tone="hi" crease="none" />
        <Line d={column.flutes} tone="lo" />
        <Solid paths={column.capital} tone="mid" crease="faint" />
      </g>
    ))}
    <Solid paths={BIN_ART.entablature} tone="mid" crease="faint" />
    <Solid paths={BIN_ART.pediment} tone="mid" crease="faint" />
    <Line d={BIN_ART.pedimentRing} tone="lo" />
  </g>
);

const LABEL_TEXT =
  "A time-lock strongroom: an open-fronted steel box on a plinth, with a barred gate on rails and a dial of 24 months in its lock. Twelve coins sit idle behind the bars as the dial turns through 24 months; then the gate slides open, a pusher plate clears the floor, and the coins slide down a chute into a Treasury box. The ₱709.88M is the cited amount returned after two years; the loop is an illustration.";

export function UnpaidArt() {
  return (
    <UnpaidLive
      label={LABEL_TEXT}
      width={WIDTH}
      height={HEIGHT}
      rest={readoutOf(REST)}
      base={staticG([BASE, DEFS, LEGS, SHELL], "base")}
      pusher={staticG(PUSHER, "pusher")}
      pusherAt={plateShift(REST.plate)}
      inside={staticG(COINS_IN, "inside")}
      rails={staticG(POST, "rails")}
      gate={staticG([GATE, KNOB], "gate")}
      gateAt={gateShift(REST.gate)}
      topRail={staticG(TOP_RAIL, "topRail")}
      chute={staticG([BIN_BACK, CHUTE], "chute")}
      outside={staticG(COINS_OUT, "outside")}
      front={staticG([CHUTE_FRONT, BIN_FRONT], "front")}
    />
  );
}
