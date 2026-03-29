/**
 * Console UI — renders RunnerEvents to stdout.
 *
 * In chat mode (primary session set), renders like pi-agent:
 *   - Primary session: text streams, tool calls + results shown
 *   - Delegated sessions (children): summary only (start + end)
 *   - Background activity (cron, heartbeats, other agents): HIDDEN
 *   - Notifications: always shown (they're addressed to the human)
 *
 * In daemon mode (no primary session), shows everything dimmed (old behavior).
 */

import { isSessionEvent, type EventBus, type RunnerEvent } from "../event-bus.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";

/** Set of sessionIds that are part of the human's task tree (primary + delegations). */
type SessionTracker = {
  primary: string | null;
  children: Set<string>;
};

export function attachConsoleUI(bus: EventBus, getPrimarySessionId?: () => string | null, chatMode?: boolean): void {
  const tracker: SessionTracker = { primary: null, children: new Set() };

  bus.on((event) => {
    const primarySid = getPrimarySessionId?.() ?? null;
    tracker.primary = primarySid;

    // ── Chat mode with no active session → suppress all except notifications ──
    if (chatMode && !primarySid) {
      if (event.type === "notification") {
        console.log(`\n📋 ${event.agent}: ${event.text}`);
      }
      return;
    }

    // ── No primary session (daemon mode) → show everything dimmed ────
    if (!primarySid) {
      renderDaemon(event);
      return;
    }

    // ── Chat mode: filter to primary session + its delegation tree ────

    if (isSessionEvent(event)) {
      const sid = event.sessionId;
      const isPrimary = sid === primarySid;

      // Track delegation children: if a session starts with parentSessionId
      // matching primary or a known child, it's part of our task tree
      if (event.type === "session_start" && event.parentSessionId) {
        if (event.parentSessionId === primarySid || tracker.children.has(event.parentSessionId)) {
          tracker.children.add(sid);
        }
      }

      const isChild = tracker.children.has(sid);

      if (isPrimary) {
        renderPrimary(event);
      } else if (isChild) {
        renderChild(event);
      }
      // else: background — drop silently
      return;
    }

    // ── Non-session events ───────────────────────────────────────────
    switch (event.type) {
      case "notification":
        // Notifications are human-facing — always show
        console.log(`\n📋 ${event.agent}: ${event.text}`);
        break;
      // Everything else (log, info, eval) — drop in chat mode
    }
  });
}

/** Render events from the primary session (human's direct conversation). */
function renderPrimary(event: RunnerEvent & { sessionId: string }): void {
  switch (event.type) {
    case "text":
      process.stdout.write(event.text);
      break;
    case "tool_call":
      console.log(`${DIM}[${event.tool}] ${formatArgs(event.tool, event.args)}${RESET}`);
      break;
    case "tool_result":
      if (event.isError) {
        console.log(`${DIM}[${event.tool}] ERROR: ${event.preview.slice(0, 200)}${RESET}`);
      }
      // Successful results: don't show (agent will summarize)
      break;
    case "turn_end":
      // Subtle separator between turns
      break;
    case "session_end":
      if (event.error) {
        console.log(`\n⚠️ ${event.error}`);
      }
      break;
  }
}

/** Render events from delegated child sessions (summary only). */
function renderChild(event: RunnerEvent & { sessionId: string }): void {
  switch (event.type) {
    case "session_start":
      if ("agent" in event && "task" in event) {
        console.log(`${DIM}${CYAN}→ [${event.agent}] ${(event.task as string).slice(0, 100)}${RESET}`);
      }
      break;
    case "session_end":
      if ("agent" in event) {
        const outcome = (event as { outcome?: string }).outcome;
        const summary = outcome ? outcome.slice(0, 150) : event.status;
        console.log(`${DIM}${CYAN}← [${(event as { agent: string }).agent}] ${summary}${RESET}`);
      }
      break;
    // Everything else from children: drop (tool calls, text, etc.)
  }
}

/** Daemon mode: show everything dimmed (no primary session). */
function renderDaemon(event: RunnerEvent): void {
  switch (event.type) {
    case "text":
      if (isSessionEvent(event)) {
        process.stdout.write(`${DIM}${event.text}${RESET}`);
      }
      break;
    case "tool_call":
      if (isSessionEvent(event)) {
        console.log(`${DIM}[${event.agent}:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}${RESET}`);
      }
      break;
    case "tool_result":
      if (isSessionEvent(event)) {
        const prefix = `[${event.agent}:${event.tool}]`;
        if (event.isError) {
          console.log(`${DIM}${prefix} ERROR${RESET}`);
        }
      }
      break;
    case "session_start":
      if (isSessionEvent(event) && event.parentSessionId) {
        console.log(`${DIM}[${event.agent}] started: ${event.task.slice(0, 100)}${RESET}`);
      }
      break;
    case "session_end":
      if (isSessionEvent(event)) {
        console.log(`${DIM}[${event.agent}] ${event.status}${RESET}`);
      }
      break;
    case "notification":
      console.log(`📋 ${event.agent}: ${event.text}`);
      break;
    case "info":
      console.log(`${DIM}${(event as { message: string }).message}${RESET}`);
      break;
    case "log":
      if (event.level === "error") {
        console.log(`${DIM}[${event.level}] ${event.message}${RESET}`);
      }
      break;
  }
}

/** Format tool call arguments for display. */
function formatArgs(tool: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  switch (tool) {
    case "bash":
      return String(a.command ?? "").slice(0, 200);
    case "read":
      return String(a.path ?? "");
    case "write":
      return String(a.path ?? "");
    case "edit":
      return String(a.path ?? "");
    case "agents":
      return `${a.action ?? "?"} ${a.agent ?? ""} ${String(a.message ?? "").slice(0, 80)}`;
    case "workflow":
      return `${a.name ?? "?"} ${String(a.task ?? "").slice(0, 80)}`;
    case "finish":
      return `${a.status ?? "?"}: ${String(a.summary ?? "").slice(0, 100)}`;
    default:
      return JSON.stringify(args).slice(0, 200);
  }
}
