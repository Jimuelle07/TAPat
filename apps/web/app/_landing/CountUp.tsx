"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1400;

/** Splits "709.88M" into digits, decimals and the rest so every frame keeps the final figure's shape. */
function parse(final: string) {
  const match = /^([\d,]+)(?:\.(\d+))?(.*)$/.exec(final);
  if (!match) return null;
  const whole = Number(match[1].replace(/,/g, ""));
  const decimals = match[2]?.length ?? 0;
  const value = Number(`${whole}${decimals ? `.${match[2]}` : ""}`);
  return { value, decimals, suffix: match[3], grouped: match[1].includes(",") };
}

/**
 * Counts up each time it scrolls into view, including when it scrolls back in. The final text is the server-rendered value and always stays in the
 * layout (it sizes the box and is what assistive tech reads), so there is no layout shift. Under reduced motion
 * nothing animates.
 */
export function CountUp({ final }: { final: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    const node = root.current;
    const parts = parse(final);
    if (!node || !parts || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const format = (n: number) => {
      const text = n.toLocaleString("en-US", {
        minimumFractionDigits: parts.decimals,
        maximumFractionDigits: parts.decimals,
        useGrouping: parts.grouped,
      });
      return `${text}${parts.suffix}`;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Stop any running tween first so rapid enter/leave never stacks rAF loops.
        cancelAnimationFrame(raf);
        if (!entry.isIntersecting) {
          setFrame(null);
          return;
        }
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - (1 - t) ** 3;
          setFrame(t < 1 ? format(parts.value * eased) : null);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [final]);

  return (
    <span ref={root} className="inline-grid tabular-nums">
      <span className={frame === null ? "col-start-1 row-start-1" : "col-start-1 row-start-1 invisible"}>{final}</span>
      {frame === null ? null : (
        <span aria-hidden="true" className="col-start-1 row-start-1">
          {frame}
        </span>
      )}
    </span>
  );
}
