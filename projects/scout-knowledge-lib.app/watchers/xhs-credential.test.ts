import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ObserverContext } from "@may-agent/sdk";
import type { XhsCredentialStatus } from "../agents/scout/tools/lib/xhs-credential";
import { observeXhsCredential, xhsCredentialEvents } from "./xhs-credential";

describe("XHS credential watcher", () => {
  it("discards an older result without overwriting newer cached evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-watcher-"));
    const ctx = { workspace: { appRoot: root } } as ObserverContext;
    const older = Promise.withResolvers<XhsCredentialStatus>();
    const newer = Promise.withResolvers<XhsCredentialStatus>();
    const ready: XhsCredentialStatus = {
      credential: "xhs",
      state: "ready",
      reason: "fixture ready",
      evidence: [],
    };
    const unavailable: XhsCredentialStatus = { ...ready, state: "unavailable" };
    try {
      const oldModule = await import(
        `./xhs-credential.ts?fixture=${Date.now()}`
      );
      const oldRun = oldModule.observeXhsCredential(ctx, () => older.promise);
      const newRun = observeXhsCredential(ctx, () => newer.promise);
      newer.resolve(unavailable);
      expect(await newRun).toMatchObject([{ data: { state: "unavailable" } }]);
      const statePath = join(root, ".state/watchers/xhs-credential.json");
      const saved = readFileSync(statePath, "utf8");
      older.resolve(ready);
      expect(await oldRun).toEqual([]);
      expect(readFileSync(statePath, "utf8")).toBe(saved);
      expect(await observeXhsCredential(ctx, async () => unavailable)).toEqual(
        [],
      );
      expect(await observeXhsCredential(ctx, async () => ready)).toMatchObject([
        { data: { state: "ready" } },
      ]);
    } finally {
      older.resolve(unavailable);
      newer.resolve(unavailable);
      rmSync(root, { recursive: true, force: true });
    }
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
