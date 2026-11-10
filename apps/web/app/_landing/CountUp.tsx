"use client";

import { useCallback, useEffect, useRef } from "react";

const DURATION_MS = 1400;

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const fmt = useCallback(
    (n: number) =>
      prefix +
      n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) +
      suffix,
    [decimals, prefix, suffix],
  );
  const final = fmt(value);
  const animatedRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const animated = animatedRef.current;
    if (!root || !animated) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animated.textContent = final;
      return;
    }

    let raf = 0;
    let first = true;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        animated.textContent = fmt(value * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
        else animated.textContent = fmt(value);
      };
      animated.textContent = fmt(0);
      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (first) {
          first = false;
          if (!visible) {
            animated.textContent = fmt(0);
            return;
          }
          // In view on mount: page restored mid-scroll -> keep final, no flash.
          if (window.scrollY > 0) {
            observer.disconnect();
            return;
          }
          observer.disconnect();
          run();
          return;
        }
        if (visible) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      animated.textContent = final;
    };
  }, [value, fmt, final]);

  return (
    <span
      ref={rootRef}
      className={`inline-grid tabular-nums ${className ?? ""}`}
    >
      <span className="sr-only">{final}</span>
      <span aria-hidden="true" className="invisible [grid-area:1/1]">
        {final}
      </span>
      <span ref={animatedRef} aria-hidden="true" className="[grid-area:1/1]">
        {final}
      </span>
    </span>
  );
}
