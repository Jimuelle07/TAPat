import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

const ORIGIN = "http://localhost:3000";

describe("safeNextPath", () => {
  it("falls back to / for missing or empty", () => {
    expect(safeNextPath(null, ORIGIN)).toBe("/");
    expect(safeNextPath("", ORIGIN)).toBe("/");
  });

  it("keeps same-origin paths with query", () => {
    expect(safeNextPath("/demo?x=1", ORIGIN)).toBe("/demo?x=1");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "/.//evil.com", "/..//evil.com"])(
    "collapses %s to /",
    (next) => {
      expect(safeNextPath(next, ORIGIN)).toBe("/");
    },
  );
});
