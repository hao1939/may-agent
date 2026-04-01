import { describe, it, expect, beforeEach } from "vitest";
import { ConcurrencyGate, resetDefaultGate, getDefaultGate } from "../src/lib/concurrency-gate.js";

describe("P162: ConcurrencyGate", () => {
  beforeEach(() => resetDefaultGate());

  it("allows immediate acquire when under limit", async () => {
    const gate = new ConcurrencyGate({ maxConcurrent: 2 });
    const r1 = await gate.acquire();
    const r2 = await gate.acquire();
    expect(gate.stats.active).toBe(2);
    expect(gate.stats.waiting).toBe(0);
    r1();
    r2();
    expect(gate.stats.active).toBe(0);
  });

  it("queues when at capacity and releases on slot open", async () => {
    const gate = new ConcurrencyGate({ maxConcurrent: 1, waitTimeoutMs: 5000 });
    const r1 = await gate.acquire();
    expect(gate.stats.active).toBe(1);

    // Start a second acquire — should block
    let r2Released = false;
    const p2 = gate.acquire().then((release) => {
      r2Released = true;
      return release;
    });

    // Give microtask a chance to process
    await new Promise((r) => setTimeout(r, 10));
    expect(gate.stats.waiting).toBe(1);
    expect(r2Released).toBe(false);

    // Release first slot — second should resolve
    r1();
    const r2 = await p2;
    expect(r2Released).toBe(true);
    expect(gate.stats.active).toBe(1);
    r2();
    expect(gate.stats.active).toBe(0);
  });

  it("times out when waiting too long", async () => {
    const gate = new ConcurrencyGate({ maxConcurrent: 1, waitTimeoutMs: 50 });
    const r1 = await gate.acquire();

    await expect(gate.acquire()).rejects.toThrow("timed out");
    expect(gate.stats.waiting).toBe(0);
    r1();
  });

  it("release is idempotent", async () => {
    const gate = new ConcurrencyGate({ maxConcurrent: 1 });
    const release = await gate.acquire();
    release();
    release(); // Should not throw or go negative
    expect(gate.stats.active).toBe(0);
  });

  it("getDefaultGate returns singleton", () => {
    const g1 = getDefaultGate();
    const g2 = getDefaultGate();
    expect(g1).toBe(g2);
  });

  it("resetDefaultGate clears singleton", () => {
    const g1 = getDefaultGate();
    resetDefaultGate();
    const g2 = getDefaultGate();
    expect(g1).not.toBe(g2);
  });

  it("FIFO ordering for waiters", async () => {
    const gate = new ConcurrencyGate({ maxConcurrent: 1, waitTimeoutMs: 5000 });
    const order: number[] = [];

    const r1 = await gate.acquire();

    const p2 = gate.acquire().then((release) => {
      order.push(2);
      return release;
    });
    const p3 = gate.acquire().then((release) => {
      order.push(3);
      return release;
    });

    // Release r1 — p2 should resolve first (FIFO)
    r1();
    const r2 = await p2;
    r2();
    const r3 = await p3;
    r3();

    expect(order).toEqual([2, 3]);
  });
});
