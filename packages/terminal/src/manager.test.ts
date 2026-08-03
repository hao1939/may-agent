import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTerminalManager, type TerminalSocket } from "./manager.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for terminal test condition");
    await delay(5);
  }
}

function makeFakeBridge(root: string): string {
  const bridge = join(root, "fake-terminal-bridge.cjs");
  writeFileSync(bridge, [
    "#!/usr/bin/env node",
    "console.log(JSON.stringify({ type: 'ready', pid: process.pid }));",
    "let buffer = '';",
    "let history = '';",
    "process.stdin.on('data', chunk => {",
    "  buffer += chunk.toString();",
    "  const lines = buffer.split('\\n');",
    "  buffer = lines.pop() || '';",
    "  for (const line of lines) {",
    "    if (!line.trim()) continue;",
    "    const frame = JSON.parse(line);",
    "    if (frame.type === 'input') { const data = String(frame.data || ''); history += data; console.log(JSON.stringify({ type: 'data', data })); }",
    "    if (frame.type === 'resize') console.log(JSON.stringify({ type: 'data', data: `resize ${frame.cols}x${frame.rows}\\n` }));",
    "    if (frame.type === 'scroll') console.log(JSON.stringify({ type: 'data', data: `scroll ${frame.direction} ${frame.lines}\\n` }));",
    "    if (frame.type === 'history-exit') console.log(JSON.stringify({ type: 'data', data: 'history-exit\\n' }));",
    "    if (frame.type === 'replay') console.log(JSON.stringify({ type: 'replay', data: history }));",
    "  }",
    "});",
    "process.stdin.resume();",
  ].join("\n"), "utf-8");
  return bridge;
}

function makeSplitUtf8Bridge(root: string): string {
  const bridge = join(root, "fake-terminal-bridge.cjs");
  writeFileSync(bridge, [
    "#!/usr/bin/env node",
    "process.stdout.write(JSON.stringify({ type: 'ready', pid: process.pid }) + '\\n');",
    "const payload = 'progress █▒ ✓\\n';",
    "const frame = JSON.stringify({ type: 'data', data: payload }) + '\\n';",
    "const bytes = Buffer.from(frame, 'utf8');",
    "const splitAt = bytes.indexOf(Buffer.from('█')) + 1;",
    "process.stdout.write(bytes.subarray(0, splitAt));",
    "setTimeout(() => process.stdout.write(bytes.subarray(splitAt)), 5);",
    "process.stdin.resume();",
  ].join("\n"), "utf-8");
  return bridge;
}

function makeDelayedReadyBridge(root: string): string {
  const bridge = join(root, "fake-terminal-bridge.cjs");
  writeFileSync(bridge, [
    "#!/usr/bin/env node",
    "setTimeout(() => console.log(JSON.stringify({ type: 'ready', pid: process.pid })), 40);",
    "process.stdin.resume();",
  ].join("\n"), "utf-8");
  return bridge;
}

function makeSocket(): TerminalSocket & { frames: unknown[]; closed: boolean } {
  return {
    frames: [],
    closed: false,
    send(data: string) {
      this.frames.push(JSON.parse(data));
    },
    close() {
      this.closed = true;
    },
  };
}

function createTestManager(root: string, bridgePath: string, idleTtlMs = 500) {
  return createTerminalManager({
    projectRoot: root,
    enabled: true,
    idleTtlMs,
    bridgePath,
    tmuxSocket: `may-web-test-${process.pid}`,
  });
}

