import { describe, expect, it } from "bun:test";
import type { ObserverContext } from "@may-agent/sdk";
import type { XhsCredentialStatus } from "../agents/scout/tools/lib/xhs-credential";
import { observeXhsCredential, xhsCredentialEvents } from "./xhs-credential";

describe("XHS credential watcher", () => {
  it("uses only publication-confirmed memory and repeats after a fresh runtime", async () => {
    const ctx = { workspace: { appRoot: "/unused" } } as ObserverContext;
    const ready: XhsCredentialStatus = {
      credential: "xhs",
      state: "ready",
      reason: "fixture ready",
      evidence: [],
    };
    const unavailable: XhsCredentialStatus = { ...ready, state: "unavailable" };
    const first = await observeXhsCredential(ctx, async () => unavailable);
    expect(first.events).toMatchObject([{ data: { state: "unavailable" } }]);
    // Failed publication leaves the same context; the next scan returns it again.
    expect(await observeXhsCredential(ctx, async () => unavailable)).toEqual(
      first,
    );
    const published = { ...ctx, previousObservation: first.nextObservation };
    expect(
      (await observeXhsCredential(published, async () => unavailable)).events,
    ).toEqual([]);
    expect(
      (await observeXhsCredential(published, async () => ready)).events,
    ).toMatchObject([{ data: { state: "ready" } }]);
    expect(await observeXhsCredential(ctx, async () => unavailable)).toEqual(
      first,
    );
  });

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

  it("publishes one unavailable transition for source-task observation", () => {
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
