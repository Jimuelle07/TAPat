import * as React from "react";
import { Dots, FaceText, Line, Solid } from "../../iso/react/draw";
import { dot3, viewOf } from "../../iso/lathe.mjs";
import { compactPath, compactSolid } from "../compact";
import { markupOf } from "../static";
import type { Part } from "./build";
import { COPY } from "./copy";
import { glyphOf, GLYPH_SIZE } from "./frame";
import { DAY_PRICE, digitsOf } from "./model";
import { ORDER } from "./order.gen";
import { buildScene } from "./scene";
import { P, PIECES } from "./view";

const SCENE = buildScene(COPY);
const V = viewOf(P);
const REST_DIGITS = digitsOf(DAY_PRICE[0]!);

const keyOf = (part: Part) => ORDER[part.id] ?? dot3(part.at, V) + part.bias;

// Parts whose solid is rebuilt each frame keep every shade node, even the empty ones.
const REBUILT = /^(lever|latch|liquid\d|boxLiquid)$/;

function LiveSolid({ part }: { part: Part }) {
  const paths = compactSolid(part.paths);
  return (
    <g className={/^(liquid\d|boxLiquid)$/.test(part.live) ? "iso-solid dp-liquid" : "iso-solid"} data-lit={part.lit ? "" : undefined}>
      <path className="iso-fill" d={paths.fill} />
      {[0, 1, 2, 3].map((shade) => (
        <path key={shade} className="iso-shade" data-shade={shade} d={paths.shades[shade] ?? ""} />
      ))}
      <path className="iso-top" d={paths.top} />
      <path className="iso-line iso-crease" data-tone="faint" d={paths.crease} />
      <path className="iso-line iso-edge" data-tone={part.tone} d={paths.outline} />
    </g>
  );
}

function Glyphs({ wheel }: { wheel: number }) {
  return (
    <>
      {Array.from({ length: 10 }, (_, digit) => {
        const glyph = glyphOf(wheel, digit, REST_DIGITS[wheel]!);
        return (
          <text key={digit} className="iso-face-text dp-glyph" data-tone="hi" data-glyph={digit} fontSize={GLYPH_SIZE} textAnchor="middle" transform={glyph.transform} opacity={glyph.opacity}>
            {digit}
          </text>
        );
      })}
    </>
  );
}

function PartNode({ part }: { part: Part }) {
  const move = part.piece ? PIECES[part.piece]! : null;
  const wheel = /^wheel(\d)$/.exec(part.live);
  return (
    <g
      data-id={part.id}
      data-piece={part.piece || undefined}
      data-live={part.live || undefined}
      data-k={keyOf(part).toFixed(3)}
      data-m={move ? dot3(move, V).toFixed(3) : undefined}
    >
      {REBUILT.test(part.live) ? (
        <LiveSolid part={part} />
      ) : (
        <Solid paths={compactSolid(part.paths)} tone={part.tone} crease={part.crease} lit={part.lit} flat={part.flat} halo={part.halo} inner={part.inner ? <Line d={compactPath(part.inner)} tone="faint" /> : undefined} />
      )}
      {part.lines.map((spec, index) => (
        <Line key={index} d={compactPath(spec.d)} tone={spec.tone} dotted={spec.dotted} free={spec.free} flow={spec.flow} className={spec.className} />
      ))}
      {wheel ? <Glyphs wheel={Number(wheel[1])} /> : null}
      {part.texts.map((spec, index) =>
        spec.live ? (
          <text key={index} className="iso-face-text" data-tone={spec.tone} data-live={spec.live} transform={spec.transform} fontSize={spec.size} textAnchor={spec.anchor}>
            {spec.text}
          </text>
        ) : (
          <FaceText key={index} transform={spec.transform} size={spec.size} tone={spec.tone} anchor={spec.anchor}>
            {spec.text}
          </FaceText>
        ),
      )}
      {part.dots.map((spec, index) => (
        <Dots key={index} points={spec.points} size={spec.size} tone={spec.tone} />
      ))}
    </g>
  );
}

const SORTED = [...SCENE.parts].sort((a, b) => keyOf(a) - keyOf(b));

/** The whole static scene as one markup string (see ../static.tsx); the live component places it and reorders its parts through the DOM. */
export const SCENE_HTML = markupOf(SORTED.map((part) => <PartNode key={part.id} part={part} />));
export const PART_COUNT = SCENE.parts.length;
