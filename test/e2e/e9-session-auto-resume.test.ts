import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishEvent } from "../../packages/control/src/client.js";
import { openSandboxDb, queryEvents } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E9: ended session controls preserve evidence", () => {
  let sb: Sandbox;

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "rejects a cold steer without reviving the session",
    async () => {
      const sid = `s_e9_${Date.now()}`;
      const sessionDir = join(sb.stateDir, "sessions", sid);
      mkdirSync(sessionDir, { recursive: true });
      const startedAt = Date.now() - 5_000;
      const meta = {
        agent: "may",
        agentRelativeDir: "agents/may",
        task: "fixture: e9 resume target",
        status: "interrupted",
        startedAt,
        endedAt: Date.now() - 1_000,
        error: "synthetic cold-session seed",
        kind: "job",
        autoClose: "immediate",
        opCount: 1,
        source: "e2e-seed",
      };
      writeFileSync(join(sessionDir, "meta.json"), JSON.stringify(meta, null, 2));

      // Retained transcript remains unchanged after rejected control.
      const userTurn = {
        role: "user",
        content: [{ type: "text", text: "fixture: e9 resume target" }],
        timestamp: startedAt,
      };
      writeFileSync(join(sessionDir, "session.jsonl"), JSON.stringify(userTurn) + "\n");

      const transcript = readFileSync(join(sessionDir, "session.jsonl"), "utf8");
      const receipt = await publishEvent(sb.socketPath, {
        type: "session.steer.requested", target: { sessionId: sid },
        data: { message: "Please continue" }, idempotencyKey: `e9-cold-${sid}`,
      });
      expect(receipt.delivery).toBe("recorded");
      const db = openSandboxDb(sb.dbPath);
      try {
        expect(queryEvents(db, { types: ["session.start"], limit: 100 })
          .filter(row => JSON.parse(row.data ?? "{}").sessionId === sid)).toEqual([]);
        expect(readFileSync(join(sessionDir, "session.jsonl"), "utf8")).toBe(transcript);
      } finally { db.close(); }
    },
    30_000,
  );
});
