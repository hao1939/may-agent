import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../src/lib/manager.js";
import { createIdentityWriter } from "../../src/lib/instance-identity.js";
import { appendSessionMessage } from "../../src/lib/persistence.js";
import { closeAllDbs } from "../../src/lib/requests.js";

describe("retained detached instance control", () => {
  let root: string;
  let manager: SubagentManager;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "may-legacy-control-"));
    manager = new SubagentManager({ persistDir: root });
  });
  afterEach(() => {
    closeAllDbs();
    rmSync(root, { recursive: true, force: true });
  });

  async function cancel(sessionId: string) {
    const result = await manager.createAgentsTool().execute("cancel", { action: "cancel", sessionId });
    return JSON.parse((result.content[0] as { text: string }).text);
  }

  it("still publishes cancellation to an existing instance's exact session", async () => {
    const socketPath = join(root, "instance.sock");
    const frames: unknown[] = [];
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      let pending = "";
      socket.on("data", (chunk) => {
        pending += chunk.toString();
        const lines = pending.split("\n");
        pending = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          frames.push(JSON.parse(line));
          socket.write(JSON.stringify({ type: "ok", command: "publish" }) + "\n");
        }
      });
    });
    try {
      server.listen(socketPath);
      await once(server, "listening");
      manager.registry.saveSession("legacy", {
        agent: "worker",
        task: "retained work",
        status: "running",
        startedAt: Date.now(),
        detached: true,
        instance: "job-legacy",
      });
      createIdentityWriter({ persistDir: root, instanceLabel: "job-legacy" })({
        status: "running",
        socket: socketPath,
        sessionId: "legacy",
      });

      expect(await cancel("legacy")).toEqual({ cancelled: "legacy", method: "socket" });
      expect(frames).toEqual([
        {
          type: "publish",
          event: {
            type: "session.cancel.requested",
            target: { sessionId: "legacy" },
            data: { reason: "agent tool requested cancellation" },
            idempotencyKey: "agents-tool-cancel:legacy",
          },
        },
      ]);
      expect(manager.registry.getSession("legacy")?.status).toBe("interrupted");
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("keeps the SIGTERM fallback for an existing instance with an unavailable socket", async () => {
    const child = spawn(process.execPath, ["-e", "process.stdout.write('ready'); setInterval(() => {}, 1000)"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(child, "exit");
    try {
      await once(child.stdout!, "data");
      manager.registry.saveSession("legacy", {
        agent: "worker",
        task: "retained work",
        status: "running",
        startedAt: Date.now(),
        detached: true,
        instance: "job-legacy",
        pid: child.pid,
      });
      createIdentityWriter({ persistDir: root, instanceLabel: "job-legacy" })({
        status: "running",
        socket: join(root, "absent.sock"),
        sessionId: "legacy",
      });
      expect(await cancel("legacy")).toEqual({ cancelled: "legacy", method: "sigterm" });
      expect(await exited).toEqual([null, "SIGTERM"]);
      expect(manager.registry.getSession("legacy")?.status).toBe("interrupted");
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await exited;
    }
  });

  for (const status of ["done", "error", "interrupted"] as const) {
    it(`reads retained ${status} results through the normal manager API`, async () => {
      manager.registry.saveSession("legacy", {
        agent: "worker",
        task: "retained work",
        status,
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
        detached: true,
        instance: "job-legacy",
      });
      appendSessionMessage(root, "legacy", { role: "user", content: "Retained evidence", timestamp: Date.now() });
      expect(await manager.waitFor("legacy")).toMatchObject({
        sessionId: "legacy",
        status,
        messages: [{ role: "user", content: "Retained evidence" }],
      });
      expect(manager.registry.getSession("legacy")?.status).toBe(status);
    });
  }
});
