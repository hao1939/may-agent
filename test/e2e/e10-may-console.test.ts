import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net, { type Socket, type Server } from "node:net";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const consolePath = resolve(repoRoot, "packages", "terminal", "bin", "may-console.cjs");

interface Harness {
  root: string;
  stateDir: string;
  socketPath: string;
  child: ChildProcessWithoutNullStreams;
  server: Server;
  sockets: Set<Socket>;
  frames: unknown[];
  stdout: string;
  cleanup: () => Promise<void>;
  writeLine: (line: string) => void;
  sendEvent: (event: Record<string, unknown>) => void;
  waitForFrame: (predicate: (frame: any) => boolean, timeoutMs?: number) => Promise<any>;
  waitForOutput: (text: string, timeoutMs?: number) => Promise<void>;
  restartServer: () => Promise<void>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createHarness(): Promise<Harness> {
  const root = join(tmpdir(), `may-console-e2e-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const stateDir = join(root, "state");
  const socketDir = join(stateDir, "instances", "background");
  const socketPath = join(socketDir, "may.sock");
  mkdirSync(socketDir, { recursive: true });

  const sockets = new Set<Socket>();
  const frames: unknown[] = [];
  let stdout = "";
  let server: Server;

  const startServer = async () => {
    server = net.createServer((socket) => {
      sockets.add(socket);
      socket.write(JSON.stringify({
        type: "connected",
        agent: "may",
        instance: "background",
        sessionId: null,
        activeAgents: [],
      }) + "\n");

      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const frame = JSON.parse(line);
          frames.push(frame);
          if (frame.type === "subscribe") socket.write(JSON.stringify({ type: "ok", command: "subscribe" }) + "\n");
          if (frame.type === "status") socket.write(JSON.stringify({ type: "status", activeAgents: [
            { sessionId: "s_1234567890", agent: "may", status: "idle", kind: "chat", task: "May chat" },
            { sessionId: "s_worker_abcdef", agent: "worker", status: "running", kind: "job", task: "Investigate failure" },
          ] }) + "\n");
        }
      });
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => sockets.delete(socket));
    });
    await new Promise<void>((resolveStart, reject) => {
      server.once("error", reject);
      server.listen(socketPath, () => {
        server.off("error", reject);
        resolveStart();
      });
    });
  };

  await startServer();

  const child = spawn("node", [consolePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      STATE_DIR: stateDir,
      DAEMON_INSTANCE: "background",
      DAEMON_AGENT: "may",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  const waitForFrame = async (predicate: (frame: any) => boolean, timeoutMs = 3000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = frames.find((frame) => predicate(frame as any));
      if (found) return found;
      await delay(20);
    }
    throw new Error(`Timed out waiting for frame. Frames: ${JSON.stringify(frames)}`);
  };

  const waitForOutput = async (text: string, timeoutMs = 3000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (stdout.includes(text)) return;
      await delay(20);
    }
    throw new Error(`Timed out waiting for output ${JSON.stringify(text)}. Output: ${stdout}`);
  };

  const harness: Harness = {
    root,
    stateDir,
    socketPath,
    child,
    get server() {
      return server;
    },
    sockets,
    frames,
    get stdout() {
      return stdout;
    },
    cleanup: async () => {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise<void>((resolveExit) => child.once("exit", () => resolveExit())),
        delay(500),
      ]);
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      rmSync(root, { recursive: true, force: true });
    },
    writeLine: (line: string) => {
      child.stdin.write(`${line}\n`);
    },
    sendEvent: (event: Record<string, unknown>) => {
      for (const socket of sockets) socket.write(JSON.stringify(event) + "\n");
    },
    waitForFrame,
    waitForOutput,
    restartServer: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      await startServer();
    },
  };

  await waitForFrame((frame) => frame.type === "subscribe" && frame.sessions?.[0] === "chat");
  await waitForFrame((frame) => frame.type === "status");
  return harness;
}

let harnesses: Harness[] = [];

beforeEach(() => {
  harnesses = [];
});

afterEach(async () => {
  for (const harness of harnesses) await harness.cleanup();
});

describe("May Console e2e", () => {
  test("startup is attach-only and does not wake May", async () => {
    const h = await createHarness();
    harnesses.push(h);

    await delay(100);
    expect(h.frames.slice(0, 2)).toEqual([
      { type: "subscribe", sessions: ["chat"] },
      { type: "status" },
    ]);
    expect(h.frames.some((frame: any) => frame.type === "chat.start.requested" || frame.type === "session.steer.requested" || frame.type === "fork" || frame.type === "resume")).toBe(false);
    await h.waitForOutput("s_12345678");
    await h.waitForOutput("may[may:s_1234567890]>");

    h.sendEvent({ type: "session.start", data: { sessionId: "s_1234567890", agent: "may", status: "running", kind: "chat", task: "help" } });
    await h.waitForOutput("may[may:s_1234567890 running]>");

    h.sendEvent({ type: "session.end", data: { sessionId: "s_1234567890", agent: "may", status: "done", kind: "chat", summary: "finished" } });
    await h.waitForOutput("may[may:s_1234567890 ready]>");
  });

  test("selects a target and routes bare input to it", async () => {
    const h = await createHarness();
    harnesses.push(h);

    h.writeLine("/use s_worker");
    await h.waitForFrame((frame) => frame.type === "subscribe" && frame.sessions?.[0] === "s_worker_abcdef");

    h.writeLine("/steer continue from failure");
    await h.waitForFrame((frame) =>
      frame.type === "session.steer.requested"
      && frame.data?.sessionId === "s_worker_abcdef"
      && frame.data?.message === "continue from failure"
      && frame.source === "may-console",
    );

    h.writeLine("run focused test");
    await h.waitForFrame((frame) =>
      frame.type === "session.steer.requested"
      && frame.data?.sessionId === "s_worker_abcdef"
      && frame.data?.message === "run focused test",
    );

    h.sendEvent({ type: "session.end", data: { sessionId: "s_worker_abcdef", agent: "worker", status: "done", summary: "finished" } });
    await h.waitForOutput("may[s_worker_a done]>");

    h.writeLine("resume ended session");
    await h.waitForFrame((frame) =>
      frame.type === "session.steer.requested"
      && frame.data?.sessionId === "s_worker_abcdef"
      && frame.data?.message === "resume ended session"
      && frame.source === "may-console",
    );

    h.writeLine("/may");
    h.writeLine("back to may");
    await h.waitForFrame((frame) =>
      frame.type === "session.steer.requested"
      && frame.data?.sessionId === "s_1234567890"
      && frame.data?.message === "back to may"
      && frame.source === "may-console",
    );
  });

  test("does not repeat successful May chat response in the session end summary", async () => {
    const h = await createHarness();
    harnesses.push(h);

    h.sendEvent({ type: "text", sessionId: "s_1234567890", agent: "may", text: "Hi there!\n" });
    h.sendEvent({
      type: "session.end",
      data: {
        sessionId: "s_1234567890",
        agent: "may",
        status: "done",
        kind: "chat",
        summary: "Hi there! I'm your orchestrator agent — I help coordinate work across the project.",
      },
    });
    await h.waitForOutput("[may] s_1234567890 ready");
    await h.waitForOutput("may[may:s_1234567890 ready]>");
    expect(h.stdout).not.toContain("[may] s_1234567890 ready: Hi there!");
  });

  test("prints May chat summary when no streamed text arrived", async () => {
    const h = await createHarness();
    harnesses.push(h);

    h.sendEvent({
      type: "session.end",
      data: {
        sessionId: "s_1234567890",
        agent: "may",
        status: "done",
        kind: "chat",
        summary: "Hi there! I can help coordinate project work.",
      },
    });

    await h.waitForOutput("Hi there! I can help coordinate project work.");
    await h.waitForOutput("[may] s_1234567890 ready");
    await h.waitForOutput("may[may:s_1234567890 ready]>");
  });

  test("clears stale May chat target when status no longer reports it", async () => {
    const h = await createHarness();
    harnesses.push(h);

    h.sendEvent({
      type: "session.end",
      data: {
        sessionId: "s_1234567890",
        agent: "may",
        status: "done",
        kind: "chat",
        summary: "ready",
      },
    });
    await h.waitForOutput("may[may:s_1234567890 ready]>");

    const beforeStatus = h.stdout.length;
    h.sendEvent({ type: "status", activeAgents: [
      { sessionId: "s_worker_abcdef", agent: "worker", status: "running", kind: "job", task: "Investigate failure" },
    ] });
    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (h.stdout.slice(beforeStatus).includes("may[may]>")) return;
      await delay(20);
    }
    throw new Error(`Timed out waiting for stale May prompt to clear. Output: ${h.stdout.slice(beforeStatus)}`);
  });

  test("handles cancel/new and rejects ambiguous or missing session steering locally", async () => {
    const h = await createHarness();
    harnesses.push(h);

    h.sendEvent({ type: "status", activeAgents: [
      { sessionId: "s_1234567890", agent: "may", status: "ready", kind: "chat", task: "May chat" },
      { sessionId: "s_abc111", agent: "a", status: "running", kind: "job", task: "one" },
      { sessionId: "s_abc222", agent: "b", status: "running", kind: "job", task: "two" },
    ] });
    h.writeLine("/use s_abc");
    await h.waitForOutput("ambiguous session id");
    await delay(100);
    expect(h.frames.some((frame: any) => frame.type === "subscribe" && frame.sessions?.[0] === "s_abc")).toBe(false);

    h.writeLine("/may");
    h.writeLine("/cancel");
    await h.waitForFrame((frame) =>
      frame.type === "session.cancel.requested"
      && frame.data?.sessionId === "s_1234567890"
      && frame.source === "may-console",
    );

    h.writeLine("/use s_abc111");
    await h.waitForFrame((frame) => frame.type === "subscribe" && frame.sessions?.[0] === "s_abc111");
    h.writeLine("/cancel");
    await h.waitForFrame((frame) =>
      frame.type === "session.cancel.requested"
      && frame.data?.sessionId === "s_abc111"
      && frame.source === "may-console",
    );

    h.writeLine("/new");
    await h.waitForFrame((frame) => frame.type === "subscribe" && frame.sessions?.[0] === "chat");
    h.writeLine("fresh topic");
    await h.waitForFrame((frame) =>
      frame.type === "chat.start.requested"
      && frame.data?.message === "fresh topic"
      && frame.data?.forceNew === true
      && frame.source === "may-console",
    );
  });

  test("reconnects and resubscribes without queuing disconnected input", async () => {
    const h = await createHarness();
    harnesses.push(h);

    h.writeLine("/use s_worker");
    await h.waitForFrame((frame) => frame.type === "subscribe" && frame.sessions?.[0] === "s_worker_abcdef");

    for (const socket of h.sockets) socket.destroy();
    await new Promise<void>((resolveClose) => h.server.close(() => resolveClose()));
    h.writeLine("message while disconnected");
    await h.waitForOutput("[disconnected]");
    await delay(100);
    expect(h.frames.some((frame: any) => frame.message === "message while disconnected")).toBe(false);

    await h.restartServer();
    await h.waitForFrame((frame) => frame.type === "subscribe" && frame.sessions?.[0] === "s_worker_abcdef", 5000);
    await h.waitForFrame((frame) => frame.type === "status", 5000);
  });
});
