import { Duplex } from "node:stream";
import { describe, expect, it } from "bun:test";
import {
  daemonSocketPath,
  emitDaemonEvent,
  emitDaemonEventWithRetry,
  getEvent,
  publishEvent,
  sendAgentMessage,
  sendDaemonEvent,
  sendDaemonInput,
  sendSocketCommand,
  waitForSocketEvent,
  SocketCommandError,
  type SocketEndpoint,
} from "./client.js";

function okEndpoint(): SocketEndpoint {
  return () => {
    const stream = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        queueMicrotask(() => {
          stream.emit("data", Buffer.from(JSON.stringify({ type: "ok", command: "trigger.metrics-snapshot" }) + "\n"));
        });
        callback();
      },
    });
    queueMicrotask(() => stream.emit("connect"));
    return stream;
  };
}

function failingEndpoint(): SocketEndpoint {
  return () => {
    const stream = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    queueMicrotask(() => stream.emit("error", new Error("connection refused")));
    return stream;
  };
}

function captureEndpoint(writes: string[]): SocketEndpoint {
  return () => {
    const stream = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        writes.push(String(chunk));
        const frame = JSON.parse(String(chunk));
        queueMicrotask(() => {
          stream.emit("data", Buffer.from(JSON.stringify({ type: "ok", command: frame.type }) + "\n"));
        });
        callback();
      },
    });
    queueMicrotask(() => stream.emit("connect"));
    return stream;
  };
}

function echoThenAckEndpoint(): SocketEndpoint {
  return () => {
    const stream = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        const frame = JSON.parse(String(chunk));
        queueMicrotask(() => {
          stream.emit(
            "data",
            Buffer.from(
              `${JSON.stringify(frame)}\n${JSON.stringify({
                type: "ok",
                command: frame.type,
                eventId: 91,
              })}\n`,
            ),
          );
        });
        callback();
      },
    });
    queueMicrotask(() => stream.emit("connect"));
    return stream;
  };
}

function simpleEventEndpoint(): SocketEndpoint {
  return () => {
    const stream = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        const frame = JSON.parse(String(chunk)) as Record<string, unknown>;
        const response =
          frame.type === "publish"
            ? {
                type: "ok",
                command: "publish",
                eventId: 73,
                eventType: "project.owner.requested",
                delivery: "recorded",
              }
            : {
                type: "ok",
                command: "event.get",
                event: { event: { id: 73, type: "project.owner.requested" } },
              };
        queueMicrotask(() => stream.emit("data", Buffer.from(`${JSON.stringify(response)}\n`)));
        callback();
      },
    });
    queueMicrotask(() => stream.emit("connect"));
    return stream;
  };
}

describe("daemonSocketPath", () => {
  it("uses the convention instance/interface-agent socket path", () => {
    expect(daemonSocketPath("/state", { instance: "background", interfaceAgent: "may" })).toBe(
      "/state/instances/background/may.sock",
    );
  });

  it("defaults to the default may daemon socket", () => {
    expect(daemonSocketPath("/state")).toBe("/state/instances/default/may.sock");
  });
});

describe("simple event client", () => {
  it("publishes an EventInput and reads its bounded view", async () => {
    await expect(
      publishEvent(simpleEventEndpoint(), {
        type: "project.owner.requested",
        target: { appId: "sample" },
        data: { reason: "review" },
      }),
    ).resolves.toEqual({
      eventId: 73,
      eventType: "project.owner.requested",
      delivery: "recorded",
    });
    await expect(getEvent(simpleEventEndpoint(), 73)).resolves.toEqual({
      event: { id: 73, type: "project.owner.requested" },
    });
  });
});

