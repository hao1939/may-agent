/**
 * Tests for Bug 2 fix: API gate abort signal propagation.
 *
 * Bug: gatedPrompt() didn't pass AbortSignal to apiGate.acquire(), so sessions
 * waiting in the gate queue couldn't be cancelled — cancel()/close() left them
 * as permanent memory leaks with hanging promises.
 *
 * Fix: pass session.abortController.signal to acquire(), and abort it in cancel().
 */
import { describe, it, expect } from "vitest";
import { ApiGate } from "../src/lib/api-gate.js";

describe("ApiGate abort signal", () => {
  it("acquire() rejects when abort signal fires while queued", async () => {
    // Gate with concurrency=1 — second acquire will queue
    const gate = new ApiGate({ defaultConcurrency: 1 });

    // First acquire succeeds immediately
    const release1 = await gate.acquire("http://test", "s1", "agent1");

    // Second acquire — must wait in queue
    const controller = new AbortController();
    const acquirePromise = gate.acquire("http://test", "s2", "agent2", controller.signal);

    // Abort the queued session
    controller.abort();

    // The queued acquire should reject
    await expect(acquirePromise).rejects.toThrow("aborted");

    // Cleanup
    release1();
  });

  it("acquire() does NOT reject when signal fires after slot is acquired", async () => {
    const gate = new ApiGate({ defaultConcurrency: 2 });

    const controller = new AbortController();
    const release = await gate.acquire("http://test", "s1", "agent1", controller.signal);

    // Signal fires after acquire already resolved — should be a no-op
    controller.abort();

    // release should still work without error
    expect(() => release()).not.toThrow();
  });

  it("releaseAll removes queued entries without leaking promises", async () => {
    const gate = new ApiGate({ defaultConcurrency: 1 });

    // Fill the single slot
    const release1 = await gate.acquire("http://test", "s1", "agent1");

    // Queue s2 — but use abort signal so it can reject cleanly
    const controller = new AbortController();
    const acquirePromise = gate.acquire("http://test", "s2", "agent2", controller.signal);

    // Simulate cancel: abort signal + releaseAll
    controller.abort();
    gate.releaseAll("s2");

    // Should reject with abort error
    await expect(acquirePromise).rejects.toThrow("aborted");

    // Gate status should be clean
    const status = gate.status();
    expect(status[0].queued).toBe(0);

    release1();
  });

  it("multiple sessions queued — only the aborted one rejects", async () => {
    const gate = new ApiGate({ defaultConcurrency: 1 });

    const release1 = await gate.acquire("http://test", "s1", "agent1");

    // Queue two sessions
    const controller2 = new AbortController();
    const acquirePromise2 = gate.acquire("http://test", "s2", "agent2", controller2.signal);
    const acquirePromise3 = gate.acquire("http://test", "s3", "agent3");

    // Abort only s2
    controller2.abort();
    await expect(acquirePromise2).rejects.toThrow("aborted");

    // s3 should still be queued, not rejected
    const status = gate.status();
    expect(status[0].queued).toBe(1);

    // Release s1 — s3 should get the slot
    release1();
    const release3 = await acquirePromise3;
    expect(typeof release3).toBe("function");
    release3();
  });
});
