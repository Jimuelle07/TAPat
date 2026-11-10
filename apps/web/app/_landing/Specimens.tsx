import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Nums } from "./kit";

/*
 * One small ledger drawing per step of the loop. Each is a pure function of `frame`, so a Remotion Player can drive it
 * and the server can render the settled still (`frame` undefined). Sample, simulated and precomputed data only, and
 * each drawing says which. Peso amounts are literals because the page passes no runtime data here. Everything settles
 * by about frame 120 and holds.
 */

export type SpecimenId = "list" | "enroll" | "fund" | "refuse" | "freeze" | "return";

export const SPECIMEN_FPS = 30;
// About 120 frames of drawing plus a 3 second hold on the finished result, then the loop starts over.
export const SPECIMEN_FRAMES = 210;
export const SPECIMEN_WIDTH = 440;
export const SPECIMEN_HEIGHT = 180;

const PHP_65 = "₱65.00";
const PHP_300 = "₱300.00";
const PHP_500 = "₱500.00";
const PHP_800 = "₱800.00";
const PHP_3190 = "₱3,190.00";

// Copied from the sample series in screens.tsx: 44 quiet days, a one-day spike at index 14, then a sustained shift.
const DIESEL = [
  62.1, 62.3, 62.0, 62.4, 62.2, 62.5, 62.3, 62.1, 62.4, 62.6, 62.3, 62.5, 62.2, 62.4, 66.0, 62.6, 62.4, 62.5, 62.3, 62.7, 62.5, 62.4, 62.8,
  62.6, 62.5, 62.9, 62.7, 62.6, 62.8, 63.0, 62.8, 62.9, 62.7, 63.0, 62.9, 63.1, 62.9, 63.0, 63.2, 63.0, 70.9, 71.0, 70.9, 70.95, 70.85,
];
const DIESEL_THRESHOLD = 65;
const SPIKE = 14;
const SHIFT = 40;

const SCORES = [0.42, 0.51, 0.47, 0.63, 0.58, 0.74, 0.88, 1.02, 1.21, 1.44, 1.63, 2.31];
const THRESHOLD = 1.78;

const SWEEPS = [
  { name: "Juan D. …9C7E", pesos: 1_150 },
  { name: "Pedro R. …3A54", pesos: 540 },
  { name: "Lito G. …AL05", pesos: 1_500 },
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lin = (frame: number, start: number, end: number) => clamp((frame - start) / (end - start));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Eased 0 → 1 progress of `frame` between `start` and `end`. */
const progress = (frame: number, start: number, end: number) => easeOut(lin(frame, start, end));

const peso = (n: number) => `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${SPECIMEN_WIDTH} ${SPECIMEN_HEIGHT}`} role="img" aria-label={label} className="block h-auto w-full">
      {children}
    </svg>
  );
}

