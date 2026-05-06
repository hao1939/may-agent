/**
 * Completeness Guard — beforeToolCall hook.
 *
 * Intercepts `finish(status: "success")` for the optimizer agent and checks
 * whether the session transcript contains evidence of writing a
 * DELIVERABLES_CHECKLIST.md file. If not, blocks the finish call with
 * instructions to enumerate deliverables first.
 *
 * Mechanism: Forced externalization (KE-007, KE-034, KE-121). The act of
 * writing a deliverable checklist forces the agent to articulate what it
 * needs to produce, preventing both omissions and misinterpretations.
 *
 * Evidence: EXP-115 showed +100pp improvement (0% → 100%) on
 * incomplete-deliverables-trap when agents wrote DELIVERABLES_CHECKLIST.md
 * before executing. The baseline failure was misinterpretation, not omission.
 *
 * Policy: FAIL-OPEN — if detection logic throws, allow the call through.
 * Source: EXP-115 Phase 3 via Coach.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Default filename the agent must create before finishing. */
const DEFAULT_CHECKLIST_FILENAME = "DELIVERABLES_CHECKLIST";

/**
 * Options for the completeness guard.
 */
export interface CompletenessGuardOptions {
  /**
   * Which agent(s) this guard applies to. If a string, matches exactly.
   * If an array, matches any. Default: ["optimizer"].
   */
  agents?: string | string[];

  /**
   * The filename (without extension) to look for in the transcript.
   * Default: "DELIVERABLES_CHECKLIST"
   */
  checklistFileName?: string;

  /**
   * Whether to block the finish call (true) or just warn (false).
   * Default: true
   */
  block?: boolean;

  /**
   * Optional callback invoked when the guard fires (for logging/metrics).
   */
  onBlock?: (agentName: string, sessionId: string) => void;
}

/**
 * Check if the transcript contains evidence of writing a checklist file.
 *
 * Scans all assistant messages for tool calls to write(), edit(), or bash()
 * that reference the checklist filename. This is transcript-based detection
 * with no filesystem access — same pattern as tool-schema-guard.ts.
 *
 * @param messages - The session transcript messages
 * @param checklistFileName - The filename to search for (without extension)
 * @returns true if evidence of writing the checklist file is found
 */
function hasChecklistEvidence(
  messages: BeforeToolCallContext["context"]["messages"],
  checklistFileName: string,
): boolean {
  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (
        !block ||
        typeof block !== "object" ||
        !("type" in block) ||
        block.type !== "toolCall" ||
        !("name" in block)
      ) {
        continue;
      }

      const name = (block as { name: string }).name;
      const args = "arguments" in block
        ? (block as { arguments: Record<string, unknown> }).arguments
        : undefined;

      if (!args) continue;

      // write() or edit() with a path containing the checklist filename
      if (name === "write" || name === "edit") {
        const path = args.path;
        if (typeof path === "string" && path.includes(checklistFileName)) {
          return true;
        }
      }

      // bash() with a command that writes to the checklist file
      // e.g., echo "..." > DELIVERABLES_CHECKLIST.md, cat > ..., tee ...
      if (name === "bash") {
        const command = args.command;
        if (typeof command === "string" && command.includes(checklistFileName)) {
          // Only count bash commands that look like writes, not just reads
          // Patterns: >, >>, tee, cat >, echo ... >
          if (/(?:>\s*|>>\s*|\btee\b|\bcat\s*>|\becho\b)/.test(command)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Create a beforeToolCall hook that enforces deliverable checklist creation
 * before finish(status: "success").
 *
 * Design:
 * - Transcript-based: scans tool call history for write()/edit()/bash() evidence
 * - No filesystem access, no async IO
 * - Fail-open: any error in detection → allow through
 * - Configurable: block vs warn, filename, agent list
 *
 * @param agentName - The current agent's name (passed from manager.ts)
 * @param options - Configuration options
 */
export function createCompletenessGuard(
  agentName: string,
  options: CompletenessGuardOptions = {},
): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  const targetAgents = options.agents
    ? (Array.isArray(options.agents) ? options.agents : [options.agents])
    : ["optimizer"];
  const checklistFileName = options.checklistFileName ?? DEFAULT_CHECKLIST_FILENAME;
  const shouldBlock = options.block !== false; // default true
  const onBlock = options.onBlock;

  // Pre-check: is this agent targeted?
  const isTargeted = targetAgents.includes(agentName);

  return async (
    ctx: BeforeToolCallContext,
  ): Promise<BeforeToolCallResult | undefined> => {
    try {
      // Only applies to targeted agents
      if (!isTargeted) return undefined;

      // Only intercept finish() calls
      if (ctx.toolCall.name !== "finish") return undefined;

      // Only guard success
      const args = ctx.args as { status?: string };
      if (args.status !== "success") return undefined;

      // Check transcript for checklist evidence
      if (hasChecklistEvidence(ctx.context.messages, checklistFileName)) {
        return undefined; // Checklist found — allow through
      }

      // Fire callback if provided
      if (onBlock) {
        try {
          onBlock(agentName, ctx.toolCall.id);
        } catch {
          // Callback errors don't block the guard
        }
      }

      // Checklist not found — block or warn
      const reason =
        `🚫 COMPLETENESS: finish(status: "success") blocked — no ${checklistFileName}.md found in session.\n\n` +
        `Before finishing, create ${checklistFileName}.md that:\n` +
        `1. Lists every deliverable required by your task\n` +
        `2. States the status of each (DONE / NOT DONE / BLOCKED)\n` +
        `3. For each DONE item, cites the file path and what you changed\n\n` +
        `Use: write({ path: "${checklistFileName}.md", content: "..." })\n` +
        `Then call finish() again.\n\n` +
        `Can't resolve? Escalate to May via message({ to: "may", content: ... }).`;

      return {
        block: shouldBlock,
        reason,
      };
    } catch {
      // Fail-open: if anything throws, allow the call through
      return undefined;
    }
  };
}
