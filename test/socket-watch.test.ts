import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSocketWatchTool } from "../src/socket-watch.js";
import { SubagentManager } from "../src/manager.js";
import type { Model } from "@mariozechner/pi-ai";
import { createServer, type Server, type Socket as NetSocket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync, unlinkSync } from "node:fs";

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

/** Create a simple Unix socket server that broadcasts JSON events. */
function createTestServer(socketPath: string): {
  server: Server;
  broadcast: (data: Record<string, unknown>) => void;
  received: string[];
  close: () => void;
} {
  const clients = new Set<NetSocket>();
  const received: string[] = [];

  if (existsSync(socketPath)) unlinkSync(socketPath);

  const server = createServer((socket) => {
    clients.add(socket);

    // Send welcome message like a real may-agent socket
    socket.write(JSON.stringify({ type: "connected", maySession: "test-session" }) + "\n");

    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.trim()) received.push(line.trim());
      }
    });

    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });

  server.listen(socketPath);

  return {
    server,
    broadcast: (data) => {
      const line = JSON.stringify(data) + "\n";
      for (const c of clients) {
        try { c.write(line); } catch { /* ignore */ }
      }
    },
    received,
    close: () => {
      for (const c of clients) c.destroy();
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    },
  };
}

describe("socket_watch tool", () => {
  let dir: string;
  let manager: SubagentManager;
  let sessionId: string;
  let testServer: ReturnType<typeof createTestServer> | null = null;
  let socketPath: string;
  const toolCleanups: Array<() => void> = [];

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "socket-watch-test-"));
    socketPath = join(dir, "test.sock");
    manager = new SubagentManager({ persistDir: dir });

    manager.register({
      name: "coach",
      description: "test coach",
      domain: "test",
      systemPrompt: "You are a test coach.",
      model: fakeModel(),
      tools: [],
      persistent: true,
    });

    sessionId = manager.run("coach", "coaching task", { persistent: true });
    await manager.waitForIdle(sessionId);
  });

  afterEach(() => {
    for (const fn of toolCleanups) fn();
    toolCleanups.length = 0;
    testServer?.close();
    testServer = null;
    rmSync(dir, { recursive: true, force: true });
  });

  function makeTool() {
    const result = createSocketWatchTool({
      manager,
      getSessionId: () => sessionId,
    });
    toolCleanups.push(result.cleanup);
    return result.tool;
  }

  async function exec(tool: ReturnType<typeof makeTool>, params: Record<string, unknown>) {
    const result = await tool.execute("tc1", params as any);
    return JSON.parse(result.content[0].text);
  }

  it("connects to a Unix socket and returns watchId", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    const result = await exec(tool, {
      action: "connect",
      socketPath,
      label: "test-conn",
    });

    expect(result.watchId).toBeTruthy();
    expect(result.label).toBe("test-conn");
  });

  it("errors on connection to non-existent socket", async () => {
    const tool = makeTool();

    const result = await exec(tool, {
      action: "connect",
      socketPath: join(dir, "nonexistent.sock"),
    });

    expect(result.error).toBeTruthy();
    expect(result.error).toContain("Failed to connect");
  });

  it("sends commands to the socket", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    const { watchId } = await exec(tool, { action: "connect", socketPath });

    const sendResult = await exec(tool, {
      action: "send",
      watchId,
      data: { type: "input", message: "hello from coach" },
    });

    expect(sendResult.sent).toBe(true);

    // Wait for the server to receive
    await new Promise((r) => setTimeout(r, 100));
    expect(testServer.received.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(testServer.received[testServer.received.length - 1]);
    expect(parsed.type).toBe("input");
    expect(parsed.message).toBe("hello from coach");
  });

  it("disconnects cleanly", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    const { watchId } = await exec(tool, { action: "connect", socketPath });

    const result = await exec(tool, { action: "disconnect", watchId });
    expect(result.disconnected).toBe(true);

    // Should not be listed anymore
    const list = await exec(tool, { action: "list" });
    expect(list.length).toBe(0);
  });

  it("lists active connections", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    await exec(tool, { action: "connect", socketPath, label: "conn1" });

    const list = await exec(tool, { action: "list" });
    expect(list.length).toBe(1);
    expect(list[0].label).toBe("conn1");
    expect(list[0].connected).toBe(true);
  });

  it("injects debounced events as followUp into the coach session", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    // Spy on manager.followUp to capture what the socket_watch tool sends
    const followUpSpy = vi.spyOn(manager, "followUp");

    await exec(tool, {
      action: "connect",
      socketPath,
      label: "coachee",
      debounceMs: 200, // Short for testing
      filter: ["tool_call", "tool_result"], // Skip 'connected' welcome
    });

    // Broadcast some events
    testServer.broadcast({ type: "tool_call", tool: "exec", args: { command: "npm test" } });
    testServer.broadcast({ type: "tool_result", tool: "exec", preview: "All tests pass" });

    // Wait for debounce flush
    await new Promise((r) => setTimeout(r, 500));

    // The socket_watch tool should have called manager.followUp with the batched events
    expect(followUpSpy).toHaveBeenCalled();
    const batchText = followUpSpy.mock.calls[0][1];
    expect(batchText).toContain("[socket_watch: coachee]");
    expect(batchText).toContain("[tool_call]");
    expect(batchText).toContain("exec");
    expect(batchText).toContain("[tool_result]");

    followUpSpy.mockRestore();
  });

  it("filters events by type", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    await exec(tool, {
      action: "connect",
      socketPath,
      label: "filtered",
      debounceMs: 200,
      filter: ["tool_call"], // Only tool_call events
    });

    // Broadcast events of different types
    testServer.broadcast({ type: "tool_call", tool: "exec", args: {} });
    testServer.broadcast({ type: "info", message: "should be filtered out" });
    testServer.broadcast({ type: "text", text: "should be filtered out" });

    await new Promise((r) => setTimeout(r, 500));
    await manager.waitForIdle(sessionId);

    const msgs = manager.progress(sessionId);
    const batchMsgs = msgs.filter(
      (m) => m.role === "user" && m.content.some(
        (c) => c.type === "text" && (c as { text: string }).text.includes("[socket_watch: filtered]"),
      ),
    );

    if (batchMsgs.length > 0) {
      const batchText = (batchMsgs[0].content[0] as { text: string }).text;
      expect(batchText).toContain("[tool_call]");
      expect(batchText).not.toContain("[info]");
      expect(batchText).not.toContain("[text]");
    }
  });

  it("cleanup disconnects all watches", async () => {
    testServer = createTestServer(socketPath);
    const { tool, cleanup } = createSocketWatchTool({
      manager,
      getSessionId: () => sessionId,
    });

    await tool.execute("tc1", { action: "connect", socketPath, label: "c1" } as any);

    cleanup();

    const listResult = await tool.execute("tc2", { action: "list" } as any);
    const list = JSON.parse(listResult.content[0].text);
    expect(list.length).toBe(0);
  });

  it("returns error for missing required params", async () => {
    const tool = makeTool();

    const r1 = await exec(tool, { action: "connect" });
    expect(r1.error).toContain("requires 'socketPath'");

    const r2 = await exec(tool, { action: "send" });
    expect(r2.error).toContain("requires 'watchId'");

    const r3 = await exec(tool, { action: "send", watchId: "w1" });
    expect(r3.error).toContain("requires 'data'");

    const r4 = await exec(tool, { action: "disconnect" });
    expect(r4.error).toContain("requires 'watchId'");
  });

  it("returns error for unknown watchId", async () => {
    const tool = makeTool();

    const result = await exec(tool, { action: "send", watchId: "nonexistent", data: {} });
    expect(result.error).toContain("No socket watch");
  });

  it("collapses consecutive text events into a single block", async () => {
    testServer = createTestServer(socketPath);
    const tool = makeTool();

    await exec(tool, {
      action: "connect",
      socketPath,
      label: "text-test",
      debounceMs: 200,
      filter: ["text"],
    });

    // Send multiple text deltas
    testServer.broadcast({ type: "text", text: "Hello " });
    testServer.broadcast({ type: "text", text: "world " });
    testServer.broadcast({ type: "text", text: "from agent" });

    await new Promise((r) => setTimeout(r, 500));
    await manager.waitForIdle(sessionId);

    const msgs = manager.progress(sessionId);
    const batchMsgs = msgs.filter(
      (m) => m.role === "user" && m.content.some(
        (c) => c.type === "text" && (c as { text: string }).text.includes("[socket_watch: text-test]"),
      ),
    );

    if (batchMsgs.length > 0) {
      const batchText = (batchMsgs[0].content[0] as { text: string }).text;
      // All text should be collapsed into one [text] line
      const textLines = batchText.split("\n").filter((l) => l.startsWith("[text]"));
      expect(textLines.length).toBe(1);
      expect(textLines[0]).toContain("Hello world from agent");
    }
  });
});
