/**
 * Console UI — renders RunnerEvents to stdout.
 *
 * Uses sessionId to determine rendering: events from the primary session
 * (human's chat) render bright, everything else renders dimmed.
 */

import { isSessionEvent, type EventBus, type RunnerEvent } from "../event-bus.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export function attachConsoleUI(bus: EventBus, getPrimarySessionId?: () => string | null): void {
  bus.on((event) => {
    // Determine if this event is from the human's active session
    const primarySid = getPrimarySessionId?.() ?? null;
    const dim = primarySid
      ? isSessionEvent(event) && event.sessionId !== primarySid
      : event.type === "log" || event.type === "turn_end";

    switch (event.type) {
      case "text":
        if (dim) {
          process.stdout.write(`${DIM}${event.text}${RESET}`);
        } else {
          process.stdout.write(event.text);
        }
        break;

      case "tool_call":
        dimLog(dim, `\n[${event.agent}:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}`);
        break;

      case "tool_result": {
        const prefix = `[${event.agent}:${event.tool}]`;
        if (event.isError) {
          dimLog(dim, `${prefix} ERROR`);
        } else {
          dimLog(dim, `${prefix} ${event.preview}${event.preview.length >= 200 ? "..." : ""}`);
        }
        break;
      }

      case "turn_end":
        dimLog(true, `[${event.agent}] turn done (${Math.round(event.durationMs / 1000)}s, ${event.toolCalls} tool calls)`);
        break;

      case "session_start":
        if (event.parentSessionId) {
          dimLog(dim, `\n[${event.agent}] started: ${event.task.slice(0, 100)}`);
        }
        break;

      case "session_end":
        dimLog(dim, `[${event.agent}] ${event.status}${event.duration ? ` (${event.duration})` : ""}`);
        break;

      case "notification":
        console.log(`\n📋 ${event.agent}: ${event.text}`);
        break;

      case "workflow": {
        const prefix = `[${event.agent}:${event.event === "start" ? "workflow" : "step"}]`;
        switch (event.event) {
          case "start":
            dimLog(dim, `\n${prefix} ${event.workflow}: ${(event.task ?? "").slice(0, 100)}`);
            break;
          case "step_start":
            dimLog(dim, `${prefix} ${event.step} started`);
            break;
          case "step_done":
            dimLog(dim, `[${event.agent}:step] ${event.step} ${event.status ?? "done"} (${event.duration ?? "?"})`);
            break;
          case "done":
            dimLog(dim, `[${event.agent}:workflow] done`);
            break;
          case "escalated":
            dimLog(dim, `[${event.agent}:workflow] escalated: ${event.reason ?? ""}`);
            break;
        }
        break;
      }

      case "eval":
        dimLog(true, `\n[eval] verdict: ${event.verdict} (efficiency: ${event.efficiency}, quality: ${event.quality})`);
        break;

      case "log":
        dimLog(true, `\n[${event.level}] ${event.message}`);
        break;

      // Deprecated: info and prompt (backward compat during migration)
      case "info":
        dimLog(true, `\n[runner] ${(event as { message: string }).message}`);
        break;

      case "prompt":
        process.stdout.write(`\n[${(event as { message: string }).message}] `);
        break;
    }
  });
}

function dimLog(dim: boolean, msg: string): void {
  if (dim) {
    console.log(`${DIM}${msg}${RESET}`);
  } else {
    console.log(msg);
  }
}
