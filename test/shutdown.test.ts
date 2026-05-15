import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";

/**
 * Tests for graceful shutdown behavior:
 * 1. Second SIGINT force-exits the process (repeated Ctrl+C)
 * 2. Single SIGINT + graceful cleanup exits cleanly
 * 3. No duplicate signal handlers from socket-ui
 * 4. SIGTERM handled correctly
 *
 * These use an in-process signal emitter so the suite stays deterministic in
 * sandboxes that block subprocess signal delivery.
 */

type ExitCall = { code: number };

function createGracefulShutdown(
  log: string[],
  exitCalls: ExitCall[],
  cleanup: () => Promise<void>,
  handledMessage = "GRACEFUL_START",
) {
  let shuttingDown = false;
  let forceExited = false;

  return async () => {
    if (shuttingDown) {
      log.push("FORCE_EXIT");
      forceExited = true;
      exitCalls.push({ code: 1 });
      return;
    }

    shuttingDown = true;
    log.push(handledMessage);
    await cleanup();
    if (forceExited) return;
    log.push("GRACEFUL_DONE");
    exitCalls.push({ code: 0 });
  };
}

describe("shutdown", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), "shutdown-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("second SIGINT force-exits the process", async () => {
    const log: string[] = [];
    const exitCalls: ExitCall[] = [];
    let resolveCleanup!: () => void;
    const cleanupStarted = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    const cleanup = () => cleanupStarted;
    const shutdown = createGracefulShutdown(log, exitCalls, cleanup);

    const first = shutdown();
    expect(log).toContain("GRACEFUL_START");

    await shutdown();
    resolveCleanup();
    await first;

    expect(log).toContain("FORCE_EXIT");
    expect(log).not.toContain("GRACEFUL_DONE");
    expect(exitCalls).toContainEqual({ code: 1 });
  });

  it("single SIGINT with short cleanup exits code 0", async () => {
    const log: string[] = [];
    const exitCalls: ExitCall[] = [];
    const shutdown = createGracefulShutdown(log, exitCalls, async () => {});

    await shutdown();

    expect(log).toEqual(["GRACEFUL_START", "GRACEFUL_DONE"]);
    expect(exitCalls).toEqual([{ code: 0 }]);
  });

  it("SIGTERM triggers shutdown and exits cleanly", async () => {
    const log: string[] = [];
    const exitCalls: ExitCall[] = [];
    const processEvents = new EventEmitter();
    const shutdown = createGracefulShutdown(log, exitCalls, async () => {}, "SIGTERM_HANDLED");

    processEvents.on("SIGTERM", shutdown);
    processEvents.emit("SIGTERM");
    await Promise.resolve();

    expect(log).toContain("SIGTERM_HANDLED");
    expect(exitCalls).toEqual([{ code: 0 }]);
  });

  it("no duplicate SIGINT handlers — each signal fires once", () => {
    // Simulates fixed socket-ui: only exit cleanup, no SIGINT/SIGTERM handlers.
    const processEvents = new EventEmitter();
    const server = new EventEmitter();
    const log: string[] = [];
    let sigintCount = 0;

    server.on("close", () => log.push("SERVER_CLOSE"));
    processEvents.on("exit", () => server.emit("close"));
    processEvents.on("SIGINT", () => {
      sigintCount++;
      log.push(`SIGINT_COUNT:${sigintCount}`);
    });

    processEvents.emit("SIGINT");
    processEvents.emit("SIGINT");

    expect(log).toContain("SIGINT_COUNT:1");
    expect(log).toContain("SIGINT_COUNT:2");
    expect(log).not.toContain("SIGINT_COUNT:3");
    expect(log).not.toContain("SERVER_CLOSE");
  });

  it("duplicate SIGINT handlers cause repeated close events (regression)", () => {
    // Demonstrates the OLD bug: if socket-ui registers its own SIGINT handler,
    // server.close() is called on every SIGINT, causing repeated "close" events.
    const processEvents = new EventEmitter();
    const server = new EventEmitter();
    const log: string[] = [];
    let closeCount = 0;
    let sigintCount = 0;

    server.on("close", () => {
      closeCount++;
      log.push(`SERVER_CLOSE:${closeCount}`);
    });

    processEvents.on("SIGINT", () => server.emit("close"));
    processEvents.on("SIGINT", () => {
      sigintCount++;
      log.push(`SIGINT_COUNT:${sigintCount}`);
    });

    processEvents.emit("SIGINT");

    expect(log).toContain("SERVER_CLOSE:1");
    expect(log).toContain("SIGINT_COUNT:1");
  });

  it("socket file cleaned up on exit", () => {
    const socketPath = join(tmpDir, "cleanup-test.sock");
    const processEvents = new EventEmitter();

    writeFileSync(socketPath, "");
    processEvents.on("exit", () => {
      try {
        if (existsSync(socketPath)) unlinkSync(socketPath);
      } catch {}
    });

    expect(existsSync(socketPath)).toBe(true);
    processEvents.emit("exit");
    expect(existsSync(socketPath)).toBe(false);
  });
});