describe("terminal manager", () => {
  test("launches Codex inline so terminal history remains available", () => {
    const manager = createTerminalManager({ projectRoot: "/app" });
    const codex = manager.getStatus().profiles.find((profile) => profile.id === "codex");

    expect(codex?.command).toContain("codex --no-alt-screen resume");
    expect(codex?.command).toContain("exec codex --no-alt-screen");
  });

  test("launches Claude with the configured endpoint and Opus 5 by default", () => {
    const manager = createTerminalManager({ projectRoot: "/app" });
    const claude = manager.getStatus().profiles.find((profile) => profile.id === "claude");

    expect(claude?.command).toContain("ANTHROPIC_BASE_URL");
    expect(claude?.command).toContain("${CLAUDE_MODEL:-claude-opus-5}");
  });

  test("reattaches a detached terminal through the warm bridge", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeFakeBridge(root), 120);
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket);
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "ready"));

      const firstStatus = manager.getStatus().profiles.find((profile) => profile.id === "may");
      expect(firstStatus?.connected).toBe(true);
      expect(firstStatus?.clients).toBe(1);
      const firstPid = firstStatus?.pid;

      manager.detach("may", firstSocket);
      const idleStatus = manager.getStatus().profiles.find((profile) => profile.id === "may");
      expect(idleStatus?.connected).toBe(true);
      expect(idleStatus?.clients).toBe(0);
      expect(typeof idleStatus?.idleUntil).toBe("number");

      const secondSocket = makeSocket();
      await manager.attach("may", secondSocket);
      await waitFor(() => secondSocket.frames.some((frame: any) => frame.type === "ready"));
      const secondStatus = manager.getStatus().profiles.find((profile) => profile.id === "may");
      expect(secondStatus?.pid).toBe(firstPid);
      expect(secondStatus?.clients).toBe(1);
      expect(secondStatus?.idleUntil).toBeUndefined();

      manager.detach("may", secondSocket);
      await delay(180);
      const finalStatus = manager.getStatus().profiles.find((profile) => profile.id === "may");
      expect(finalStatus?.connected).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports starting until the bridge confirms PTY readiness", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeDelayedReadyBridge(root));
      const socket = makeSocket();
      await manager.attach("may", socket);

      expect((socket.frames[0] as any)?.type).toBe("starting");
      expect(socket.frames.some((frame: any) => frame.type === "ready")).toBe(false);
      await waitFor(() => socket.frames.some((frame: any) => frame.type === "ready"));

      const ready = socket.frames.find((frame: any) => frame.type === "ready") as any;
      expect(ready?.profile?.id).toBe("may");
      expect(ready?.pid).toBeNumber();
      expect(ready?.startupMs).toBeGreaterThanOrEqual(30);
      expect(manager.getStatus().profiles.find((profile) => profile.id === "may")?.ready).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not replay raw terminal output when a browser reattaches", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeFakeBridge(root));
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket);
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "ready"));

      manager.input("may", "before refresh\n");
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "data" && frame.data === "before refresh\n"));
      manager.detach("may", firstSocket);

      manager.input("may", "while detached\n");
      await delay(20);

      const secondSocket = makeSocket();
      await manager.attach("may", secondSocket);
      await delay(20);

      const replayed = secondSocket.frames
        .filter((frame: any) => frame.type === "replay")
        .map((frame: any) => frame.data)
        .join("");
      expect(replayed).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not send replay frames to concurrent browser clients", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeFakeBridge(root));
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket);
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "ready"));

      manager.input("may", "visible once\n");
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "data" && frame.data === "visible once\n"));
      const firstFrameCount = firstSocket.frames.length;

      const secondSocket = makeSocket();
      await manager.attach("may", secondSocket);
      await delay(20);

      const firstReplay = firstSocket.frames
        .slice(firstFrameCount)
        .filter((frame: any) => frame.type === "replay")
        .map((frame: any) => frame.data)
        .join("");
      const secondReplay = secondSocket.frames
        .filter((frame: any) => frame.type === "replay")
        .map((frame: any) => frame.data)
        .join("");

      expect(firstReplay).toBe("");
      expect(secondReplay).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps existing bridge size when a passive browser attaches", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeFakeBridge(root));
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket, 90, 18, "first");
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "data" && frame.data === "resize 90x18\n"));

      const secondSocket = makeSocket();
      await manager.attach("may", secondSocket, 166, 35, "second");
      await delay(50);

      const resized = [...firstSocket.frames, ...secondSocket.frames]
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");

      expect(resized).toContain("resize 90x18\n");
      expect(resized).not.toContain("resize 166x35\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores resize from inactive concurrent browser clients", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeFakeBridge(root));
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket, 90, 18, "first");
      await waitFor(() => firstSocket.frames.some((frame: any) => frame.type === "ready"));

      const secondSocket = makeSocket();
      await manager.attach("may", secondSocket, 166, 35, "second");
      await delay(20);

      const dataFrames = () => [...firstSocket.frames, ...secondSocket.frames]
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");

      manager.activate("may", "second", 166, 35);
      await waitFor(() => dataFrames().includes("resize 166x35\n"));

      const beforeInactiveResize = dataFrames();
      manager.resize("may", 90, 18, "first");
      await delay(20);
      expect(dataFrames()).toBe(beforeInactiveResize);

      manager.activate("may", "first", 90, 18);
      await waitFor(() => dataFrames().includes("resize 90x18\n"));

      const resized = dataFrames();
      expect(resized).toContain("resize 166x35\n");
      expect(resized).toContain("resize 90x18\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("forwards bounded history scrolling and an explicit return to live view", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeFakeBridge(root));
      const socket = makeSocket();
      await manager.attach("codex", socket, 100, 24, "browser");
      await delay(20);

      manager.scroll("codex", "up", 500, "browser");
      manager.historyExit("codex", "browser");
      await waitFor(() => socket.frames.some((frame: any) => frame.type === "data" && frame.data === "history-exit\n"));

      const output = socket.frames
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");
      expect(output).toContain("scroll up 100\n");
      expect(output).toContain("history-exit\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("preserves split UTF-8 inside bridge JSONL frames", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      const manager = createTestManager(root, makeSplitUtf8Bridge(root));
      const socket = makeSocket();
      await manager.attach("may", socket);
      await waitFor(() => socket.frames.some((frame: any) => frame.type === "data"));

      const output = socket.frames
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");

      expect(output).toContain("progress █▒ ✓\n");
      expect(output).not.toContain("�");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
