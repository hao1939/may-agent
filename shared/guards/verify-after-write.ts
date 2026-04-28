/// <reference path="../../types/workflow-defs.d.ts" />
/**
 * verify-after-edit guard — C1.3 Write/Edit-Without-Verify detection.
 *
 * Scans step_done events for write() AND edit() tool calls where the
 * target file was not subsequently read() in the same step. Injects a
 * corrective run_step that forces the agent to verify the modified files.
 *
 * This is the #2 convention violation (C1.3). Same Ch1→Ch2 channel
 * switch that produced 0%→100% for C1.1 (read-before-edit guard),
 * EXP-188 (finish guard), and EXP-115 (optimizer completeness).
 *
 * Design: follows read-before-edit.ts pattern exactly.
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
  name: "verify-after-write",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];

    const calls = extractToolCalls(event.result.messages);

    // Track write()/edit() calls and whether a subsequent read() verified them
    const writtenPaths = new Map<string, number>(); // path → index of write/edit call
    const violations: string[] = [];

    for (const call of calls) {
      if ((call.name === "write" || call.name === "edit") && call.path) {
        const np = normPath(call.path);
        writtenPaths.set(np, call.index);
      } else if (call.name === "read" && call.path) {
        const np = normPath(call.path);
        // Only counts as verification if read comes AFTER write
        if (writtenPaths.has(np) && call.index > writtenPaths.get(np)!) {
          writtenPaths.delete(np);
        }
      }
    }

    // Any remaining entries in writtenPaths were not verified
    for (const [path] of writtenPaths) {
      violations.push(path);
    }

    if (violations.length === 0) return [];

    const unique = [...new Set(violations)];

    return [
      {
        type: "run_step",
        reason: `C1.3 Write-Without-Verify: ${unique.length} file(s) written without subsequent read() verification: ${unique.join(", ")}. ` +
          `Convention requires reading back written files to catch truncation, encoding errors, or content mistakes.`,
        step: {
          name: "c1.3-verify-recovery",
          agent: true,
          task: `## C1.3 Recovery — Verify After Write\n\n` +
            `The previous step wrote ${unique.length} file(s) without reading them back to verify:\n` +
            `${unique.map(f => `- \`${f}\``).join("\n")}\n\n` +
            `**You MUST now:**\n` +
            `1. read() each file to verify the contents are correct and complete\n` +
            `2. If any file has truncation, encoding errors, or wrong content, rewrite it\n` +
            `3. Confirm each file looks correct before proceeding`,
        },
      },
    ];
  },
};
