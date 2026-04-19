import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addOrder, getOrders, completeOrder } from "../src/lib/orders.js";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TMP_BASE = join(process.cwd(), ".tmp-test-orders-" + process.pid);

beforeEach(() => {
  mkdirSync(TMP_BASE, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
});

describe("addOrder", () => {
  it("returns an Order with id, text, from, createdAt, status=active", () => {
    const order = addOrder("Deploy v2", "human", TMP_BASE);

    expect(order.id).toBeDefined();
    expect(typeof order.id).toBe("string");
    expect(order.id.length).toBeGreaterThan(0);
    expect(order.text).toBe("Deploy v2");
    expect(order.from).toBe("human");
    expect(order.createdAt).toBeDefined();
    expect(order.status).toBe("active");
    expect(order.completedAt).toBeUndefined();
  });

  it("persists the order to the JSONL file", () => {
    addOrder("Deploy v2", "human", TMP_BASE);
    const fp = join(TMP_BASE, "orders.jsonl");
    expect(existsSync(fp)).toBe(true);
  });
});

describe("getOrders", () => {
  it("returns only active orders by default", () => {
    const o1 = addOrder("Task A", "human", TMP_BASE);
    const o2 = addOrder("Task B", "bob", TMP_BASE);
    completeOrder(o1.id, TMP_BASE);

    const active = getOrders("active", TMP_BASE);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(o2.id);
  });

  it('returns all orders with filter "all"', () => {
    addOrder("Task A", "human", TMP_BASE);
    const o2 = addOrder("Task B", "bob", TMP_BASE);
    completeOrder(o2.id, TMP_BASE);

    const all = getOrders("all", TMP_BASE);
    expect(all).toHaveLength(2);
  });

  it("returns [] on nonexistent file", () => {
    const missing = join(TMP_BASE, "subdir-that-does-not-exist");
    const result = getOrders("active", missing);
    expect(result).toEqual([]);
  });
});

describe("completeOrder", () => {
  it("marks the order completed and sets completedAt", () => {
    const o = addOrder("Upgrade DB", "human", TMP_BASE);
    const completed = completeOrder(o.id, TMP_BASE);

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe("completed");
    expect(completed!.completedAt).toBeDefined();
    expect(typeof completed!.completedAt).toBe("string");
  });

  it('returns null for a nonexistent id', () => {
    addOrder("Something", "human", TMP_BASE);
    const result = completeOrder("nonexistent-id", TMP_BASE);
    expect(result).toBeNull();
  });
});

describe("multiple orders workflow", () => {
  it("add 3, complete 1, getOrders active returns 2", () => {
    const o1 = addOrder("Task 1", "human", TMP_BASE);
    const o2 = addOrder("Task 2", "human", TMP_BASE);
    const o3 = addOrder("Task 3", "bob", TMP_BASE);

    completeOrder(o2.id, TMP_BASE);

    const active = getOrders("active", TMP_BASE);
    expect(active).toHaveLength(2);

    const activeIds = active.map((o) => o.id);
    expect(activeIds).toContain(o1.id);
    expect(activeIds).toContain(o3.id);
    expect(activeIds).not.toContain(o2.id);

    const completed = getOrders("completed", TMP_BASE);
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe(o2.id);
  });
});
