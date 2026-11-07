import { describe, expect, it } from "vitest";
import { MAX_TILT, phoneFacing } from "./phone-facing";

const PHONE = { x: 1000, y: 450 };
const VIEW = { width: 1440, height: 900 };

describe("phoneFacing", () => {
  it("looks straight ahead when the cursor is on the phone", () => {
    expect(phoneFacing(PHONE, PHONE, VIEW)).toEqual({ yaw: 0, pitch: -0 });
  });

  it("turns furthest to the left, where the cursor usually is", () => {
    const left = phoneFacing({ x: 0, y: 450 }, PHONE, VIEW).yaw;
    const right = phoneFacing({ x: 1440, y: 450 }, PHONE, VIEW).yaw;
    expect(left).toBe(-28);
    expect(right).toBe(16);
    expect(Math.abs(left)).toBeGreaterThan(Math.abs(right));
  });

  it("is already well turned with the cursor over the page's text", () => {
    expect(phoneFacing({ x: 300, y: 450 }, PHONE, VIEW).yaw).toBeLessThan(-20);
  });

  it("tilts up and down", () => {
    expect(phoneFacing({ x: 1000, y: 0 }, PHONE, VIEW).pitch).toBe(18);
    expect(phoneFacing({ x: 1000, y: 900 }, PHONE, VIEW).pitch).toBe(-18);
  });

  it("never goes past the limit", () => {
    const { yaw, pitch } = phoneFacing({ x: -5000, y: -5000 }, PHONE, VIEW);
    expect(Math.abs(yaw)).toBeLessThanOrEqual(MAX_TILT);
    expect(pitch).toBe(18);
  });
});
