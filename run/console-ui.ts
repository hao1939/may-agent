/**
 * Console UI — renders RunnerEvents to stdout.
 *
 * Chat-channel events render normally (bright).
 * Activity-channel events render dimmed so the user can focus on conversation.
 */

import { eventChannel, type EventBus } from "./event-bus.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export function attachConsoleUI(bus: EventBus): void {
  bus.on((event) => {
    const ch = eventChannel(event);
    const dim = ch === "activity";

    switch (event.type) {
      case "text":
        if (dim) {
          process.stdout.write(`${DIM}${event.text}${RESET}`);
        } else {
          process.stdout.write(event.text);
        }
        break;

      case "tool_call":
        if (event.agent === "may") {
          dimLog(dim, `\n[tool:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}`);
        } else {
          dimLog(dim, `  [${event.agent}:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}`);
        }
        break;

      case "tool_result": {
        const prefix = event.agent === "may" ? `[tool:${event.tool}]` : `  [${event.agent}:${event.tool}]`;
        if (event.isError) {
          dimLog(dim, `${prefix} ERROR`);
        } else {
          const line = `${event.preview}${event.preview.length >= 200 ? "..." : ""}`;
          dimLog(dim, `${prefix} ${line}`);
        }
        break;
      }

      case "session_start":
        // Sub-agent sessions announced via workflow events
        break;

      case "session_end":
        // Handled by workflow step_done events
        break;

      case "workflow": {
        const prefix = `[${event.agent}:${event.event === "start" ? "workflow" : "step"}]`;
        switch (event.event) {
          case "start":
            dimLog(dim, `\n${prefix} ${event.workflow}: ${(event.task ?? "").slice(0, 100)}`);
            break;
          case "step_start":
            dimLog(dim, `${prefix} ${event.step} started${event.sessionId ? ` (${event.sessionId})` : ""}`);
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
        dimLog(dim, `\n[eval] verdict: ${event.verdict} (efficiency: ${event.efficiency}, quality: ${event.quality})`);
        if (event.tokens) {
          dimLog(dim, `[eval] usage: ${event.tokens} tokens, $${(event.cost ?? 0).toFixed(4)}, ${event.turns} turns`);
        }
        if (event.failureChains && event.failureChains > 0) {
          dimLog(dim, `[eval] failure chains: ${event.failureChains} (${event.wastedCalls} wasted calls)`);
        }
        break;

      case "info":
        dimLog(dim, `\n[runner] ${event.message}`);
        break;

      case "prompt":
        if (ch === "chat") {
          process.stdout.write(`\n[${event.message}] `);
        } else {
          dimLog(true, `\n[${event.message}]`);
        }
        break;
    }
  });
}

/** console.log with optional ANSI dim wrapping. */
function dimLog(dim: boolean, msg: string): void {
  if (dim) {
    console.log(`${DIM}${msg}${RESET}`);
  } else {
    console.log(msg);
  }
}
