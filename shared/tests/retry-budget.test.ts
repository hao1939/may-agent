/**
 * Unit tests for retry-budget guard (EXP-950)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { checkRetryBudget, recordDispatch, recordCompletion } from "../utils/retry-budget.js";

const STATE_FILE = ".state/retry-budget.json";

function cleanup() {
  try { unlinkSync(STATE_FILE); } catch {}
}

describe("retry-budget", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("allows first dispatch", () => {
    const result = checkRetryBudget("deploy service X", "tech-lead");
    expect(result.allowed).toBe(true);
    expect(result.attempts).toBe(0);
  });

  it("allows up to 3 attempts", () => {
    for (let i = 0; i < 2; i++) {
      recordDispatch("fix the auth bug", "tech-lead");
      recordCompletion("fix the auth bug", "tech-lead", false);
    }
    const check = checkRetryBudget("fix the auth bug", "tech-lead");
    expect(check.allowed).toBe(true);
    expect(check.attempts).toBe(2);
  });

  it("blocks after 3 failed dispatches", () => {
    for (let i = 0; i < 3; i++) {
      recordDispatch("fix the auth bug", "tech-lead");
      recordCompletion("fix the auth bug", "tech-lead", false);
    }
    const check = checkRetryBudget("fix the auth bug", "tech-lead");
    expect(check.allowed).toBe(false);
    expect(check.attempts).toBe(3);
  });

  it("clears budget on success", () => {
    for (let i = 0; i < 2; i++) {
      recordDispatch("fix the auth bug", "tech-lead");
      recordCompletion("fix the auth bug", "tech-lead", false);
    }
    recordDispatch("fix the auth bug", "tech-lead");
    recordCompletion("fix the auth bug", "tech-lead", true);
    const check = checkRetryBudget("fix the auth bug", "tech-lead");
    expect(check.allowed).toBe(true);
    expect(check.attempts).toBe(0);
  });

  it("normalizes timestamps and UUIDs in task descriptions", () => {
    recordDispatch("fix bug in session 550e8400-e29b-41d4-a716-446655440000", "tech-lead");
    recordCompletion("fix bug in session 550e8400-e29b-41d4-a716-446655440000", "tech-lead", false);
    // Same task with different UUID should match
    const check = checkRetryBudget("fix bug in session a1b2c3d4-e5f6-7890-abcd-ef1234567890", "tech-lead");
    expect(check.allowed).toBe(true); // only 1 attempt
    expect(check.attempts).toBe(1);
  });

  it("treats different agents independently", () => {
    for (let i = 0; i < 3; i++) {
      recordDispatch("run tests", "agent-a");
      recordCompletion("run tests", "agent-a", false);
    }
    const checkA = checkRetryBudget("run tests", "agent-a");
    const checkB = checkRetryBudget("run tests", "agent-b");
    expect(checkA.allowed).toBe(false);
    expect(checkB.allowed).toBe(true);
  });
});
