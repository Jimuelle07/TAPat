"use client";

// Remotion playback of a step specimen. Only ever imported dynamically from ./Reel.
import { Player } from "@remotion/player";
import { useCurrentFrame } from "remotion";
import { useEffect, useRef } from "react";
import { usePlayOnScreen } from "./Motion";
import { Specimen, SPECIMEN_FPS, SPECIMEN_FRAMES, SPECIMEN_HEIGHT, SPECIMEN_WIDTH, type SpecimenId } from "./Specimens";

function SpecimenScene({ id }: { id: SpecimenId }) {
  return <Specimen id={id} frame={useCurrentFrame()} />;
}

export function ReelPlayer({ id, onReady }: { id: SpecimenId; onReady?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { player, seen } = usePlayOnScreen(box, SPECIMEN_FRAMES - 1, 0.35);

  useEffect(() => {
    if (seen) onReady?.();
  }, [seen, onReady]);

  return (
    <div ref={box} className="h-full w-full">
      {seen ? (
        <Player
          ref={player}
          component={SpecimenScene}
          inputProps={{ id }}
          durationInFrames={SPECIMEN_FRAMES}
          compositionWidth={SPECIMEN_WIDTH}
          compositionHeight={SPECIMEN_HEIGHT}
          fps={SPECIMEN_FPS}
          numberOfSharedAudioTags={0}
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
    </div>
  );
}