function Label({
  x,
  y,
  anchor = "start",
  opacity = 1,
  className = "",
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  opacity?: number;
  /** Phone-only nudges live in steps.css under these class names; they never apply from 640px up. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize="13" opacity={opacity} className={`specimen-label fill-text font-mono ${className}`}>
      {typeof children === "string" ? <Nums svg>{children}</Nums> : children}
    </text>
  );
}

type StampTone = "accent" | "danger" | "frozen";
const STAMP_RECT: Record<StampTone, string> = {
  accent: "fill-accent stroke-text",
  danger: "fill-danger stroke-danger",
  frozen: "fill-frozen stroke-text",
};
const STAMP_TEXT: Record<StampTone, string> = {
  accent: "fill-text",
  danger: "fill-surface",
  frozen: "fill-text",
};

/** A small rotated stamp that lands: scales from 1.2 to 1 while it fades in. `t` is its 0 → 1 progress. */
function Stamp({
  cx,
  cy,
  tone,
  rotate,
  t,
  dx = 0,
  dy = 0,
  children,
}: {
  cx: number;
  cy: number;
  tone: StampTone;
  rotate: number;
  t: number;
  /** Phone-only nudge in user units, applied with the phone enlargement in steps.css. */
  dx?: number;
  dy?: number;
  children: string;
}) {
  const w = children.length * 8.1 + 16;
  const scale = 1.2 - 0.2 * t;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate}) scale(${scale.toFixed(3)})`} opacity={clamp(t * 1.6)}>
      <g className="specimen-stamp" style={{ "--stamp-dx": `${dx}px`, "--stamp-dy": `${dy}px` } as CSSProperties}>
        <rect x={-w / 2} y={-12} width={w} height={24} rx={3} strokeWidth="1.5" className={STAMP_RECT[tone]} />
        <text y={4.5} textAnchor="middle" fontSize="13" className={`font-mono ${STAMP_TEXT[tone]}`}>
          {children}
        </text>
      </g>
    </g>
  );
}

/** Points of `series` from index `from` up to the fractional index `upTo`, as an SVG polyline string. */
function partial(pts: Array<[number, number]>, from: number, upTo: number) {
  const out: string[] = [];
  const last = Math.min(Math.floor(upTo), pts.length - 1);
  for (let i = from; i <= last; i++) out.push(`${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`);
  if (last < pts.length - 1 && upTo > last && last >= from) {
    const f = upTo - last;
    const [x0, y0] = pts[last];
    const [x1, y1] = pts[last + 1];
    out.push(`${(x0 + (x1 - x0) * f).toFixed(1)},${(y0 + (y1 - y0) * f).toFixed(1)}`);
  }
  return out.join(" ");
}

function Tick({ d, t, className, width = 2 }: { d: string; t: number; className: string; width?: number }) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="1"
      strokeDashoffset={1 - t}
      opacity={t > 0 ? 1 : 0}
      className={className}
    />
  );
}

function List({ f }: { f: number }) {
  const ghost = progress(f, 92, 112);
  return (
    <Frame label="12 masterlist rows checked, 2 ghosts removed (precomputed sample)">
      {Array.from({ length: 12 }, (_, i) => {
        const isGhost = i === 3 || i === 8;
        const x = 8 + (i % 6) * 72;
        const y = 24 + Math.floor(i / 6) * 52;
        const appear = progress(f, 4 + i * 4, 16 + i * 4);
        const mark = progress(f, 30 + i * 4, 38 + i * 4);
        const g = isGhost ? ghost : 0;
        return (
          <g key={i} transform={`translate(0 ${((1 - appear) * 6 + g * 10).toFixed(2)})`} opacity={appear * (1 - 0.7 * g)}>
            <rect x={x} y={y} width="60" height="26" rx="13" strokeWidth="1.5" opacity={1 - g} className="fill-mint stroke-text" />
            {isGhost ? (
              <rect x={x} y={y} width="60" height="26" rx="13" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity={g} className="stroke-text" />
            ) : null}
            <Label x={x + 12} y={y + 17} className="specimen-rowid">{`R${String(i + 1).padStart(2, "0")}`}</Label>
            {isGhost ? (
              <Tick d={`M${x + 42} ${y + 8} l9 9 M${x + 51} ${y + 8} l-9 9`} t={mark} className="stroke-declined specimen-tick" />
            ) : (
              <Tick d={`M${x + 40} ${y + 13} l4 4 8 -9`} t={mark} className="stroke-primary specimen-tick" />
            )}
          </g>
        );
      })}
    </Frame>
  );
}

function Enroll({ f }: { f: number }) {
  const card = progress(f, 0, 20);
  const tap = lin(f, 24, 56);
  const arrow = progress(f, 36, 62);
  const line1 = progress(f, 56, 82);
  const line2 = progress(f, 82, 108);
  const tick1 = progress(f, 80, 94);
  const tick2 = progress(f, 106, 120);
  const arrowEnd = 144 + 52 * arrow;
  return (
    <Frame label="One card tap registers its device and spending policy on-chain (sample)">
      <g transform={`translate(${((1 - card) * -16).toFixed(2)} 0)`} opacity={card}>
        <rect x="8" y="30" width="128" height="80" rx="10" strokeWidth="1.5" className="fill-accent-tint stroke-text" />
        <rect x="22" y="44" width="22" height="16" rx="3" strokeWidth="1.5" fill="none" className="stroke-text" />
        <Label x={22} y={98} className="specimen-cardname">
          Ana V. …A1B2
        </Label>
      </g>
      {[0, 1, 2].map((k) => {
        const t = clamp(tap * 1.6 - k * 0.25);
        const r = 6 + k * 7 + t * 6;
        const o = Math.sin(Math.PI * t);
        return (
          <path
            key={k}
            d={`M${140 + r * 0.5} ${70 - r} A${r} ${r} 0 0 1 ${140 + r * 0.5} ${70 + r}`}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={o}
            className="stroke-primary"
          />
        );
      })}
      <g fill="none" strokeWidth="1.5" className="stroke-text" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M150 70 H${Math.max(150, arrowEnd - 6).toFixed(1)}`} strokeDasharray="4 4" opacity={arrow > 0 ? 1 : 0} />
        <path d="M190 64 l6 6 -6 6" opacity={clamp((arrow - 0.9) * 10)} />
        <path d={`M210 56 H${(210 + 222 * line1).toFixed(1)}`} opacity={line1 > 0 ? 1 : 0} />
        <path d={`M210 104 H${(210 + 222 * line2).toFixed(1)}`} opacity={line2 > 0 ? 1 : 0} />
      </g>
      <Label x={210} y={49} opacity={line1}>
        device registered
      </Label>
      <Label x={210} y={97} opacity={line2}>
        policy registered
      </Label>
      <Tick d="M406 42 l5 5 10 -11" t={tick1} className="stroke-primary" />
      <Tick d="M406 90 l5 5 10 -11" t={tick2} className="stroke-primary" />
      <Label x={8} y={172}>
        sample
      </Label>
    </Frame>
  );
}

