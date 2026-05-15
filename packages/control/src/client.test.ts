import { Duplex } from "node:stream";
import { describe, expect, it } from "bun:test";
import { daemonSocketPath, sendDaemonEvent, type SocketEndpoint } from "./client.js";

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
