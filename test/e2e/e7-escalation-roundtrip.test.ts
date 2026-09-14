/** Real-daemon admission preserves unresolved ownership without resurrecting a session. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { openSandboxDb, queryEvents, socketEmit } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

function eventPayload(row: { data: string | null }): Record<string, unknown> {
  return JSON.parse(row.data ?? "{}") as Record<string, unknown>;
}

describe("E7: escalation lifecycle roundtrip", () => {
  let sb: Sandbox;

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      cronJson: { may: [] },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test("all resolution outcomes retain visible routing facts when the original owner is missing", async () => {
    const escalationId = `question-${Date.now()}`;
    const since = Date.now();
    await socketEmit(sb.socketPath, "escalation.created", { source: "test", owner: "agent:may",
      data: { escalationId, sourceSessionId: "missing-session", reason: "Need review" } });
    for (const outcome of ["needs_human", "resolved"]) {
      const receipt = await socketEmit(sb.socketPath, "escalation.resolved", { source: "test", owner: "agent:may",
        data: { escalationId, outcome, summary: "Recorded decision" } }) as { type: string };
      expect(receipt.type).toBe("ok");
    }
    const db = openSandboxDb(sb.dbPath);
    try {
      const replies = queryEvents(db, { types: ["escalation.resolved"], since, limit: 10 });
      expect(replies).toHaveLength(2);
      expect(replies.every(row => eventPayload(row).feedbackRoute === "unresolved")).toBe(true);
      expect(replies.every(row => eventPayload(row).escalationId === escalationId)).toBe(true);
      expect(queryEvents(db, { types: ["escalation.resume_attempted", "session.start"], since, limit: 10 })).toEqual([]);
    } finally { db.close(); }
  });
});
