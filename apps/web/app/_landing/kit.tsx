import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Server-safe kit pieces for the landing page. The app's own Chip lives in a client module that pulls in
 * auth and fetch code, so the landing keeps these small ones instead.
 */

export type StatusTone = "ok" | "refused" | "held" | "neutral";

const STATUS: Record<StatusTone, string> = {
  ok: "border-primary text-primary",
  refused: "border-danger text-danger",
  held: "border-text bg-frozen text-text",
  neutral: "border-text text-text",
};

/** Status is always written out in capitals, so colour is never the only signal. */
export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit shrink-0 items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[12px] leading-none tracking-[0.04em] whitespace-nowrap ${STATUS[tone]}`}>
      {children}
    </span>
  );
}

/** A numbered, bilingual section heading: Filipino first, English second. */
export function SectionHeading({ id, num, fil, en }: { id: string; num?: string; fil: string; en: string }) {
  return (
    <h2 id={id} className="doc-h2 flex flex-col">
      <span>
        {num ? <span className="font-mono font-normal mr-3">{num}</span> : null}
        <span lang="fil">{fil}</span>
      </span>
      <span className="font-normal">{en}</span>
    </h2>
  );
}

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className="doc-btn">
      {children}
    </Link>
  );
}
