/// <reference path="../../types/workflow-defs.d.ts" />
/**
 * verify-after-write guard — C1.3 Write/Edit-Without-Verify detection.
 *
 * Scans step_done events for write()/edit() tool calls where the target file was
 * not subsequently read() in the same session. Blocks finish until verified.
 *
 * Design: follows read-before-edit.ts pattern exactly.
 */

/**
 * Extract tool calls from messages in order.
 */
function extractToolCalls(messages: any[]): Array<{ name: string; path?: string; index: number }> {
  const calls: Array<{ name: string; path?: string; index: number }> = [];
  let idx = 0;
  const failedToolCallIds = new Set<string>();

  for (const msg of messages ?? []) {
    if (msg.role === "toolResult" && msg.isError) {
      const id = msg.toolCallId;
      if (id) failedToolCallIds.add(id);
    }
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "toolResult" && part.isError) {
        const id = part.toolCallId ?? msg.toolCallId;
        if (id) failedToolCallIds.add(id);
      }
    }
  }

  for (const msg of messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "toolCall" || part.type === "tool_use") {
        const id = part.id ?? part.toolCallId;
        if (id && failedToolCallIds.has(id)) continue;
        const name = part.name ?? part.toolName;
        const args = part.arguments ?? part.input ?? {};
        calls.push({ name, path: args.path, index: idx++ });
      }
    }
  }
  return calls;
}

/**
 * Normalize path for comparison.
 *
 * Tool calls may use either project-relative paths (`agents/dev/file.md`) or
 * absolute paths (`/app/agents/dev/file.md`). Treat those as the same file so
 * a legitimate read-back is not missed because the agent switched path style.
 */
function normPath(p: string): string {
  let normalized = (p || "").replace(/\\/g, "/").replace(/\/+/g, "/");
  normalized = normalized.replace(/^\.\//, "");
  normalized = normalized.replace(/^\/app\//, "");
  return normalized;
}

/**
 * Find unverified edit paths in a single step's messages.
 */
function findUnverifiedPaths(messages: any[]): string[] {
  const calls = extractToolCalls(messages);
  const writtenPaths = new Map<string, number>(); // path -> index of write/edit call

  for (const call of calls) {
    if ((call.name === "write" || call.name === "edit") && call.path) {
      const np = normPath(call.path);
      writtenPaths.set(np, call.index);
    } else if (call.name === "read" && call.path) {
      const np = normPath(call.path);
      // Only counts as verification if read comes AFTER edit
      if (writtenPaths.has(np) && call.index > writtenPaths.get(np)!) {
        writtenPaths.delete(np);
      }
    }
  }

  return [...writtenPaths.keys()];
}

/**
 * Scan all completed steps + current step for unverified writes/edits across
 * the entire session. A read() in a later step counts as verification.
 */
function findSessionUnverifiedPaths(event: WorkflowGuardEvent): string[] {
  // Collect all steps: completed + current
  const allMessages: any[][] = [];
  for (const step of event.completedSteps ?? []) {
    if (step.result?.messages) {
      allMessages.push(step.result.messages as any[]);
    }
  }
  allMessages.push(event.result.messages as any[]);

  // Build global write/edit->read tracking across all steps in order.
  const unverified = new Set<string>();

  for (const messages of allMessages) {
    const calls = extractToolCalls(messages);
    for (const call of calls) {
      if ((call.name === "write" || call.name === "edit") && call.path) {
        unverified.add(normPath(call.path));
      } else if (call.name === "read" && call.path) {
        unverified.delete(normPath(call.path));
      }
    }
  }

  return [...unverified];
}

export const guard: WorkflowGuard = {
  name: "verify-after-write",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];

    const demands: Demand[] = [];

    // === Tier 1: Finish-block enforcement ===
    // If this step is finishing with success, block if ANY modifications across the
    // entire session remain unverified. Same pattern as finish-guard (EXP-188).
    const finishResult = event.result?.finishResult;
    if (finishResult && finishResult.status === "success") {
      const sessionUnverified = findSessionUnverifiedPaths(event);
      if (sessionUnverified.length > 0) {
        return [{
          type: "block",
          reason:
            `C1.3 Verify-After-Write: Cannot finish(success) — ${sessionUnverified.length} file(s) ` +
            `were written or edited but never read() back for verification: ` +
            `${sessionUnverified.join(", ")}. ` +
            `You MUST read() each modified file to verify correctness before finishing.`,
        }];
      }
    }

    // === Tier 3: DISABLED — was injecting run_step recovery for every unverified write ===
    // This caused 56%+ of all sessions to be recovery sessions (P0 waste).
    // Tier 1 finish-block is sufficient: agents cannot finish(success) without
    // verifying all writes. Mid-workflow recovery steps are redundant.
    // Disabled 2026-08-01 by optimizer. See proposal 004.

    return demands;
  },
};