function Fund({ f }: { f: number }) {
  const x = (i: number) => 8 + i * (424 / 44);
  const y = (p: number) => 130 - (p - 60) * (104 / 12);
  const pts = DIESEL.map((p, i): [number, number] => [x(i), y(p)]);
  const idx = lin(f, 8, 95) * (DIESEL.length - 1);
  const line = y(DIESEL_THRESHOLD);
  const thr = progress(f, 0, 24);
  const spikeIn = clamp(idx - SPIKE);
  const shiftIn = clamp(idx - SHIFT);
  return (
    <Frame label={`Simulated diesel price: a one-day spike releases nothing; a sustained rise above ${PHP_65} releases the tranche`}>
      <path d="M8 130 H432" fill="none" strokeWidth="1.5" className="stroke-text" />
      <path d={`M8 ${line} H${(8 + 424 * thr).toFixed(1)}`} fill="none" strokeWidth="1.5" strokeDasharray="5 5" className="stroke-ring-accent" />
      <Label x={8} y={line - 5} opacity={thr}>
        {PHP_65}
      </Label>
      <polyline points={partial(pts, 0, idx)} fill="none" strokeWidth="1.5" strokeLinejoin="round" className="stroke-text" />
      <polyline points={partial(pts, SHIFT, idx)} fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
      <circle cx={x(SPIKE)} cy={y(DIESEL[SPIKE])} r={6 * spikeIn} fill="none" strokeWidth="1.5" className="stroke-declined" />
      <Label x={x(SPIKE)} y={y(DIESEL[SPIKE]) - 20} anchor="middle" opacity={spikeIn}>
        1-day spike: nothing
      </Label>
      <Label x={x(SHIFT - 1) - 8} y={y(DIESEL[SHIFT]) + 4} anchor="end" opacity={shiftIn}>
        held: release
      </Label>
      <Label x={8} y={172}>
        simulated
      </Label>
      <Label x={432} y={172} anchor="end">
        45 days
      </Label>
    </Frame>
  );
}

function Refuse({ f }: { f: number }) {
  const x = (pesos: number) => 8 + pesos * 0.4;
  const cap = progress(f, 18, 42);
  const b1 = progress(f, 8, 40);
  const b2 = progress(f, 44, 86);
  const over = progress(f, 84, 100);
  const paid = progress(f, 44, 62);
  const declined = progress(f, 100, 118);
  const zero = progress(f, 112, 124);
  const w2 = x(800) - 8;
  const capX = x(500);
  const w2a = Math.min(w2 * b2, capX - 8);
  const w2b = Math.max(0, w2 * b2 - (capX - 8));
  return (
    <Frame label={`${PHP_300} is paid; ${PHP_800} is over the ${PHP_500} cap and declined with no transaction (sample)`}>
      <path d="M8 128 H408" fill="none" strokeWidth="1.5" className="stroke-text" />
      <rect x="8" y="30" width={(x(300) - 8) * b1} height="24" strokeWidth="1.5" className="fill-mint stroke-text" />
      <Label x={16} y={46} opacity={clamp((b1 - 0.7) * 4)}>
        {PHP_300}
      </Label>
      <Stamp cx={x(300) + 8 + 20 + 8} cy={42} tone="accent" rotate={-3} t={paid}>
        PAID
      </Stamp>
      <rect x="8" y="76" width={w2a} height="24" strokeWidth="1.5" className="fill-mint stroke-text" />
      <rect x={capX} y="76" width={w2b} height="24" strokeWidth="1.5" className="fill-mint stroke-text" />
      <rect x={capX} y="76" width={w2b} height="24" strokeWidth="1.5" opacity={over} className="fill-declined-tint stroke-declined" />
      <Label x={16} y={92} opacity={clamp((b2 - 0.5) * 3)}>
        {PHP_800}
      </Label>
      <path d={`M${capX} 20 V${(20 + 108 * cap).toFixed(1)}`} fill="none" strokeWidth="1.5" className="stroke-text" />
      <Label x={capX + 4} y={14} opacity={cap}>
        {`cap ${PHP_500}`}
      </Label>
      <Stamp cx={382} cy={88} tone="danger" rotate={3} t={declined}>
        DECLINED
      </Stamp>
      <Label x={382} y={116} anchor="middle" opacity={zero} className="specimen-zero">
        0 tx
      </Label>
      <Label x={8} y={172}>
        sample
      </Label>
    </Frame>
  );
}

