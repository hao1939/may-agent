/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * finish-guard — FM-3.4 Persistent-Task Enforcement.
 *
 * Blocks workflow steps that finish(success) when the task required
 * persistent-task workflow usage but the agent worked inline instead.
 *
 * Evidence: EXP-188 confirmed +100pp (0% → 100%) adoption with this guard.
 * Without it, agents read the instruction, work inline, and skip the workflow.
 *
 * Detection heuristic:
 * - Task contains "project:" pointing to a directory with project.md → required
 * - Task explicitly mentions persistent-task workflow → required
 * - Result messages contain workflow.run("persistent-task") call → satisfied
 *
 * Fail-open: only blocks finish(success). Other statuses pass through.
 */

/**
 * Check if the task text indicates persistent-task workflow is required.
 */
function isPersistentTaskRequired(taskText: string): boolean {
  if (!taskText) return false;
  const lower = taskText.toLowerCase();

  // Explicit workflow mention
  if (lower.includes('workflow.run("persistent-task"') ||
      lower.includes("workflow.run('persistent-task'") ||
      lower.includes('run the persistent-task workflow') ||
      lower.includes('use persistent-task workflow') ||
      lower.includes('must use persistent-task')) {
    return true;
  }

  // Task has a project: field pointing to a directory
  const projectMatch = taskText.match(/^project:\s*(.+)$/m);
  if (projectMatch) {
    const projectPath = projectMatch[1].trim();
    // Directory-style project references (not .md files) indicate persistent-task
    if (!projectPath.endsWith('.md') && (
      projectPath.includes('/projects/') ||
      projectPath.includes('/project.md') === false
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Check if persistent-task workflow was actually invoked during the step.
 * Scans messages for workflow.run tool calls with "persistent-task".
 */
function wasPersistentTaskRun(result: any): boolean {
  // Check messages for workflow tool calls
  for (const msg of result?.messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      // Check for workflow.run tool call
      if (part.type === "toolCall" && part.name === "workflow") {
        const args = part.arguments;
        if (args?.action === "run" && args?.name === "persistent-task") {
          return true;
        }
      }
      // Also check tool_use blocks (different message formats)
      if (part.type === "tool_use" && part.name === "workflow") {
        const input = part.input;
        if (input?.action === "run" && input?.name === "persistent-task") {
          return true;
        }
      }
    }
  }

  // Check the result text for evidence of persistent-task execution
  const text = result?.lastAssistantText ?? "";
  if (text.includes("persistent-task") && (
    text.includes("workflow.run") ||
    text.includes("workflow completed") ||
    text.includes("iterations"))) {
    return true;
  }

  return false;
}

// Re-export validation functions from src/lib/finish-guard for agent-sdk consumers
export {
  validateFinishDeliverables,
  enforceFinishDeliverables,
  validateVerificationEvidence,
  enforceVerificationEvidence,
} from "../../src/lib/finish-guard.js";
export type {
  FinishDeliverable,
  FinishCallParams,
  FinishValidationResult,
  EvidenceValidationResult,
} from "../../src/lib/finish-guard.js";

export const guard: WorkflowGuard = {
  name: "finish-guard",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];

    const finishResult = event.result?.finishResult;

    // Only gate finish(success) — other statuses are legitimate
    if (!finishResult || finishResult.status !== "success") return [];

    // Get the task text from the event
    const taskText = (event as any).task ?? event.step ?? "";

    // Check if persistent-task was required
    if (!isPersistentTaskRequired(taskText)) return [];

    // Check if persistent-task was actually run
    if (wasPersistentTaskRun(event.result)) return [];

    // Persistent-task was required but not run — block
    return [{
      type: "block",
      reason:
        "FM-3.4 Persistent-Task Required: This task required the persistent-task " +
        "workflow but it was never invoked. The agent must use " +
        'workflow.run("persistent-task", "project: <path>\\ngoal: <goal>") ' +
        "instead of working inline. Do NOT do the work directly — run the workflow.",
    }];
  },
};
