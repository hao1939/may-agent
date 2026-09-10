/**
 * E9 — Session resume after cold (interrupted) end
 *
 * Regression test for the unified resume path: when a session has been
 * persisted with status=interrupted (cold) and a typed session steer arrives
 * for it, the daemon must invoke `manager.resumeSession()` and emit a
 * fresh `session.start` event with the same sessionId.
 *
 * History:
 *   Between v1 and v2, the `manager.resumeInterrupted(sid)` stub was
 *   reduced to `return false`. Unit + integration tests all mocked
 *   `manager` with `{ resumeInterrupted: () => false }`, locking the
 *   broken behavior in as expected. The downstream signal
 *   (`escalation.created` after 3 exhausted attempts) still fired, so
 *   nothing alarmed. This test asserts the resume *primitive* works
 *   end-to-end by publishing a supported session control for a cold session.
 *
 * Flow:
 *   1. Boot sandbox with `may`.
 *   2. Pre-seed disk:
 *        <stateDir>/sessions/<sid>/meta.json (status=interrupted, agent=may)
 *        <stateDir>/sessions/<sid>/session.jsonl with a user turn
 *   3. Publish `session.steer.requested` with sessionId=<sid> and a message.
 *      command-router routes cold sessions to `manager.resumeSession()`.
 *   4. Within a few seconds, assert: a `session.start` event was emitted
 *      with the same sessionId. That means resumeSession was actually
 *      invoked and manager.run produced the start event.
 *
 * What this doesn't cover (out of scope):
 *   - The LLM call that follows session.start. Sandbox has no API
 *     credentials, so the actual model invocation will fail. We only
 *     assert that the resume attempt happened.
 *   - The automatic bounded retry after an interrupted session. This test
 *     covers the resume primitive directly rather than waiting for its
 *     production backoff.
 *
 * Why this test would have caught the original v2 regression:
 *   The legacy `resumeInterrupted` no-op was unreachable from the typed
 *   session-steer route in v2 — that route already used `resumeSession`. But in v1 and
 *   in early v2, only the auto-resume path resumed sessions. By moving
 *   the cold-session steer through `resumeSession`, we get a primitive
 *   test that does not require LLM credentials.
 *
 * No env gating; this test runs in the normal e2e suite.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishEvent } from "../../packages/control/src/client.js";
import { openSandboxDb, pollUntil, queryEvents } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E9: session resume from cold (interrupted) end via typed control", () => {
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

  test(
    "a typed steer onto a cold session invokes resumeSession and emits a fresh session.start",
    async () => {
      // Pre-seed an interrupted session on disk. `resumeSession` requires:
      //  - meta.json present (status=interrupted is fine; only "running"
      //    in _sessions map would be a problem, and we haven't run() it)
      //  - the agent ("may") to be registered
      //  - its recorded folder to match the registered definition
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

      // Minimal JSONL so buildResumeMessages() finds at least one message.
      const userTurn = {
        role: "user",
        content: [{ type: "text", text: "fixture: e9 resume target" }],
        timestamp: startedAt,
      };
      writeFileSync(join(sessionDir, "session.jsonl"), JSON.stringify(userTurn) + "\n");

      const cutoff = Date.now();

      // Publish the typed control used by every current adapter. The command
      // router cold-resumes because the target is not live in manager.status().
      const receipt = await publishEvent(sb.socketPath, {
        type: "session.steer.requested",
        target: { sessionId: sid },
        data: { message: "[e2e-test] please resume" },
        idempotencyKey: `e9-resume-${sid}`,
      });
      expect(receipt).toMatchObject({ eventType: "session.steer.requested", delivery: "accepted" });

      const db = openSandboxDb(sb.dbPath);
      try {
        let matched;
        try {
          matched = await pollUntil(
            () => {
              const rows = queryEvents(db, {
                types: ["session.start"],
                since: cutoff,
                limit: 100,
              });
              for (const row of rows) {
                if (!row.data) continue;
                try {
                  const data = JSON.parse(row.data) as { sessionId?: string };
                  if (data.sessionId === sid) return row;
                } catch {
                  // ignore malformed rows
                }
              }
              return null;
            },
            {
              timeoutMs: 15_000,
              intervalMs: 200,
              description: `session.start event with sessionId=${sid}`,
            },
          );
        } catch (err) {
          // On timeout, dump the daemon log tail and recent events to make
          // the failure mode obvious.
          console.error("=== daemon log (tail) ===\n" + sb.getLogs().split("\n").slice(-80).join("\n"));
          const allEvents = queryEvents(db, { since: cutoff, limit: 200 });
          console.error(`=== events since cutoff (${allEvents.length}) ===\n` + allEvents.map((e) => `${e.event_type} src=${e.source} owner=${e.owner} data=${(e.data ?? "").slice(0, 200)}`).join("\n"));
          throw err;
        }

        // Source should reflect that the run came from a resume path, not
        // a brand-new top-level invocation.
        expect(matched.source).toBe("control-socket");
      } finally {
        db.close();
      }
    },
    30_000,
  );
});
