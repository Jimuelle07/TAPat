// The two demo charts as plain SVG: no chart library is installed, and these are one line and a few dots.
import type { PricePoint } from "@tapat/shared";
import { Card, Chip } from "./ui";

const WIDTH = 318;
const HEIGHT = 132;

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

function ThresholdLine({ y }: { y: number }) {
  return <line x1="0" x2={WIDTH} y1={y} y2={y} className="stroke-accent" strokeWidth="2" strokeDasharray="6 4" />;
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
  const span = Math.max(total - 1, 1);
  const x = (idx: number): number => ((idx - 1) / span) * WIDTH;
  const y = (price: number): number => HEIGHT - ((price - 56) / 18) * HEIGHT;
  const last = points[points.length - 1];
  const threshold = `PHP ${thresholdPhp.toFixed(2)}`;
  return (
    <ChartFrame
      title="Diesel price"
      label={simulated ? "simulated DOE series" : "DOE series"}
      summary={
        last === undefined
          ? `No prices yet. Threshold ${threshold} per litre.`
          : `Latest price PHP ${last.pricePhp.toFixed(2)} at point ${last.idx} of ${total}. Threshold ${threshold} per litre.`
      }
      caption={`Threshold ${threshold} per litre. Point ${last?.idx ?? 0} of ${total}.`}
    >
      <ThresholdLine y={y(thresholdPhp)} />
      <polyline
        points={points.map((p) => `${x(p.idx).toFixed(1)},${y(p.pricePhp).toFixed(1)}`).join(" ")}
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {fired && last !== undefined ? <circle cx={x(last.idx)} cy={y(last.pricePhp)} r="5" className="fill-primary" /> : null}
    </ChartFrame>
  );
}

export function EdgeChart({ scores, threshold, frozenScore }: { scores: number[]; threshold: number; frozenScore: number | null }) {
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
      <ThresholdLine y={y(threshold)} />
      {scores.map((value, index) => {
        const over = value >= threshold;
        return (
          <circle key={index} cx={(index / span) * (WIDTH - 12) + 6} cy={y(value)} r={over ? 6 : 4} className={over ? "fill-text" : "fill-primary"} />
        );
      })}
    </ChartFrame>
  );
}
