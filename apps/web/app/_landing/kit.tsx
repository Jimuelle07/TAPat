import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/*
 * Server-safe kit pieces for the landing page. The app's own Chip and Receipt live in client modules that pull in
 * auth and fetch code, so the landing keeps these small copies instead.
 */

export type ChipTone = "outline" | "mint" | "accent" | "danger" | "frozen" | "ink";

/** Same map as the app's Chip (`app/(app)/_components/ui.tsx`). */
export const CHIP: Record<ChipTone, string> = {
  outline: "border-text bg-raised text-text",
  mint: "border-text bg-mint text-text",
  accent: "border-text bg-accent text-text",
  danger: "border-danger bg-danger text-surface",
  frozen: "border-text bg-frozen text-text",
  ink: "border-text bg-text text-surface",
};

/** Status is always written out, so colour is never the only signal. */
export function Stamp({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`inline-flex w-fit shrink-0 items-center rounded-sm border-[1.5px] px-2 py-1 text-caption ${CHIP[tone]}`}>{children}</span>;
}

/** The torn bottom edge of a receipt, as on the station page. */
export function TearEdge({ teeth = 30 }: { teeth?: number }) {
  const points = Array.from({ length: teeth * 2 + 1 }, (_, i) => `${(i / (teeth * 2)) * 100},${i % 2 === 0 ? 0 : 10}`).join(" ");
  return (
    <svg aria-hidden="true" viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-[10px] w-full overflow-visible">
      <polyline points={points} className="fill-raised stroke-text" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The hero's contactless tap on the Forest ground: a disc with three rings rippling out, plus the corner ring set. Pure SVG and CSS. */
export function HeroArt() {
  return (
    <>
      <span aria-hidden="true" className="band-arc">
        <svg viewBox="0 0 1000 1000" className="absolute inset-0 h-full w-full">
          <circle cx="500" cy="500" r="230" className="hero-tap-disc fill-primary" />
          {[300, 370, 440].map((r, i) => (
            <circle key={r} cx="500" cy="500" r={r} fill="none" strokeWidth={30 - i * 8} className="hero-tap-ring stroke-primary" style={{ "--i": i } as CSSProperties} />
          ))}
        </svg>
      </span>
      <span aria-hidden="true" className="absolute top-0 right-0 size-30 lg:size-60">
        <svg viewBox="0 0 240 240" className="block h-full w-full">
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx="240" cy="0" r={30 * (i + 1)} fill="none" strokeWidth="1.5" className="stroke-pressed" />
          ))}
        </svg>
      </span>
    </>
  );
}

const CTA_LOOK = {
  accent: "cta-raised bg-accent text-text hover:bg-accent-tint",
  primary: "cta-raised bg-primary text-surface hover:bg-pressed",
  outline: "cta-outline border-[1.5px] border-current hover:bg-current/10",
};

const CTA_SIZE = { lg: "h-[54px] px-6", sm: "h-11 px-4" };

export function Cta({ href, look, size = "lg", children }: { href: string; look: keyof typeof CTA_LOOK; size?: keyof typeof CTA_SIZE; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group inline-flex items-center gap-2 rounded-md text-label transition-colors duration-200 ${CTA_SIZE[size]} ${CTA_LOOK[look]}`}
    >
      {children}
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </Link>
  );
}
