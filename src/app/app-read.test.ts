import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { claimAppInboxItem, completeAppInboxClaim, createAppInboxItem } from "./app-inbox-store.js";
import { createRuntimeAppRead } from "./app-read.js";

describe("App read projections", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });

  afterEach(() => db.close());

  it("returns only the authored result for a completed inbox item", async () => {
    createAppInboxItem(db, {
      id: "app_read_result",
      appId: "evaluation-canary",
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { prompt: "test" } },
      now: 100,
    });
    const claim = claimAppInboxItem(db, "app_read_result", "host-1", 1_000, 100);
    expect(claim).not.toBeNull();
    completeAppInboxClaim(db, claim!, { summary: "probe complete", response: "ok", evidence: ["canary"] }, 200);
    const read = createRuntimeAppRead({
      getDb: () => db,
      metrics: {
        get: () => null,
      } as any,
    });

    await expect(read.appResult("app_read_result")).resolves.toEqual({
      summary: "probe complete",
      response: "ok",
      evidence: ["canary"],
    });
    await expect(read.appResult("missing")).resolves.toBeNull();
  });
});
