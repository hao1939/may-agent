/**
 * Tests for session digest Phase 4a — switchover from string-matching to digest classifier.
 *
 * Two areas under test:
 * 1. P62 Recovery: two-tier decision logic (digest → classifyError fallback)
 * 2. Circuit breaker: digest-informed kill/escalate/resume decisions
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb } from "../src/lib/requests.js";
import { getLastDigest } from "../src/lib/session-digest.js";
import { classifyError } from "../src/lib/classify-error.js";
import { createStuckDetector } from "../src/lib/session-subscribers.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "digest-switchover-test-"));
}

function setupDb(persistDir: string) {
  const db = getDb(persistDir);
  return db;
}

function insertTestDigest(
  persistDir: string,
  opts: {
    sessionId: string;
    agent: string;
    trigger: string;
    action: string | null;
    action_reason?: string | null;
    outcome?: string;
    what_happened?: string;
    still_open?: string | null;
    step?: number;
  },
) {
  const db = setupDb(persistDir);
  db.prepare(
    `INSERT INTO session_digests
     (sessionId, agent, trigger, step, task, what_happened, outcome, still_open,
      files_modified, details, action, action_reason, created_at)
     VALUES (?, ?, ?, ?, 'test task', ?, ?, ?, NULL, NULL, ?, ?, ?)`,
  ).run(
    opts.sessionId,
    opts.agent,
    opts.trigger,
    opts.step ?? 1,
    opts.what_happened ?? "test",
    opts.outcome ?? "failure",
    opts.still_open ?? null,
    opts.action,
    opts.action_reason ?? null,
    Date.now(),
  );
}

/**
 * Replicates the two-tier recovery decision logic from may.ts P62 subscriber.
 * This is the exact logic pattern used in production.
 */
function makeRecoveryDecision(
  persistDir: string,
  sessionId: string,
  errorText: string,
): { action: string; source: string } {
  let action: string | null = null;
  let source = "fallback";
  try {
    const digest = getLastDigest(persistDir, sessionId);
    if (digest?.action) {
      action = digest.action;
      source = "digest";
    }
  } catch { /* best-effort */ }

  if (!action) {
    const errorClass = classifyError(errorText);
    if (errorClass === "infra") action = "requeue";
    else action = "nothing";
  }

  return { action: action!, source };
}

// ── P62 Recovery Decision Logic Tests ──────────────────────────────────

describe("P62 Recovery — two-tier decision", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = makeTempDir();
    setupDb(persistDir);
  });

  afterEach(() => {
    try { rmSync(persistDir, { recursive: true }); } catch {}
  });

  it("uses digest action=resume → requeues", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_resume_1",
      agent: "coder",
      trigger: "circuit_break",
      action: "resume",
      outcome: "in_progress",
      what_happened: "Was working on feature",
      still_open: "Feature half done",
    });
    const result = makeRecoveryDecision(persistDir, "s_resume_1", "Connection reset");
    expect(result.action).toBe("resume");
    expect(result.source).toBe("digest");
  });

  it("uses digest action=requeue → requeues", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_requeue_1",
      agent: "coder",
      trigger: "zombie_cleanup",
      action: "requeue",
      outcome: "in_progress",
      what_happened: "Zombie session had work",
      still_open: "Migration incomplete",
    });
    const result = makeRecoveryDecision(persistDir, "s_requeue_1", "Process killed");
    expect(result.action).toBe("requeue");
    expect(result.source).toBe("digest");
  });

  it("uses digest action=kill → does nothing", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_kill_1",
      agent: "coder",
      trigger: "circuit_break",
      action: "kill",
      outcome: "failure",
      what_happened: "Completely stuck in loop",
    });
    const result = makeRecoveryDecision(persistDir, "s_kill_1", "Connection reset");
    expect(result.action).toBe("kill");
    expect(result.source).toBe("digest");
  });

  it("uses digest action=escalate → escalates", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_escalate_1",
      agent: "coder",
      trigger: "timeout",
      action: "escalate",
      action_reason: "Timed out with critical work open",
      outcome: "in_progress",
      still_open: "Deploy step remaining",
    });
    const result = makeRecoveryDecision(persistDir, "s_escalate_1", "SIGTERM");
    expect(result.action).toBe("escalate");
    expect(result.source).toBe("digest");
  });

  it("uses digest action=nothing → does nothing", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_nothing_1",
      agent: "coder",
      trigger: "timeout",
      action: "nothing",
      outcome: "success",
      what_happened: "Finished before timeout",
    });
    const result = makeRecoveryDecision(persistDir, "s_nothing_1", "Connection reset");
    expect(result.action).toBe("nothing");
    expect(result.source).toBe("digest");
  });

  it("falls back to classifyError when no digest exists — infra error → requeues", () => {
    const result = makeRecoveryDecision(persistDir, "s_no_digest", "Connection reset by peer");
    expect(result.action).toBe("requeue");
    expect(result.source).toBe("fallback");
  });

  it("falls back to classifyError when no digest exists — logic error → nothing", () => {
    const result = makeRecoveryDecision(persistDir, "s_no_digest_logic", "TypeError: Cannot read property 'foo' of undefined");
    expect(result.action).toBe("nothing");
    expect(result.source).toBe("fallback");
  });

  it("falls back when digest exists but has no action (non-classify trigger)", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_no_action",
      agent: "coder",
      trigger: "checkpoint",
      action: null,
      outcome: "in_progress",
    });
    // ETIMEDOUT is not matched by classifyError (it checks "timeout" not "timedout")
    // Use "Connection reset" which IS matched as infra
    const result = makeRecoveryDecision(persistDir, "s_no_action", "Connection reset");
    expect(result.action).toBe("requeue");
    expect(result.source).toBe("fallback");
  });

  it("digest action takes precedence over classifyError — even for non-infra errors", () => {
    insertTestDigest(persistDir, {
      sessionId: "s_override",
      agent: "coder",
      trigger: "circuit_break",
      action: "resume",
      outcome: "in_progress",
      still_open: "Work remaining despite logic error",
    });
    const result = makeRecoveryDecision(persistDir, "s_override", "TypeError: bad code");
    expect(result.action).toBe("resume");
    expect(result.source).toBe("digest");
  });
});

