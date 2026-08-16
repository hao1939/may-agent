import { appendFileSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import type { ProjectAppTaskAction } from "@may-agent/sdk/legacy";

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
    "read-only-owner" | "route-task-workspace" | "reject-unbound-writer";
  reason: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function actionTaskId(action: ProjectAppTaskAction): string {
  return action.kind === "create-task"
    ? action.id
    : action.kind === "update-task"
      ? action.taskId
      : "";
}

function actionWorkflow(action: ProjectAppTaskAction): string | null {
  if (action.kind !== "create-task" && action.kind !== "update-task")
    return null;
  return typeof action.workflow === "string" && action.workflow.trim()
    ? action.workflow.trim()
    : null;
}

function domainAction(action: ProjectAppTaskAction): boolean {
  if (action.kind !== "create-task" && action.kind !== "update-task")
    return false;
  return (
    actionTaskId(action).startsWith("domain/") ||
    action.owner === "aks-explorer" ||
    action.category === "domain"
  );
}

function normalizedIntentText(action: ProjectAppTaskAction): string {
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
export function domainSourceWriteRequired(
  action: ProjectAppTaskAction,
): boolean {
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
  action: ProjectAppTaskAction,
): DomainWriteRoutingDecision {
  const taskId = actionTaskId(action);
  const workflow = actionWorkflow(action);
  const writeRequired = domainSourceWriteRequired(action);
  if (!writeRequired) {
    return {
      taskId,
      writeRequired: false,
      workflow,
      decision: "read-only-owner",
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
      "domain source-changing work requires an existing owner workflow that declares an isolated task workspace; ordinary unbound owner execution is read-only",
  };
}

function gitSnapshot(projectDir: string): { head: string; status: string } {
  if (!existsSync(projectDir)) return { head: "missing", status: "missing" };
  const run = (args: string[]) =>
    spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
  const head = run(["rev-parse", "HEAD"]);
  const status = run(["status", "--porcelain=v2", "--untracked-files=all"]);
  return {
    head: head.status === 0 ? head.stdout.trim() : "unreadable",
    status: status.status === 0 ? status.stdout.trim() : "unreadable",
  };
}

/** Append a durable, identity-aware preflight record before a write route is admitted. */
export function recordDomainWritePreflight(
  action: ProjectAppTaskAction,
  decision: DomainWriteRoutingDecision,
  appDir: string,
  projectDir: string,
): void {
  if (!decision.writeRequired) return;
  const input =
    (action.kind === "create-task" || action.kind === "update-task") &&
    isRecord(action.input)
      ? action.input
      : {};
  const snapshot = gitSnapshot(projectDir);
  const path = `${appDir}/.state/audit/domain-write-preflight.jsonl`;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({
      observedAt: new Date().toISOString(),
      taskId: decision.taskId,
      attemptId: typeof input.attemptId === "string" ? input.attemptId : null,
      sessionId: typeof input.sessionId === "string" ? input.sessionId : null,
      workflowRunId:
        typeof input.workflowRunId === "string" ? input.workflowRunId : null,
      workflow: decision.workflow,
      canonicalPath: existsSync(projectDir)
        ? realpathSync(projectDir)
        : projectDir,
      canonicalPreflightHead: snapshot.head,
      canonicalPreflightStatus: snapshot.status,
      decision: decision.decision,
      reason: decision.reason,
    })}\n`,
  );
}
