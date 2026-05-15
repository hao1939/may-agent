import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * read-before-edit guard — C1.1 Edit-Without-Read detection.
 *
 * Scans step_done events for edit() tool calls where the target file
 * was not read() earlier in the same step. Injects a corrective run_step
 * that forces the agent to read and verify the edited files.
 *
 * This catches the #1 convention violation (C1.1) which accounts for
 * ~37% of all violations in the 190-violation baseline.
 */

/**
 * Extract tool calls from messages in order.
 */
function extractToolCalls(messages: any[]): Array<{ name: string; path?: string; index: number }> {
  const calls: Array<{ name: string; path?: string; index: number }> = [];
  let idx = 0;
  for (const msg of messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "toolCall" || part.type === "tool_use") {
        const name = part.name ?? part.toolName;
        const args = part.arguments ?? part.input ?? {};
        calls.push({ name, path: args.path, index: idx++ });
      }
    }
  }
  return calls;
}

/**
 * Normalize path for comparison (strip leading ./).
 */
function normPath(p: string): string {
  return (p || "").replace(/^\.\//, "").replace(/\/+/g, "/");
}

export const guard: WorkflowGuard = {
  name: "read-before-edit",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];

    const calls = extractToolCalls(event.result.messages);
    const readPaths = new Set<string>();
    const violations: string[] = [];

    for (const call of calls) {
      if (call.name === "read" && call.path) {
        readPaths.add(normPath(call.path));
      } else if (call.name === "edit" && call.path) {
        const np = normPath(call.path);
        if (!readPaths.has(np)) {
          violations.push(np);
        }
      }
    }

    if (violations.length === 0) return [];

    // Deduplicate
    const unique = [...new Set(violations)];

    // DISABLED: mid-step run_step recovery caused 56%+ recovery session overhead.
    // The verify-after-write Tier 1 finish-block already prevents agents from
    // finishing without reading back all modified files. Mid-step recovery is
    // redundant. Warn only so we can track violation rate without the waste.
    // Disabled 2026-08-01 by optimizer. See proposal 004.
    return [
      {
        type: "warn",
        reason: `C1.1 Edit-Without-Read: ${unique.length} file(s) edited without prior read(): ${unique.join(", ")}. ` +
          `You must read() all modified files before finishing.`,
      },
    ];
  },
};
