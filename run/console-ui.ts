/**
 * Console UI — renders RunnerEvents to stdout.
 */

import type { EventBus } from "./event-bus.js";

export function attachConsoleUI(bus: EventBus): void {
  bus.on((event) => {
    switch (event.type) {
      case "text":
        if (event.agent === "may") {
          process.stdout.write(event.text);
        } else {
          process.stdout.write(event.text);
        }
        break;

      case "tool_call":
        if (event.agent === "may") {
          console.log(`\n[tool:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}`);
        } else {
          console.log(`  [${event.agent}:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}`);
        }
        break;

      case "tool_result":
        if (event.isError) {
          if (event.agent === "may") {
            console.log(`[tool:${event.tool}] ERROR`);
          } else {
            console.log(`  [${event.agent}:${event.tool}] ERROR`);
          }
        } else {
          const line = `${event.preview}${event.preview.length >= 200 ? "..." : ""}`;
          if (event.agent === "may") {
            console.log(`[tool:${event.tool}] ${line}`);
          } else {
            console.log(`  [${event.agent}:${event.tool}] ${line}`);
          }
        }
        break;

      case "session_start":
        if (event.agent !== "may") {
          // Sub-agent sessions announced via workflow events
        }
        break;

      case "session_end":
        // Handled by workflow step_done events
        break;

      case "workflow": {
        const prefix = `[${event.agent}:${event.event === "start" ? "workflow" : "step"}]`;
        switch (event.event) {
          case "start":
            console.log(`\n${prefix} ${event.workflow}: ${(event.task ?? "").slice(0, 100)}`);
            break;
          case "step_start":
            console.log(`${prefix} ${event.step} started${event.sessionId ? ` (${event.sessionId})` : ""}`);
            break;
          case "step_done":
            console.log(`[${event.agent}:step] ${event.step} ${event.status ?? "done"} (${event.duration ?? "?"})`);
            break;
          case "done":
            console.log(`[${event.agent}:workflow] done`);
            break;
          case "escalated":
            console.log(`[${event.agent}:workflow] escalated: ${event.reason ?? ""}`);
            break;
        }
        break;
      }

      case "eval":
        console.log(`\n[eval] verdict: ${event.verdict} (efficiency: ${event.efficiency}, quality: ${event.quality})`);
        if (event.tokens) {
          console.log(`[eval] usage: ${event.tokens} tokens, $${(event.cost ?? 0).toFixed(4)}, ${event.turns} turns`);
        }
        if (event.failureChains && event.failureChains > 0) {
          console.log(`[eval] failure chains: ${event.failureChains} (${event.wastedCalls} wasted calls)`);
        }
        break;

      case "info":
        console.log(`\n[runner] ${event.message}`);
        break;

      case "prompt":
        process.stdout.write(`\n[may] `);
        break;
    }
  });
}
