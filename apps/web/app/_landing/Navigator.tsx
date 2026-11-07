"use client";

import { useEffect, useRef, useState } from "react";
import "./navigator.css";

type RailStep = { id: string; num: string; label: string };

/** Fuel-gauge scroll progress along the header's bottom edge: E at the top of the page, F at the end. */
export function ScrollGauge() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    // Where scroll timelines run, CSS fills the gauge and there is nothing to listen to.
    const timelineOk = CSS.supports("animation-timeline: scroll()") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (timelineOk) return;

    let frame = 0;
    const paint = () => {
      frame = 0;
      const root = document.documentElement;
      const max = root.scrollHeight - window.innerHeight;
      el.style.setProperty("--p", String(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0));
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="gauge">
      <span className="gauge-end gauge-e">E</span>
      <span className="gauge-end gauge-f">F</span>
      <span className="gauge-track">
        <span className="gauge-fill" />
      </span>
    </div>
  );
}

/** Step navigator for the loop: a left-edge rail from lg, a bottom pill below it. Shown only while #loop crosses the middle half of the viewport. */
export function StepRail({ steps }: { steps: RailStep[] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const loop = document.getElementById("loop");
    if (loop === null) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setShown(entry.isIntersecting);
      },
      { rootMargin: "-25% 0px -25% 0px", threshold: 0 },
    );
    seen.observe(loop);

    // A thin band across the middle of the viewport: the step crossing it is the current one.
    const current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = steps.findIndex((s) => s.id === entry.target.id);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const s of steps) {
      const target = document.getElementById(s.id);
      if (target !== null) current.observe(target);
    }
    return () => {
      seen.disconnect();
      current.disconnect();
    };
  }, [steps]);

  const go = (index: number) => {
    document.getElementById(steps[index].id)?.scrollIntoView({ block: "start" });
  };
  const step = steps[active];

  return (
    <>
      <nav aria-label="Loop steps" className="step-rail" data-shown={shown}>
        <ol>
          {steps.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={i === active ? "step" : undefined}>
                <span className="step-rail-num">{s.num}</span>
                <span className="step-rail-label">{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div role="group" aria-label="Loop steps" className="step-pill" data-shown={shown}>
        <button type="button" aria-label="Previous step" disabled={active === 0} onClick={() => go(active - 1)}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4L3 8l4 4" />
          </svg>
        </button>
        <span aria-live="off" aria-current="step" className="step-pill-text">
          Step {step.num.replace(/^0/, "")} of {steps.length} · {step.label}
        </span>
        <button type="button" aria-label="Next step" disabled={active === steps.length - 1} onClick={() => go(active + 1)}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>
    </>
  );
}
