import type { TaskAction } from "@may-agent/sdk";

export const TASK_WORKSPACE_WRITE_WORKFLOWS = new Set([
  "domain-task-execution",
  "spec-live-reconciliation",
  "master-validation-failure",
  "non-spec-main-publication",
  "legacy-branch-family-reconciliation",
]);

export type DomainWriteRoutingDecision = {
  taskId: string;
  writeRequired: boolean;
  workflow: string | null;
  decision:
    | "read-only-agent"
    | "route-task-workspace"
    | "reject-unbound-writer";
  reason: string | null;
};

function actionTaskId(action: TaskAction): string {
  return action.kind === "create-task"
    ? action.id
    : action.kind === "update-task"
      ? action.taskId
      : "";
}

function actionWorkflow(action: TaskAction): string | null {
  if (action.kind !== "create-task" && action.kind !== "update-task")
    return null;
  return typeof action.workflow === "string" && action.workflow.trim()
    ? action.workflow.trim()
    : null;
}

function domainAction(action: TaskAction): boolean {
  if (action.kind !== "create-task" && action.kind !== "update-task")
    return false;
  return (
    actionTaskId(action).startsWith("domain/") ||
    (action.agent ?? action.owner) === "aks-explorer" ||
    action.category === "domain"
  );
}

function normalizedIntentText(action: TaskAction): string {
  if (action.kind !== "create-task" && action.kind !== "update-task") return "";
  const pieces: unknown[] = [
    action.outcome,
    ...(action.acceptance ?? []),
    action.input,
  ];
  return JSON.stringify(pieces)
    .toLowerCase()
    .replace(/\b(?:do not|must not|without|never)\b[^.\"]*/g, "read-only");
}

/** Conservative semantic gate for domain work that can change repository source. */
export function domainSourceWriteRequired(action: TaskAction): boolean {
  if (!domainAction(action)) return false;
  const text = normalizedIntentText(action);
  return (
    /\b(?:edit|modify|write|commit|publish|push|rebase|integrat(?:e|ion)|cherry-pick|apply|land)\w*\b/.test(
      text,
    ) ||
    /\b(?:source|repository|repo|branch)\s+(?:patch|change|repair|update)\b/.test(
      text,
    ) ||
    /\b(?:patch|change|repair|update)\s+(?:the\s+)?(?:source|repository|repo|branch)\b/.test(
      text,
    )
  );
}

export function decideDomainWriteRouting(
  action: TaskAction,
): DomainWriteRoutingDecision {
  const taskId = actionTaskId(action);
  const workflow = actionWorkflow(action);
  const writeRequired = domainSourceWriteRequired(action);
  if (!writeRequired) {
    return {
      taskId,
      writeRequired: false,
      workflow,
      decision: "read-only-agent",
      reason: null,
    };
  }
  if (workflow && TASK_WORKSPACE_WRITE_WORKFLOWS.has(workflow)) {
    return {
      taskId,
      writeRequired: true,
      workflow,
      decision: "route-task-workspace",
      reason: null,
    };
  }
  return {
    taskId,
    writeRequired: true,
    workflow,
    decision: "reject-unbound-writer",
    reason:
      "domain source-changing work requires an existing workflow that declares an isolated task workspace; ordinary unbound agent execution is read-only",
  };
}
