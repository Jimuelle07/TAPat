import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

/*
 * Server-safe kit pieces for the landing page. The app's own Chip lives in a client module that pulls in
 * auth and fetch code, so the landing keeps these small ones instead.
 */

/** A numbered section heading. */
export function SectionHeading({ id, num, title }: { id: string; num?: string; title: string }) {
  return (
    <Reveal as="h2" id={id} draw className="doc-h2 doc-h2-draw">
      {num ? <span className="font-mono font-normal mr-3">{num}</span> : null}
      {title}
    </Reveal>
  );
}

export function ButtonLink({ href, children, arrow = false }: { href: string; children: ReactNode; arrow?: boolean }) {
  return (
    <Link href={href} prefetch={false} className="doc-btn">
      {children}
      {arrow ? (
        <span aria-hidden="true" className="doc-btn-arrow">
          →
        </span>
      ) : null}
    </Link>
  );
}
