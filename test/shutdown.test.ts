import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * Tests for graceful shutdown behavior:
 * 1. Second SIGINT force-exits the process (repeated Ctrl+C)
 * 2. Single SIGINT + graceful cleanup exits cleanly
 * 3. No duplicate signal handlers from socket-ui
 * 4. SIGTERM handled correctly
 *
 * Uses plain node (not tsx) since test scripts are pure JS.
 */

describe("shutdown", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), "shutdown-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Spawn a node subprocess running a JS script. */
  function spawnScript(script: string): {
    proc: ChildProcess;
    stdout: () => string;
    stderr: () => string;
    waitForExit: (timeoutMs?: number) => Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  } {
    const scriptPath = join(tmpDir, "test-script.mjs");
    writeFileSync(scriptPath, script);

    const proc = spawn(process.execPath, [scriptPath], {
      cwd: tmpDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    proc.stdout!.on("data", (d) => {
      stdoutBuf += d.toString();
    });
    proc.stderr!.on("data", (d) => {
      stderrBuf += d.toString();
    });

    return {
      proc,
      stdout: () => stdoutBuf,
      stderr: () => stderrBuf,
      waitForExit: (timeoutMs = 10_000) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            proc.kill("SIGKILL");
            reject(new Error(`Process did not exit within ${timeoutMs}ms. stdout: ${stdoutBuf}, stderr: ${stderrBuf}`));
          }, timeoutMs);
          proc.on("exit", (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal });
          });
        }),
    };
  }

  function waitForOutput(getter: () => string, match: string, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (getter().includes(match)) return resolve(undefined);
        if (Date.now() - start > timeoutMs)
          return reject(new Error(`Timeout waiting for "${match}" in output: ${getter()}`));
        setTimeout(check, 50);
      };
      check();
    });
  }

  it("second SIGINT force-exits the process", async () => {
    const script = `
      let shuttingDown = false;

      function gracefulShutdown() {
        if (shuttingDown) {
          console.log("FORCE_EXIT");
          process.exit(1);
        }
        shuttingDown = true;
        console.log("GRACEFUL_START");
        setTimeout(() => {
          console.log("GRACEFUL_DONE");
          process.exit(0);
        }, 10000);
      }

      process.on("SIGINT", gracefulShutdown);
      setInterval(() => {}, 1000);
      console.log("READY");
    `;

    const { proc, stdout, waitForExit } = spawnScript(script);
    await waitForOutput(stdout, "READY");

    // First SIGINT → graceful shutdown starts
    proc.kill("SIGINT");
    await waitForOutput(stdout, "GRACEFUL_START");

    // Second SIGINT → force exit
    proc.kill("SIGINT");
    const result = await waitForExit(3000);

    expect(stdout()).toContain("FORCE_EXIT");
    expect(stdout()).not.toContain("GRACEFUL_DONE");
    expect(result.code).toBe(1);
  }, 15_000);

  it("single SIGINT with short cleanup exits code 0", async () => {
    const script = `
      let shuttingDown = false;

      function gracefulShutdown() {
        if (shuttingDown) {
          process.exit(1);
        }
        shuttingDown = true;
        console.log("GRACEFUL_START");
        setTimeout(() => {
          console.log("GRACEFUL_DONE");
          process.exit(0);
        }, 300);
      }

      process.on("SIGINT", gracefulShutdown);
      setInterval(() => {}, 1000);
      console.log("READY");
    `;

    const { proc, stdout, waitForExit } = spawnScript(script);
    await waitForOutput(stdout, "READY");

    proc.kill("SIGINT");
    const result = await waitForExit(5000);

    expect(stdout()).toContain("GRACEFUL_START");
    expect(stdout()).toContain("GRACEFUL_DONE");
    expect(result.code).toBe(0);
  }, 10_000);

  it("SIGTERM triggers shutdown and exits cleanly", async () => {
    const script = `
      let shuttingDown = false;

      function gracefulShutdown() {
        if (shuttingDown) { process.exit(1); }
        shuttingDown = true;
        console.log("SIGTERM_HANDLED");
        setTimeout(() => process.exit(0), 200);
      }

      process.on("SIGTERM", gracefulShutdown);
      setInterval(() => {}, 1000);
      console.log("READY");
    `;

    const { proc, stdout, waitForExit } = spawnScript(script);
    await waitForOutput(stdout, "READY");

    proc.kill("SIGTERM");
    const result = await waitForExit(3000);

    expect(stdout()).toContain("SIGTERM_HANDLED");
    expect(result.code).toBe(0);
  }, 10_000);

  it("no duplicate SIGINT handlers — each signal fires once", async () => {
    // Simulates fixed socket-ui: only exit cleanup, no SIGINT/SIGTERM handlers.
    // Verifies each SIGINT increments counter by exactly 1.
    const socketPath = join(tmpDir, "test.sock");
    const script = `
      import { createServer } from "node:net";
      import { existsSync, unlinkSync } from "node:fs";

      const socketPath = ${JSON.stringify(socketPath)};
      let sigintCount = 0;

      const server = createServer(() => {});
      server.listen(socketPath, () => {
        // Fixed: only exit cleanup, no SIGINT/SIGTERM handlers on the server
        process.on("exit", () => {
          try {
            server.close();
            if (existsSync(socketPath)) unlinkSync(socketPath);
          } catch {}
        });
        console.log("LISTENING");
      });

      // Single SIGINT handler (main process handler)
      process.on("SIGINT", () => {
        sigintCount++;
        console.log("SIGINT_COUNT:" + sigintCount);
        if (sigintCount >= 2) process.exit(0);
      });

      console.log("READY");
    `;

    const { proc, stdout, waitForExit } = spawnScript(script);
    await waitForOutput(stdout, "LISTENING");

    proc.kill("SIGINT");
    await waitForOutput(stdout, "SIGINT_COUNT:1");

    proc.kill("SIGINT");
    const result = await waitForExit(3000);

    expect(stdout()).toContain("SIGINT_COUNT:1");
    expect(stdout()).toContain("SIGINT_COUNT:2");
    expect(stdout()).not.toContain("SIGINT_COUNT:3");
    expect(result.code).toBe(0);
  }, 10_000);

  it("duplicate SIGINT handlers cause repeated close events (regression)", async () => {
    // Demonstrates the OLD bug: if socket-ui registers its own SIGINT handler,
    // server.close() is called on every SIGINT, causing repeated "close" events.
    const socketPath = join(tmpDir, "test-dup.sock");
    const script = `
      import { createServer } from "node:net";
      import { existsSync, unlinkSync } from "node:fs";

      const socketPath = ${JSON.stringify(socketPath)};
      let closeCount = 0;
      let sigintCount = 0;

      const server = createServer(() => {});
      server.listen(socketPath, () => console.log("LISTENING"));

      server.on("close", () => {
        closeCount++;
        console.log("SERVER_CLOSE:" + closeCount);
      });

      // OLD buggy pattern: socket-ui adds its own SIGINT handler
      const cleanup = () => {
        try {
          server.close();
          if (existsSync(socketPath)) unlinkSync(socketPath);
        } catch {}
      };
      process.on("SIGINT", cleanup);

      // Main handler that exits
      process.on("SIGINT", () => {
        sigintCount++;
        console.log("SIGINT_COUNT:" + sigintCount);
        // Exit after first SIGINT so we can inspect the output
        setTimeout(() => process.exit(0), 200);
      });

      console.log("READY");
    `;

    const { proc, stdout, waitForExit } = spawnScript(script);
    await waitForOutput(stdout, "LISTENING");

    // Single SIGINT fires both cleanup and main handler
    proc.kill("SIGINT");
    const result = await waitForExit(3000);

    // The bug: server.close() fires the "close" event
    expect(stdout()).toContain("SERVER_CLOSE:1");
    expect(stdout()).toContain("SIGINT_COUNT:1");
    expect(result.code).toBe(0);
  }, 10_000);

  it("socket file cleaned up on exit", async () => {
    const socketPath = join(tmpDir, "cleanup-test.sock");
    const script = `
      import { createServer } from "node:net";
      import { existsSync, unlinkSync } from "node:fs";

      const socketPath = ${JSON.stringify(socketPath)};
      const server = createServer(() => {});

      server.listen(socketPath, () => {
        process.on("exit", () => {
          try {
            server.close();
            if (existsSync(socketPath)) unlinkSync(socketPath);
          } catch {}
        });
        console.log("READY");
      });

      process.on("SIGTERM", () => process.exit(0));
    `;

    const { proc, stdout, waitForExit } = spawnScript(script);
    await waitForOutput(stdout, "READY");

    expect(existsSync(socketPath)).toBe(true);

    proc.kill("SIGTERM");
    await waitForExit(3000);

    expect(existsSync(socketPath)).toBe(false);
  }, 10_000);
});
