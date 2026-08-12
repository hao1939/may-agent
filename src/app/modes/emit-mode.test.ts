import { Duplex } from "node:stream";
import { describe, expect, it } from "bun:test";
import { parseEmitMode, runEmitMode } from "./emit.js";
import type { SocketEndpoint } from "../../../packages/control/src/client.js";

describe("emit mode", () => {
  it("parses event name and JSON payload", () => {
    expect(parseEmitMode(["may-agent", "--emit", "metric.updated", '{"agent":"may"}'])).toEqual({
      event: "metric.updated",
      data: { agent: "may" },
    });
  });

  it("returns null when --emit is absent", () => {
    expect(parseEmitMode(["may-agent", "--cron"])).toBeNull();
  });

  it("throws a clear error for invalid JSON payload", () => {
    expect(() => parseEmitMode(["may-agent", "--emit", "metric.updated", "{"])).toThrow("Invalid --emit JSON payload");
  });

  it("reuses one event identity after a lost acknowledgement and prints the original persisted event id", async () => {
    const frames: Array<Record<string, unknown>> = [];
    let attempt = 0;
    const endpoint: SocketEndpoint = () => {
      attempt += 1;
      const currentAttempt = attempt;
      const stream = new Duplex({
        read() {},
        write(chunk, _encoding, callback) {
          const frame = JSON.parse(String(chunk)) as Record<string, unknown>;
          frames.push(frame);
          callback();
          queueMicrotask(() => {
            if (currentAttempt === 1) stream.destroy();
            else stream.push(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 481 })}\n`);
          });
        },
      });
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    };
    const receipts: string[] = [];

    await runEmitMode({
      mode: { event: "metric.updated", data: { metricId: "system.health" } },
      persistDir: "/unused",
      instanceLabel: "test",
      interfaceAgent: "may",
      endpoint,
      retry: { maxAttempts: 2 },
      writeReceipt: (message) => receipts.push(message),
    });

    expect(frames).toHaveLength(2);
    const firstData = frames[0]?.data as Record<string, unknown>;
    const retryData = frames[1]?.data as Record<string, unknown>;
    expect(firstData.idempotencyKey).toBeString();
    expect(retryData.idempotencyKey).toBe(firstData.idempotencyKey);
    expect(receipts).toEqual(["Event emitted: metric.updated (event 481)"]);
  });

  it("explicitly reports an unknown outcome after acknowledgement retries are exhausted", async () => {
    const endpoint: SocketEndpoint = () => {
      const stream = new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
          callback();
          queueMicrotask(() => stream.destroy());
        },
      });
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    };

    await expect(
      runEmitMode({
        mode: { event: "metric.updated" },
        persistDir: "/unused",
        instanceLabel: "test",
        interfaceAgent: "may",
        endpoint,
        retry: { maxAttempts: 2 },
      }),
    ).rejects.toThrow("outcome unknown");
  });
});
