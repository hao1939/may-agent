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
});
