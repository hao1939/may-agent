import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTerminalManager, type TerminalSocket } from "./manager.js";

const oldWebTerminal = process.env.MAY_WEB_TERMINAL;
const oldIdleTtl = process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS;
const oldBridge = process.env.MAY_TERMINAL_BRIDGE;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

afterEach(() => {
  if (oldWebTerminal === undefined) delete process.env.MAY_WEB_TERMINAL;
  else process.env.MAY_WEB_TERMINAL = oldWebTerminal;
  if (oldIdleTtl === undefined) delete process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS;
  else process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = oldIdleTtl;
  if (oldBridge === undefined) delete process.env.MAY_TERMINAL_BRIDGE;
  else process.env.MAY_TERMINAL_BRIDGE = oldBridge;
});

describe("terminal manager", () => {
  test("launches Codex inline so terminal history remains available", () => {
    const manager = createTerminalManager({ projectRoot: "/app" });
    const codex = manager.getStatus().profiles.find((profile) => profile.id === "codex");

    expect(codex?.command).toContain("codex --no-alt-screen resume");
    expect(codex?.command).toContain("exec codex --no-alt-screen");
  });

  test("reattaches a detached terminal through a fresh bridge", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "120";
      process.env.MAY_TERMINAL_BRIDGE = makeFakeBridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket);
      await delay(20);

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
      await delay(20);
      const secondStatus = manager.getStatus().profiles.find((profile) => profile.id === "may");
      expect(secondStatus?.pid).not.toBe(firstPid);
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

  test("does not replay raw terminal output when a browser reattaches", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-manager-"));
    try {
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "500";
      process.env.MAY_TERMINAL_BRIDGE = makeFakeBridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket);
      await delay(20);

      manager.input("may", "before refresh\n");
      await delay(20);
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
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "500";
      process.env.MAY_TERMINAL_BRIDGE = makeFakeBridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket);
      await delay(20);

      manager.input("may", "visible once\n");
      await delay(20);
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
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "500";
      process.env.MAY_TERMINAL_BRIDGE = makeFakeBridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket, 90, 18, "first");
      await delay(50);

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
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "500";
      process.env.MAY_TERMINAL_BRIDGE = makeFakeBridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const firstSocket = makeSocket();
      await manager.attach("may", firstSocket, 90, 18, "first");
      await delay(20);

      const secondSocket = makeSocket();
      await manager.attach("may", secondSocket, 166, 35, "second");
      await delay(20);

      manager.activate("may", "second", 166, 35);
      await delay(20);

      const dataFrames = () => [...firstSocket.frames, ...secondSocket.frames]
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");

      const beforeInactiveResize = dataFrames();
      manager.resize("may", 90, 18, "first");
      await delay(20);
      expect(dataFrames()).toBe(beforeInactiveResize);

      manager.activate("may", "first", 90, 18);
      await delay(20);

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
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "500";
      process.env.MAY_TERMINAL_BRIDGE = makeFakeBridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const socket = makeSocket();
      await manager.attach("codex", socket, 100, 24, "browser");
      await delay(20);

      manager.scroll("codex", "up", 500, "browser");
      manager.historyExit("codex", "browser");
      await delay(20);

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
      process.env.MAY_WEB_TERMINAL = "1";
      process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS = "500";
      process.env.MAY_TERMINAL_BRIDGE = makeSplitUtf8Bridge(root);

      const manager = createTerminalManager({ projectRoot: root });
      const socket = makeSocket();
      await manager.attach("may", socket);
      await delay(50);

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
