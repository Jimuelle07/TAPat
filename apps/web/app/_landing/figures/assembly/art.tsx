import { dotsSvg, faceTextSvg, lineSvg, solidSvg, wireSvg } from "@/app/_landing/iso/iso-kit";
import { compactPath, compactSolid } from "../compact";
import { CHIPS } from "./chips";
import { drawOf, poseAt, U_REST, type Draw } from "./frame";
import type { Item, Spec } from "./item";
import { AFTER, BEHIND, BENCH, INFRONT } from "./order";
import { PIN_CLIPS } from "./s5";
import { AssemblyLive } from "./live";
import { TRUTH } from "./truth";
import { HEIGHT, WIDTH } from "./view";

/* The static art is built once on the server in painter's order as ONE SVG string (the kit's string renderers, paths
   compacted to one decimal) and written with dangerouslySetInnerHTML, so the page carries a single string rather than
   thousands of element nodes. The live component gets no art as props: it finds the .as-live node just before it.
   Moving parts are plain <g data-m>, <path data-d> and <g data-solid> that the live loop writes by name. */

const REST_POSE = poseAt(U_REST, false, 0, TRUTH);
const REST: Draw = drawOf(REST_POSE);

const SHADES = [0, 1, 2, 3] as const;

const specSvg = (spec: Spec): string => {
  switch (spec.k) {
    case "halo":
      return `<path class="iso-halo" d="${compactPath(spec.d)}"/>`;
    case "solid": {
      const flagged = spec.flag ? REST.flags[spec.flag] === true : false;
      const solid = solidSvg(compactSolid(spec.paths), {
        tone: spec.tone,
        crease: spec.crease,
        lit: spec.lit || flagged,
        flat: spec.flat,
        halo: spec.halo,
        inner: spec.inner ? lineSvg(compactPath(spec.inner), { tone: "faint" }) : "",
      });
      return spec.flag ? `<g data-flag="${spec.flag}">${solid}</g>` : solid;
    }
    case "line":
      if (spec.flag) return `<path class="iso-line" data-tone="${REST.flags[spec.flag] ? "lit" : spec.tone}" data-tone0="${spec.tone}" data-flag="${spec.flag}" d="${compactPath(spec.d)}"/>`;
      return lineSvg(compactPath(spec.d), { tone: spec.tone, dotted: spec.dotted, dashed: spec.dashed, free: spec.free, className: spec.cls });
    case "dots":
      return dotsSvg(spec.pts, { size: spec.size, tone: spec.tone, pulse: spec.pulse });
    case "text":
      return faceTextSvg(spec.tf, spec.text, { size: spec.size, tone: spec.tone, anchor: spec.anchor });
    case "wire": {
      const wire = wireSvg(spec.from, spec.to, { via: spec.via, tone: spec.tone, flow: spec.flag ? REST.flags[spec.flag] === true : spec.flow });
      return spec.flag ? `<g data-flag="${spec.flag}">${wire}</g>` : `<g>${wire}</g>`;
    }
    case "dline": {
      const free = spec.free === true ? ' data-free=""' : spec.free ? ` data-free="${spec.free}"` : "";
      return `<path class="${spec.cls ? `iso-line ${spec.cls}` : "iso-line"}" data-tone="${spec.tone ?? "mid"}" data-d="${spec.name}"${free} d="${compactPath(REST.lines[spec.name] ?? "")}"/>`;
    }
    case "dsolid": {
      const paths = REST.solids[spec.name];
      if (!paths) return "";
      const compact = compactSolid(paths);
      const shades = SHADES.map((shade) => `<path class="iso-shade" data-shade="${shade}" data-f="s${shade}" d="${compact.shades[shade] ?? ""}"/>`).join("");
      return (
        `<g class="iso-solid" data-solid="${spec.name}"><path class="iso-fill" data-f="fill" d="${compact.fill}"/>${shades}` +
        `<path class="iso-top" data-f="top" d="${compact.top}"/><path class="iso-line iso-edge" data-tone="${spec.tone ?? "hi"}" data-f="outline" d="${compact.outline}"/></g>`
      );
    }
  }
};

const hidden = (vis?: string) => (vis ? (vis.startsWith("!") ? REST.flags[vis.slice(1)] === true : REST.flags[vis] !== true) : false);

const itemSvg = (item: Item): string => {
  const body = item.specs.map(specSvg).join("");
  const moving = item.m ? `<g data-m="${item.m}" transform="${REST.move[item.m]}"${item.m.startsWith("chip") ? ` style="opacity:${REST.opacity}"` : ""}>${body}</g>` : body;
  const vis = item.vis ? ` data-vis="${item.vis}"` : "";
  const style = hidden(item.vis) ? ' style="display:none"' : "";
  return `<g data-item="${item.id}"${vis}${style}>${item.clip ? `<g clip-path="url(#${item.clip})">${moving}</g>` : moving}</g>`;
};

const clips = PIN_CLIPS.map((clip) => `<clipPath id="${clip.id}"><path d="${compactPath(clip.d)}"/></clipPath>`).join("");
const TREE = `<g><defs>${clips}</defs>${[BENCH, BEHIND, AFTER, CHIPS, INFRONT].map((items) => items.map(itemSvg).join("")).join("")}</g>`;

const LABEL =
  "A conveyor bench with eight stations that a stack of three ₱500 chips rides through. 01 a dial gauge reads the simulated diesel price. 02 a fly-ball governor, the Tranche Agent, swings out and lifts the stop plate. 03 fund_escrow(): a drawer takes the chips into a vault and brings them back. 04 a card taps the reader. 05 authorize(): a three-pin tumbler gate turns only when the cap, expiry and nonce pins line up. 06 the Freeze Agent's watch post with a turning radar mast. 07 claim(): a pusher sends one chip down the settlement chute to the station, or a latch holds it if the card is frozen. 08 sweep_on_revoke(): a lever lifts the last stop and the rest ride a chute into the LGU lockbox.";

export function AssemblyArt() {
  return (
    <>
      <div
        className="as-live"
        role="slider"
        tabIndex={0}
        aria-label="Assembly line with eight stations: hover or use the arrow keys to step through them, F freezes the card, Space pauses the tour"
        aria-valuemin={1}
        aria-valuemax={8}
        aria-valuenow={5}
        aria-valuetext={REST_POSE.say}
      >
        <div className="as-pan">
          <div className="iso-stage as-stage">
            <svg className="iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={LABEL} focusable="false" dangerouslySetInnerHTML={{ __html: TREE }} />
          </div>
        </div>
      </div>
      <AssemblyLive truth={TRUTH} rest={REST_POSE.say} />
    </>
  );
}
