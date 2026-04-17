import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runConventionChecks } from "../../agents/may/handlers/convention-check.js";
import { getDb } from "../../src/lib/requests.js";

// Regression: Patch 1 from coach's C1.4 regression brief.
// Review-only workflow calls (kind=call, source=workflow, task starts with
// "[REVIEW ONLY") are one-shot synchronous invocations whose deliverable IS
// the response; they do not use finish(). They must be exempted from
// finish-dependent convention checks (C1.4, C8.2, C1.5, C1.7).
describe("convention-check — review-only workflow call exemption (Patch 1)", () => {
  let persistDir: string;
  let agentsRoot: string;
  const FINISH_DEPENDENT = ["C1.4", "C8.2", "C1.5", "C1.7"];

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "conv-check-review-only-"));
    agentsRoot = mkdtempSync(join(tmpdir(), "conv-check-agents-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  function seedSessionTranscript(sessionId: string) {
    const sessDir = join(persistDir, "sessions", "history", sessionId);
    mkdirSync(sessDir, { recursive: true });
    // A transcript with a read() and a bash() call but NO finish() — this
    // would normally trigger C1.4 (finish-clearly) and C8.2 failures.
    const lines = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "read",
            input: { path: "some/file.ts" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "call_1",
        content: [{ type: "text", text: "<tool_output>ok</tool_output>" }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call_2",
            name: "bash",
            input: { command: "echo done" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "call_2",
        content: [{ type: "text", text: "<tool_output>done</tool_output>" }],
      }),
    ];
    writeFileSync(join(sessDir, "session.jsonl"), lines.join("\n"));
  }

  function seedSession(sessionId: string, row: {
    agent: string;
    task: string;
    status?: string;
    kind?: string | null;
    source?: string | null;
  }) {
    const db = getDb(persistDir);
    const now = Date.now();
    db.prepare(
      `INSERT INTO sessions (sessionId, agent, task, status, kind, source, startedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sessionId,
      row.agent,
      row.task,
      row.status ?? "done",
      row.kind ?? null,
      row.source ?? null,
      now,
    );
    // Insert an evaluation row so findUncheckedSessions picks it up.
    db.prepare(
      `INSERT INTO evaluations (sessionId, agent, createdAt) VALUES (?, ?, ?)`,
    ).run(sessionId, row.agent, now);
  }

  it("does NOT record finish-dependent failures for a review-only workflow call", () => {
    const sessionId = "s_review_only_001";
    seedSessionTranscript(sessionId);
    seedSession(sessionId, {
      agent: "bob",
      task: "[REVIEW ONLY] Assess common-sense issue in handler.ts",
      kind: "call",
      source: "workflow",
      status: "done",
    });

    const result = runConventionChecks({
      persistDir,
      agentsRoot,
      log: () => {},
      getDb: () => getDb(persistDir),
    });

    expect(result.sessionsChecked).toBe(1);

    const db = getDb(persistDir);
    const rows = db
      .prepare(
        `SELECT convention, passed FROM convention_checks WHERE session_id = ?`,
      )
      .all(sessionId) as Array<{ convention: string; passed: number }>;

    // Finish-dependent checks should have been skipped entirely (not inserted).
    for (const conv of FINISH_DEPENDENT) {
      const match = rows.find((r) => r.convention === conv);
      expect(
        match,
        `C1.4/exemption: ${conv} should not be recorded for review-only call`,
      ).toBeUndefined();
    }
    // Other checks still run (e.g., C1.1, C2.1) — sanity: at least one row exists.
    expect(rows.length).toBeGreaterThan(0);
  });

  it("DOES record C1.4 failure for a normal (non-review-only) call with no finish()", () => {
    const sessionId = "s_normal_call_002";
    seedSessionTranscript(sessionId);
    seedSession(sessionId, {
      agent: "bob",
      task: "Fix the bug in handler.ts",
      kind: "call",
      source: "workflow",
      status: "done",
    });

    runConventionChecks({
      persistDir,
      agentsRoot,
      log: () => {},
      getDb: () => getDb(persistDir),
    });

    const db = getDb(persistDir);
    const c14 = db
      .prepare(
        `SELECT passed FROM convention_checks WHERE session_id = ? AND convention = 'C1.4'`,
      )
      .get(sessionId) as { passed: number } | undefined;
    // Control: non-review-only call WITHOUT finish() should produce a C1.4 row
    // (and it should fail). This proves the exemption in the other test is the
    // reason finish-dependent rows are absent — not a plumbing bug.
    expect(c14).toBeDefined();
    expect(c14?.passed).toBe(0);
  });
});