describe("sendDaemonEvent", () => {
  it("returns the daemon transport ack", async () => {
    await expect(sendDaemonEvent(okEndpoint(), { type: "trigger.metrics-snapshot" })).resolves.toMatchObject({
      type: "ok",
      command: "trigger.metrics-snapshot",
    });
  });

  it("waits for the acknowledgement when the event broadcast arrives first", async () => {
    await expect(
      sendDaemonEvent(echoThenAckEndpoint(), {
        type: "project.comment.created",
        source: "test",
        owner: "agent:may",
        data: { project: "sample", comment: "advance" },
      }),
    ).resolves.toEqual({ type: "ok", command: "project.comment.created", eventId: 91 });
  });

  it("types a connection failure as pre-send", async () => {
    const error = await sendDaemonEvent(failingEndpoint(), { type: "trigger.metrics-snapshot" }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(SocketCommandError);
    expect((error as SocketCommandError).kind).toBe("pre-send");
    expect((error as Error).message).toContain("connection refused");
  });

  it("types a socket close after the write as post-send unknown", async () => {
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

    const error = await sendSocketCommand(endpoint, { type: "status" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SocketCommandError);
    expect((error as SocketCommandError).kind).toBe("post-send-unknown");
    expect((error as Error).message).toContain("outcome unknown");
  });

  it("ignores an acknowledgement for a different command", async () => {
    const endpoint: SocketEndpoint = () => {
      const stream = new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
          queueMicrotask(() => {
            stream.emit(
              "data",
              Buffer.from(
                `${JSON.stringify({ type: "ok", command: "reload" })}\n${JSON.stringify({ type: "status", command: "status", activeAgents: [] })}\n`,
              ),
            );
          });
          callback();
        },
      });
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    };

    await expect(sendSocketCommand(endpoint, { type: "status" })).resolves.toMatchObject({
      type: "status",
      command: "status",
    });
  });
});

