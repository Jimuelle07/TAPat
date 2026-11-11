"use client";

import { useEffect, useRef, useState } from "react";
import { Nums } from "./kit";
import "./navigator.css";

type RailStep = { id: string; num: string; label: string };

/** Step navigator for the loop: a left-edge rail from lg, a bottom pill below it. Shown only while the steps list crosses the middle half of the viewport. */
export function StepRail({ steps }: { steps: RailStep[] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  const pill = useRef<HTMLDivElement>(null);

  // Tuck the pill away while scrolling down; bring it back on scroll up or after the scroll settles. No React state per frame.
  useEffect(() => {
    const el = pill.current;
    if (el === null) return;
    let last = window.scrollY;
    let frame = 0;
    let settle = 0;
    const paint = () => {
      frame = 0;
      const y = window.scrollY;
      if (y - last > 6) el.dataset.away = el.contains(document.activeElement) ? "false" : "true";
      else if (last - y > 6) el.dataset.away = "false";
      else return;
      last = y;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        el.dataset.away = "false";
      }, 220);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    const list = document.getElementById("loop")?.querySelector("ol.loop-steps");
    if (!list) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setShown(entry.isIntersecting);
      },
      { rootMargin: "-25% 0px -25% 0px", threshold: 0 },
    );
    seen.observe(list);

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

      <div ref={pill} role="group" aria-label="Loop steps" className="step-pill" data-shown={shown} data-away="false">
        <button type="button" aria-label="Previous step" disabled={active === 0} onClick={() => go(active - 1)}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4L3 8l4 4" />
          </svg>
        </button>
        <span aria-live="off" aria-current="step" className="step-pill-text">
          <Nums>{`Step ${step.num.replace(/^0/, "")} of ${steps.length} · ${step.label}`}</Nums>
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

const SECTIONS = [
  { id: "loop", label: "How it works" },
  { id: "stakes", label: "Why" },
  { id: "contract", label: "Contract" },
];

/** Header section links. The section crossing the middle of the viewport is marked current with aria-current. */
export function SectionNav() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const crossing = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target.id);
          else crossing.delete(entry.target.id);
        }
        setCurrent(SECTIONS.find((s) => crossing.has(s.id))?.id ?? null);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el !== null) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="Sections" className="ledger-nav hidden items-center gap-9 md:flex">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-current={current === s.id ? "location" : undefined} className="inline-flex h-11 items-center text-[15px] font-medium">
          {s.label}
        </a>
      ))}
    </nav>
  );
}

