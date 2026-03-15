/**
 * Launcher — minimal wrapper that keeps may.ts running.
 *
 * Replaces the bash while-true restart loops in may.sh and Docker entrypoints.
 *
 * Exit code protocol:
 *   0   — Clean shutdown. Launcher exits.
 *   100 — Hot-reload requested. Restart immediately (no backoff).
 *   *   — Crash. Restart with exponential backoff + jitter.
 *
 * Signals:
 *   SIGTERM/SIGINT → forwarded to child → child exits 0 → launcher exits.
 *   If child doesn't exit within 5s of signal, SIGKILL is sent.
 *
 * Design: docs/launcher-design.md
 * Review: agents/bob/workspace/launcher-review.md
 */

import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAY_TS = resolve(__dirname, "may.ts");

const args = process.argv.slice(2);

let child: ChildProcess | null = null;
let shuttingDown = false;
let backoffMs = 2000;
let lastStartTime = 0;

// ── Exit codes ────────────────────────────────────────────────────────────
const EXIT_STOP = 0;
const EXIT_RELOAD = 100;

// ── Backoff config ────────────────────────────────────────────────────────
const BACKOFF_INITIAL = 2000;
const BACKOFF_MAX = 30_000;
const STABLE_RUN_THRESHOLD = 60_000; // Reset backoff if child ran > 60s

// ── Shutdown config ───────────────────────────────────────────────────────
const SHUTDOWN_TIMEOUT = 5000; // SIGKILL if child doesn't exit within 5s

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [launcher] ${msg}`);
}

function spawnChild(): void {
  lastStartTime = Date.now();

  log(`Starting may.ts (args: ${args.join(" ") || "(none)"})`);

  // Bun handles .ts natively — no execArgv propagation needed.
  child = spawn(process.execPath, [MAY_TS, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });

  child.on("exit", (code, signal) => {
    child = null;

    // Case 1: Clean shutdown (exit 0 or we initiated shutdown)
    if (shuttingDown || code === EXIT_STOP) {
      log(signal ? `may.ts killed by ${signal}. Exiting.` : `may.ts exited cleanly. Exiting.`);
      process.exit(0);
    }

    // Case 2: Hot-reload (exit 100) — restart immediately
    if (code === EXIT_RELOAD) {
      log("Hot-reload requested. Restarting immediately.");
      backoffMs = BACKOFF_INITIAL;
      spawnChild();
      return;
    }

    // Case 3: Crash — restart with backoff
    // Reset backoff if child ran long enough (not a crash loop)
    const runtime = Date.now() - lastStartTime;
    if (runtime > STABLE_RUN_THRESHOLD) {
      backoffMs = BACKOFF_INITIAL;
    }

    // Jitter: ±50% of base delay
    const jitter = backoffMs * (0.5 + Math.random());
    const delay = Math.min(jitter, BACKOFF_MAX);

    log(
      `may.ts exited (code ${code}, signal ${signal}, ran ${Math.round(runtime / 1000)}s). Restarting in ${Math.round(delay)}ms...`,
    );
    setTimeout(spawnChild, delay);

    // Increase backoff for next crash
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
  });

  child.on("error", (err) => {
    log(`Failed to spawn may.ts: ${err.message}`);
    child = null;

    // Treat spawn failure as a crash
    const delay = Math.min(backoffMs * (0.5 + Math.random()), BACKOFF_MAX);
    setTimeout(spawnChild, delay);
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
  });
}

// ── Signal handling ───────────────────────────────────────────────────────

function forwardSignal(sig: NodeJS.Signals): void {
  if (shuttingDown) {
    // Second signal — force kill
    log(`Received ${sig} again. Force killing child.`);
    child?.kill("SIGKILL");
    process.exit(1);
  }

  shuttingDown = true;
  log(`Received ${sig}. Forwarding to child...`);

  if (!child) {
    process.exit(0);
  }

  child.kill(sig);

  // If child doesn't exit within timeout, SIGKILL it
  const killTimer = setTimeout(() => {
    if (child) {
      log(`Child didn't exit within ${SHUTDOWN_TIMEOUT}ms. Sending SIGKILL.`);
      child.kill("SIGKILL");
    }
  }, SHUTDOWN_TIMEOUT);
  killTimer.unref(); // Don't keep process alive just for this timer
}

process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

// ── Start ─────────────────────────────────────────────────────────────────

spawnChild();
