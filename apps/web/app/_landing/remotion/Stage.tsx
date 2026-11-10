"use client";

import type { Player as PlayerValue, PlayerRef, Thumbnail as ThumbnailValue } from "@remotion/player";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../useReducedMotion";
import type { AgentProps } from "./agentMeta";

interface RemotionModules {
  Player: typeof PlayerValue;
  Thumbnail: typeof ThumbnailValue;
  Composition: ComponentType<AgentProps>;
}

// Module-level cache so remounts do not flash the empty box again.
let remotionModules: RemotionModules | null = null;

/** Start loading remotion when the box is within ~1.5 viewports, so the poster is ready on arrival. */
const LOAD_MARGIN = "150% 0px";

export function RemotionStage({
  inputProps,
  durationInFrames,
  fps,
  compositionWidth,
  compositionHeight,
  stillFrame,
  loop = true,
  onEnded,
  paused = false,
  className,
  label,
  children,
}: {
  inputProps: AgentProps;
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  stillFrame: number;
  loop?: boolean;
  onEnded?: () => void;
  /** Hold the current frame, whatever the viewport says (the card's explanation is open). */
  paused?: boolean;
  className?: string;
  label: string;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [mods, setMods] = useState<RemotionModules | null>(remotionModules);
  const boxRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  });

  // Client-only lazy load of remotion (Player, Thumbnail and the composition), only once the box nears the
  // viewport. Thumbnail reads Date.now(), so never SSR it.
  useEffect(() => {
    const box = boxRef.current;
    if (remotionModules || !box) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void Promise.all([import("@remotion/player"), import("./AgentComposition")]).then(([p, c]) => {
          remotionModules = { Player: p.Player, Thumbnail: p.Thumbnail, Composition: c.AgentComposition };
          if (!cancelled) setMods(remotionModules);
        });
      },
      { rootMargin: LOAD_MARGIN },
    );
    io.observe(box);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  // Restart from frame 0 when the input props change.
  const propsKey = useMemo(() => {
    try {
      return JSON.stringify(inputProps);
    } catch {
      return "";
    }
  }, [inputProps]);

  // Pause when off-screen, the tab is hidden or the caller holds the frame; resume otherwise.
  const showPlayer = !reduced && mods !== null;
  useEffect(() => {
    const box = boxRef.current;
    if (!showPlayer || !box) return;
    let visible = false;
    if (paused) playerRef.current?.pause();
    const sync = () => {
      const p = playerRef.current;
      if (!p) return;
      if (visible && !document.hidden && !paused) p.play();
      else p.pause();
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible = e.isIntersecting;
      sync();
    });
    io.observe(box);
    document.addEventListener("visibilitychange", sync);
    const p = playerRef.current;
    const ended = () => onEndedRef.current?.();
    p?.addEventListener("ended", ended);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      p?.removeEventListener("ended", ended);
    };
  }, [showPlayer, propsKey, paused]);

  const common = {
    inputProps,
    durationInFrames,
    fps,
    compositionWidth,
    compositionHeight,
    style: { width: "100%", height: "100%" },
  } as const;

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={label}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${compositionWidth} / ${compositionHeight}`,
        overflow: "hidden",
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        {mods === null ? (
          <div
            className="motion-safe:animate-pulse"
            style={{
              position: "absolute",
              left: "14%",
              right: "14%",
              top: "56%",
              height: "20%",
              borderRadius: 6,
              border: "1px solid rgba(27, 46, 40, 0.2)",
              background: "rgba(27, 46, 40, 0.06)",
              transform: "skewX(-35deg)",
            }}
          />
        ) : showPlayer ? (
          <mods.Player
            component={mods.Composition}
            key={propsKey}
            ref={playerRef}
            {...common}
            autoPlay
            loop={loop}
            initiallyMuted
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
          />
        ) : (
          <mods.Thumbnail component={mods.Composition} {...common} frameToDisplay={stillFrame} />
        )}
      </div>
      {children}
    </div>
  );
}
