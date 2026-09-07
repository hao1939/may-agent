/** Retained standalone recovery annotations. These do not dispatch work. */

import { describe, it, expect } from "bun:test";
import { classifyDigest } from "./session-digest.js";

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

  // ── auto_resume (Phase 4c) ────────────────────────────────────────────
  describe("auto_resume", () => {
    it("resumes when in_progress with work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: "Fixing auth bug", what_happened: "Was debugging auth" },
        "auto_resume",
      );
      expect(result.action).toBe("resume");
      expect(result.reason).toContain("Fixing auth bug");
    });

    it("does nothing when no work still open", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: null, what_happened: "Working on something" },
        "auto_resume",
      );
      expect(result.action).toBe("nothing");
      expect(result.reason).toBe("No recoverable work worth resuming");
    });

    it("does nothing when outcome is failure", () => {
      const result = classifyDigest(
        { outcome: "failure", still_open: "Incomplete", what_happened: "Failed" },
        "auto_resume",
      );
      expect(result.action).toBe("nothing");
    });

    it("does nothing when outcome is success", () => {
      const result = classifyDigest(
        { outcome: "success", still_open: null, what_happened: "Completed task" },
        "auto_resume",
      );
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

    it("returns nothing for session.start trigger", () => {
      const result = classifyDigest(
        { outcome: "in_progress", still_open: null, what_happened: "Starting" },
        "session.start",
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
