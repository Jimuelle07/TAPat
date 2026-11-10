import * as React from "react";
import { Dots, FaceText, Line, Solid } from "@/app/_landing/iso/react/draw";
import { compactArt } from "../../compact";
import { staticG } from "../../static";
import * as G from "./geometry";
import { POOL, heapShown, levelPath, mouthShown } from "./frame";
import { LeakLive } from "./live";
import { REST_TIME, readoutOf, stateAt } from "./model";
import { HEIGHT, LAUNCH, WIDTH, flightShift } from "./view";

/* Static art goes out compacted: relative commands, one decimal. */
const {
  BASE_ART,
  COIN,
  DRAWERS,
  GAUGE_ART,
  HEAP,
  HOPPER_ART,
  MOUTH_COINS,
  RACK_ART,
  STAND_ART,
  coinAt,
} = compactArt({
  BASE_ART: G.BASE_ART,
  COIN: G.COIN,
  DRAWERS: G.DRAWERS,
  GAUGE_ART: G.GAUGE_ART,
  HEAP: G.HEAP,
  HOPPER_ART: G.HOPPER_ART,
  MOUTH_COINS: G.MOUTH_COINS,
  RACK_ART: G.RACK_ART,
  STAND_ART: G.STAND_ART,
  coinAt: G.coinAt,
});

const REST = stateAt(REST_TIME);

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
    <Solid paths={BASE_ART.label} tone="lo" crease="none" />
    <Line d={BASE_ART.labelLine} tone="faint" />
    <FaceText transform={BASE_ART.labelMatrix} size={4.2} tone="hi">
      ₱2.7B
    </FaceText>
    <Dots points={BASE_ART.labelScrews} size={0.45} tone="mid" />
  </g>
);

const DEFS = (
  <defs key="defs">
    <g id="pf-lk-coin">
      <Solid paths={COIN} tone="mid" crease="faint" />
    </g>
    <g id="pf-lk-spark">
      <Solid paths={COIN} tone="hi" crease="faint" lit />
    </g>
  </defs>
);

const SKID = (index: number) => (
  <g key={`skid${index}`}>
    <Solid paths={STAND_ART.skids[index]} tone="lo" crease="faint" />
    <Dots points={STAND_ART.skidScrews.slice(index * 2, index * 2 + 2)} size={0.45} tone="mid" />
    <Solid paths={STAND_ART.legs[index]} tone="mid" crease="faint" inner={<Line d={STAND_ART.collars[index]} tone="faint" />} />
  </g>
);
const LEFT_LEG = <g key="leg-left">{SKID(0)}</g>;
const RIGHT_LEG = <g key="leg-right">{SKID(1)}</g>;

const heap = (drawer: number) => (
  <g key={`heap${drawer}`} data-drawer={drawer}>
    {HEAP[drawer].map((coin, index) => (
      <use key={index} href="#pf-lk-coin" x={coin.at[0]} y={coin.at[1]} data-heap={`${drawer}-${index}`} data-threshold={coin.threshold} style={heapShown(coin.threshold, REST.leaked) ? undefined : { display: "none" }} />
    ))}
  </g>
);

const drawerBack = (index: number) => (
  <g key={`drawer-back${index}`} className="pf-ghost" data-drawer={index}>
    <Solid paths={DRAWERS[index].floor} tone="mid" crease="faint" />
    <Solid paths={DRAWERS[index].back} tone="mid" crease="faint" />
    <Solid paths={DRAWERS[index].left} tone="mid" crease="faint" />
    <Solid paths={DRAWERS[index].right} tone="mid" crease="faint" />
  </g>
);

const divider = (index: number) => (
  <g key={`divider${index}`} className="pf-ghost">
    <Solid paths={RACK_ART.dividers[index]} tone="mid" crease="faint" />
  </g>
);

const RACK_AND_DRAWERS = (
  <g key="rack">
    <g className="pf-ghost">
      <Solid paths={RACK_ART.bottom} tone="mid" crease="faint" />
      <Solid paths={RACK_ART.back} tone="mid" crease="faint" />
      <Solid paths={RACK_ART.left} tone="mid" crease="faint" />
    </g>
    {drawerBack(0)}
    {heap(0)}
    {divider(0)}
    {drawerBack(1)}
    {heap(1)}
    {divider(1)}
    {drawerBack(2)}
    {heap(2)}
    <g className="pf-ghost">
      <Solid paths={RACK_ART.right} tone="mid" crease="faint" />
      <Dots points={RACK_ART.screws} size={0.5} tone="mid" />
    </g>
  </g>
);

const GANTRY = (
  <g key="gantry">
    <Solid paths={STAND_ART.brace} tone="mid" crease="faint" />
    <Solid paths={STAND_ART.gantry} tone="mid" crease="faint" />
    <Dots points={STAND_ART.gantryScrews} size={0.5} tone="mid" />
  </g>
);

