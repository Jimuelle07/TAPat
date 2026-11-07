"use client";

// The page's own motion: each band's abstract art (./art) plays in Remotion while the band is on screen.
import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "../(app)/_components/motion";
import { Art, ART_SETTLED, Corner, type ArtId } from "./art";

const FPS = 30;
// Long enough that the idle motion's loop point is never noticed.
const ART_FRAMES = 5 * 60 * FPS;
const CORNER_FRAMES = 60;
const CORNER_SIZE = 240;

/**
 * Plays a Player from the start each time `target` comes on screen, and pauses it off screen. Players mount on first
 * sight, so the prerendered page holds none of them. Under reduced motion it shows `stillFrame` instead.
 */
export function usePlayOnScreen(target: RefObject<Element | null>, stillFrame: number, threshold = 0.2, restart?: unknown) {
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
  }, [seen, onScreen, reduced, stillFrame, restart]);

  return { player, seen };
}

function CornerPlayer({ art, box }: { art: ArtId; box: RefObject<Element | null> }) {
  const { player, seen } = usePlayOnScreen(box, CORNER_FRAMES - 1);
  if (!seen) return null;
  return (
    <Player
      ref={player}
      component={Corner}
      inputProps={{ art }}
      durationInFrames={CORNER_FRAMES}
      compositionWidth={CORNER_SIZE}
      compositionHeight={CORNER_SIZE}
      fps={FPS}
      numberOfSharedAudioTags={0}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** A band's art: the main piece on the right, its motif in the top corner, and a quieter echo bottom left on desktop. */
export function BandMotion({ art, motif }: { art: ArtId; motif: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const { player, seen } = usePlayOnScreen(box, ART_SETTLED);
  return (
    <>
      <span ref={box} aria-hidden="true" className="band-arc">
        {seen ? (
          <Player
            ref={player}
            component={Art}
            inputProps={{ art }}
            durationInFrames={ART_FRAMES}
            compositionWidth={1000}
            compositionHeight={1000}
            fps={FPS}
            loop
            numberOfSharedAudioTags={0}
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}
      </span>
      <span aria-hidden="true" className={`absolute top-0 right-0 size-30 lg:size-60 ${motif}`}>
        <CornerPlayer art={art} box={box} />
      </span>
      <span aria-hidden="true" className={`absolute bottom-0 left-0 hidden size-60 rotate-180 opacity-50 lg:block ${motif}`}>
        <CornerPlayer art={art} box={box} />
      </span>
    </>
  );
}
