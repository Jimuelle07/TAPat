"use client";

// Lazy motion for the landing page. Remotion is reachable only through the dynamic imports below.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ArtId } from "./art";
import type { SpecimenId } from "./Specimens";

const LazyReelPlayer = dynamic(() => import("./ReelPlayer").then((m) => m.ReelPlayer), { ssr: false, loading: () => null });
const BandMotion = dynamic(() => import("./Motion").then((m) => m.BandMotion), { ssr: false, loading: () => null });

export function LazyBandMotion({ art, motif }: { art: ArtId; motif: string }) {
  return <BandMotion art={art} motif={motif} />;
}

/** Shows the server-rendered specimen; near the viewport a Remotion Player of the same drawing is laid over it. */
export function SpecimenReel({ id, children }: { id: SpecimenId; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        setNear(true);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div ref={box} className="relative">
      <div className={ready ? "opacity-0" : undefined}>{children}</div>
      {near ? (
        <div aria-hidden className="absolute inset-0">
          <LazyReelPlayer id={id} onReady={onReady} />
        </div>
      ) : null}
    </div>
  );
}
