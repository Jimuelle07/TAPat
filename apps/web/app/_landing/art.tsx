"use client";

// Abstract background art, one for each band, drawn in that band's kit colours and animated by the Remotion frame.
// Each piece grows in as its band arrives, then keeps a slow idle motion for as long as the band is on screen.
// Each main piece stays inside its 1000 x 1000 box, because a shape cut by the box edge would show as a hard line.
import type { ReactNode } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

/** How many frames a piece needs to finish growing in; reduced motion shows this frame. */
export const ART_SETTLED = 75;

function useGrow(): (delay: number) => number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (delay) => spring({ frame: frame - delay, fps, config: { damping: 200 } });
}

function Canvas({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full">
      {children}
    </svg>
  );
}

/** Hero: a contactless tap, rippling out. */
function Tap() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  return (
    <Canvas size={1000}>
      <circle cx="500" cy="500" r={(230 + 8 * Math.sin(frame / 22)) * grow(0)} className="fill-primary" />
      {[300, 370, 440].map((r, i) => (
        <circle
          key={r}
          cx="500"
          cy="500"
          r={(r + 10 * Math.sin(frame / 22 - (i + 1) * 0.8)) * grow(6 + i * 6)}
          fill="none"
          className="stroke-primary"
          strokeWidth={30 - i * 8}
        />
      ))}
    </Canvas>
  );
}

const GHOSTS = new Set(["1-3", "3-1", "4-4"]);

/** Masterlist: rows of pills sliding past, with the ghosts left as empty outlines. */
function Sieve() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  return (
    <Canvas size={1000}>
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const by = grow((row + col) * 2);
          const ghost = GHOSTS.has(`${row}-${col}`);
          return (
            <rect
              key={`${row}-${col}`}
              x={60 + col * 182 + 10 * Math.sin(frame / 40 + row)}
              y={120 + row * 130}
              width={150 * by}
              height="72"
              rx="36"
              className={ghost ? "fill-none stroke-ring-surface" : row % 2 === col % 2 ? "fill-sunken" : "fill-ring-surface"}
              strokeWidth={ghost ? 5 : 0}
              strokeDasharray={ghost ? "14 12" : undefined}
              strokeDashoffset={ghost ? -frame * 0.6 : undefined}
            />
          );
        }),
      )}
    </Canvas>
  );
}

/** Enrollment: a hand of NFC cards fanning open and breathing. */
function Cards() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  const open = grow(0);
  const sway = 1.6 * Math.sin(frame / 34);
  const front = (6 + sway) * open;
  return (
    <Canvas size={1000}>
      {[
        { angle: -24 - sway, fill: "fill-surface" },
        { angle: -10 - sway / 2, fill: "fill-raised" },
        { angle: 6 + sway, fill: "fill-primary" },
      ].map(({ angle, fill }) => (
        <rect
          key={fill}
          x="170"
          y="300"
          width="660"
          height="410"
          rx="40"
          className={`${fill} stroke-text`}
          strokeWidth="3"
          style={{ rotate: `${angle * open}deg`, transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
      <g style={{ rotate: `${front}deg`, transformOrigin: "500px 505px", opacity: open }}>
        <rect x="240" y="380" width="120" height="90" rx="14" className="fill-mint stroke-text" strokeWidth="3" />
        {[50, 84, 118].map((r, i) => (
          <path
            key={r}
            d={`M 700 ${410 - r / 2} a ${r} ${r} 0 0 1 0 ${r}`}
            fill="none"
            className="stroke-mint"
            strokeWidth="9"
            strokeLinecap="round"
            opacity={0.45 + 0.55 * Math.max(0, Math.sin(frame / 12 - i))}
          />
        ))}
      </g>
    </Canvas>
  );
}

/** Funding: a price that stays flat, then steps over the threshold and holds. */
function Shift() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  const drawn = 1 - grow(8);
  return (
    <Canvas size={1000}>
      <clipPath id="art-shift">
        <circle cx="500" cy="500" r="470" />
      </clipPath>
      <circle cx="500" cy="500" r={470 * grow(0)} className="fill-primary-deep" />
      <g clipPath="url(#art-shift)" style={{ opacity: grow(10) }}>
        <path d="M 0 1000 V 760 H 300 V 720 H 560 V 470 H 1000 V 1000 Z" className="fill-pressed" />
        <path d="M 0 1000 V 860 H 420 V 820 H 640 V 620 H 1000 V 1000 Z" className="fill-text" fillOpacity="0.35" />
        <line x1="0" x2="1000" y1="560" y2="560" className="stroke-accent" strokeWidth="6" strokeDasharray="26 16" strokeDashoffset={-frame * 0.8} />
      </g>
      <path
        d="M 60 690 H 300 V 650 H 560 V 400 H 960"
        fill="none"
        className="stroke-surface"
        strokeWidth="10"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={drawn}
        clipPath="url(#art-shift)"
      />
    </Canvas>
  );
}

const OCTAGON = Array.from({ length: 8 }, (_, i) => {
  const angle = ((i + 0.5) * Math.PI) / 4;
  return `${(500 + 450 * Math.cos(angle)).toFixed(1)},${(500 + 450 * Math.sin(angle)).toFixed(1)}`;
}).join(" ");

/** Refusal: a plain no-entry sign whose bar keeps pressing shut. */
function NoEntry() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  const bar = grow(12) * (1 + 0.04 * Math.sin(frame / 14));
  return (
    <Canvas size={1000}>
      <polygon points={OCTAGON} className="fill-declined" style={{ scale: String(grow(0)), transformBox: "fill-box", transformOrigin: "center" }} />
      <rect x={500 - 300 * bar} y="440" width={600 * bar} height="120" rx="20" className="fill-declined-tint" />
    </Canvas>
  );
}

/** Freeze: facets of ice closing around a centre, turning slowly. */
function Crystal() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  return (
    <Canvas size={1000}>
      <g style={{ rotate: `${frame * 0.12}deg`, transformOrigin: "500px 500px" }}>
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} style={{ rotate: `${i * 60}deg`, transformOrigin: "500px 500px" }}>
            <g style={{ scale: String(grow(i * 4)), transformOrigin: "500px 500px" }}>
              <polygon points="500,500 620,290 500,60 380,290" className={i % 2 === 0 ? "fill-surface" : "fill-raised"} />
              <polygon points="500,500 565,290 500,170 435,290" className="fill-frozen" fillOpacity="0.55" />
            </g>
          </g>
        ))}
      </g>
    </Canvas>
  );
}

