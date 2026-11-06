// The two demo charts as plain SVG: no chart library is installed, and these are one line and a few dots.
import { useId, type CSSProperties } from "react";
import type { PricePoint } from "@tapat/shared";
import { Card, Chip } from "./ui";

const WIDTH = 318;
const HEIGHT = 132;
const CP_BAND = 28;
const FIRE_P = 0.9;
const PAD_X = 12;
const PAD_TOP = 16;

function ChartFrame({
  title,
  label,
  summary,
  caption,
  children,
}: {
  title: string;
  label: string;
  summary: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-label">{title}</h3>
        <Chip>{label}</Chip>
      </div>
      <svg role="img" aria-label={summary} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full overflow-visible">
        {children}
      </svg>
      <p className="text-caption">{caption}</p>
    </Card>
  );
}

function ThresholdLine({ y, label }: { y: number; label?: string }) {
  return (
    <g className="fade-in">
      <line x1="0" x2={WIDTH} y1={y} y2={y} className="stroke-accent" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
      {label === undefined ? null : (
        <>
          <rect x="0" y={y - 14} width={label.length * 5.4 + 10} height="12" rx="6" className="fill-accent" />
          <text x="5" y={y - 5} fontSize="9" fontWeight="600" className="fill-text">
            {label}
          </text>
        </>
      )}
    </g>
  );
}

/** Faint horizontal rules so the eye can read the line against a scale. */
function Grid({ height, rows }: { height: number; rows: number }) {
  return (
    <g aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => {
        const gy = (height / rows) * (i + 1) - height / rows / 2;
        return <line key={i} x1="0" x2={WIDTH} y1={gy} y2={gy} className="stroke-ring-surface" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" opacity="0.8" />;
      })}
    </g>
  );
}

