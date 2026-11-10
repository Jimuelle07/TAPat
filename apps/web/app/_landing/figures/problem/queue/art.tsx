import * as React from "react";
import { Dots, FaceText, Line, Solid } from "@/app/_landing/iso/react/draw";
import { compactArt } from "../../compact";
import { staticG } from "../../static";
import * as G from "./geometry";
import type { PersonArt, RopePiece } from "./geometry";
import { orderOf, wiltOf } from "./frame";
import { QueueLive } from "./live";
import { REST_TIME, readoutOf, stateAt } from "./model";
import { HEIGHT, WIDTH, shift } from "./view";

/* Static art goes out compacted: relative commands, one decimal. */
const {
  BOOTH_ART,
  FLOOR_ART,
  LAMP_ART,
  PEOPLE_ART,
  POSTS,
  POST_ART,
  ROPES,
} = compactArt({
  BOOTH_ART: G.BOOTH_ART,
  FLOOR_ART: G.FLOOR_ART,
  LAMP_ART: G.LAMP_ART,
  PEOPLE_ART: G.PEOPLE_ART,
  POSTS: G.POSTS,
  POST_ART: G.POST_ART,
  ROPES: G.ROPES,
});

const REST = stateAt(REST_TIME);

const FLOOR = (
  <g key="floor">
    <path className="iso-halo" d={FLOOR_ART.halo} />
    <Solid paths={FLOOR_ART.slab} tone="lo" crease="faint" />
    <Line d={FLOOR_ART.groove} tone="faint" />
    <Line d={FLOOR_ART.joints} tone="faint" />
    {FLOOR_ART.slots.map((d, index) => (
      <Line key={index} d={d} tone="lo" />
    ))}
    <g data-pool="">
      <Solid paths={FLOOR_ART.pool} tone="mid" crease="faint" lit flat />
    </g>
    <g data-rings="">
      {FLOOR_ART.poolRings.map((d, index) => (
        <Line key={index} d={d} tone="lo" dotted />
      ))}
    </g>
  </g>
);

const BOOTH = (
  <g key="booth">
    <Solid paths={BOOTH_ART.plinth} tone="lo" crease="faint" />
    <Solid paths={BOOTH_ART.body} tone="mid" crease="faint" inner={<Line d={BOOTH_ART.seam} tone="faint" />} />
    {BOOTH_ART.slots.map((d, index) => (
      <path key={index} className="pf-hole" d={d} />
    ))}
    <path className="pf-hole" d={BOOTH_ART.windowFrame} />
    <path className="pf-glass" d={BOOTH_ART.window} />
    <Line d={BOOTH_ART.window} tone="mid" />
    <Line d={BOOTH_ART.mullion} tone="lo" />
    <Line d={BOOTH_ART.tray} tone="lo" />
    <Solid paths={BOOTH_ART.shelf} tone="hi" crease="faint" />
    <Line d={BOOTH_ART.shelfEdge} tone="faint" />
    <Solid paths={BOOTH_ART.sign} tone="hi" crease="faint" />
    <FaceText transform={BOOTH_ART.signText} size={3.2} tone="hi">
      PAYOUT
    </FaceText>
    <Dots points={BOOTH_ART.signScrews} size={0.45} tone="mid" />
    <Line d={BOOTH_ART.door} tone="lo" />
    <Line d={BOOTH_ART.doorPanel} tone="faint" />
    {BOOTH_ART.hingePins.map((d, index) => (
      <Line key={index} d={d} tone="mid" />
    ))}
    <Solid paths={BOOTH_ART.handle} tone="mid" crease="faint" />
    <Solid paths={BOOTH_ART.roof} tone="mid" crease="faint" />
    <Line d={BOOTH_ART.roofGroove} tone="faint" />
    <Dots points={BOOTH_ART.roofScrews} size={0.5} tone="mid" />
    <Solid paths={BOOTH_ART.vent} tone="mid" crease="faint" />
    <Solid paths={BOOTH_ART.ventCap} tone="mid" crease="faint" />
  </g>
);