describe("emitDaemonEventWithRetry", () => {
  it("reuses one idempotency key after timeout-after-send and returns the original event id", async () => {
    const writes: Array<Record<string, unknown>> = [];
    let attempts = 0;
    const endpoint: SocketEndpoint = () => {
      attempts += 1;
      const attempt = attempts;
      const stream = new Duplex({
        read() {},
        write(chunk, _encoding, callback) {
          const frame = JSON.parse(String(chunk)) as Record<string, unknown>;
          writes.push(frame);
          callback();
          if (attempt > 1) {
            queueMicrotask(() =>
              stream.emit("data", Buffer.from(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 91 })}\n`)),
            );
          }
        },
      });
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    };

    await expect(
      emitDaemonEventWithRetry(
        endpoint,
        "metric.breach",
        { metricId: "system.health" },
        { maxAttempts: 2, timeoutMs: 5 },
      ),
    ).resolves.toEqual({ type: "ok", command: "metric.breach", eventId: 91 });

    expect(writes).toHaveLength(2);
    const firstData = writes[0]?.data as Record<string, unknown>;
    const secondData = writes[1]?.data as Record<string, unknown>;
    expect(firstData.idempotencyKey).toBeString();
    expect(secondData.idempotencyKey).toBe(firstData.idempotencyKey);
  });

  it("does not retry a definitive daemon rejection", async () => {
    let attempts = 0;
    const endpoint: SocketEndpoint = () => {
      attempts += 1;
      const stream = new Duplex({
        read() {},
        write(chunk, _encoding, callback) {
          const frame = JSON.parse(String(chunk)) as Record<string, unknown>;
          callback();
          queueMicrotask(() => {
            stream.emit(
              "data",
              Buffer.from(`${JSON.stringify({ type: "error", command: frame.type, message: "rejected" })}\n`),
            );
          });
        },
      });
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    };

    const error = await emitDaemonEventWithRetry(endpoint, "metric.breach", {}, { maxAttempts: 3 }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(SocketCommandError);
    expect((error as SocketCommandError).kind).toBe("definitive");
    expect(attempts).toBe(1);
  });
});

describe("waitForSocketEvent", () => {
  it("subscribes before accepting a matching event", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const endpoint: SocketEndpoint = () => {
      const stream = new Duplex({
        read() {},
        write(chunk, _encoding, callback) {
          const frame = JSON.parse(String(chunk)) as Record<string, unknown>;
          writes.push(frame);
          queueMicrotask(() => {
            stream.emit(
              "data",
              Buffer.from(
                `${JSON.stringify({ type: "ok", command: "subscribe" })}\n${JSON.stringify({ type: "session.end", data: { sessionId: "s_1" } })}\n`,
              ),
            );
          });
          callback();
        },
      });
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    };

    await expect(waitForSocketEvent(endpoint, "session.end", { sessionId: "s_1" })).resolves.toMatchObject({
      type: "session.end",
    });
    expect(writes).toEqual([{ type: "subscribe", sessions: ["s_1"] }]);
  });
});

describe("emitDaemonEvent", () => {
  it("wraps dot-named event payloads in a canonical envelope", async () => {
    const writes: string[] = [];

    await expect(
      emitDaemonEvent(captureEndpoint(writes), "metric.breach", {
        source: "metrics-snapshot",
        owner: "dev",
        metricId: "system.health",
        message: "check",
      }),
    ).resolves.toMatchObject({ type: "ok", command: "metric.breach" });

    expect(JSON.parse(writes[0] ?? "")).toEqual({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "agent:dev",
      data: {
        metricId: "system.health",
        message: "check",
      },
    });
  });

  it("preserves caller-built canonical envelopes", async () => {
    const writes: string[] = [];

    await expect(
      emitDaemonEvent(captureEndpoint(writes), "message.created", {
        source: "agent:dev",
        owner: "human:operator",
        urgency: "high",
        data: {
          from: "dev",
          to: "human",
          content: "Need approval",
        },
      }),
    ).resolves.toMatchObject({ type: "ok", command: "message.created" });

    expect(JSON.parse(writes[0] ?? "")).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
      data: {
        from: "dev",
        to: "human",
        content: "Need approval",
      },
    });
  });

  it("defaults envelope metadata without nesting an existing data payload", async () => {
    const writes: string[] = [];

    await expect(
      emitDaemonEvent(captureEndpoint(writes), "project.status_changed", {
        data: {
          projectId: "p1",
          from: "open",
          to: "active",
        },
      }),
    ).resolves.toMatchObject({ type: "ok", command: "project.status_changed" });

    expect(JSON.parse(writes[0] ?? "")).toEqual({
      type: "project.status_changed",
      source: "control",
      owner: "agent:may",
      data: {
        projectId: "p1",
        from: "open",
        to: "active",
      },
    });
  });

  it("keeps socket command shortcuts flat", async () => {
    const writes: string[] = [];

    await expect(
      emitDaemonEvent(captureEndpoint(writes), "trigger.metrics-snapshot", {
        source: "control",
      }),
    ).resolves.toMatchObject({ type: "ok", command: "trigger.metrics-snapshot" });

    expect(JSON.parse(writes[0] ?? "")).toEqual({
      type: "trigger.metrics-snapshot",
      source: "control",
    });
  });

  it("publishes one May App input event and keeps direct agent chat direct", async () => {
    const writes: string[] = [];

    await expect(sendDaemonInput(captureEndpoint(writes), "hello May", "cli")).resolves.toMatchObject({
      type: "ok",
      command: "publish",
    });
    await expect(sendAgentMessage(captureEndpoint(writes), "may", "review this", "cli")).resolves.toMatchObject({
      type: "ok",
      command: "publish",
    });
    await expect(sendAgentMessage(captureEndpoint(writes), "dev", "fix it", "cli")).resolves.toMatchObject({
      type: "ok",
      command: "publish",
    });

    expect(JSON.parse(writes[0] ?? "")).toMatchObject({
      type: "publish",
      event: {
        type: "app.input.requested",
        target: { appId: "may" },
        data: { input: { kind: "message", data: { message: "hello May" } }, channel: "cli" },
        idempotencyKey: expect.stringMatching(/^control-input-/),
      },
    });
    expect(JSON.parse(writes[1] ?? "")).toMatchObject({
      type: "publish",
      event: {
        type: "app.input.requested",
        target: { appId: "may" },
        data: { input: { kind: "message", data: { message: "review this" } }, channel: "cli" },
        idempotencyKey: expect.stringMatching(/^control-input-/),
      },
    });
    expect(JSON.parse(writes[2] ?? "")).toMatchObject({
      type: "publish",
      event: {
        type: "chat.start.requested",
        data: { agent: "dev", message: "fix it", channel: "cli" },
        idempotencyKey: expect.stringMatching(/^control-chat-/),
      },
    });
  });
});
