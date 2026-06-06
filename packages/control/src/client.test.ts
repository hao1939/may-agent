import { Duplex } from "node:stream";
import { describe, expect, it } from "bun:test";
import { daemonSocketPath, emitDaemonEvent, sendAgentMessage, sendDaemonEvent, sendDaemonInput, type SocketEndpoint } from "./client.js";

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

describe("daemonSocketPath", () => {
  it("uses the convention instance/interface-agent socket path", () => {
    expect(daemonSocketPath("/state", { instance: "background", interfaceAgent: "may" }))
      .toBe("/state/instances/background/may.sock");
  });

  it("defaults to the default may daemon socket", () => {
    expect(daemonSocketPath("/state")).toBe("/state/instances/default/may.sock");
  });
});

describe("sendDaemonEvent", () => {
  it("returns the daemon transport ack", async () => {
    await expect(sendDaemonEvent(okEndpoint(), { type: "trigger.metrics-snapshot" }))
      .resolves.toMatchObject({ type: "ok", command: "trigger.metrics-snapshot" });
  });

  it("fails clearly when the socket cannot be connected", async () => {
    await expect(sendDaemonEvent(failingEndpoint(), { type: "trigger.metrics-snapshot" }))
      .rejects.toThrow("connection refused");
  });
});

describe("emitDaemonEvent", () => {
  it("wraps dot-named event payloads in a canonical envelope", async () => {
    const writes: string[] = [];

    await expect(emitDaemonEvent(captureEndpoint(writes), "metric.breach", {
      source: "metrics-snapshot",
      owner: "dev",
      metricId: "system.health",
      message: "check",
    })).resolves.toMatchObject({ type: "ok", command: "metric.breach" });

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

    await expect(emitDaemonEvent(captureEndpoint(writes), "message.created", {
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
      data: {
        from: "dev",
        to: "human",
        content: "Need approval",
      },
    })).resolves.toMatchObject({ type: "ok", command: "message.created" });

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

    await expect(emitDaemonEvent(captureEndpoint(writes), "project.status_changed", {
      data: {
        projectId: "p1",
        from: "open",
        to: "active",
      },
    })).resolves.toMatchObject({ type: "ok", command: "project.status_changed" });

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

    await expect(emitDaemonEvent(captureEndpoint(writes), "trigger.metrics-snapshot", {
      source: "control",
    })).resolves.toMatchObject({ type: "ok", command: "trigger.metrics-snapshot" });

    expect(JSON.parse(writes[0] ?? "")).toEqual({
      type: "trigger.metrics-snapshot",
      source: "control",
    });
  });

  it("sends human chat helpers as canonical chat.start.requested intents", async () => {
    const writes: string[] = [];

    await expect(sendDaemonInput(captureEndpoint(writes), "hello May", "cli"))
      .resolves.toMatchObject({ type: "ok", command: "chat.start.requested" });
    await expect(sendAgentMessage(captureEndpoint(writes), "dev", "fix it", "cli"))
      .resolves.toMatchObject({ type: "ok", command: "chat.start.requested" });

    expect(JSON.parse(writes[0] ?? "")).toEqual({
      type: "chat.start.requested",
      source: "cli",
      owner: "agent:may",
      data: { agent: "may", message: "hello May", channel: "cli" },
    });
    expect(JSON.parse(writes[1] ?? "")).toEqual({
      type: "chat.start.requested",
      source: "cli",
      owner: "agent:dev",
      data: { agent: "dev", message: "fix it", channel: "cli" },
    });
  });
});
