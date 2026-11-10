import { describe, expect, it } from "vitest";
import { MAX_TILT, phoneFacing } from "./phone-facing";

const PHONE = { x: 1000, y: 450 };
const VIEW = { width: 1440, height: 900 };

describe("phoneFacing", () => {
  it("looks straight ahead when the cursor is on the phone", () => {
    expect(phoneFacing(PHONE, PHONE, VIEW)).toEqual({ yaw: 0, pitch: -0 });
  });

  it("reaches full tilt at each edge of the window", () => {
    expect(phoneFacing({ x: 1440, y: 450 }, PHONE, VIEW).yaw).toBe(MAX_TILT);
    expect(phoneFacing({ x: 0, y: 450 }, PHONE, VIEW).yaw).toBe(-MAX_TILT);
    expect(phoneFacing({ x: 1000, y: 0 }, PHONE, VIEW).pitch).toBe(MAX_TILT);
    expect(phoneFacing({ x: 1000, y: 900 }, PHONE, VIEW).pitch).toBe(-MAX_TILT);
  });

  it("never goes past the limit", () => {
    const { yaw, pitch } = phoneFacing({ x: 5000, y: -5000 }, PHONE, VIEW);
    expect(yaw).toBe(MAX_TILT);
    expect(pitch).toBe(MAX_TILT);
  });
});