const RAYS = 16;

/** Return: a sun of rays, everything flowing back to one point. */
function Sun() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  return (
    <Canvas size={1000}>
      <g style={{ rotate: `${frame * 0.15}deg`, transformOrigin: "500px 500px" }}>
        {Array.from({ length: RAYS }, (_, i) => {
          const reach = 470 * grow(i * 1.5);
          const a = (i * 2 * Math.PI) / RAYS;
          const spread = Math.PI / RAYS / 1.5;
          const point = (angle: number) => `${500 + reach * Math.cos(angle)},${500 + reach * Math.sin(angle)}`;
          return (
            <polygon
              key={i}
              points={`500,500 ${point(a - spread)} ${point(a + spread)}`}
              className={i % 2 === 0 ? "fill-accent-tint" : "fill-ring-accent"}
              fillOpacity={i % 2 === 0 ? 1 : 0.45}
            />
          );
        })}
      </g>
      <circle cx="500" cy="500" r={(190 + 6 * Math.sin(frame / 24)) * grow(10)} className="fill-surface" />
      <circle cx="500" cy="500" r={235 * grow(14)} fill="none" className="stroke-ring-accent" strokeWidth="6" />
    </Canvas>
  );
}

/** Close: coins overlapping, each one accounted for, going round. */
function Coins() {
  const grow = useGrow();
  const frame = useCurrentFrame();
  return (
    <Canvas size={1000}>
      <g style={{ rotate: `${frame * 0.2}deg`, transformOrigin: "500px 500px" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 12;
          return (
            <circle key={i} cx={500 + 285 * Math.cos(a)} cy={500 + 285 * Math.sin(a)} r={160 * grow(i * 2)} className="fill-primary stroke-pressed" strokeWidth="8" />
          );
        })}
      </g>
    </Canvas>
  );
}

export const ART = {
  top: Tap,
  list: Sieve,
  enroll: Cards,
  fund: Shift,
  refuse: NoEntry,
  freeze: Crystal,
  return: Sun,
  close: Coins,
};
export type ArtId = keyof typeof ART;

const CORNER_SIZE = 240;
const CORNER_STEP = 30;

/** The small motif in a band's corner, anchored at the top right. Colour comes from the surrounding text colour. */
function CornerShapes({ art }: { art: ArtId }) {
  const grow = useGrow();
  const steps = Array.from({ length: 8 }, (_, i) => i);
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;
  if (art === "list") {
    return steps.flatMap((row) =>
      steps
        .filter((col) => col >= row)
        .map((col) => <circle key={`${row}-${col}`} cx={CORNER_SIZE - (7 - col) * CORNER_STEP - 8} cy={8 + row * CORNER_STEP} r={4.5 * grow(row + col)} fill="currentColor" />),
    );
  }
  if (art === "enroll") {
    return steps.flatMap((row) =>
      steps
        .filter((col) => col >= row)
        .map((col) => {
          const x = CORNER_SIZE - (7 - col) * CORNER_STEP - 10;
          const y = 10 + row * CORNER_STEP;
          const r = 7 * grow(row + col);
          return <path key={`${row}-${col}`} d={`M ${x - r} ${y} H ${x + r} M ${x} ${y - r} V ${y + r}`} {...line} />;
        }),
    );
  }
  if (art === "fund") {
    return steps.map((i) => <path key={i} d={`M ${60 + i * 26} ${40 + i * 24} L ${150 + i * 13} ${i * 12} L 240 ${40 + i * 24}`} opacity={grow(i * 3)} {...line} />);
  }
  if (art === "refuse") {
    return steps.map((i) => <line key={i} x1={i * 30} y1="0" x2="240" y2={240 - i * 30} opacity={grow(i * 3)} {...line} />);
  }
  if (art === "freeze") {
    return steps.map((i) => {
      const r = (i + 1) * CORNER_STEP * grow(i * 3);
      const points = Array.from({ length: 6 }, (_, k) => `${240 + r * Math.cos((k * Math.PI) / 3)},${r * Math.sin((k * Math.PI) / 3)}`).join(" ");
      return <polygon key={i} points={points} {...line} />;
    });
  }
  if (art === "return") {
    return Array.from({ length: 13 }, (_, i) => {
      const a = Math.PI / 2 + (i * Math.PI) / 24;
      const reach = 240 * grow(i * 2);
      return <line key={i} x1="240" y1="0" x2={240 + reach * Math.cos(a)} y2={reach * Math.sin(a)} {...line} />;
    });
  }
  return steps.map((i) => <circle key={i} cx="240" cy="0" r={CORNER_STEP * (i + 1) * grow(i * 3)} {...line} />);
}

export function Corner({ art }: { art: ArtId }) {
  return (
    <Canvas size={CORNER_SIZE}>
      <CornerShapes art={art} />
    </Canvas>
  );
}

export function Art({ art }: { art: ArtId }) {
  const Piece = ART[art];
  return <Piece />;
}
