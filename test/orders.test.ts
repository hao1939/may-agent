import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logOrder, updateOrderStatus, getPendingOrders, resetStaleOrders } from "../src/lib/orders.js";
import type { OrderTicket } from "../src/lib/orders.js";

describe("orders (P209: Intent Persistence)", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "orders-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  test("logOrder creates a PENDING ticket", () => {
    const ticket = logOrder(persistDir, {
      text: "Fix the security gap",
      assignedTo: "may",
      source: "console",
    });

    expect(ticket.id).toMatch(/^ord_\d+/);
    expect(ticket.text).toBe("Fix the security gap");
    expect(ticket.status).toBe("PENDING");
    expect(ticket.assignedTo).toBe("may");
    expect(ticket.sessionId).toBeNull();

    // Should be persisted on disk
    const content = readFileSync(join(persistDir, "orders.jsonl"), "utf-8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.id).toBe(ticket.id);
  });

  test("logOrder with sessionId creates IN_PROGRESS ticket", () => {
    const ticket = logOrder(persistDir, {
      text: "Deploy feature",
      assignedTo: "tech-lead",
      source: "socket",
      sessionId: "s_123",
    });

    expect(ticket.status).toBe("IN_PROGRESS");
    expect(ticket.sessionId).toBe("s_123");
  });

  test("updateOrderStatus appends status change", () => {
    const ticket = logOrder(persistDir, {
      text: "Build the thing",
      assignedTo: "may",
      source: "console",
    });

    updateOrderStatus(persistDir, ticket.id, {
      status: "IN_PROGRESS",
      sessionId: "s_456",
    });

    updateOrderStatus(persistDir, ticket.id, {
      status: "COMPLETED",
    });

    // Should have 3 lines in the log
    const content = readFileSync(join(persistDir, "orders.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(3);

    // Last line should have COMPLETED status
    const last = JSON.parse(lines[2]);
    expect(last.status).toBe("COMPLETED");
    expect(last.completedAt).toBeNumber();
  });

  test("getPendingOrders returns only PENDING/IN_PROGRESS", () => {
    // Create 3 orders
    const o1 = logOrder(persistDir, { text: "Task 1", assignedTo: "may", source: "console" });
    const o2 = logOrder(persistDir, { text: "Task 2", assignedTo: "may", source: "console" });
    const o3 = logOrder(persistDir, { text: "Task 3", assignedTo: "may", source: "socket" });

    // Complete o1, fail o2
    updateOrderStatus(persistDir, o1.id, { status: "COMPLETED" });
    updateOrderStatus(persistDir, o2.id, { status: "FAILED", error: "Something broke" });

    const pending = getPendingOrders(persistDir);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(o3.id);
    expect(pending[0].text).toBe("Task 3");
  });

  test("getPendingOrders returns empty array when no file exists", () => {
    const result = getPendingOrders(join(persistDir, "nonexistent"));
    expect(result).toEqual([]);
  });

  test("getPendingOrders merges updates correctly", () => {
    const ticket = logOrder(persistDir, {
      text: "Original task",
      assignedTo: "may",
      source: "console",
    });

    updateOrderStatus(persistDir, ticket.id, {
      status: "IN_PROGRESS",
      sessionId: "s_789",
    });

    const pending = getPendingOrders(persistDir);
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("IN_PROGRESS");
    expect(pending[0].sessionId).toBe("s_789");
    expect(pending[0].text).toBe("Original task"); // Original text preserved
  });

  test("resetStaleOrders resets old IN_PROGRESS orders to PENDING", () => {
    // Create an order and move to IN_PROGRESS
    const ticket = logOrder(persistDir, {
      text: "Stale task",
      assignedTo: "may",
      source: "console",
    });
    updateOrderStatus(persistDir, ticket.id, {
      status: "IN_PROGRESS",
      sessionId: "s_old",
    });

    // With maxAge=0 (instant staleness), should reset
    const count = resetStaleOrders(persistDir, 0);
    expect(count).toBe(1);

    const pending = getPendingOrders(persistDir);
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("PENDING");
  });

  test("resetStaleOrders does not reset fresh orders", () => {
    const ticket = logOrder(persistDir, {
      text: "Fresh task",
      assignedTo: "may",
      source: "console",
    });
    updateOrderStatus(persistDir, ticket.id, {
      status: "IN_PROGRESS",
      sessionId: "s_new",
    });

    // With very large maxAge, nothing should be reset
    const count = resetStaleOrders(persistDir, 99999999);
    expect(count).toBe(0);
  });

  test("FAILED order with error is properly recorded", () => {
    const ticket = logOrder(persistDir, {
      text: "Will fail",
      assignedTo: "may",
      source: "console",
    });

    updateOrderStatus(persistDir, ticket.id, {
      status: "FAILED",
      error: "API timeout",
    });

    // Should not appear in pending
    const pending = getPendingOrders(persistDir);
    expect(pending.length).toBe(0);

    // But error should be in the log
    const content = readFileSync(join(persistDir, "orders.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.error).toBe("API timeout");
  });
});
