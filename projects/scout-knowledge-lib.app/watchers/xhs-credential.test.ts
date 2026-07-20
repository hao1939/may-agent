import { describe, expect, it } from "bun:test";
import { xhsCredentialEvents } from "./xhs-credential";

describe("XHS credential watcher", () => {
  it("replays a semantic ready observation for exact Conditions", () => {
    expect(
      xhsCredentialEvents({
        credential: "xhs",
        state: "ready",
        reason: "ready",
        evidence: ["note-count:12"],
      }),
    ).toMatchObject([
      {
        type: "credential.ready",
        credential: "xhs",
        state: "ready",
      },
    ]);
  });

  it("notifies the human once when credentials become unavailable", () => {
    const status = {
      credential: "xhs" as const,
      state: "unavailable" as const,
      reason: "login required",
      evidence: ["login-wall:true"],
    };
    expect(xhsCredentialEvents(status, { state: "ready" })).toMatchObject([
      { type: "message.created", to: "human" },
    ]);
    expect(xhsCredentialEvents(status, { state: "unavailable" })).toEqual([]);
  });
});
