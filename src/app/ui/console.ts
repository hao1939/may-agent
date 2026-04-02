/**
 * Console UI — renders events to stdout.
 *
 * Chat mode: show primary session events bright, everything else hidden.
 * Daemon mode: show everything dimmed.
 */

import { isSessionEvent, type EventBus } from "../event-bus.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export function attachConsoleUI(bus: EventBus, getPrimarySessionId?: () => string | null, chatMode?: boolean): void {
  bus.subscribe((event) => {
    const primarySid = getPrimarySessionId?.() ?? null;

    // Chat mode: only show primary session + notifications
    if (chatMode) {
      // Debug: uncomment to trace session matching
      // Debug removed
      if (event.type === "notification") {
        console.log(`\n📋 ${event.agent}: ${event.text}`);
        return;
      }
      if (!primarySid) return; // no session yet, suppress all
      if (!isSessionEvent(event)) return; // drop system events (log, info, eval)
      if (event.sessionId !== primarySid) return; // drop other sessions

      // Primary session — show everything
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
          break;
        case "session_end":
          if (event.error) {
            console.log(`\n⚠️ ${event.error}`);
          }
          break;
      }
      return;
    }

    // Daemon mode: show everything dimmed
    switch (event.type) {
      case "text":
        if (isSessionEvent(event)) process.stdout.write(`${DIM}${event.text}${RESET}`);
        break;
      case "tool_call":
        if (isSessionEvent(event))
          console.log(`${DIM}[${event.agent}:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}${RESET}`);
        break;
      case "tool_result":
        if (isSessionEvent(event) && event.isError) console.log(`${DIM}[${event.agent}:${event.tool}] ERROR${RESET}`);
        break;
      case "session_start":
        if (isSessionEvent(event) && event.parentSessionId)
          console.log(`${DIM}[${event.agent}] started: ${event.task.slice(0, 100)}${RESET}`);
        break;
      case "session_end":
        if (isSessionEvent(event)) console.log(`${DIM}[${event.agent}] ${event.status}${RESET}`);
        break;
      case "notification":
        console.log(`📋 ${event.agent}: ${event.text}`);
        break;
      case "info":
        console.log(`${DIM}${(event as { message: string }).message}${RESET}`);
        break;
      case "log":
        if (event.level === "error") console.log(`${DIM}[${event.level}] ${event.message}${RESET}`);
        break;
    }
  });
}

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