export function PriceChart({
  points,
  total,
  thresholdPhp,
  fired,
  simulated,
}: {
  points: PricePoint[];
  total: number;
  thresholdPhp: number;
  fired: boolean;
  simulated: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const areaId = `${uid}-area`;
  const heatId = `${uid}-heat`;
  const glowId = `${uid}-glow`;
  const span = Math.max(total - 1, 1);
  const x = (idx: number): number => PAD_X + ((idx - 1) / span) * (WIDTH - 2 * PAD_X);
  // Bottom CP_BAND px hold the changepoint band; prices use the rest.
  const plotH = HEIGHT - CP_BAND;
  const values = [...points.map((p) => p.pricePhp), thresholdPhp];
  const lo = points.length === 0 ? thresholdPhp - 9 : Math.min(...values) - 1;
  const hi = points.length === 0 ? thresholdPhp + 9 : Math.max(...values) + 1;
  const y = (price: number): number => plotH - ((price - lo) / (hi - lo)) * (plotH - PAD_TOP);
  const cpY = (p: number): number => HEIGHT - 2 - Math.min(Math.max(p, 0), 1) * (CP_BAND - 6);
  const baseY = HEIGHT - 2;
  const last = points[points.length - 1];
  const threshold = `PHP ${thresholdPhp.toFixed(2)}`;
  const latestCp = [...points].reverse().find((p) => p.cpRecent !== null)?.cpRecent ?? null;
  const cpText = latestCp === null ? "" : ` changepoint p=${latestCp.toFixed(2)}`;
  const cpPoints = points.filter((p) => p.cpRecent !== null);
  const cpPath = cpPoints.map((p, index) => `${index === 0 ? "M" : "L"} ${x(p.idx).toFixed(1)} ${cpY(p.cpRecent as number).toFixed(1)}`).join(" ");
  const cpArea =
    cpPoints.length === 0 ? "" : `${cpPath} L ${x(cpPoints[cpPoints.length - 1].idx).toFixed(1)} ${baseY} L ${x(cpPoints[0].idx).toFixed(1)} ${baseY} Z`;
  const pricePath = points.map((p, index) => `${index === 0 ? "M" : "L"} ${x(p.idx).toFixed(1)} ${y(p.pricePhp).toFixed(1)}`).join(" ");
  const priceArea = last === undefined || points.length < 2 ? "" : `${pricePath} L ${x(last.idx).toFixed(1)} ${plotH} L ${x(points[0].idx).toFixed(1)} ${plotH} Z`;
  // The fire point: first point where the changepoint probability reached the 0.90 trigger.
  const fire = points.find((p) => p.cpRecent !== null && p.cpRecent >= FIRE_P);
  const fireX = fire === undefined ? null : x(fire.idx);
  const flagEnd = fireX !== null && fireX > WIDTH - 44;
  return (
    <ChartFrame
      title="Diesel price"
      label={simulated ? "simulated DOE series" : "DOE series"}
      summary={
        last === undefined
          ? `No prices yet. Threshold ${threshold} per litre.`
          : `Latest price PHP ${last.pricePhp.toFixed(2)} at point ${last.idx} of ${total}. Threshold ${threshold} per litre.${cpText}`
      }
      caption={`Threshold ${threshold} per litre. Point ${last?.idx ?? 0} of ${total}.${cpText}`}
    >
      <defs>
        <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--color-accent)", stopOpacity: 0.6 }} />
          <stop offset="100%" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
        </linearGradient>
        {/* Heat in chart space: pale tint at p=0 climbing to full accent at p=1, so colour tracks the value, not the shape. */}
        <linearGradient id={heatId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={cpY(1)} y2={cpY(0)}>
          <stop offset="0%" style={{ stopColor: "var(--color-accent)", stopOpacity: 0.95 }} />
          <stop offset="100%" style={{ stopColor: "var(--color-accent-tint)", stopOpacity: 0.35 }} />
        </linearGradient>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <Grid height={plotH} rows={3} />
      {/* Changepoint band: a recessed track with the probability filled in as heat. */}
      <rect x="0" y={HEIGHT - CP_BAND + 2} width={WIDTH} height={CP_BAND - 2} rx="6" className="fill-sunken" />
      <line x1="0" x2={WIDTH} y1={cpY(FIRE_P)} y2={cpY(FIRE_P)} className="stroke-accent" strokeWidth="1" strokeDasharray="3 3" />
      <rect x={WIDTH - PAD_X - 52} y={HEIGHT - CP_BAND - 12} width="52" height="11" rx="5.5" className="fill-raised" opacity="0.9" />
      <text x={WIDTH - PAD_X - 26} y={HEIGHT - CP_BAND - 3.5} textAnchor="middle" fontSize="9" className="fill-ring-accent">
        fire 0.90
      </text>
      {cpArea !== "" ? <path d={cpArea} fill={`url(#${heatId})`} className="fade-in" /> : null}
      {cpPath !== "" ? <path d={cpPath} fill="none" className="stroke-ring-accent" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
      <ThresholdLine y={y(thresholdPhp)} label={`threshold ${thresholdPhp.toFixed(2)}`} />
      {priceArea !== "" ? <path d={priceArea} fill={`url(#${areaId})`} /> : null}
      {fireX !== null ? (
        <g className="fade-in">
          <line x1={fireX} x2={fireX} y1="0" y2={HEIGHT} className="stroke-text" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
          <rect x={flagEnd ? fireX - 28 : fireX} y="0" width="28" height="12" rx="6" className="fill-text" />
          <text x={flagEnd ? fireX - 14 : fireX + 14} y="9" textAnchor="middle" fontSize="9" fontWeight="600" className="fill-accent">
            fire
          </text>
        </g>
      ) : null}
      <path d={pricePath} fill="none" pathLength={1} className="draw stroke-primary" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {last !== undefined ? (
        <>
          {/* Keyed by the point count so each arriving price pops once; the line itself is never remounted. */}
          <circle cx={x(last.idx)} cy={y(last.pricePhp)} r="9" filter={`url(#${glowId})`} className="fill-accent" opacity="0.9" />
          <circle key={points.length} cx={x(last.idx)} cy={y(last.pricePhp)} r="4.5" strokeWidth="2" className="svg-dot pop-in fill-primary stroke-raised" />
          <circle cx={x(last.idx)} cy={y(last.pricePhp)} r="10" fill="none" strokeWidth="1.5" className={`svg-ping ${fired ? "stroke-primary" : "stroke-ring-accent"}`} />
        </>
      ) : null}
    </ChartFrame>
  );
}

export function EdgeChart({
  scores,
  threshold,
  frozenScore,
  live = false,
}: {
  scores: number[];
  threshold: number;
  frozenScore: number | null;
  /** True while a burst is running: over-line dots blink once as the freeze approaches. */
  live?: boolean;
}) {
  const top = Math.max(threshold * 1.45, ...scores.map((s) => s * 1.1));
  const y = (value: number): number => HEIGHT - (value / top) * HEIGHT;
  const span = Math.max(scores.length - 1, 1);
  return (
    <ChartFrame
      title="MIDAS score per tap"
      label="simulated"
      summary={`${scores.length} taps scored against a freeze line of ${threshold}.`}
      caption={
        frozenScore === null
          ? `Freeze line at ${threshold}. Taps are scored as they arrive.`
          : `Score ${frozenScore.toFixed(2)} crossed the ${threshold} line. The station froze.`
      }
    >
      <Grid height={HEIGHT} rows={4} />
      <ThresholdLine y={y(threshold)} label="freeze line" />
      {scores.map((value, index) => {
        const over = value >= threshold;
        // Blink only once the burst/freeze class mounts; ordinary arrivals pop in.
        const blinking = over && (frozenScore !== null || live);
        return (
          <circle
            key={index}
            cx={(index / span) * (WIDTH - 12) + 6}
            cy={y(value)}
            r={over ? 6 : 4}
            style={{ "--i": Math.min(index, 8) } as CSSProperties}
            className={`svg-dot ${over ? "fill-text" : "fill-primary"} ${blinking ? "flicker" : "pop-in"}`}
          />
        );
      })}
    </ChartFrame>
  );
}
