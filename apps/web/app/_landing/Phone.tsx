"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useReducedMotion } from "../(app)/_components/motion";
import { MAX_TILT, phoneFacing } from "@/lib/phone-facing";
import { usePlayOnScreen } from "./Motion";
import { SCENES, SCREEN_HEIGHT, SCREEN_WIDTH, type SceneId } from "./screens";

// Each scene holds its finished screen this long before it plays again.
const HOLD_FRAMES = 90;

/** Stacked behind the front face in 3D space, these read as the thickness of the phone's body as it turns. */
const BODY_LAYERS = Array.from({ length: 12 }, (_, i) => i + 1);

/** The simulated app under public/phone-frame.png, sized by `--s`. It is a picture, so it takes no focus or clicks. */
function Phone({ label, frame, children }: { label: string; frame: RefObject<HTMLElement | null>; children: ReactNode }) {
  return (
    <figure ref={frame} role="img" aria-label={label} className="phone">
      <span aria-hidden="true" className="phone-shadow" />
      {BODY_LAYERS.map((layer) => (
        <span key={layer} aria-hidden="true" className="phone-body" style={{ "--layer": layer } as CSSProperties} />
      ))}
      <div className="phone-screen" inert>
        {children}
      </div>
      <div aria-hidden="true" className="phone-glare" />
      <div aria-hidden="true" className="phone-frame" />
    </figure>
  );
}

function Simulation({ scene, player }: { scene: SceneId; player: RefObject<PlayerRef | null> }) {
  return (
    <Player
      ref={player}
      component={SCENES[scene].component}
      durationInFrames={SCENES[scene].frames + HOLD_FRAMES}
      compositionWidth={SCREEN_WIDTH}
      compositionHeight={SCREEN_HEIGHT}
      fps={30}
      loop
      numberOfSharedAudioTags={0}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** Below `lg`, each band carries its own phone, which plays while it is on screen. */
export function InlinePhone({ scene, label }: { scene: SceneId; label: string }) {
  const frame = useRef<HTMLElement>(null);
  const { player, seen } = usePlayOnScreen(frame, SCENES[scene].frames - 1, 0.35);
  return (
    <Phone label={label} frame={frame}>
      {seen ? <Simulation scene={scene} player={player} /> : null}
    </Phone>
  );
}

/** On a device with a real pointer, the phone turns to face the cursor, and settles back when the cursor leaves. */
function useFaceCursor(frame: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const phone = frame.current;
    if (phone === null || reduced || !window.matchMedia("(hover: hover)").matches) return;
    let queued = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || queued !== 0) return;
      const { clientX: x, clientY: y } = event;
      queued = requestAnimationFrame(() => {
        queued = 0;
        const box = phone.getBoundingClientRect();
        const { yaw, pitch } = phoneFacing({ x, y }, { x: box.left + box.width / 2, y: box.top + box.height / 2 }, { width: window.innerWidth, height: window.innerHeight });
        phone.style.transform = `rotateY(${yaw}deg) rotateX(${pitch}deg) rotateZ(0deg)`;
        // The band of light slides with the turn and fades as the phone squares up, so it stays off the data being read.
        phone.style.setProperty("--glare-opacity", String((Math.max(Math.abs(yaw), Math.abs(pitch)) / MAX_TILT) * 0.7));
        phone.style.setProperty("--glare-x", `${50 - (yaw / MAX_TILT) * 50}%`);
      });
    };
    const settle = () => {
      cancelAnimationFrame(queued);
      queued = 0;
      phone.style.removeProperty("transform");
      phone.style.removeProperty("--glare-opacity");
      phone.style.removeProperty("--glare-x");
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", settle);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", settle);
      settle();
    };
  }, [frame, reduced]);
}

/** From `lg`, one pinned phone plays the scene of whichever band crosses the middle of the viewport. */
export function PinnedPhone({ steps }: { steps: Array<{ id: SceneId; label: string }> }) {
  const [active, setActive] = useState(0);
  const frame = useRef<HTMLElement>(null);
  const scene = steps[active].id;
  // Hidden below `lg`, so it never counts as on screen there and never plays.
  const { player, seen } = usePlayOnScreen(frame, SCENES[scene].frames - 1, 0.2, scene);
  useFaceCursor(frame);

  useEffect(() => {
    const ids = steps.map((step) => step.id as string);
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
    <Phone label={steps[active].label} frame={frame}>
      {seen ? <Simulation scene={scene} player={player} /> : null}
    </Phone>
  );
}