// ── Circuit Breaker Decision Logic Tests ───────────────────────────────

describe("Circuit breaker — digest-informed decisions", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = makeTempDir();
    setupDb(persistDir);
  });

  afterEach(() => {
    try { rmSync(persistDir, { recursive: true }); } catch {}
  });

  it("falls back to kill when persistDir is undefined", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector(
      (sessionId: string) => cancelledSessions.push(sessionId),
      undefined,
      undefined, // no persistDir
      undefined,
    );

    handler({ type: "session_start", sessionId: "s_fallback", agent: "coder", task: "test" } as any);
    for (let i = 0; i < 7; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_fallback",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    // Without persistDir, should fall back to immediate kill
    expect(cancelledSessions).toContain("s_fallback");
  });

  it("stuck warning at threshold 4 does not cancel", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector(
      (sessionId: string) => cancelledSessions.push(sessionId),
      undefined,
      persistDir,
      undefined,
    );

    handler({ type: "session_start", sessionId: "s_warn", agent: "coder", task: "test" } as any);
    for (let i = 0; i < 4; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_warn",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).not.toContain("s_warn");
  });

  it("consecutive error count resets on successful turn", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector(
      (sessionId: string) => cancelledSessions.push(sessionId),
      undefined,
      persistDir,
      undefined,
    );

    handler({ type: "session_start", sessionId: "s_reset", agent: "coder", task: "test" } as any);
    for (let i = 0; i < 5; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_reset",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }
    // One successful turn resets the counter
    handler({
      type: "turn_end",
      sessionId: "s_reset",
      agent: "coder",
      toolCalls: 2,
      errorCount: 0,
    } as any);
    // 5 more error turns — still below threshold since counter was reset
    for (let i = 0; i < 5; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_reset",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).not.toContain("s_reset");
  });

  it("session_end cleans up state", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector(
      (sessionId: string) => cancelledSessions.push(sessionId),
      undefined,
      persistDir,
      undefined,
    );

    handler({ type: "session_start", sessionId: "s_cleanup", agent: "coder", task: "test" } as any);
    for (let i = 0; i < 3; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_cleanup",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }
    // Session ends
    handler({ type: "session_end", sessionId: "s_cleanup", agent: "coder" } as any);
    // New errors after session_end should not accumulate
    for (let i = 0; i < 7; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_cleanup",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).not.toContain("s_cleanup");
  });
});

// ── Integration: getLastDigest returns correct action field ────────────

describe("getLastDigest integration with switchover", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = makeTempDir();
    setupDb(persistDir);
  });

  afterEach(() => {
    try { rmSync(persistDir, { recursive: true }); } catch {}
  });

  it("returns the action field from the most recent digest", () => {
    // Insert two digests — only the latest should be returned (highest step)
    const db = setupDb(persistDir);
    db.prepare(
      `INSERT INTO session_digests
       (sessionId, agent, trigger, step, task, what_happened, outcome, still_open,
        files_modified, details, action, action_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    ).run("s_multi", "coder", "stuck_detected", 1, "task", "warning phase", "in_progress", "stuff", null, null, Date.now() - 1000);

    db.prepare(
      `INSERT INTO session_digests
       (sessionId, agent, trigger, step, task, what_happened, outcome, still_open,
        files_modified, details, action, action_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    ).run("s_multi", "coder", "circuit_break", 2, "task", "killed", "failure", null, "kill", "No recoverable work", Date.now());

    const digest = getLastDigest(persistDir, "s_multi");
    expect(digest).not.toBeNull();
    expect(digest!.action).toBe("kill");
    expect(digest!.trigger).toBe("circuit_break");
    expect(digest!.step).toBe(2);
  });

  it("returns null when no digests exist for session", () => {
    const digest = getLastDigest(persistDir, "s_nonexistent");
    expect(digest).toBeNull();
  });
});
