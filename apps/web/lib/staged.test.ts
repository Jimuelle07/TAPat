import { afterEach, describe, expect, it, vi } from "vitest";
import { withMinDuration } from "./staged";

afterEach(() => {
  vi.useRealTimers();
});

describe("withMinDuration", () => {
  it("does not resolve before the minimum has passed", async () => {
    vi.useFakeTimers();
    let settled = false;
    const result = withMinDuration(Promise.resolve("ok"), 1000).then((value) => {
      settled = true;
      return value;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe("ok");
  });

  it("waits for slow work past the minimum", async () => {
    vi.useFakeTimers();
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(7), 3000));
    const result = withMinDuration(slow, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBe(7);
  });

  it("rejects with the work's error, also only after the minimum", async () => {
    vi.useFakeTimers();
    const failure = new Error("boom");
    let settled = false;
    const result = withMinDuration(Promise.reject(failure), 1000);
    const caught = result.catch((error: unknown) => {
      settled = true;
      return error;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await caught).toBe(failure);
  });
});
