/**
 * Tests for dispatch-dedup-guard.ts
 * Validates dedup logic without hitting real filesystem by testing exported functions.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, unlinkSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  shouldDispatch,
  recordDispatch,
  recordOutcome,
  unblock,
  getBlockedTasks,
  cleanup,
} from "./dispatch-dedup-guard.js";

const DEDUP_FILE = ".state/dispatch-dedup.json";
const ORIGINAL_CWD = process.cwd();
const ORIGINAL_STATE_DIR = process.env.STATE_DIR;
const TEST_CWD = join("/tmp", "__dispatch_dedup_guard_test__");

function clearDb() {
  if (existsSync(DEDUP_FILE)) unlinkSync(DEDUP_FILE);
}

function readDb() {
  return JSON.parse(readFileSync(DEDUP_FILE, "utf-8"));
}

describe("dispatch-dedup-guard", () => {
  beforeEach(() => {
    rmSync(TEST_CWD, { recursive: true, force: true });
    mkdirSync(TEST_CWD, { recursive: true });
    process.chdir(TEST_CWD);
    process.env.STATE_DIR = join(TEST_CWD, ".state");
    clearDb();
  });
  afterEach(() => {
    clearDb();
    if (ORIGINAL_STATE_DIR === undefined) {
      delete process.env.STATE_DIR;
    } else {
      process.env.STATE_DIR = ORIGINAL_STATE_DIR;
    }
    process.chdir(ORIGINAL_CWD);
    rmSync(TEST_CWD, { recursive: true, force: true });
  });

  test("allows first dispatch of a new task", () => {
    const result = shouldDispatch("bob", "Ship EXP-188 results");
    expect(result.allowed).toBe(true);
    expect(result.attempts).toBe(0);
  });

  test("allows dispatch with force override even when blocked", () => {
    // Create 3 failures to trigger block
    recordDispatch("bob", "failing-task");
    recordOutcome("bob", "failing-task", "failure");
    recordDispatch("bob", "failing-task");
    recordOutcome("bob", "failing-task", "failure");
    recordDispatch("bob", "failing-task");
    recordOutcome("bob", "failing-task", "failure");

    const blocked = shouldDispatch("bob", "failing-task");
    expect(blocked.allowed).toBe(false);

    const forced = shouldDispatch("bob", "failing-task", { force: true });
    expect(forced.allowed).toBe(true);
    expect(forced.reason).toBe("force override");
  });

  test("blocks after 3 failures", () => {
    for (let i = 0; i < 3; i++) {
      recordDispatch("bob", "doomed-task");
      recordOutcome("bob", "doomed-task", "failure");
    }
    const result = shouldDispatch("bob", "doomed-task");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("failure outcomes");
  });

  test("success resets failure counter", () => {
    recordDispatch("bob", "flaky-task");
    recordOutcome("bob", "flaky-task", "failure");
    recordDispatch("bob", "flaky-task");
    recordOutcome("bob", "flaky-task", "failure");
    // 2 failures, then success
    recordDispatch("bob", "flaky-task");
    recordOutcome("bob", "flaky-task", "success");

    const result = shouldDispatch("bob", "flaky-task");
    expect(result.allowed).toBe(true);
  });

  test("partial does not increment or reset failures", () => {
    recordDispatch("bob", "partial-task");
    recordOutcome("bob", "partial-task", "failure");
    recordDispatch("bob", "partial-task");
    recordOutcome("bob", "partial-task", "partial");

    const db = readDb();
    const key = Object.keys(db.records).find(k => k.includes("partialtask"));
    expect(db.records[key!].failures).toBe(1);
  });

  test("unblock clears blocked state", () => {
    for (let i = 0; i < 3; i++) {
      recordDispatch("bob", "blocked-task");
      recordOutcome("bob", "blocked-task", "failure");
    }
    expect(shouldDispatch("bob", "blocked-task").allowed).toBe(false);

    unblock("bob", "blocked-task");
    expect(shouldDispatch("bob", "blocked-task").allowed).toBe(true);
  });

  test("getBlockedTasks returns only blocked entries", () => {
    for (let i = 0; i < 3; i++) {
      recordDispatch("bob", "bad-task");
      recordOutcome("bob", "bad-task", "failure");
    }
    recordDispatch("bob", "good-task");
    recordOutcome("bob", "good-task", "success");

    const blocked = getBlockedTasks();
    expect(blocked.length).toBe(1);
    expect(blocked[0].agent).toBe("bob");
  });

  test("running task within lease is blocked", () => {
    recordDispatch("bob", "running-task");
    // lastStatus is "running", just dispatched
    const result = shouldDispatch("bob", "running-task");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("still be running");
  });

  test("running task after lease expiry is allowed", () => {
    recordDispatch("bob", "stale-running-task");
    const db = readDb();
    const key = Object.keys(db.records)[0];
    db.records[key].lastAttempt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    writeFileSync(DEDUP_FILE, JSON.stringify(db, null, 2));

    const result = shouldDispatch("bob", "stale-running-task");
    expect(result.allowed).toBe(true);
    expect(result.attempts).toBe(1);
  });

  test("different agents have independent records", () => {
    for (let i = 0; i < 3; i++) {
      recordDispatch("bob", "shared-task");
      recordOutcome("bob", "shared-task", "failure");
    }
    const bobResult = shouldDispatch("bob", "shared-task");
    const mayResult = shouldDispatch("may", "shared-task");
    expect(bobResult.allowed).toBe(false);
    expect(mayResult.allowed).toBe(true);
  });
});
