import { describe, expect, it } from "bun:test";
import type { SocketResponse } from "../../../packages/control/src/client.js";
import { probeDaemonReadiness } from "./server.js";

describe("HTTP daemon readiness", () => {
  it("reports ready only after the daemon answers the status command", async () => {
    const readiness = await probeDaemonReadiness(
      "/state/instances/background/may.sock",
      async (endpoint, command, options) => {
        expect(endpoint).toBe("/state/instances/background/may.sock");
        expect(command).toEqual({ type: "status" });
        expect(options).toEqual({ timeoutMs: 123 });
        return { type: "status", command: "status", activeAgents: [] } as SocketResponse;
      },
      123,
    );

    expect(readiness).toMatchObject({
      ready: true,
      socketPath: "/state/instances/background/may.sock",
    });
    expect(readiness.checkedAt).toBeGreaterThan(0);
  });

  it("reports not ready when a stale socket file cannot answer", async () => {
    const readiness = await probeDaemonReadiness("/state/instances/background/may.sock", async () => {
      throw new Error("connect ECONNREFUSED");
    });

    expect(readiness).toMatchObject({
      ready: false,
      socketPath: "/state/instances/background/may.sock",
      error: "connect ECONNREFUSED",
    });
  });
});