const FUNNEL = (
  <g key="funnel">
    <Solid paths={HOPPER_ART.funnel} tone="mid" crease="faint" />
    {HOPPER_ART.cracks.map((d, index) => (
      <path key={index} className="pf-hole" d={d} />
    ))}
  </g>
);

const FLIGHTS = (
  <g key="flights">
    {POOL.map(({ stream, slot }) => {
      const flight = REST.flights.find((f) => f.stream === stream && f.slot === slot);
      const [x, y] = coinAt(LAUNCH[stream]);
      return (
        <g key={`${stream}-${slot}`} data-flight={`${stream}-${slot}`} transform={flight ? flightShift(stream, flight.age) : undefined} style={flight ? undefined : { display: "none" }}>
          <use href="#pf-lk-spark" x={x} y={y} />
        </g>
      );
    })}
  </g>
);

const FRONTS = (
  <g key="fronts" className="pf-ghost">
    {DRAWERS.map((drawer, index) => (
      <g key={index} data-drawer={index}>
        <Solid paths={drawer.front} tone="mid" crease="faint" />
        <Dots points={drawer.rivets} size={0.4} tone="mid" />
        <Line d={drawer.holder} tone="mid" />
        <Line d={drawer.head} tone="mid" />
        <Line d={drawer.shoulders} tone="mid" />
        {drawer.pullPosts.map((paths, post) => (
          <Solid key={post} paths={paths} tone="mid" crease="faint" />
        ))}
        <Solid paths={drawer.pullBar} tone="mid" crease="faint" />
      </g>
    ))}
  </g>
);

const LUG = (index: number) => (
  <g key={`lug${index}`}>
    <Solid paths={HOPPER_ART.lugs[index]} tone="mid" crease="faint" />
    <Solid paths={STAND_ART.arms[index]} tone="mid" crease="faint" />
    <Dots points={[STAND_ART.armScrews[index]]} size={0.5} tone="mid" />
  </g>
);

const BIN = (
  <g key="bin">
    <Solid paths={HOPPER_ART.shoulder} tone="mid" crease="faint" />
    <Solid
      paths={HOPPER_ART.body}
      tone="hi"
      crease="faint"
      inner={
        <>
          {HOPPER_ART.seams.map((d, index) => (
            <Line key={index} d={d} tone="faint" />
          ))}
        </>
      }
    />
  </g>
);

const BIN_TOP = (
  <g key="bin-top">
    <Solid paths={HOPPER_ART.rim} tone="mid" crease="faint" />
    <Line d={HOPPER_ART.mouthRing} tone="lo" />
    <path className="pf-hole" d={HOPPER_ART.mouth} />
    <Dots points={HOPPER_ART.bolts} size={0.45} tone="mid" />
    {MOUTH_COINS.map(([x, y], index) => (
      <use
        key={index}
        className="pf-mouth-coin"
        href="#pf-lk-coin"
        x={x}
        y={y}
        data-mouth={index}
        style={mouthShown(index, MOUTH_COINS.length, REST.leaked) ? undefined : { opacity: 0 }}
      />
    ))}
  </g>
);

const GAUGE = (
  <g key="gauge">
    {GAUGE_ART.brackets.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Solid paths={GAUGE_ART.panel} tone="mid" crease="faint" />
    <Line d={GAUGE_ART.frame} tone="lo" />
    <path className="pf-hole" d={GAUGE_ART.window} />
    <path className="pf-gauge-fill" data-level="" d={levelPath(1 - REST.leaked)} />
    <Line d={GAUGE_ART.scale.minor} tone="lo" />
    <Line d={GAUGE_ART.scale.major} tone="mid" />
    <Dots points={GAUGE_ART.screws} size={0.45} tone="mid" />
  </g>
);

const LABEL_TEXT =
  "A cash hopper on a stand with a cracked spout, dripping coins into three ghost drawers: dashed, empty-faced drawers with a blank bust on each label card, standing for ghost and duplicate beneficiaries. A level gauge on the hopper falls as the leak runs. The ₱2.7B figure is the cited amount nearly lost; the drain shown is an illustration.";

export function LeakArt() {
  return (
    <LeakLive
      label={LABEL_TEXT}
      width={WIDTH}
      height={HEIGHT}
      rest={readoutOf(REST.leaked)}
      parts={staticG([
        BASE,
        DEFS,
        LEFT_LEG,
        RACK_AND_DRAWERS,
        RIGHT_LEG,
        GANTRY,
        LUG(0),
        FUNNEL,
        FLIGHTS,
        FRONTS,
        BIN,
        LUG(1),
        BIN_TOP,
        GAUGE,
      ], "parts")}
    />
  );
}
