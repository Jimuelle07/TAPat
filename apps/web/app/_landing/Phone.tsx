"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Chip } from "../(app)/_components/ui";

/** The app screen under public/phone-frame.png. Screens are real components at 390px, scaled by `--s`, and inert. */
export function Phone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure role="img" aria-label={label} className="phone">
      <div className="phone-screen" inert>
        {children}
      </div>
      <div aria-hidden="true" className="phone-frame" />
      <span className="absolute -bottom-3 left-1/2 z-40 -translate-x-1/2">
        <Chip>Sample data</Chip>
      </span>
    </figure>
  );
}

export interface Step {
  id: string;
  label: string;
  screen: ReactNode;
}

/** Desktop: one phone stays pinned and shows the screen of whichever band crosses the middle of the viewport. */
export function PinnedPhone({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const ids = steps.map((step) => step.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(ids.indexOf(entry.target.id));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const id of ids) {
      const band = document.getElementById(id);
      if (band !== null) observer.observe(band);
    }
    return () => observer.disconnect();
  }, [steps]);

  return (
    <Phone label={steps[active].label}>
      {steps.map((step, index) => (
        <div key={step.id} className="phone-layer" data-on={index === active}>
          {step.screen}
        </div>
      ))}
    </Phone>
  );
}
