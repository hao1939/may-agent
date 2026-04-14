/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * auto-test guard — injects a test step when source files are modified
 * without test confirmation.
 *
 * Listens to step_done events from agent steps. If the step modified .ts/.js
 * files under src/ but the output doesn't mention test results, it injects
 * a run_step demand to run the test suite.
 */

/**
 * Extract changed files from a task result by scanning messages for
 * write/edit tool calls and finish deliverables. Inlined from workflow-utils
 * since guards can't import from src/ at runtime.
 */
function getChangedFiles(result: { messages: any[]; finishResult?: { deliverables?: Array<{ path: string }> } }): string[] {
  const files = new Set<string>();

  // Scan messages for write/edit tool calls
  for (const msg of result.messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "toolCall" && (part.name === "write" || part.name === "edit")) {
        const p = part.arguments?.path;
        if (typeof p === "string") files.add(p);
      }
      // Also pick up "Wrote N bytes to <path>" from tool results
      if (part.type === "text" && typeof part.text === "string") {
        const m = part.text.match(/Wrote \d+ bytes to (\S+)/);
        if (m) files.add(m[1]);
      }
    }
  }

  // Include finish deliverables
  if (result.finishResult?.deliverables) {
    for (const d of result.finishResult.deliverables) {
      if (typeof d.path === "string") files.add(d.path);
    }
  }

  return [...files];
}

export const guard: WorkflowGuard = {
  name: "auto-test",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    // Don't trigger on function steps or guard-injected steps
    if (event.source === "function") return [];
    if (event.step.startsWith("guard:")) return [];

    const srcFiles = getChangedFiles(event.result)
      .filter(f => (f.endsWith(".ts") || f.endsWith(".js")) && f.startsWith("src/"));
    if (srcFiles.length === 0) return [];

    // Check if tests were already confirmed in the output
    const text = event.result.lastAssistantText ?? "";
    const alreadyTested =
      /all\s+\d+\s+tests?\s+pass/i.test(text) ||
      /\d+\s+pass\s+0\s+fail/i.test(text) ||
      /tests?\s+(pass|passed|passing|green|succeeded)/i.test(text);
    if (alreadyTested) return [];

    return [
      {
        type: "run_step",
        reason: `${srcFiles.length} source file(s) modified without test confirmation`,
        step: {
          agent: "coder",
          task: `Run the test suite to verify the changes to: ${srcFiles.join(", ")}. Run: bun test. Report pass/fail counts.`,
          label: "guard:auto-test",
        },
      },
    ];
  },
};
