/**
 * E6 — Agent call chain (plumbing-only variant, no LLM)
 *
 * Validates that when a handler invokes `ctx.sdk.runAgent(target, task)`:
 *
 *   1. A new `sessions` row is created for the target agent.
 *   2. The row has `kind="call"` and `source="callAgent"` reflecting the
 *      handler-invoked call chain.
 *   3. The handler observes the call's completion via
 *      `e2e.call-worker.completed` (or `.error`) event.
 *
 * What this doesn't cover:
 *   - Workflow-step driven runAgent (workflow steps run inside a session,
 *     so they DO produce a parentSessionId link — separate test scope).
 *   - Actual LLM exchange between agents (requires E2E_LIVE_LLM and creds).
 *   - Call depth enforcement (covered by manager unit tests).
 *
 * Behavioral note: handler-driven calls have `parentSessionId = NULL` because
 * the caller (handler) is not itself a session — it runs in cron context.
 * Workflow- or session-driven runAgent calls would populate parentSessionId.
 *
 * Validates documented behavior of:
 *   - sdk-quickstart.md § sdk.runAgent
 *   - agents.md § Agent call chain
 *
 * Gated behind E2E_LIVE=1; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { openSandboxDb, pollUntil, queryEvents, querySessions } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E6: agent call chain", () => {
  let sb: Sandbox;

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may", "worker"],
      fixtureHandlers: { may: ["e2e-call-worker"] },
      cronJson: {
        may: [
          {
            name: "e2e-call-worker",
            handler: "e2e-call-worker",
            intervalMs: 10000,
            agent: "may",
            enabled: true,
          },
        ],
        worker: [],
      },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "handler-initiated runAgent creates a child session and emits completion event",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        // 1. Wait for a worker session row with kind=call + source=callAgent.
        const sessions = await pollUntil(
          () => {
            const ws = querySessions(db, { agents: ["worker"], limit: 20 });
            const callRows = ws.filter((s) => s.kind === "call" && s.source === "callAgent");
            return callRows.length >= 1 ? callRows : null;
          },
          {
            timeoutMs: 30_000,
            intervalMs: 250,
            description: "worker session with kind=call + source=callAgent",
          },
        );

        const child = sessions[0];
        expect(child.agent).toBe("worker");
        expect(child.kind).toBe("call");
        expect(child.source).toBe("callAgent");
        expect(typeof child.sessionId).toBe("string");
        expect(child.sessionId.length).toBeGreaterThan(0);
        expect(typeof child.task).toBe("string");
        expect(child.task).toContain("fixture call chain ping");

        // 2. Confirm the handler observed completion (or error).
        const events = await pollUntil(
          () => {
            const rows = queryEvents(db, {
              types: ["e2e.call-worker.completed", "e2e.call-worker.error"],
              limit: 5,
            });
            return rows.length >= 1 ? rows : null;
          },
          {
            timeoutMs: 30_000,
            intervalMs: 500,
            description: "e2e.call-worker.completed or .error event",
          },
        );

        const evt = events[0];
        expect(["e2e.call-worker.completed", "e2e.call-worker.error"]).toContain(evt.event_type);
        // Note: parentSessionId is null for handler-driven calls (handlers are
        // not sessions). This is the documented semantic — see the comment
        // block at the top of this file.
      } finally {
        db.close();
      }
    },
    60_000 + 30_000,
  );
});
