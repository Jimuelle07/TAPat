import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@tapat/shared";
import { checkSession } from "./auth-retry";

const USER = { id: "u1", email: "officer@tapat.demo", role: "officer" } as unknown as AuthUser;
const noSleep = () => Promise.resolve();

describe("checkSession", () => {
  it("treats an authoritative null user as logged out, without retrying", async () => {
    const fetchMe = vi.fn().mockResolvedValue({ user: null });
    expect(await checkSession(fetchMe, { sleep: noSleep })).toEqual({ kind: "anonymous" });
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it("returns the user when transient errors are followed by success", async () => {
    const fetchMe = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("502"))
      .mockResolvedValue({ user: USER });
    const sleep = vi.fn(noSleep);
    expect(await checkSession(fetchMe, { sleep })).toEqual({ kind: "user", user: USER });
    expect(fetchMe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("reports unreachable, not logged out, when every attempt fails", async () => {
    const fetchMe = vi.fn().mockRejectedValue(new Error("down"));
    expect(await checkSession(fetchMe, { attempts: 3, sleep: noSleep })).toEqual({ kind: "unreachable" });
    expect(fetchMe).toHaveBeenCalledTimes(3);
  });

  it("an authoritative null after transient errors is still logged out", async () => {
    const fetchMe = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue({ user: null });
    expect(await checkSession(fetchMe, { sleep: noSleep })).toEqual({ kind: "anonymous" });
  });

  it("stops retrying once cancelled", async () => {
    const fetchMe = vi.fn().mockRejectedValue(new Error("down"));
    expect(await checkSession(fetchMe, { sleep: noSleep, cancelled: () => true })).toEqual({ kind: "unreachable" });
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });
});
