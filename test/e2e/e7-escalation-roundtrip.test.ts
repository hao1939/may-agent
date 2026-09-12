/**
 * E7 — Escalation roundtrip (plumbing-only variant)
 *
 * Validates that the escalation lifecycle subscriber processes
 * escalation.resolved events correctly:
 *
 *   1. emit escalation.created (with escalationId + sourceSessionId)
 *   2. emit needs_human, then resolved (matching escalationId)
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
 * (no resume attempt until a terminal resolution). The later resolution proves
 * the same FIFO listener has processed the earlier event; no fixed sleep.
 * Parent/child human escalation is covered by the integration lifecycle tests.
 *
 * Validates documented behavior of:
 *   - sdk-quickstart.md § External Escalate
 *   - escalation.md (lifecycle semantics)
 *   - user-guide.md § Events in Practice (escalation.resolved)
 *
 * Runs by default; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { openSandboxDb, pollUntil, queryEvents, socketEmit } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

function eventPayload(row: { data: string | null }): Record<string, unknown> {
  return JSON.parse(row.data ?? "{}") as Record<string, unknown>;
}

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

  test("needs_human does not resume; terminal resolution attempts the exact source session", async () => {
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
      const createdRows = await pollUntil(
        () => {
          const rows = queryEvents(db, { types: ["escalation.created"], since: t0, limit: 5 }).filter((e) =>
            (e.data ?? "").includes(escalationId),
          );
          return rows.length >= 1 ? rows : null;
        },
        { timeoutMs: 5_000, intervalMs: 100, description: "escalation.created persisted" },
      );
      expect(createdRows[0].source).toBe("control-socket");
      expect(createdRows[0].owner).toBe("agent:may");
      expect(eventPayload(createdRows[0])).toEqual({
        escalationId,
        reason: "e2e test escalation",
        sourceSessionId,
        requestedAction: "test resume",
        resumeCondition: "test resume",
        resume: {
          kind: "session",
          sessionId: sourceSessionId,
          condition: "test resume",
        },
      });

      const waiting = { escalationId, outcome: "needs_human", summary: "blocked on human" };
      const waitingResp = (await socketEmit(sb.socketPath, "escalation.resolved", {
        source: "e2e-test",
        owner: "agent:may",
        data: waiting,
      })) as { type?: string };
      expect(waitingResp.type).toBe("ok");

      // ── 3. Emit a later terminal resolution on the same listener ───
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
          const failed = queryEvents(db, {
            types: ["escalation.resume_failed"],
            since: t0,
            limit: 5,
          }).filter((e) => (e.data ?? "").includes(escalationId));
          if (!failed.some((row) => eventPayload(row).outcome === "resolved")) return null;
          // Read earlier facts only after the terminal marker is visible.
          const attempted = queryEvents(db, {
            types: ["escalation.resume_attempted"],
            since: t0,
            limit: 5,
          }).filter((e) => (e.data ?? "").includes(escalationId));
          const resolved = queryEvents(db, {
            types: ["escalation.resolved"],
            since: t0,
            limit: 5,
          }).filter((e) => (e.data ?? "").includes(escalationId));
          return { resolved, attempted, failed };
        },
        { timeoutMs: 5_000, intervalMs: 100, description: "resolved + resume_attempted + resume_failed" },
      );

      // The listener is FIFO: terminal failure proves it already processed
      // needs_human. Exactly one attempt excludes an early, erroneous resume.
      expect(result.attempted).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.resolved).toHaveLength(2);
      const waitingRow = result.resolved.find((row) => eventPayload(row).outcome === "needs_human")!;
      expect(waitingRow).toMatchObject({ source: "control-socket", owner: "agent:may" });
      expect(eventPayload(waitingRow)).toEqual(waiting);
      const resolvedRow = result.resolved.find((row) => eventPayload(row).outcome === "resolved")!;
      expect(resolvedRow.source).toBe("control-socket");
      expect(resolvedRow.owner).toBe("agent:may");
      expect(eventPayload(resolvedRow)).toEqual({
        escalationId,
        outcome: "resolved",
        summary: "test resolution",
        resumeInstruction: "Test resume instruction",
      });

      // Resume was attempted with the correct source session.
      const attemptedRow = result.attempted[0];
      expect(attemptedRow.source).toBe("escalation-lifecycle");
      expect(attemptedRow.owner).toBe("agent:may");
      const attemptedData = eventPayload(attemptedRow);
      expect(attemptedData.escalationId).toBe(escalationId);
      expect(attemptedData.sourceKind).toBe("session");
      expect(attemptedData.sourceRef).toBe(sourceSessionId);
      expect(attemptedData.sourceSessionId).toBe(sourceSessionId);
      expect(attemptedData.outcome).toBe("resolved");
      expect(attemptedData.resumeInstruction).toContain("Test resume instruction");

      // Resume failed because the fake session id doesn't exist in the
      // sandbox manager.
      const failedRow = result.failed[0];
      expect(failedRow.source).toBe("escalation-lifecycle");
      expect(failedRow.owner).toBe("agent:may");
      const failedData = eventPayload(failedRow);
      expect(failedData.escalationId).toBe(escalationId);
      expect(failedData.sourceKind).toBe("session");
      expect(failedData.sourceRef).toBe(sourceSessionId);
      expect(failedData.sourceSessionId).toBe(sourceSessionId);
      // Category should be `resume_failed` (manager threw) — not
      // `missing_resume_target` (which would mean we didn't even find a
      // session id in escalation.created).
      expect(failedData.category).toBe("resume_failed");
    } finally {
      db.close();
    }
  }, 30_000);
});
