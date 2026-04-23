/// <reference path="../../../src/lib/workflow-defs.d.ts" />
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

    // Upgraded from warn → run_step (2026-04-24, Bob).
    // Per H-098/EXP-188: text warnings (Ch1) ≈ 0% compliance,
    // structural enforcement (Ch2) ≈ 100%. Injecting a corrective
    // step forces the agent to read the files it missed.
    return [
      {
        type: "run_step",
        reason: `C1.1 Edit-Without-Read: ${unique.length} file(s) edited without prior read() in this step: ${unique.join(", ")}. ` +
          `Convention requires reading a file before editing to prevent data loss from stale assumptions.`,
        step: {
          name: "c1.1-read-recovery",
          agent: true,
          task: `## C1.1 Recovery — Read Before Edit\n\n` +
            `The previous step edited ${unique.length} file(s) without reading them first: ${unique.join(", ")}.\n\n` +
            `**You MUST now:**\n` +
            `1. read() each of these files to verify the edits are correct\n` +
            `2. If any edit introduced errors (wrong content, lost data), fix them immediately\n` +
            `3. Confirm each file looks correct before proceeding\n\n` +
            `Files to verify: ${unique.map(f => `\n- \`${f}\``).join("")}`,
        },
      },
    ];
  },
};
