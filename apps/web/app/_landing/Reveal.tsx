"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type Tag = "div" | "li" | "article" | "section" | "p" | "h2";

/**
 * Scroll reveal: opacity and a 12px rise, once. Content is fully visible without JS and under reduced motion:
 * the element only gets `data-reveal="pending"` (hidden) when it starts below the fold, and `"in"` once seen.
 * `delay` (ms) staggers siblings. The attribute is set on the DOM, not in state, so nothing re-renders.
 * `draw` uses the attribute `data-draw` instead (no fade or rise): the heading underline draws in, nothing else moves.
 */
export function Reveal({ as = "div", delay = 0, id, draw = false, className, children }: { as?: Tag; delay?: number; id?: string; draw?: boolean; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const attr = draw ? "data-draw" : "data-reveal";
    // No layout reads: the observer's first callback carries the geometry. Already on screen, or scrolled past
    // (page restored mid-scroll): leave it visible. Otherwise hide it until it scrolls in.
    let first = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        if (first) {
          first = false;
          if (e.boundingClientRect.top < (e.rootBounds?.height ?? window.innerHeight)) {
            observer.disconnect();
            return;
          }
          el.setAttribute(attr, "pending");
          return;
        }
        if (!e.isIntersecting) return;
        el.setAttribute(attr, "in");
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeAttribute(attr);
    };
  }, [draw]);

  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;
  const Tag = as as "div";
  return (
    <Tag ref={ref} id={id} className={className} style={style}>
      {children}
    </Tag>
  );
}

/**
 * Cover motion, motion-safe only: a slow Ken Burns on the image (CSS, see `.cover-kb`) inside a layer that a passive
 * scroll listener drifts down to 40px as the page scrolls up, so the photo trails the page. The scroll writes one
 * CSS variable per animation frame. The layer starts 40px above the cover so the drift never exposes an edge.
 */
export function CoverMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const write = () => {
      frame = 0;
      el.style.setProperty("--cover-y", `${Math.min(40, Math.max(0, window.scrollY * 0.12))}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      el.style.removeProperty("--cover-y");
    };
  }, []);

  return (
    <div ref={ref} className="cover-parallax">
      <div className="cover-kb">{children}</div>
    </div>
  );
}
