"use client";

// Lazy motion for the landing page. Remotion is reachable only through the dynamic imports below.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ArtId } from "./art";
import type { SpecimenId } from "./Specimens";

const BandMotion = dynamic(() => import("./Motion").then((m) => m.BandMotion), { ssr: false, loading: () => null });

/** Mounts Remotion's band art only once its placeholder is near the viewport; never under reduced motion. */
export function LazyBandMotion({ art, motif }: { art: ArtId; motif: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);

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
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (near) return <BandMotion art={art} motif={motif} />;
  return <span ref={box} aria-hidden="true" className="band-arc" />;
}

/**
 * Fetches the player's code on the visitor's first scroll. Waiting until a card is close means that on a first visit,
 * with nothing cached, the early cards scroll past before it arrives; fetching on load would slow every page view.
 */
const fetchReelOnScroll = () => void import("./ReelPlayer").catch(() => undefined);

/** Shows the server-rendered specimen until the card is on screen, then a Remotion Player of the same drawing over it. */
export function SpecimenReel({ id, children }: { id: SpecimenId; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [Reel, setReel] = useState<typeof import("./ReelPlayer").ReelPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // All six cards share one listener: the same function only registers once.
    window.addEventListener("scroll", fetchReelOnScroll, { once: true, passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        // Plain state, not next/dynamic: React gives a suspended component's retry the lowest priority, so while another
        // card is animating on a slow phone, this one would not mount until everything else went quiet.
        import("./ReelPlayer")
          .then((m) => setReel(() => m.ReelPlayer))
          .catch(() => undefined); // The still stays up, which is the finished drawing.
      },
      // Well ahead of the card: mounting a Player takes a moment on a slow phone, and it should be ready on arrival.
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div ref={box} className="relative">
      <div className={ready ? "opacity-0" : undefined}>{children}</div>
      {Reel ? (
        // Hidden until it plays, so its empty first frame never shows over the still.
        <div aria-hidden className={`absolute inset-0 ${ready ? "" : "invisible"}`}>
          <Reel id={id} onReady={onReady} />
        </div>
      ) : null}
    </div>
  );
}
