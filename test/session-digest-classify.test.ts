/**
 * Tests for session digest classifier (Phase 3 — shadow classifier).
 *
 * Tests classifyDigest() logic for all 6 CLASSIFY_TRIGGERS:
 *   stuck_detected, circuit_break, timeout, zombie_cleanup, resume_exhausted, overflow
 *
 * Also tests logShadowComparison() logging helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyDigest, logShadowComparison } from "../src/lib/session-digest.js";
import type { DigestRow } from "../src/lib/session-digest.js";

// ── classifyDigest tests ────────────────────────────────────────────────

describe("classifyDigest", () => {
  // ── stuck_detected ────────────────────────────────────────────────────
  describe("stuck_detected", () => {
    it("escalates when in_progress with work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "Needs to fix auth bug", what_happened: "Was debugging auth" },
        "stuck_detected",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toBe("Needs to fix auth bug");
    });

    it("does nothing when no recoverable work", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: null, what_happened: "Failed completely" },
        "stuck_detected",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("No recoverable work");
    });

    it("does nothing when in_progress but nothing still_open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: null, what_happened: "Working but nearly done" },
        "stuck_detected",
      );
      expect(result.action).toBe("nothing");
    });

    it("does nothing when outcome is success", () => {
      const result = classifyDigest(
        { outcome: "success", still_open: "Some minor cleanup", what_happened: "Completed task" },
        "stuck_detected",
      );
      expect(result.action).toBe("nothing");
    });
  });

  // ── circuit_break ─────────────────────────────────────────────────────
  describe("circuit_break", () => {
    it("escalates when in_progress with work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "Deploy step remaining", what_happened: "Was deploying" },
        "circuit_break",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toBe("Deploy step remaining");
    });

    it("does nothing when outcome is failure and nothing open", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: null, what_happened: "Crashed on API call" },
        "circuit_break",
      );
      expect(result.action).toBe("nothing");
    });

    it("does nothing when outcome is partial but nothing still_open", () => {
      const result = classifyDigest(
        { outcome: "partial", still_open: null, what_happened: "Partially completed" },
        "circuit_break",
      );
      expect(result.action).toBe("nothing");
    });
  });

  // ── timeout ───────────────────────────────────────────────────────────
  describe("timeout", () => {
    it("escalates when there is work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "3 tests remaining to fix", what_happened: "Was fixing tests" },
        "timeout",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toBe("Timed out: 3 tests remaining to fix");
    });

    it("does nothing when no work still open", () => {
      const result = classifyDigest(
        { outcome: "success", still_open: null, what_happened: "Completed everything" },
        "timeout",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("Timed out, nothing critical left");
    });

    it("escalates even on failure if still_open exists", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: "Need to rollback changes", what_happened: "Failed mid-deployment" },
        "timeout",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toContain("Need to rollback changes");
    });
  });

  // ── zombie_cleanup ────────────────────────────────────────────────────
  describe("zombie_cleanup", () => {
    it("requeues when there is work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "File migration incomplete", what_happened: "Was migrating files" },
        "zombie_cleanup",
      );
      expect(result.action).toBe("requeue");
      expect(result.reason).toContain("File migration incomplete");
    });

    it("does nothing when no work still open", () => {
      const result = classifyDigest(
        { outcome: "interrupted", still_open: null, what_happened: "Session was abandoned" },
        "zombie_cleanup",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("No recoverable work");
    });
  });

  // ── resume_exhausted ──────────────────────────────────────────────────
  describe("resume_exhausted", () => {
    it("always escalates regardless of outcome", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: null, what_happened: "Kept crashing on API call" },
        "resume_exhausted",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toContain("Exhausted retries");
      expect(result.reason).toContain("Kept crashing on API call");
    });

    it("escalates even when successful with open work", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "Half done", what_happened: "Made some progress" },
        "resume_exhausted",
      );
      expect(result.action).toBe("escalate");
    });
  });

  // ── overflow ──────────────────────────────────────────────────────────
  describe("overflow", () => {
    it("escalates when there is work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "Need to refactor large module", what_happened: "Context window full" },
        "overflow",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toContain("Context overflow");
      expect(result.reason).toContain("Need to refactor large module");
    });

    it("does nothing when no work still open", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: null, what_happened: "Overflowed after completing task" },
        "overflow",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("Overflow, no critical work left");
    });
  });

  // ── session_end_blocked (Phase 4b) ─────────────────────────────────────
  describe("session_end_blocked", () => {
    it("escalates with still_open as reason", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: "Need API credentials from admin", what_happened: "Could not access external API" },
        "session_end_blocked",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toBe("Need API credentials from admin");
    });

    it("escalates with what_happened when no still_open", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: null, what_happened: "Blocked on missing config file" },
        "session_end_blocked",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toBe("Blocked on missing config file");
    });

    it("always escalates regardless of outcome", () => {
      const result = classifyDigest(
        { outcome: "success", still_open: "Minor cleanup needed", what_happened: "Mostly done but stuck on permissions" },
        "session_end_blocked",
      );
      expect(result.action).toBe("escalate");
    });
  });

  // ── session_end_failure (Phase 4b) ────────────────────────────────────
  describe("session_end_failure", () => {
    it("escalates when there is still_open work", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: "Tests still broken, needs investigation", what_happened: "Could not fix test failures" },
        "session_end_failure",
      );
      expect(result.action).toBe("escalate");
      expect(result.reason).toBe("Tests still broken, needs investigation");
    });

    it("does nothing when failure has no open work", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: null, what_happened: "Task was not feasible" },
        "session_end_failure",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("Failure with no open work — no escalation needed");
    });

    it("does nothing when still_open is empty string", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: "", what_happened: "Failed cleanly" },
        "session_end_failure",
      );
      // empty string is falsy → nothing
      expect(result.action).toBe("nothing");
    });
  });

  // ── Non-classify triggers ─────────────────────────────────────────────
  describe("non-classify triggers (default case)", () => {
    it("returns nothing for checkpoint trigger", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "Work remaining", what_happened: "Made progress" },
        "checkpoint",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("Informational trigger");
    });

    it("returns nothing for session_start trigger", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: null, what_happened: "Starting" },
        "session_start",
      );
      expect(result.action).toBe("nothing");
    });

    it("returns nothing for end trigger", () => {
      const result = classifyDigest(
        { outcome: "success", still_open: null, what_happened: "Done" },
        "end",
      );
      expect(result.action).toBe("nothing");
    });

    it("returns nothing for unknown trigger", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "stuff", what_happened: "things" },
        "some_unknown_trigger",
      );
      expect(result.action).toBe("nothing");
    });
  });
});

// ── logShadowComparison tests ───────────────────────────────────────────

describe("logShadowComparison", () => {
  let logSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock the log function
    logSpy = vi.fn();
    vi.doMock("../src/lib/log.js", () => ({ log: logSpy }));
  });

  it("does not throw when digest is null", () => {
    // Should not throw — shadow logging is best-effort
    expect(() => {
      logShadowComparison("session-123", "timeout", "kill", null);
    }).not.toThrow();
  });

  it("does not throw with a valid digest", () => {
    const digest: DigestRow = {
      id: 1,
      sessionId: "session-123",
      agent: "coder",
      trigger: "timeout",
      step: 2,
      task: "fix bug",
      what_happened: "Was fixing the bug",
      outcome: "in_progress",
      still_open: "Need to finish",
      files_modified: null,
      details: null,
      action: "escalate",
      action_reason: "Timed out: Need to finish",
      created_at: Date.now(),
    };
    expect(() => {
      logShadowComparison("session-123", "timeout", "kill", digest);
    }).not.toThrow();
  });

  it("handles digest with no action (non-classify trigger)", () => {
    const digest: DigestRow = {
      id: 1,
      sessionId: "session-123",
      agent: "coder",
      trigger: "checkpoint",
      step: 2,
      task: "fix bug",
      what_happened: "Made progress",
      outcome: "in_progress",
      still_open: null,
      files_modified: null,
      details: null,
      action: null,
      action_reason: null,
      created_at: Date.now(),
    };
    // Should report classifier_action as "none(no_digest)" equivalent
    expect(() => {
      logShadowComparison("session-123", "checkpoint", "nothing", digest);
    }).not.toThrow();
  });
});

// ── Shadow comparison expected outcomes matrix ──────────────────────────
// Documents what the existing system does vs. what the classifier might say.

describe("shadow comparison expected outcomes", () => {
  const scenarios = [
    {
      name: "stuck_detected with recoverable work → existing=nothing, classifier=escalate (DISAGREE)",
      trigger: "stuck_detected",
      digest: { outcome: "in_progress", still_open: "Bug fix incomplete", what_happened: "Debugging" },
      existingAction: "nothing",
      expectedClassifierAction: "escalate",
      expectMatch: false,
    },
    {
      name: "stuck_detected with no work → existing=nothing, classifier=nothing (AGREE)",
      trigger: "stuck_detected",
      digest: { outcome: "failure", still_open: null, what_happened: "Crashed" },
      existingAction: "nothing",
      expectedClassifierAction: "nothing",
      expectMatch: true,
    },
    {
      name: "circuit_break with recoverable work → existing=kill, classifier=escalate (DISAGREE)",
      trigger: "circuit_break",
      digest: { outcome: "in_progress", still_open: "Remaining tasks", what_happened: "Working" },
      existingAction: "kill",
      expectedClassifierAction: "escalate",
      expectMatch: false,
    },
    {
      name: "circuit_break with no work → existing=kill, classifier=nothing (DISAGREE)",
      trigger: "circuit_break",
      digest: { outcome: "failure", still_open: null, what_happened: "Dead" },
      existingAction: "kill",
      expectedClassifierAction: "nothing",
      expectMatch: false,
    },
    {
      name: "timeout with work open → existing=kill, classifier=escalate (DISAGREE)",
      trigger: "timeout",
      digest: { outcome: "in_progress", still_open: "Tests remaining", what_happened: "Testing" },
      existingAction: "kill",
      expectedClassifierAction: "escalate",
      expectMatch: false,
    },
    {
      name: "timeout with no work → existing=kill, classifier=nothing (DISAGREE)",
      trigger: "timeout",
      digest: { outcome: "success", still_open: null, what_happened: "Done" },
      existingAction: "kill",
      expectedClassifierAction: "nothing",
      expectMatch: false,
    },
    {
      name: "zombie_cleanup with work → existing=nothing, classifier=requeue (DISAGREE)",
      trigger: "zombie_cleanup",
      digest: { outcome: "in_progress", still_open: "Migration pending", what_happened: "Migrating" },
      existingAction: "nothing",
      expectedClassifierAction: "requeue",
      expectMatch: false,
    },
    {
      name: "zombie_cleanup with no work → existing=nothing, classifier=nothing (AGREE)",
      trigger: "zombie_cleanup",
      digest: { outcome: "interrupted", still_open: null, what_happened: "Abandoned" },
      existingAction: "nothing",
      expectedClassifierAction: "nothing",
      expectMatch: true,
    },
    {
      name: "resume_exhausted → existing=escalate, classifier=escalate (AGREE)",
      trigger: "resume_exhausted",
      digest: { outcome: "failure", still_open: null, what_happened: "Kept failing" },
      existingAction: "escalate",
      expectedClassifierAction: "escalate",
      expectMatch: true,
    },
    {
      name: "overflow with work → existing=kill, classifier=escalate (DISAGREE)",
      trigger: "overflow",
      digest: { outcome: "in_progress", still_open: "Refactoring", what_happened: "Context full" },
      existingAction: "kill",
      expectedClassifierAction: "escalate",
      expectMatch: false,
    },
    {
      name: "overflow with no work → existing=kill, classifier=nothing (DISAGREE)",
      trigger: "overflow",
      digest: { outcome: "success", still_open: null, what_happened: "Completed before overflow" },
      existingAction: "kill",
      expectedClassifierAction: "nothing",
      expectMatch: false,
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const classification = classifyDigest(scenario.digest, scenario.trigger);
      expect(classification.action).toBe(scenario.expectedClassifierAction);

      const match = scenario.existingAction === classification.action;
      expect(match).toBe(scenario.expectMatch);
    });
  }
});
