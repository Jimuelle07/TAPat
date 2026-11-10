"use client";

import dynamic from "next/dynamic";
import { useRef, useSyncExternalStore } from "react";
import type { LandingScenarios } from "./figures/recorder/model";
import raw from "./scenarios.json";

// The recorder's art is large; it loads as its own chunk once the visit's scenario is picked.
const RecorderFigure = dynamic(() => import("./figures/recorder/figure").then((m) => m.RecorderFigure), { ssr: false, loading: () => <Placeholder /> });

const DATA = raw as LandingScenarios;
const STORAGE_KEY = "tapat:landing-scenario";

/** Same footprint as the plate (drawing, corner labels and caption), so nothing shifts when the figure lands. */
function Placeholder() {
  return <div aria-hidden className="w-full rounded-[2px] border border-text bg-raised" style={{ aspectRatio: "1000 / 800" }} />;
}

/** Next scenario index: random among the others, so a browser tab never sees the same one twice in a row. */
function pickIndex(count: number): number {
  let last = -1;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) last = Number(stored);
  } catch {
    // sessionStorage can be blocked; fall back to a plain random pick.
  }
  let next = Math.floor(Math.random() * count);
  if (count > 1 && next === last) next = (next + 1 + Math.floor(Math.random() * (count - 1))) % count;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

// One pick per mount, so in-app navigation back to the landing re-picks too. The server and hydration snapshot
// is -1 (not picked yet); the ref keeps re-renders and StrictMode double reads on the same pick.
const subscribe = () => () => {};
const getServerSnapshot = () => -1;

export function ScenarioPlayer() {
  const pick = useRef(-1);
  const getSnapshot = () => {
    if (pick.current < 0) pick.current = pickIndex(DATA.scenarios.length);
    return pick.current;
  };
  const idx = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const scenario = idx >= 0 ? DATA.scenarios[idx] : undefined;

  if (scenario === undefined) return <Placeholder />;

  return (
    <RecorderFigure
      scenario={scenario}
      position={idx + 1}
      count={DATA.scenarios.length}
      thresholdPhp={DATA.thresholdPhp}
      tranchePhp={DATA.tranchePhp}
      cards={DATA.cards}
    />
  );
}