function Freeze({ f }: { f: number }) {
  const base = 124;
  const k = 96 / 2.5;
  const lineY = base - THRESHOLD * k;
  const lastIdx = SCORES.length - 1;
  const thr = progress(f, 0, 24);
  const stamp = progress(f, 104, 120);
  const turn = progress(f, 98, 106);
  return (
    <Frame label="Simulated MIDAS-F scores; the last tap scores 2.31, over the 1.78 line, and Rotonda Fuels is frozen">
      <path d={`M8 ${base} H432`} fill="none" strokeWidth="1.5" className="stroke-text" />
      {SCORES.map((s, i) => {
        const last = i === lastIdx;
        const t = last ? progress(f, 80, 100) : progress(f, 4 + i * 6, 16 + i * 6);
        const h = s * k * t;
        const bx = 8 + i * 36;
        return (
          <g key={i}>
            <rect x={bx} y={base - h} width="24" height={h} strokeWidth="1.5" opacity={t > 0 ? 1 : 0} className="fill-ring-surface stroke-text" />
            {last ? <rect x={bx} y={base - h} width="24" height={h} strokeWidth="1.5" opacity={turn} className="fill-frozen stroke-text" /> : null}
          </g>
        );
      })}
      <path d={`M8 ${lineY.toFixed(1)} H${(8 + 424 * thr).toFixed(1)}`} fill="none" strokeWidth="1.5" strokeDasharray="5 5" className="stroke-text" />
      <Label x={8} y={lineY - 5} opacity={thr}>
        {THRESHOLD.toFixed(2)}
      </Label>
      <Label x={416} y={140} anchor="middle" opacity={progress(f, 90, 100)} className="specimen-score">
        {SCORES[lastIdx].toFixed(2)}
      </Label>
      <Label x={396} y={48} anchor="end" opacity={progress(f, 108, 120)}>
        Rotonda Fuels frozen
      </Label>
      <Stamp cx={400} cy={16} tone="frozen" rotate={-4} t={stamp} dx={-8} dy={1}>
        FROZEN
      </Stamp>
      <Label x={8} y={172}>
        MIDAS-F · simulated
      </Label>
    </Frame>
  );
}

function Return({ f }: { f: number }) {
  const rows = SWEEPS.map((s, i) => {
    const barY = 28 + i * 48;
    const w = s.pesos * (220 / 1500);
    const grow = progress(f, 8 + i * 22, 30 + i * 22);
    const flow = progress(f, 30 + i * 22, 54 + i * 22);
    return { ...s, i, barY, w, grow, flow };
  });
  const total = rows.reduce((sum, r) => sum + r.pesos * r.flow, 0);
  const done = total >= 3190;
  const entryY = [76, 100, 124];
  return (
    <Frame label={`Three revoked cards return ${PHP_3190} to the LGU wallet (sample)`}>
      {rows.map((r) => {
        const cy = r.barY + 10;
        const d = `M${8 + r.w} ${cy} H290 V${entryY[r.i]} H322`;
        return (
          <g key={r.name}>
            <Label x={8} y={r.barY - 6} opacity={r.grow} className="specimen-sweepname">
              {r.name}
            </Label>
            <Label x={278} y={r.barY - 6} anchor="end" opacity={r.grow} className="specimen-amount">
              {peso(r.pesos)}
            </Label>
            <rect x="8" y={r.barY} width={r.w * r.grow} height="20" strokeWidth="1.5" opacity={r.grow > 0 ? 1 : 0} className="fill-accent stroke-text" />
            <path
              d={d}
              pathLength={1}
              fill="none"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeDasharray="1"
              strokeDashoffset={1 - r.flow}
              opacity={r.flow > 0 ? 1 : 0}
              className="stroke-text"
            />
          </g>
        );
      })}
      <Label x={377} y={44} anchor="middle" className="specimen-wallet-text">
        LGU wallet
      </Label>
      <rect x="322" y="52" width="110" height="96" strokeWidth="1.5" className="specimen-wallet-box fill-accent-tint stroke-text" />
      <Label x={377} y={104} anchor="middle" className="specimen-wallet-text">
        {done ? PHP_3190 : peso(Math.round(total * 100) / 100)}
      </Label>
      <Label x={432} y={166} anchor="end" opacity={progress(f, 100, 118)}>
        3 cards revoked
      </Label>
      <Label x={8} y={172}>
        sample
      </Label>
    </Frame>
  );
}

const DRAWINGS: Record<SpecimenId, (props: { f: number }) => ReactElement> = {
  list: List,
  enroll: Enroll,
  fund: Fund,
  refuse: Refuse,
  freeze: Freeze,
  return: Return,
};

export function Specimen({ id, frame }: { id: SpecimenId; frame?: number }): ReactElement {
  const Drawing = DRAWINGS[id];
  return <Drawing f={frame ?? SPECIMEN_FRAMES - 1} />;
}
