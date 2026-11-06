"use client";

// Motion foundation: reduced-motion hook, change counter, rAF count-up, stagger wrapper and one-shot particles.
// CSS only + Web Animations API; no animation dependency.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion(): boolean {
  return window.matchMedia(REDUCE_QUERY).matches;
}

function getReducedMotionOnServer(): boolean {
  return false;
}

/** Live `prefers-reduced-motion: reduce`; false during SSR and hydration. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionOnServer);
}

/** 0 on mount, then +1 for every change of `value` (Object.is). */
export function useValueChange<T>(value: T): number {
  const [previous, setPrevious] = useState(value);
  const [count, setCount] = useState(0);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    setCount(count + 1);
  }
  return count;
}

/**
 * Writes the tweened number straight to `textContent` in one rAF loop (no per-frame React render).
 * A new `to` re-targets from the value currently on screen; reduced motion (or a delta under half a unit)
 * writes the final value immediately.
 */
export function useCountUp(
  to: number,
  format: (n: number) => string,
  opts?: { durationMs?: number; from?: number },
): RefObject<HTMLSpanElement | null> {
  const el = useRef<HTMLSpanElement | null>(null);
  const shown = useRef(opts?.from ?? 0);
  const fmt = useRef(format);
  const running = useRef(false);
  const durationMs = opts?.durationMs ?? 500;
  const reduce = useReducedMotion();

  // Keep the latest formatter without restarting the loop, and re-render an idle counter when formatting changes.
  useEffect(() => {
    fmt.current = format;
    const node = el.current;
    if (node !== null && !running.current) node.textContent = format(shown.current);
  });

  useEffect(() => {
    const node = el.current;
    if (node === null) return;
    const write = (value: number) => {
      node.textContent = fmt.current(value);
    };
    if (reduce) {
      shown.current = to;
      write(to);
      return;
    }
    const start = shown.current;
    if (Math.abs(to - start) < 0.5) {
      shown.current = to;
      write(to);
      return;
    }
    const t0 = performance.now();
    running.current = true;
    let raf = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - t0) / durationMs);
      const value = start + (to - start) * (1 - Math.pow(1 - progress, 3));
      shown.current = value;
      write(value);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else {
        shown.current = to;
        write(to);
        running.current = false;
      }
    });
    return () => {
      running.current = false;
      cancelAnimationFrame(raf);
    };
  }, [to, reduce, durationMs]);

  return el;
}

/** Same contract as `useCountUp`, rendered as a span. The accessible name is always the final value. */
export function CountUp({
  to,
  format,
  className,
  durationMs = 500,
}: {
  to: number;
  format: (n: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const ref = useCountUp(to, format, { durationMs });
  return (
    <span ref={ref} aria-label={format(to)} className={className}>
      {format(0)}
    </span>
  );
}

/** Cascading wrapper: the CSS `nth-child` rules hand each child its `--i` delay (capped at 8). */
export function Stagger({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "section";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={className === undefined ? "stagger" : `stagger ${className}`}>{children}</Tag>;
}

/** Drawn check mark; the path is fully drawn when animations are off. */
export function CheckDraw({
  size = 24,
  className,
  delayMs = 0,
}: {
  size?: number;
  className?: string;
  delayMs?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        pathLength={1}
        className="draw"
        style={{ animationDelay: `${delayMs}ms` }}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** NFC ripple rings behind a reading panel; one static ring with reduced motion. */
export function Ripple({
  active,
  className,
  rings = 3,
}: {
  active: boolean;
  className?: string;
  rings?: number;
}) {
  const reduce = useReducedMotion();
  if (!active) return null;
  const layer =
    className === undefined
      ? "pointer-events-none absolute inset-0 grid place-items-center"
      : `pointer-events-none absolute inset-0 grid place-items-center ${className}`;
  if (reduce) {
    return (
      <div className={layer} aria-hidden="true">
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            border: "1.5px solid var(--color-primary)",
            opacity: 0.18,
          }}
        />
      </div>
    );
  }
  return (
    <div className={layer} aria-hidden="true">
      {Array.from({ length: rings }, (_, index) => (
        <span
          key={index}
          className="ripple-ring"
          style={{ "--delay": `${index * 500}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}

const CONFETTI_COLORS = [
  "var(--color-accent)",
  "var(--color-primary)",
  "var(--color-frozen)",
  "var(--color-declined)",
];

/** One-shot confetti burst, deterministic (no randomness) and inert under reduced motion. */
export function Confetti({ pieces = 14, className }: { pieces?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const layer =
    className === undefined
      ? "pointer-events-none absolute inset-0 overflow-hidden"
      : `pointer-events-none absolute inset-0 overflow-hidden ${className}`;
  return (
    <div className={layer} aria-hidden="true">
      {Array.from({ length: pieces }, (_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              "--dx": `${(index % 7 - 3) * 26}px`,
              "--dy": `${-(46 + (index % 5) * 22)}px`,
              "--rot": `${(index % 2 === 1 ? 1 : -1) * (140 + index * 13)}deg`,
              "--delay": `${(index % 6) * 18}ms`,
              "--confetti-color": CONFETTI_COLORS[index % CONFETTI_COLORS.length],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** One-shot coin drift toward the top-right wallet, deterministic and inert under reduced motion. */
export function CoinFlow({ coins = 8, className }: { coins?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const layer =
    className === undefined
      ? "pointer-events-none absolute inset-0 overflow-hidden"
      : `pointer-events-none absolute inset-0 overflow-hidden ${className}`;
  return (
    <div className={layer} aria-hidden="true">
      {Array.from({ length: coins }, (_, index) => (
        <span
          key={index}
          className="settle-coin"
          style={
            {
              "--dx": `${28 + (index % 4) * 16}px`,
              "--dy": `${-(56 + (index % 5) * 14)}px`,
              "--delay": `${index * 40}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
