/**
 * Daemon info log — minimal bus subscriber for daemon mode.
 *
 * Problem: `attachConsoleUI` is the only subscriber that forwards `info` events
 * to stdout. It is gated behind `--console` / `--chat`, so in production
 * `--cron --socket` mode any `bus.emit({ type: "info", message })` is silently
 * dropped. With ~70 such call sites across the codebase (startup checks,
 * telegram routing diagnostics, reload summaries, etc.) this is a serious
 * operational visibility gap. See F7 in
 * `projects/platform/proposals/2026-05-19-e2e-harness-findings.md`.
 *
 * This module attaches a minimal subscriber that forwards `info` events
 * through `log("info", ...)` so they land in the daemon log. It is intended
 * to run **only when `attachConsoleUI` is NOT attached** (i.e. neither
 * `--console` nor `--chat`). Otherwise `info` events would be printed twice.
 *
 * Opt-out via env: set `MAY_DAEMON_QUIET=1` to suppress.
 */

import type { EventBus } from "../event-bus.js";
import { log } from "../../lib/log.js";

export function attachDaemonInfoLog(bus: EventBus): void {
  bus.subscribe((event) => {
    if (event.type !== "info") return;
    const message = (event as { message?: unknown }).message;
    if (typeof message !== "string" || message.length === 0) return;
    log("info", message);
  });
}
