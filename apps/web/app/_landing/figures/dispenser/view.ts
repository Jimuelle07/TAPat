import { fitProjection, iso, type Flat, type Plan, type Point3, type Projection } from "../../iso/iso-kit";
import { chordOf, CATCH_U, GATE_LIFT, LEVER_L, WEIGHT_U } from "./kin";

// World: x runs left to right along the cabinet front, y runs back to front (+y faces the viewer), z is up. 1 unit is about 1 mm of the real cabinet.
export const WIDTH = 640;
export const HEIGHT = 300;
export const AZIMUTH = 66;
export const ELEVATION = 26;

export const PLINTH: Plan = { x: -172, y: -44, w: 396, d: 88, r: 3 };
export const PLINTH_H = 6;
export const DECK: Plan = { x: -160, y: -36, w: 320, d: 72, r: 2 };
export const DECK_Z = PLINTH_H;
export const DECK_H = 8;
export const FLOOR = DECK_Z + DECK_H; // 14
export const WALL_TOP = 88;
export const ROOF_H = 5;
export const BACK_Y = -32; // front face of the back wall

// Price drum: four number wheels on an axis along x.
export const WHEEL_X = -148;
export const WHEEL_W = 9.5;
export const WHEEL_R = 12;
export const WHEEL_Y = 8;
export const WHEEL_Z = 40;
export const INDEX_PER_PESO = 3;
export const PRICE_FIRST = 63.84;
export const PRICE_LAST = 67.65;
export const INDEX_RISE = (PRICE_LAST - PRICE_FIRST) * INDEX_PER_PESO;

// Card reader: a rail along the console front, scale 0.08 rail units per peso, the mechanical stop at the 500 mark.
export const SLIDE_RATE = 0.08;
export const STOP_PESO = 500;
export const ASK_MAX = 800;
export const RAIL_X0 = 80; // ruler position of zero pesos
export const HEAD_W = 6;
export const HEAD_Z = 58;
export const askX = (peso: number) => RAIL_X0 + SLIDE_RATE * peso; // centre of the ask flag or the plunger head

// Return chute: a wedge ramp on the deck from the card rack to the lockbox; its floor falls CHUTE_Z0 -> CHUTE_Z1.
export const CHUTE_X0 = 64;
export const CHUTE_X1 = 166;
export const CHUTE_Z0 = 24;
export const CHUTE_Z1 = 16;
export const CHUTE_Y0 = -10;
export const CHUTE_Y1 = -2;
export const chuteZ = (x: number) => CHUTE_Z0 + ((CHUTE_Z1 - CHUTE_Z0) * (x - CHUTE_X0)) / (CHUTE_X1 - CHUTE_X0);

// Card cartridges on the collector rack: each is a sight window whose level is that card balance.
export const CARD_X = [-6, 18, 42]; // left edge of each card
export const CARD_W = 18;
export const CARD_Z0 = 30;
export const CARD_H = 28;
export const CARD_Y0 = -10;
export const LIQ_Z0 = 32;
export const LIQ_H = 21;
export const LIQ_Y: [number, number] = [-9.4, -8.2];
export const LIQ_MIN = 0.3;
export const MANIFOLD_Z = 62;

// The LGU lockbox and its level gauge (full scale is the funded 4,500).
export const BOX_X = 166;
export const BOX_Y = -20;
export const BOX_W = 44;
export const BOX_D = 40;
export const BOX_Z = 6;
export const BOX_H = 44;
export const LIQ_BOX_Z0 = 11;
export const LIQ_BOX_H = 15;
export const LIQ_BOX_X: [number, number] = [173, 203];
export const LIQ_BOX_Y: [number, number] = [20.8, 22];

export const PIECES: Record<string, Point3> = {
  index: [0, 0, INDEX_RISE],
  ask: [ASK_MAX * SLIDE_RATE, 0, 0],
  plunger: [STOP_PESO * SLIDE_RATE, 0, 0],
  gate: [0, 0, GATE_LIFT],
  weight: chordOf(WEIGHT_U),
  tip: chordOf(LEVER_L),
  catch: chordOf(CATCH_U),
};

// The order pieces leave home in the audit's replay: whatever is outside goes first.
export const PIECE_ORDER = ["ask", "plunger", "index", "weight", "tip", "catch", "gate"];
export const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

function boxPoints(plan: Plan, z0: number, z1: number): Point3[] {
  const out: Point3[] = [];
  for (const x of [plan.x, plan.x + plan.w]) for (const y of [plan.y, plan.y + plan.d]) for (const z of [z0, z1]) out.push([x, y, z]);
  return out;
}



export const P: Projection = fitProjection([...boxPoints(PLINTH, 0, 0), ...boxPoints({ x: -166, y: -42, w: 332, d: 84, r: 0 }, WALL_TOP, WALL_TOP + ROOF_H)], WIDTH, HEIGHT, {
  pad: 2,
  azimuth: AZIMUTH,
  elevation: ELEVATION,
});

export const at = (point: Point3): Flat => iso(point, P);
