import { describe, expect, it } from "bun:test";
import { createXhsCredentialObserver } from "./xhs-credential";

describe("XHS credential observation", () => {
  it("returns provider evidence through the common resource contract", async () => {
    const status = {
      credential: "xhs" as const,
      state: "unavailable" as const,
      reason: "Login required",
      evidence: ["login-wall:true"],
      loginWall: true,
    };
    const signal = new AbortController().signal;
    const calls: unknown[] = [];
    const observer = createXhsCredentialObserver("/fixture/scout.app", async (...args) => {
      calls.push(args);
      return status;
    });
    expect(await observer.inspect("xhs", { signal })).toEqual(status);
    expect(calls).toEqual([["/fixture/scout.app", signal]]);
    await expect(observer.inspect("other", { signal })).rejects.toThrow("Unknown XHS");
    await expect(observer.inspect("xhs", { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});
