import { useId } from "react";

export type TapPhase = "idle" | "reading" | "done" | "error";

const SPOKEN: Record<TapPhase, string> = {
  idle: "Card waiting to be tapped on the reader",
  reading: "Card tapped on the reader, reading",
  done: "Card read successfully",
  error: "Card could not be read",
};

/**
 * Inline-SVG illustration of a contactless card meeting a reader. Decorative state indicator, not a control:
 * `phase` drives CSS (see `.tapscene` in globals.css); every animation is gated on prefers-reduced-motion there,
 * and each phase has a static finished pose, so reduced-motion users still see the right state.
 * Only the last four UID characters are ever drawn.
 */
export function TapScene({
  phase,
  label,
  simulated = false,
  last4,
  className = "",
}: {
  phase: TapPhase;
  label?: string;
  simulated?: boolean;
  last4?: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  const spoken = `${label === undefined ? SPOKEN[phase] : `${SPOKEN[phase]}: ${label}`}${simulated ? " (simulated)" : ""}`;
  const digits = last4 === undefined ? "····" : last4.slice(-4).toUpperCase();

  return (
    <figure className={`m-0 flex w-full flex-col items-center gap-2 ${className}`}>
      <svg
        role="img"
        aria-label={spoken}
        viewBox="0 0 320 224"
        data-phase={phase}
        className="tapscene block h-auto w-full"
      >
        <defs>
          <radialGradient id={id("stage")} cx="50%" cy="38%" r="75%">
            <stop offset="0%" style={{ stopColor: "var(--color-raised)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-mint)" }} />
          </radialGradient>
          <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-primary)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-pressed)" }} />
          </linearGradient>
          <linearGradient id={id("card")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-accent-tint)" }} />
            <stop offset="55%" style={{ stopColor: "var(--color-accent)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-ring-accent)" }} />
          </linearGradient>
          <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id("chip")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-raised)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-accent-tint)" }} />
          </linearGradient>
          <filter id={id("lift")} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#1b2e28" floodOpacity="0.28" />
          </filter>
          <filter id={id("soft")} x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <clipPath id={id("clip")}>
            <rect width="128" height="76" rx="10" />
          </clipPath>
        </defs>

        {/* stage */}
        <rect width="320" height="224" rx="20" fill={ref("stage")} />
        <g className="fill-ring-surface" opacity="0.55">
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 14 }, (_, col) => <circle key={`${row}-${col}`} cx={18 + col * 22} cy={16 + row * 26} r="1.2" />),
          )}
        </g>

        {/* simulated tag: honesty label for demo-only reads */}
        {simulated ? (
          <g transform="translate(12 192)">
            <rect width="70" height="20" rx="10" className="fill-accent-tint stroke-ring-accent" strokeWidth="1.2" />
            <text x="35" y="14" textAnchor="middle" className="fill-text font-mono" fontSize="11" fontWeight="500">
              simulated
            </text>
          </g>
        ) : null}

        {/* NFC field arcs, centred under the reader */}
        <g className="tapscene-arcs" fill="none" strokeLinecap="round" strokeWidth="4">
          <path className="tapscene-arc stroke-accent" style={{ animationDelay: "0s" }} d="M148 88 A12 12 0 0 0 172 88" />
          <path className="tapscene-arc stroke-accent" style={{ animationDelay: "0.22s" }} d="M136 88 A24 24 0 0 0 184 88" />
          <path className="tapscene-arc stroke-ring-accent" style={{ animationDelay: "0.44s" }} d="M124 88 A36 36 0 0 0 196 88" />
        </g>

        {/* reader */}
        <g className="tapscene-reader">
          <rect x="70" y="14" width="180" height="70" rx="16" fill={ref("body")} filter={ref("lift")} />
          <rect x="70.75" y="14.75" width="178.5" height="68.5" rx="15.5" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
          <rect className="tapscene-halo fill-none stroke-primary" x="64" y="8" width="192" height="82" rx="21" strokeWidth="3" />
          <rect x="84" y="24" width="152" height="40" rx="9" className="fill-text" />
          <rect x="84" y="24" width="152" height="40" rx="9" fill="none" stroke="#fff" strokeOpacity="0.08" />
          {/* screen glyphs: one per phase */}
          <g className="tapscene-glyph tapscene-glyph-idle">
            <circle cx="148" cy="44" r="3.5" className="fill-muted" />
            <circle cx="160" cy="44" r="3.5" className="fill-muted" />
            <circle cx="172" cy="44" r="3.5" className="fill-muted" />
          </g>
          <g className="tapscene-glyph tapscene-glyph-reading">
            <circle className="tapscene-dot fill-accent" style={{ animationDelay: "0s" }} cx="148" cy="44" r="3.5" />
            <circle className="tapscene-dot fill-accent" style={{ animationDelay: "0.18s" }} cx="160" cy="44" r="3.5" />
            <circle className="tapscene-dot fill-accent" style={{ animationDelay: "0.36s" }} cx="172" cy="44" r="3.5" />
          </g>
          <g className="tapscene-glyph tapscene-glyph-done">
            <circle cx="160" cy="44" r="14" className="fill-primary" />
            <path className="tapscene-stroke stroke-raised" d="M152 44.5 L158 50.5 L169 37.5" pathLength={1} fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g className="tapscene-glyph tapscene-glyph-error">
            <circle cx="160" cy="44" r="14" className="fill-declined" />
            <path className="tapscene-stroke stroke-raised" d="M153.5 37.5 L166.5 50.5 M166.5 37.5 L153.5 50.5" pathLength={1} fill="none" strokeWidth="4" strokeLinecap="round" />
          </g>
          {/* status LED + speaker slots */}
          <circle className="tapscene-led" cx="236" cy="74" r="3" />
          <g className="stroke-raised" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round">
            <path d="M92 74 H112" />
            <path d="M118 74 H128" />
          </g>
        </g>

        {/* ground shadow follows the card */}
        <ellipse className="tapscene-ground fill-text" cx="160" cy="212" rx="62" ry="5" opacity="0.18" filter={ref("soft")} />

        {/* card */}
        <g className="tapscene-card">
          <g transform="translate(96 128)">
            <rect width="128" height="76" rx="10" fill={ref("card")} filter={ref("lift")} />
            <g clipPath={ref("clip")}>
              <rect width="128" height="76" fill={ref("sheen")} />
              <circle cx="118" cy="-8" r="46" fill="#fff" fillOpacity="0.1" />
              <circle cx="126" cy="2" r="30" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="6" />
            </g>
            <rect x="0.75" y="0.75" width="126.5" height="74.5" rx="9.5" fill="none" className="tapscene-edge" strokeWidth="1.5" />
            {/* chip */}
            <g transform="translate(14 14)">
              <rect width="26" height="20" rx="4" fill={ref("chip")} className="stroke-ring-accent" strokeWidth="1" />
              <path d="M9 0 V20 M17 0 V20 M0 7 H26 M0 13 H26" className="stroke-ring-accent" strokeWidth="0.8" fill="none" opacity="0.8" />
              <rect x="9" y="7" width="8" height="6" rx="1.5" fill="none" className="stroke-ring-accent" strokeWidth="0.8" />
            </g>
            {/* contactless mark */}
            <g className="stroke-text" fill="none" strokeWidth="2" strokeLinecap="round" opacity="0.7" transform="translate(100 24)">
              <path d="M0 -7 A9 9 0 0 1 0 7" />
              <path d="M5 -11 A15 15 0 0 1 5 11" />
              <path d="M10 -15 A21 21 0 0 1 10 15" opacity="0.6" />
            </g>
            <text x="14" y="52" className="fill-text font-mono" fontSize="9" fontWeight="500" opacity="0.7">
              TAPat
            </text>
            {/* last-4 slot */}
            <rect x="14" y="56" width="100" height="14" rx="5" className="fill-text" opacity="0.12" />
            <text x="22" y="66.5" className="fill-text font-mono" fontSize="10" letterSpacing="2" opacity="0.8">
              ••••
            </text>
            <text x="106" y="66.5" textAnchor="end" className="fill-text font-mono" fontSize="10.5" fontWeight="500" letterSpacing="1.5">
              {digits}
            </text>
          </g>
        </g>
      </svg>
      {label === undefined ? null : <figcaption className="text-small text-muted text-center">{label}</figcaption>}
    </figure>
  );
}
