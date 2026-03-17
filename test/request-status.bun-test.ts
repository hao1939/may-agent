/**
 * Tests for request-status.ts — CLI status tool
 * Phase 5 of request-tracking plan.
 *
 * Uses bun:test + bun:sqlite (native Bun modules).
 * Run with: bun test test/request-status.bun-test.ts
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { trackRequest, updateRequest, closeDb } from "../src/lib/requests";
import { printRequestStatus } from "../src/lib/tools/request-status";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "req-status-test-"));
});

afterEach(() => {
  closeDb(tempDir);
  rmSync(tempDir, { recursive: true, force: true });
});

test("empty DB shows 0 active and no 24h data", () => {
  const output = printRequestStatus(tempDir);
  expect(output).toContain("Active Requests: 0");
  expect(output).toContain("No requests in the last 24h.");
});

test("shows active requests with task preview", () => {
  trackRequest(tempDir, {
    fromEntity: "human",
    toAgent: "tech-lead",
    task: "Build the widget feature with tests and documentation",
    method: "chat",
  });
  const output = printRequestStatus(tempDir);
  expect(output).toContain("Active Requests: 1");
  expect(output).toContain("human → tech-lead");
  expect(output).toContain("chat");
  expect(output).toContain("Build the widget");
});

test("shows stale requests when older than 2h", () => {
  const reqId = trackRequest(tempDir, {
    fromEntity: "may",
    toAgent: "coder",
    task: "Old stale task that was never completed",
    method: "send",
  });
  // Manually backdate the request
  const { getDb } = require("../src/lib/requests");
  const db = getDb(tempDir);
  const twoHoursAgo = Date.now() - 3 * 60 * 60 * 1000; // 3h ago
  db.run("UPDATE requests SET createdAt = ? WHERE requestId = ?", [
    twoHoursAgo,
    reqId,
  ]);

  const output = printRequestStatus(tempDir);
  expect(output).toContain("Stale Requests (>2h)");
  expect(output).toContain("may → coder");
});

test("no stale section when all requests are fresh", () => {
  trackRequest(tempDir, {
    fromEntity: "human",
    toAgent: "tech-lead",
    task: "Fresh task",
    method: "chat",
  });
  const output = printRequestStatus(tempDir);
  expect(output).not.toContain("Stale Requests");
});

test("shows completion rates for last 24h", () => {
  const r1 = trackRequest(tempDir, {
    fromEntity: "may",
    toAgent: "tech-lead",
    task: "Task 1",
    method: "send",
  });
  updateRequest(tempDir, r1, {
    status: "COMPLETED",
    completedAt: Date.now(),
    durationMs: 5000,
  });

  const r2 = trackRequest(tempDir, {
    fromEntity: "may",
    toAgent: "tech-lead",
    task: "Task 2",
    method: "send",
  });
  updateRequest(tempDir, r2, {
    status: "FAILED",
    error: "timeout",
    completedAt: Date.now(),
  });

  const output = printRequestStatus(tempDir);
  expect(output).toContain("Completion Rates (last 24h)");
  expect(output).toContain("tech-lead");
  expect(output).toContain("50%"); // 1 done, 1 failed = 50%
});

test("multiple agents show separate rows", () => {
  const r1 = trackRequest(tempDir, {
    fromEntity: "may",
    toAgent: "tech-lead",
    task: "TL task",
    method: "send",
  });
  updateRequest(tempDir, r1, { status: "COMPLETED", completedAt: Date.now() });

  const r2 = trackRequest(tempDir, {
    fromEntity: "may",
    toAgent: "coder",
    task: "Coder task",
    method: "call",
  });
  updateRequest(tempDir, r2, { status: "COMPLETED", completedAt: Date.now() });

  const output = printRequestStatus(tempDir);
  expect(output).toContain("tech-lead");
  expect(output).toContain("coder");
});

test("truncates long task descriptions", () => {
  trackRequest(tempDir, {
    fromEntity: "human",
    toAgent: "tech-lead",
    task: "A".repeat(200),
    method: "chat",
  });
  const output = printRequestStatus(tempDir);
  // Task should be truncated to 60 chars
  expect(output).toContain("…");
  expect(output).not.toContain("A".repeat(200));
});
