import { describe, expect, it } from "bun:test";

import { sendDaemonFrameWithRetry } from "./server.js";

describe("HTTP event ingress acknowledgement recovery", () => {
  it("retries an unknown timeout with the same idempotency key", async () => {
    const frames: Record<string, unknown>[] = [];
    const timeouts: number[] = [];
    const send = async (_socketPath: unknown, frame: Record<string, unknown>, options?: { timeoutMs?: number }) => {
      frames.push(structuredClone(frame));
      timeouts.push(Number(options?.timeoutMs));
      if (frames.length === 1) throw new Error("Socket timeout");
      return { type: "ok" as const, eventId: 42 };
    };

    const result = await sendDaemonFrameWithRetry(
      "/tmp/may.sock",
      { type: "gym.review.requested", data: { project: "gym" } },
      send,
    );

    expect(result).toEqual({ ok: true, eventId: 42 });
    expect(timeouts).toEqual([2_000, 5_000]);
    expect((frames[0].data as Record<string, unknown>).idempotencyKey).toMatch(/^web-/);
    expect((frames[1].data as Record<string, unknown>).idempotencyKey).toBe(
      (frames[0].data as Record<string, unknown>).idempotencyKey,
    );
  });

  it("preserves a caller key and does not retry a definite delivery error", async () => {
    const frames: Record<string, unknown>[] = [];
    const send = async (_socketPath: unknown, frame: Record<string, unknown>) => {
      frames.push(structuredClone(frame));
      throw new Error("connect ENOENT");
    };

    const result = await sendDaemonFrameWithRetry(
      "/tmp/missing.sock",
      {
        type: "project.task.tick",
        data: { project: "gym", idempotencyKey: "existing-key" },
      },
      send,
    );

    expect(result).toEqual({
      ok: false,
      error: "daemon socket delivery failed at /tmp/missing.sock: connect ENOENT",
    });
    expect(frames).toHaveLength(1);
    expect((frames[0].data as Record<string, unknown>).idempotencyKey).toBe("existing-key");
  });

  it("returns the durable event when both transport acknowledgements time out", async () => {
    const keys: string[] = [];
    const send = async () => {
      throw new Error("Socket timeout");
    };

    const result = await sendDaemonFrameWithRetry(
      "/tmp/may.sock",
      { type: "aks.finite-holder-migration.requested", data: { project: "aks-rp-e2e" } },
      send,
      (idempotencyKey) => {
        keys.push(idempotencyKey);
        return 4936896;
      },
    );

    expect(result).toEqual({ ok: true, eventId: 4936896 });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^web-/);
  });
});
