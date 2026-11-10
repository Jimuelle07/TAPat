import { createScene, type Scene } from "./build";
import type { Copy } from "./model";
import { baseParts } from "./parts-base";
import { cardParts } from "./parts-cards";
import { drumParts } from "./parts-drum";
import { govParts, REST_POSE, type Pose } from "./parts-gov";
import { readerParts } from "./parts-reader";
import { returnParts } from "./parts-return";

export function buildScene(copy: Copy, pose: Pose = REST_POSE, order?: string[]): Scene {
  const scene = createScene(order);
  baseParts(scene);
  drumParts(scene);
  govParts(scene, pose);
  cardParts(scene, pose.gate);
  readerParts(scene, copy);
  returnParts(scene, copy);
  return scene;
}