const DEFS = (
  <defs key="defs">
    <g id="pf-q-post">
      <Line d={POST_ART.ring} tone="faint" />
      <Solid paths={POST_ART.base} tone="lo" crease="faint" />
      <Solid paths={POST_ART.pole} tone="mid" crease="none" />
      <Solid paths={POST_ART.collar} tone="mid" crease="faint" />
      <Solid paths={POST_ART.upper} tone="mid" crease="none" />
      <Solid paths={POST_ART.knob} tone="hi" crease="faint" />
    </g>
    {(["plain", "hat"] as const).map((variant) => {
      const art: PersonArt = PEOPLE_ART[variant];
      return (
        <g key={variant} id={`pf-q-person-${variant}`}>
          <path className="iso-halo" d={art.halo} />
          <Solid paths={art.legs} tone="lo" crease="faint" />
          <Solid paths={art.torso} tone="mid" crease="faint" inner={<Line d={art.belt} tone="faint" />} />
          <Solid paths={art.head} tone="hi" crease="faint" />
          {art.brim && art.crown ? (
            <>
              <Solid paths={art.brim} tone="mid" crease="faint" />
              <Solid paths={art.crown} tone="mid" crease="faint" />
            </>
          ) : null}
        </g>
      );
    })}
  </defs>
);

const LAMP_BACK = (
  <g key="lamp-back">
    <Solid paths={LAMP_ART.plate} tone="lo" crease="faint" />
    <Dots points={LAMP_ART.plateScrews} size={0.45} tone="mid" />
    <Solid paths={LAMP_ART.mast} tone="mid" crease="faint" inner={<Line d={LAMP_ART.mastBand} tone="faint" />} />
  </g>
);

function Rope({ pieces }: { pieces: RopePiece[] }) {
  return (
    <>
      {pieces.map((piece, index) => (
        <g key={index} className="tb">
          <path className="tb-body" d={piece.body} />
          {piece.wide ? (
            <>
              <path className="tb-shine" d={piece.shine} />
              <path className="tb-shade" d={piece.shade} />
            </>
          ) : null}
          <path className="iso-line tb-edge" data-tone="hi" d={piece.edges} />
        </g>
      ))}
    </>
  );
}

const row = (index: number) => (
  <g key={`row${index}`}>
    {POSTS[index].map(([x, y], post) => (
      <React.Fragment key={post}>
        <use href="#pf-q-post" x={x} y={y} />
        {post < ROPES[index].length ? <Rope pieces={ROPES[index][post]} /> : null}
      </React.Fragment>
    ))}
  </g>
);

const ROW_BACK = row(0);
const ROW_FRONT = row(1);

const BEAMS = (
  <g key="beams" data-beams="">
    <Line d={LAMP_ART.beams} tone="lo" dotted />
  </g>
);

const variantOf = (id: number) => (id % 3 === 1 ? "hat" : "plain");
const PEOPLE_LAYER = (
  <g key="people">
    {orderOf(REST).map((id) => {
      const person = REST.people[id];
      return (
        <g key={id} data-person={id} transform={shift(person.x, person.y, person.z)} style={person.alpha === 1 ? undefined : { opacity: person.alpha }}>
          <g data-wilt="" transform={wiltOf(person.heat)}>
            <use href={`#pf-q-person-${variantOf(id)}`} />
            <path className="iso-line" data-tone="mid" data-sweat="" d={PEOPLE_ART.sweat} style={{ opacity: person.heat }} />
          </g>
        </g>
      );
    })}
  </g>
);

const LAMP_HEAD = (
  <g key="lamp-head">
    <Solid paths={LAMP_ART.arm} tone="mid" crease="faint" />
    <Dots points={LAMP_ART.armScrews} size={0.45} tone="mid" />
    <Solid paths={LAMP_ART.stem} tone="mid" crease="none" />
    <Solid paths={LAMP_ART.shade} tone="hi" crease="faint" inner={<Line d={LAMP_ART.shadeSeam} tone="faint" />} />
    <g data-bulb="">
      <Solid paths={LAMP_ART.bulb} tone="hi" crease="faint" lit />
    </g>
  </g>
);

const LABEL_TEXT =
  "A payout booth with a service window, and a queue of eight small figures between two rows of rope stanchions. A sun lamp on a mast over the lane throws a pool of light on the pavement; each person who steps into it wilts a little and beads with sweat. Every few seconds the person at the window leaves, the line steps up, and they rejoin at the back. Payouts are kept in person, and drivers fainted in heat-exposed queues; the queue itself is an illustration.";

export function QueueArt() {
  return (
    <QueueLive
      label={LABEL_TEXT}
      width={WIDTH}
      height={HEIGHT}
      rest={readoutOf(REST)}
      back={staticG([FLOOR, DEFS, BOOTH, LAMP_BACK, ROW_BACK, BEAMS], "back")}
      crowd={staticG(PEOPLE_LAYER, "crowd")}
      front={staticG([LAMP_HEAD, ROW_FRONT], "front")}
    />
  );
}
