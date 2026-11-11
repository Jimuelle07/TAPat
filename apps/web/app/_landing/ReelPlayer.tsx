"use client";

// Remotion playback of a step specimen. Only ever imported dynamically from ./Reel.
import { Player, type PlayerRef } from "@remotion/player";
import { useCurrentFrame } from "remotion";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "../(app)/_components/motion";
import { Specimen, SPECIMEN_FPS, SPECIMEN_FRAMES, SPECIMEN_HEIGHT, SPECIMEN_WIDTH, type SpecimenId } from "./Specimens";

/** Plays the Player from the start each time `target` comes on screen, and pauses it off screen. Under reduced motion it shows `stillFrame`. */
function usePlayOnScreen(target: RefObject<Element | null>, stillFrame: number, threshold: number) {
  const player = useRef<PlayerRef>(null);
  const [seen, setSeen] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = target.current;
    if (element === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, threshold]);

  useEffect(() => {
    const current = player.current;
    if (current === null) return;
    if (reduced) {
      current.seekTo(stillFrame);
    } else if (onScreen) {
      current.seekTo(0);
      current.play();
    } else {
      current.pause();
    }
  }, [onScreen, reduced, stillFrame]);

  return { player, seen };
}

function SpecimenScene({ id }: { id: SpecimenId }) {
  return <Specimen id={id} frame={useCurrentFrame()} />;
}

export function ReelPlayer({ id, onReady }: { id: SpecimenId; onReady?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { player, seen } = usePlayOnScreen(box, SPECIMEN_FRAMES - 1, 0.35);

  useEffect(() => {
    if (seen) onReady?.();
  }, [seen, onReady]);

  // Parts of an artifact outside the drawing (the list's tally) animate from this frame number in CSS.
  useEffect(() => {
    const current = player.current;
    // Set on the tally itself: on the artifact it would restyle everything inside it, on every frame of all six cards.
    const tally = box.current?.closest(".step-art")?.querySelector<HTMLElement>(".step-ledger-tally");
    if (!current || !tally) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => tally.style.setProperty("--reel-frame", String(detail.frame));
    current.addEventListener("frameupdate", onFrame);
    return () => current.removeEventListener("frameupdate", onFrame);
  }, [player]);

  return (
    <div ref={box} className="h-full w-full">
      {/* Mounted as soon as this component is, ahead of the card: it stays paused until the card is on screen. */}
      <Player
        ref={player}
        component={SpecimenScene}
        inputProps={{ id }}
        durationInFrames={SPECIMEN_FRAMES}
        compositionWidth={SPECIMEN_WIDTH}
        compositionHeight={SPECIMEN_HEIGHT}
        fps={SPECIMEN_FPS}
        // Silent reels. Unmuted, playback waits for the AudioContext to start, which browsers block until the visitor
        // clicks or presses a key (scrolling doesn't count), so the reels would sit frozen on their first frame.
        initiallyMuted
        loop
        numberOfSharedAudioTags={0}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
