import { getWorkflowRun, getWorkflowStepSessions, listChildWorkflowRunIds } from "./db/workflows.js";
import { readWorkflowDiagnostics } from "./workflow-diagnostics.js";

const MAX_LINKED_EXECUTIONS = 100;

/** Inspect one exact execution without metrics, Event subscribers, or an agent. */
export function readWorkflowFacts(persistDir: string, runId: string) {
  const run = getWorkflowRun(persistDir, runId);
  if (!run) return null;
  const steps = getWorkflowStepSessions(persistDir, runId, MAX_LINKED_EXECUTIONS + 1);
  const children = listChildWorkflowRunIds(persistDir, runId, MAX_LINKED_EXECUTIONS + 1);
  return {
    run,
    // Sessions keep every invocation, including failed calls in a successful run.
    steps: steps.slice(0, MAX_LINKED_EXECUTIONS),
    stepsTruncated: steps.length > MAX_LINKED_EXECUTIONS,
    childRunIds: children.slice(0, MAX_LINKED_EXECUTIONS),
    childrenTruncated: children.length > MAX_LINKED_EXECUTIONS,
    diagnostics: readWorkflowDiagnostics(persistDir, runId),
  };
}
