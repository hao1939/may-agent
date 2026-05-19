/**
 * E7 — Escalation roundtrip (plumbing-only variant)
 *
 * Validates that the escalation lifecycle subscriber processes
 * escalation.resolved events correctly:
 *
 *   1. emit escalation.created (with escalationId + sourceSessionId)
 *   2. emit escalation.resolved (matching escalationId)
 *   3. subscriber finds the original, attempts to resume
 *   4. emits escalation.resume_attempted, then resume_failed
 *      (because the source session id is synthetic — no real session
 *      to resume)
 *
 * This proves: event persistence, lookup-by-escalationId via json_extract,
 * outcome handling, source-session resolution from escalation.created data,
 * resume attempt emission. The "session actually resumes and runs to
 * completion" assertion requires a real LLM-driven fixture session and is
 * deferred to an E7-full variant (currently not implemented).
 *
 * Also covers the `needs_human` short-circuit: resolving with
 * outcome=needs_human does NOT attempt resume of the source session
 * (the parent stays blocked until the human child escalation resolves).
 *
 * Validates documented behavior of:
 *   - sdk-quickstart.md § External Escalate
 *   - escalation.md (lifecycle semantics)
 *   - user-guide.md § Events in Practice (escalation.resolved)
 *
 * Runs by default; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  openSandboxDb,
  pollUntil,
  queryEvents,
  socketEmit,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E7: escalation lifecycle roundtrip", () => {
  let sb: Sandbox;

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      // No handlers / workflows needed — the escalation subscriber is
      // wired automatically in daemon-events.ts.
      cronJson: { may: [] },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "resolved → resume_attempted → resume_failed (no real session to resume)",
    async () => {
      const escalationId = `e2e-${Date.now()}-resolved`;
      const sourceSessionId = `e2e-fake-session-${Date.now()}`;
      const t0 = Date.now();

      // ── 1. Emit escalation.created ───────────────────────────────────
      const createdResp = (await socketEmit(sb.socketPath, "escalation.created", {
        source: "e2e-test",
        owner: "agent:may",
        data: {
          escalationId,
          reason: "e2e test escalation",
          sourceSessionId,
          requestedAction: "test resume",
        },
      })) as { type?: string };
      expect(createdResp.type).toBe("ok");

      // ── 2. Wait for the event to land in the DB ──────────────────────
      const db = openSandboxDb(sb.dbPath);
      try {
        await pollUntil(
          () => {
            const rows = queryEvents(db, { types: ["escalation.created"], since: t0, limit: 5 })
              .filter((e) => (e.data ?? "").includes(escalationId));
            return rows.length >= 1 ? rows : null;
          },
          { timeoutMs: 5_000, intervalMs: 100, description: "escalation.created persisted" },
        );

        // ── 3. Emit escalation.resolved ────────────────────────────────
        const resolvedResp = (await socketEmit(sb.socketPath, "escalation.resolved", {
          source: "e2e-test",
          owner: "agent:may",
          data: {
            escalationId,
            outcome: "resolved",
            summary: "test resolution",
            resumeInstruction: "Test resume instruction",
          },
        })) as { type?: string };
        expect(resolvedResp.type).toBe("ok");

        // ── 4. Subscriber processes → resume_attempted + resume_failed ──
        const result = await pollUntil(
          () => {
            const attempted = queryEvents(db, {
              types: ["escalation.resume_attempted"],
              since: t0,
              limit: 5,
            }).filter((e) => (e.data ?? "").includes(escalationId));
            const failed = queryEvents(db, {
              types: ["escalation.resume_failed"],
              since: t0,
              limit: 5,
            }).filter((e) => (e.data ?? "").includes(escalationId));
            if (attempted.length >= 1 && failed.length >= 1) return { attempted, failed };
            return null;
          },
          { timeoutMs: 5_000, intervalMs: 100, description: "resume_attempted + resume_failed" },
        );

        // Resume was attempted with the correct source session.
        const attemptedData = JSON.parse(result.attempted[0].data ?? "{}");
        const attInner = attemptedData.data ?? attemptedData;
        expect(attInner.escalationId).toBe(escalationId);
        expect(attInner.sourceSessionId).toBe(sourceSessionId);
        expect(attInner.resumeInstruction).toContain("Test resume instruction");

        // Resume failed because the fake session id doesn't exist in the
        // sandbox manager.
        const failedData = JSON.parse(result.failed[0].data ?? "{}");
        const failInner = failedData.data ?? failedData;
        expect(failInner.escalationId).toBe(escalationId);
        // Category should be `resume_failed` (manager threw) — not
        // `missing_resume_target` (which would mean we didn't even find a
        // session id in escalation.created).
        expect(failInner.category).toBe("resume_failed");
      } finally {
        db.close();
      }
    },
    30_000,
  );

  test(
    "needs_human outcome does NOT attempt source-session resume",
    async () => {
      const escalationId = `e2e-${Date.now()}-needs-human`;
      const sourceSessionId = `e2e-fake-session-${Date.now() + 1}`;
      const t0 = Date.now();

      // Emit created
      await socketEmit(sb.socketPath, "escalation.created", {
        source: "e2e-test",
        owner: "agent:may",
        data: {
          escalationId,
          reason: "needs human decision",
          sourceSessionId,
          requestedAction: "human input required",
        },
      });

      const db = openSandboxDb(sb.dbPath);
      try {
        await pollUntil(
          () => {
            const rows = queryEvents(db, { types: ["escalation.created"], since: t0, limit: 5 })
              .filter((e) => (e.data ?? "").includes(escalationId));
            return rows.length >= 1 ? rows : null;
          },
          { timeoutMs: 5_000, intervalMs: 100, description: "needs_human escalation.created persisted" },
        );

        // Resolve with outcome=needs_human
        await socketEmit(sb.socketPath, "escalation.resolved", {
          source: "e2e-test",
          owner: "agent:may",
          data: {
            escalationId,
            outcome: "needs_human",
            summary: "blocked on human",
          },
        });

        // Wait briefly to let the subscriber decide not to act.
        await new Promise((r) => setTimeout(r, 1500));

        // Assert: NO resume_attempted for this escalation.
        const attempted = queryEvents(db, {
          types: ["escalation.resume_attempted"],
          since: t0,
          limit: 5,
        }).filter((e) => (e.data ?? "").includes(escalationId));
        expect(attempted.length).toBe(0);

        // The resolved event itself should still have landed.
        const resolved = queryEvents(db, {
          types: ["escalation.resolved"],
          since: t0,
          limit: 5,
        }).filter((e) => (e.data ?? "").includes(escalationId));
        expect(resolved.length).toBeGreaterThanOrEqual(1);
      } finally {
        db.close();
      }
    },
    15_000,
  );
});
