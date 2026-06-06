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
    "    if (frame.type === 'replay') console.log(JSON.stringify({ type: 'replay', data: history }));",
    "  }",
    "});",
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
  test("keeps a detached terminal warm briefly and reuses it on reattach", async () => {
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

  test("replays terminal output when a browser reattaches", async () => {
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
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");
      expect(replayed).toContain("before refresh\n");
      expect(replayed).toContain("while detached\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes attach replay only to the newly attached browser", async () => {
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

      const firstAfterReplay = firstSocket.frames
        .slice(firstFrameCount)
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");
      const secondReplay = secondSocket.frames
        .filter((frame: any) => frame.type === "data")
        .map((frame: any) => frame.data)
        .join("");

      expect(firstAfterReplay).not.toContain("visible once\n");
      expect(secondReplay).toContain("visible once\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
