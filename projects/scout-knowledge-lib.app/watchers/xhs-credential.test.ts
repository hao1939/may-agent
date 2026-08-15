import { describe, expect, it } from "bun:test";
import { xhsCredentialEvents } from "./xhs-credential";

describe("XHS credential watcher", () => {
  it("replays the current credential level for exact Conditions", () => {
    expect(
      xhsCredentialEvents({
        credential: "xhs",
        state: "ready",
        reason: "ready",
        evidence: ["note-count:12"],
      }),
    ).toMatchObject([
      {
        type: "credential.state",
        data: { credential: "xhs", state: "ready" },
      },
    ]);
  });

  it("publishes one unavailable transition for the App owner route", () => {
    const status = {
      credential: "xhs" as const,
      state: "unavailable" as const,
      reason: "login required",
      evidence: ["login-wall:true"],
    };
    expect(xhsCredentialEvents(status, { state: "ready" })).toMatchObject([
      { type: "credential.state", data: { state: "unavailable" } },
    ]);
    expect(xhsCredentialEvents(status, { state: "unavailable" })).toEqual([]);
  });
});
