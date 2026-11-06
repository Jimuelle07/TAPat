import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

const ORIGIN = "http://localhost:3000";

describe("safeNextPath", () => {
  it("falls back to the dashboard for missing or empty", () => {
    expect(safeNextPath(null, ORIGIN)).toBe("/dashboard");
    expect(safeNextPath("", ORIGIN)).toBe("/dashboard");
  });

  it("keeps same-origin paths with query", () => {
    expect(safeNextPath("/demo?x=1", ORIGIN)).toBe("/demo?x=1");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "/.//evil.com", "/..//evil.com"])(
    "collapses %s to the dashboard",
    (next) => {
      expect(safeNextPath(next, ORIGIN)).toBe("/dashboard");
    },
  );
});
