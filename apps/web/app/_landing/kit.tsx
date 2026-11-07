import Link from "next/link";
import type { ReactNode } from "react";

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

const CTA_LOOK = {
  accent: "bg-accent text-text shadow-button hover:bg-accent-tint",
  primary: "bg-primary text-surface shadow-button hover:bg-pressed",
  outline: "border-[1.5px] border-current hover:bg-current/10",
};

const CTA_SIZE = { lg: "h-[54px] px-6", sm: "h-11 px-4" };

export function Cta({ href, look, size = "lg", children }: { href: string; look: keyof typeof CTA_LOOK; size?: keyof typeof CTA_SIZE; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-md text-label transition-colors duration-200 active:translate-y-px ${CTA_SIZE[size]} ${CTA_LOOK[look]}`}
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
