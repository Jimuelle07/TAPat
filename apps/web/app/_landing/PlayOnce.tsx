"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Plays its children's entrance once, the first time it scrolls into view. The server renders everything in its
 * final state; only after hydration does this arm the hidden start (`data-armed`) and then release it (`data-on`), so
 * without JavaScript, or under reduced motion, nothing is ever hidden.
 */
export function PlayOnce({ className, children }: { className?: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (el === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.armed = "";
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // One frame in the armed state first, so an element already on screen still animates in.
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => {
            el.dataset.on = "";
          });
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
