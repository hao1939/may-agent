/**
 * project-planner — refill/review loop for aks-rp-e2e.
 *
 * The planner workflow is the app-ops decision adapter. It wakes app-ops with
 * task-tree tools, then emits task dispatch events from app-ops decisions or
 * already-clear backlog dispatch.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { TaskNode, WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  appendPlannerRun,
  appendToolJournal,
  assignTask,
  compactDoneLeaves,
  createTask,
  drainTaskAssignments,
  listRunnableBacklogTaskIds,
  markTaskDone,
  planningPacket,
  readTask,
  rejectTaskReview,
  repairTaskTreeRollups,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
  type TaskAssignment,
  type TaskPlanningPacket,
  type TaskTreeConfig,
} from "./lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "./lib/task-tree-store.ts";
import { syncProjectReadout } from "./lib/project-readout-sync.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  sourceDir,
  triggerBlock,
  triggerValue,
} from "./lib/workflow-input.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
  type SpecLoopSpecState,
} from "./lib/spec-loop-store.ts";

export const name = "project-planner";
export const description =
  "Wake app-ops to plan in the task tree, then emit explicit task dispatches or durable loop controller ticks.";

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
    opts?: { timeoutMs?: number },
  ) => Promise<unknown>;
};

type RuntimeEventRow = {
  id?: unknown;
  event_type?: unknown;
  source?: unknown;
  owner?: unknown;
  urgency?: unknown;
  data?: unknown;
  timestamp?: unknown;
};

const loopControllerWorkflows = new Set([
  "feature-reference-loop-controller",
  "feature-compact-loop-controller",
  "spec-loop-controller",
]);

const loopControllerTaskIds = new Set([
  "aks-feature-reference-loop",
  "aks-feature-compact-loop",
  "aks-spec-verification-loop",
]);

const loopControllerTaskActions = new Map([
  ["aks-feature-reference-loop", "feature-reference-loop"],
  ["aks-feature-compact-loop", "feature-compact-loop"],
  ["aks-spec-verification-loop", "spec-loop"],
]);

const loopControllerWorkflowActions = new Map([
  ["feature-reference-loop-controller", "feature-reference-loop"],
  ["feature-compact-loop-controller", "feature-compact-loop"],
  ["spec-loop-controller", "spec-loop"],
]);

const loopControllerManagedChildWorkflows = new Set([
  "feature-reference-collector",
  "feature-compact-planner",
  "single-spec-verifier",
]);

type LoopControllerPulse = {
  taskId: string;
  action: string;
  reason: string;
};

function isLoopOwnedChildTask(config: TaskTreeConfig, taskId: string): boolean {
  if (loopControllerTaskIds.has(taskId)) return false;
  const task = readTask(config, taskId);
  if (!task) return false;
  if (!loopControllerManagedChildWorkflows.has(String(task.workflow ?? ""))) {
    return false;
  }

  const context =
    task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
      ? (task.context as Record<string, unknown>)
      : {};
  if (
    typeof context.loopTaskId === "string" &&
    loopControllerTaskIds.has(context.loopTaskId)
  ) {
    return true;
  }

  if (!task.parent_id) return false;
  const parent = readTask(config, task.parent_id);
  return !!parent?.workflow && loopControllerWorkflows.has(parent.workflow);
}

function plannerAssignableBacklogTaskIds(config: TaskTreeConfig): string[] {
  return listRunnableBacklogTaskIds(config, 200).filter(
    (taskId) => !isLoopOwnedChildTask(config, taskId),
  );
}

function loopControllerActionForTask(
  config: TaskTreeConfig,
  taskId: string,
): string | null {
  const taskAction = loopControllerTaskActions.get(taskId);
  if (taskAction) return taskAction;

  const task = readTask(config, taskId);
  const workflow = typeof task?.workflow === "string" ? task.workflow : "";
  return loopControllerWorkflowActions.get(workflow) ?? null;
}

function assignPlannerRunnableBacklogTasks(
  config: TaskTreeConfig,
  input: { worker?: string; domainWorker?: string; opsWorker?: string } = {},
): LoopControllerPulse[] {
  const controllerPulses: LoopControllerPulse[] = [];

  for (const taskId of plannerAssignableBacklogTaskIds(config)) {
    const controllerAction = loopControllerActionForTask(config, taskId);
    if (controllerAction) {
      controllerPulses.push({
        taskId,
        action: controllerAction,
        reason: "planner-refill",
      });
      continue;
    }

    try {
      prepareFreshSessionForTerminalRuntime(config, taskId);
      assignTask(config, {
        taskId,
        worker: plannerWorkerForTask(config, taskId, input),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Worker capacity is full")) break;
    }
  }

  if (controllerPulses.length > 0) {
    appendToolJournal(config, {
      kind: "planner_loop_controller_pulses_requested",
      task_ids: controllerPulses.map((pulse) => pulse.taskId),
      actions: controllerPulses.map((pulse) => pulse.action),
      reason: "planner refill found runnable durable loop controller root(s)",
    });
  }

  return controllerPulses;
}

function taskAncestry(config: TaskTreeConfig, taskId: string): string[] {
  const ancestry: string[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = taskId;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    ancestry.push(currentId);
    const task = readTask(config, currentId);
    currentId =
      typeof task?.parent_id === "string" && task.parent_id.trim()
        ? task.parent_id
        : undefined;
  }
  return ancestry;
}

function hasScopePrefix(value: string, scope: string): boolean {
  return (
    value === scope ||
    value.startsWith(`${scope}/`) ||
    value.startsWith(`${scope}-`)
  );
}

function plannerWorkerForTask(
  config: TaskTreeConfig,
  taskId: string,
  input: { worker?: string; domainWorker?: string; opsWorker?: string },
): string | undefined {
  const task = readTask(config, taskId);
  const workflow = String(task?.workflow ?? "");
  const ancestry = taskAncestry(config, taskId);
  const owner = String(task?.owner ?? "").trim();
  const conflictScopes = Array.isArray(task?.conflict_scope)
    ? task.conflict_scope
        .map((scope) => (typeof scope === "string" ? scope.trim() : ""))
        .filter(Boolean)
    : [];
  if (
    owner === "app-ops" ||
    conflictScopes.some(
      (scope) => scope.startsWith("app-") || scope.startsWith("app-task-tree:"),
    )
  ) {
    return input.opsWorker ?? input.worker;
  }
  if (ancestry.some((id) => hasScopePrefix(id, "ops"))) {
    return input.opsWorker ?? input.worker;
  }
  if (ancestry.some((id) => hasScopePrefix(id, "domain"))) {
    return input.domainWorker ?? input.worker;
  }
  if (loopControllerManagedChildWorkflows.has(workflow)) {
    return input.domainWorker ?? input.worker;
  }
  return input.worker;
}

type ReviewDecision = "accept" | "redo" | "followup" | "blocked" | "escalate";

type ReviewedTaskApplyResult = {
  handled: boolean;
  applied: boolean;
  decision?: ReviewDecision;
  taskId?: string;
  message: string;
  successorTaskId?: string;
};

type StallReviewedApplyResult = {
  handled: boolean;
  applied: boolean;
  requeuedTaskIds: string[];
  message: string;
};

function truncateText(value: string, max = 280): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function rejectAcceptOnInvariant(input: {
  config: TaskTreeConfig;
  taskId: string;
  attemptId: string;
  invariant: string;
  summary: string;
  details: Record<string, unknown>;
}): ReviewedTaskApplyResult {
  appendToolJournal(input.config, {
    kind: "review_accept_invariant_failed",
    task_id: input.taskId,
    attempt_id: input.attemptId,
    invariant: input.invariant,
    summary: input.summary,
    details: input.details,
    reason:
      "planner refused to apply an accept review because a hard app invariant was still false; reviewer/app-ops must decide the next move",
  });
  return {
    handled: true,
    applied: false,
    decision: "accept",
    taskId: input.taskId,
    message: `Did not apply accept review for ${input.taskId}: ${input.summary}`,
  };
}

function projectPushMode(appDir: string): string {
  try {
    const raw = JSON.parse(
      readFileSync(join(appDir, "project.json"), "utf8"),
    ) as { policy?: { mode?: unknown } };
    return typeof raw.policy?.mode === "string" ? raw.policy.mode : "";
  } catch {
    return "";
  }
}

function compactTaskDetailForPrompt(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  for (const key of [
    "id",
    "parent_id",
    "state",
    "status",
    "kind",
    "priority",
    "owner",
    "workflow",
    "session_id",
    "goal",
    "blocker",
    "conflict_scope",
    "depends_on",
    "outputs",
    "trace",
  ]) {
    if (value[key] !== undefined) compact[key] = value[key];
  }

  if (typeof compact.goal === "string") {
    compact.goal = truncateText(compact.goal, 360);
  }
  if (typeof compact.blocker === "string") {
    compact.blocker = truncateText(compact.blocker, 360);
  }
  if (Array.isArray(compact.outputs)) {
    compact.outputs = compact.outputs.slice(0, 3);
  }
  if (Array.isArray(compact.depends_on)) {
    compact.depends_on = compact.depends_on.slice(0, 3);
  }
  if (Array.isArray(compact.conflict_scope)) {
    compact.conflict_scope = compact.conflict_scope.slice(0, 4);
  }
  const trace =
    compact.trace &&
    typeof compact.trace === "object" &&
    !Array.isArray(compact.trace)
      ? (compact.trace as Record<string, unknown>)
      : null;
  if (trace) {
    const compactTrace: Record<string, unknown> = {};
    for (const key of [
      "assigned_at",
      "assigned_by",
      "assigned_worker",
      "current_attempt_id",
      "last_session",
      "last_worker_result",
      "last_worker_claim",
      "last_worker_completed_at",
      "last_worker_summary",
    ]) {
      if (trace[key] !== undefined) compactTrace[key] = trace[key];
    }
    if (typeof compactTrace.last_worker_summary === "string") {
      compactTrace.last_worker_summary = truncateText(
        compactTrace.last_worker_summary,
        360,
      );
    }
    compact.trace = compactTrace;
  }

  return compact;
}

function compactPlannerPacketForPrompt(packet: unknown): unknown {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return packet;
  }

  const compact = JSON.parse(JSON.stringify(packet)) as Record<string, unknown>;

  const frontierDetails =
    compact.frontier_details &&
    typeof compact.frontier_details === "object" &&
    !Array.isArray(compact.frontier_details)
      ? (compact.frontier_details as Record<string, unknown>)
      : null;
  if (frontierDetails) {
    for (const key of ["runnable", "waiting", "active", "review", "blocked"]) {
      const entries = frontierDetails[key];
      if (!Array.isArray(entries)) continue;
      const limit = key === "review" ? 5 : 3;
      frontierDetails[key] = entries
        .slice(0, limit)
        .map((entry) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? compactTaskDetailForPrompt(entry as Record<string, unknown>)
            : entry,
        );
      if (entries.length > limit) {
        frontierDetails[`${key}_omitted_count`] = entries.length - limit;
      }
    }
  }

  const modelStatusSummary =
    compact.model_status_summary &&
    typeof compact.model_status_summary === "object" &&
    !Array.isArray(compact.model_status_summary)
      ? (compact.model_status_summary as Record<string, unknown>)
      : null;
  if (modelStatusSummary) {
    const nonPassingPaths = modelStatusSummary.non_passing_paths;
    if (Array.isArray(nonPassingPaths)) {
      const limit = 40;
      modelStatusSummary.non_passing_paths = nonPassingPaths.slice(0, limit);
      if (nonPassingPaths.length > limit) {
        modelStatusSummary.omitted_non_passing_paths =
          nonPassingPaths.length - limit;
      }
    }
  }

  return compact;
}

function timeoutFromEnv(name: string, fallbackMs: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallbackMs;
}

function plannerStateDbPath(appDir: string): string {
  return process.env.MAY_DB_PATH ?? join(appDir, ".state", "may.db");
}

function hasRunningPlannerSession(
  appDir: string,
  agent: string,
  excludeSessionId: string,
): boolean {
  const dbPath = plannerStateDbPath(appDir);
  if (!existsSync(dbPath)) return false;
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .query(
        `
          select sessionId
          from sessions
          where source = 'workflow:project-planner'
            and agent = ?
            and status = 'running'
            and sessionId != ?
          order by startedAt desc
          limit 1
        `,
      )
      .get(agent, excludeSessionId) as { sessionId?: string } | null;
    return typeof row?.sessionId === "string" && row.sessionId.length > 0;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

function runtimeSessionDbPath(appDir: string): string {
  const configured = plannerStateDbPath(appDir);
  if (existsSync(configured)) return configured;
  const defaultRuntimePath = "/app/.state/may.db";
  return existsSync(defaultRuntimePath) ? defaultRuntimePath : configured;
}

function runtimeSessionRow(
  appDir: string,
  sessionId: string,
): {
  status?: unknown;
  outcome?: unknown;
  endedAt?: unknown;
} | null {
  if (!sessionId) return null;
  const dbPath = runtimeSessionDbPath(appDir);
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .query(
        `
          select status, outcome, endedAt
          from sessions
          where sessionId = ?
          limit 1
        `,
      )
      .get(sessionId) as {
      status?: unknown;
      outcome?: unknown;
      endedAt?: unknown;
    } | null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function runtimeSessionIsRunning(appDir: string, sessionId: string): boolean {
  const row = runtimeSessionRow(appDir, sessionId);
  if (!row) return false;
  const status = typeof row.status === "string" ? row.status : "";
  const outcome = typeof row.outcome === "string" ? row.outcome : "";
  if (typeof row.endedAt === "number" && Number.isFinite(row.endedAt)) {
    return false;
  }
  return status === "running" && outcome !== "error";
}

function runtimeSessionIsTerminal(appDir: string, sessionId: string): boolean {
  const row = runtimeSessionRow(appDir, sessionId);
  if (!row) return false;
  const status = typeof row.status === "string" ? row.status : "";
  const outcome = typeof row.outcome === "string" ? row.outcome : "";
  if (typeof row.endedAt === "number" && Number.isFinite(row.endedAt)) {
    return true;
  }
  return ["done", "error", "failed", "cancelled", "canceled"].includes(
    status || outcome,
  );
}

function prepareFreshSessionForTerminalRuntime(
  config: TaskTreeConfig,
  taskId: string,
): boolean {
  const task = readTask(config, taskId);
  const sessionId =
    typeof task?.session_id === "string" ? task.session_id.trim() : "";
  if (!sessionId || !runtimeSessionIsTerminal(config.appDir, sessionId)) {
    return false;
  }

  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const latestTask = tree.tasks[taskId];
    if (!latestTask) return false;
    const currentState = String(latestTask.status ?? latestTask.state ?? "");
    if (currentState !== "backlog") return false;
    if (latestTask.session_id !== sessionId) return false;

    latestTask.session_id = undefined;
    latestTask.trace = {
      ...(latestTask.trace ?? {}),
      stale_active_fresh_session: true,
      stale_active_requeue_reason:
        "planner detected stored task session is already terminal before assignment",
      previous_session_id: sessionId,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "terminal_task_session_cleared_before_assignment",
      task_id: taskId,
      previous_session_id: sessionId,
      reason:
        "planner detected stored task session is already terminal before assignment",
    });
    return true;
  });
}

function plannerSessionId(step: "event_review" | "planning_update"): string {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `s_project_planner_${step}_${stamp}_${suffix}`;
}

function parseEventData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function compactHumanSteering(event: RuntimeEventRow): Record<string, unknown> {
  const data = parseEventData(event.data);
  const params =
    data.params &&
    typeof data.params === "object" &&
    !Array.isArray(data.params)
      ? (data.params as Record<string, unknown>)
      : {};
  const context =
    params.context &&
    typeof params.context === "object" &&
    !Array.isArray(params.context)
      ? (params.context as Record<string, unknown>)
      : undefined;
  return {
    id: event.id,
    ts: event.timestamp,
    source: event.source,
    urgency: event.urgency,
    action: data.action ?? params.action,
    reason: data.reason,
    instruction:
      typeof params.instruction === "string"
        ? params.instruction.slice(0, 2400)
        : undefined,
    task_id: params.task_id ?? params.taskId,
    comment:
      typeof params.comment === "string"
        ? params.comment.slice(0, 1400)
        : undefined,
    expected_parent: params.expected_parent,
    expected_live_root_child: params.expected_live_root_child,
    required_planner_decision: params.required_planner_decision,
    review_findings: params.reviewFindings ?? params.review_findings,
    context,
  };
}

function recentHumanSteering(ctx: WorkflowContext): Record<string, unknown>[] {
  try {
    const query = ctx.query;
    if (!query?.events) return [];
    const since = Date.now() - 2 * 60 * 60_000;
    const rows = ["project.planning.requested"]
      .flatMap(
        (type) =>
          query.events({
            type,
            since,
            limit: 50,
          }).rows as RuntimeEventRow[],
      )
      .filter((row) => {
        const data = parseEventData(row.data);
        return (
          data.project === "aks-rp-e2e" &&
          (data.reason === "human-steering" ||
            data.reason === "project-comment") &&
          (row.urgency === "high" || row.urgency === "immediate")
        );
      });
    return rows.slice(0, 5).map(compactHumanSteering);
  } catch {
    return [];
  }
}

function humanSteeringBlock(events: Record<string, unknown>[]): string {
  if (!events.length) return "";
  return `\n\n## Pending Human Steering Overrides\n\nThese high-priority human steering events are durable planner input. Review them before routine watchdog/refill work. If a steering event asks for a concrete tree correction, either make that correction with the task-tree tools or record an explicit refusal/blocker in the tree.\n\n\`\`\`json\n${JSON.stringify(events, null, 2)}\n\`\`\``;
}

function buildPlannerPrompt(input: {
  appDir: string;
  projectDir: string;
  sourceDir: string;
  agent: string;
  domainWorker: string;
  opsWorker: string;
  eventReview: string;
  trigger: string;
  packet: unknown;
  humanSteering: Record<string, unknown>[];
  wakeReason: string | null;
  aggressivePush: boolean;
}): string {
  const singleAssignmentWakeGuidance = [
    "task-completed",
    "watchdog-capacity-underfilled",
    "planner-timeout-underfilled-frontier",
  ].includes(input.wakeReason ?? "")
    ? input.aggressivePush
      ? `
- This wake is in aggressive-push mode (${input.wakeReason}). Do not short-circuit after one refill. If safe runnable work, review work, drained non-pass loop results, or locally actionable blocked families remain, push the tree toward a full useful frontier before stopping.`
      : `
- This wake is in the bounded single-dispatch short-circuit family (${input.wakeReason}). If you create or dispatch one truthful deterministic refill or bounded successor and no human-steering or review frontier remains, stop immediately. Do not keep scanning unrelated blocked families or try to saturate all remaining capacity in this same wake.`
    : "";
  return `Planning Update Step

This is step 2 of 2 for the same planner wake. Use the event review from step
1 and the latest compact task-tree packet below. Now update the task tree,
repair bad decomposition, roll up completed work, create concrete next leaves,
and assign runnable backlog work when useful.

You are app-ops for aks-rp-e2e.app. The workflow is only a wakeup adapter. You
judge app/process motion and apply task-tree decisions.

Core operating model:
- The task tree is your workspace and memory aid. It serves your planning; it
  is not the controller and it does not decide what happens by itself.
- Task-tree commands are your tools, not the workflow brain.
- Do not create planning/control task nodes.
- Do not run worker task bodies from the planner session.
- Keep new work under visible scope: domain/* for AKS spec/feature/compact/live
  result work, and ops/* for app health, routing, watchdog, recovery,
  observability, and escalation plumbing.
- Do not decide AKS product correctness in app-ops. When AKS judgment or domain
  fixing is needed, create or dispatch domain/* work for ${input.domainWorker}.
- Use ops/* work for process repair and route it to ${input.opsWorker}.
- If a task is too large or unclear, rewrite/split that branch once toward
  executable leaves. Do not cycle through rework tasks.
- Worker output is progress, not a final project decision. First review every
  review leaf according to the latest task state and trace.last_worker_result
  (or legacy trace.last_worker_claim).
  Accept only when evidence satisfies acceptance. If the result is weak,
  unsupported, non-terminal, or contradictory, repair/replace/retry through a
  concrete task. Mark blocked only after you have exact external evidence and a
  concrete resume condition.
- Do not mark an active dispatched task done/replaced/cancelled while its current
  attempt has started. Active means a worker may still emit
  project.task.completed. Wait for that completion, use requeue-active only
  for a stale/non-running attempt, or create separate follow-up/problem work
  without closing the active assignment.
- Failure/blocking is first-class project work. When a review task exposes a
  blocker or failure, classify the problem, create or link one visible
  problem-solving task in the tree, and let the problem-solver event loop work
  it. Prefer one shared problem task for a shared root cause such as staging ARM
  auth, not one duplicate blocker task per affected replay. Use the stable
  problemKey from project.problem.* events when present.
- Periodic blocked-frontier review is owner work. If the wake reason is
  scheduled-blocked-frontier-review, blocked-frontier-review, or
  watchdog-blocked-frontier-review, use blocked_frontier_summary to choose
  whole blocker families, not only the first visible blocked leaves. The goal
  is burn-down: reduce duplicate/noisy blocked leaves or advance the family to
  one clearer next owner action. Recheck whether resume conditions changed,
  create/link problem-solving work for locally fixable blockers, convert proven
  terminal/product/environment dispositions to done with evidence and retest
  condition, unblock/rework stale blockers, or create the external
  ask/escalation/response-await path needed to close the blocker. If several
  leaves share one real external wait, keep one family-level wait carrying the
  owner, exact resume condition, next review trigger, and affected task ids;
  mark duplicate/stale child waits done with --resolution replaced only after
  that meaning is preserved. Leave a task blocked only when it is the single
  useful live representation of a true wait. Never retry a blocked leaf
  unchanged.
- Treat blocked_action_warnings as direct owner-review hints. They do not decide
  the domain truth, but they flag blocked leaves whose shape is suspicious.
  A response-await task is not a real blocker when the ask has not been proven
  sent or handed off; create/assign the owner send-handoff/escalation work, or
  mark the passive wait replaced by the task that actually sends it. An exact
  source blocker is valid only when no truthful bounded/source-equivalent spec,
  replay, evidence-ceiling, public-doc check, or draft follow-up can progress.
  Missing perfect handwritten source should not freeze the project by itself:
  first try local artifacts, checked-in specs/replays, accepted source-equivalent
  evidence, mounted Go source, public docs, and bounded "best known equivalent"
  specs. Environment
  blockers are also work, not a parking lot: create setup/diagnosis/retry or a
  single exact owner escalation/wait for the shared environment cause, then move
  unrelated work forward.
- When project.problem.resolved, project.problem.escalated, or
  project.problem.inconclusive wakes you, reconcile the solver result into the
  affected task branch: retry or supersede affected tasks when resolved; mark
  precise external blockers or human escalation state when escalated; triage or
  request follow-up investigation when the solver could not classify the result.
  The solver reports facts; you own tree decisions.
- When project.stall.reviewed wakes you, treat it as a project-level liveness
  judgment. Read its collected packet and summary before routine refill. If the
  stall-review packet shows unfinished loop state, stale false-terminal roots,
  retry-drained work, or noisy waits, create or assign the smallest concrete
  owner/worker/problem task that restores motion. If the judgment is a real
  external wait, record one exact wait with owner, resume condition, affected
  scope, and next review trigger. Do not let the reviewed event disappear into
  another generic no-op.
- When project.approval.submitted wakes you, treat approvalId, waitId, pathId,
  and packetPath as the returned owner decision for the matching wait. Find the
  blocked task or response-await branch that references the same id/path. If the
  decision approves or adjusts the work, clear/replace the wait and create or
  assign the next concrete task. If it holds, declines, or reroutes, record that
  exact decision in the task tree with the next owner action or terminal reason.
  Do not no-op a submitted approval while a matching wait remains open.
- Treat the task tree as the project-specific source of truth. Read root and
  lane context before deciding that the project is complete or blocked.
- Project-specific progress signals, completion criteria, gap reconciliation,
  execution intent, and user steering belong in the task tree as task context
  or standing tasks, not in this workflow prompt.
- This is a bounded planning pass, but it should do enough work to make the
  next project state clear. Review worker progress first. Then create
  concrete leaves, assign runnable backlog leaves, close completed branches, or record
  exact blockers.
- If active+runnable backlog is empty and review/blocked/dependency-waiting backlog work exists, this is a
  refill/reconciliation incident. Make task-tree mutations before deep
  investigation: mark verified review work done, create retry/follow-up leaves for
  resolved blockers, link unresolved blockers to one visible problem task, and
  assign clear runnable leaves. Do not spend the whole wake rediscovering context.
- If blocked_frontier_summary.blocked_leaf_count is high, do not stop after one
  small blocker update. Pick at least one largest parent group or repeated
  blocker group and make the tree more readable: consolidate, close replaced
  leaves, or create the one missing owner/problem follow-up that lets future
  reviews finish that family.
- Spec-loop follow-up leaves with context.specLoopFollowup=true are not
  live reruns and are not duplicate per-spec blocker churn. They are repo-local
  grouped reconciliation work for drained fail, blocked, or error loop
  results. Preserve or assign them unless they duplicate the same
  status/family key, lack clear acceptance, or have already produced an
  accepted classification. Do not replace them solely because a shared westus2
  live-execution wait still blocks fresh cloud runs.
- If blocked_action_warnings is non-empty, handle at least one warning family
  before routine refill. Prefer batch repair: convert no-send-proof waits into
  one active send/escalation task, and convert source-exactness waits into
  bounded authoring/evidence-ceiling/public-doc work unless the tree proves no
  bounded progress is possible. Convert repeated environment blockers into one
  active setup/diagnosis/escalation family instead of many passive blocked
  leaves.
- Treat trigger lineage as current-trigger-scoped, not as a generic recent-work
  search. If the wake reason is blocked-frontier/capacity/runnable-backlog and
  the current trigger payload does not include reviewTasks, do not invent
  missing live review work from recently accepted worker-completion ids seen in
  nearby planner history. If an older review id matters, first prove it is
  still live in the current tree or current trigger; otherwise check recent
  done-leaf archives and classify accepted archived lineage as settled history,
  not a new missing-visibility repair.
- For blocked-frontier or manual-learning wakes, treat an accepted same-lineage
  diagnosis/evidence ceiling as live context even when its task was archived.
  If the same spec/run/first-failing-surface question was already accepted and
  the current trigger names no materially new evidence gap or narrower explicit
  question, do not create another same-lineage diagnosis leaf from the same
  async-op/node-RG pointers. Leave any already-started duplicate attempt alone,
  judge its output against the accepted memo, and keep or refresh one exact
  holder instead.
- For project.problem.* events, trust the solver summary as new evidence. If an
  escalated event summary says the local cause was fixed and verified, treat it
  as resolved-but-misclassified, record that in the affected branch, and create
  retry tasks. If it says external input is still required, record the exact
  resume condition and move to unrelated work. If the event is unknown, convert
  the ambiguity into one concrete retry, investigation, or blocker decision
  instead of letting the result disappear.
- Limit first-pass investigation in planning-update to the task-tree packet,
  the event review, and at most two targeted reads. After that, choose a tree
  action. Follow-up investigation belongs in newly created worker/problem tasks.
- Stop once the next useful project action is clear and recorded, or once you
  have dispatched enough runnable work for this wake.
  Do not stop merely because one rollup or one new leaf was created.${singleAssignmentWakeGuidance}
- Tree hygiene is owner judgment. If task_tree_hygiene shows many safe done
  leaves under a parent, decide whether their durable meaning is already
  summarized on that parent or in linked evidence. When it is, use
  rollup-parent with your summary to archive the low-value completed children.
  Do not compact open leaves, milestone children, or done leaves whose meaning
  is not yet represented by parent context/evidence.
- If the frontier is empty, do not stop at analysis. Add concrete work under one
  of the durable value-loop lanes according to the task-tree context, unless
  that context and current evidence show an exact external blocker.
- High-priority human steering is planner input, not discussion noise. Process
  it before routine watchdog/refill work. If the user points out a missing root
  task/lane, either create the missing task under the requested parent or record
  a concrete refusal/blocker in the tree.
- Project-scoped learning.feedback is evaluator feedback about how the
  project is running. If the trigger payload names projectId/project
  aks-rp-e2e, classify it like any other abnormal signal: create/link repair
  work, record an exact wait, escalate, or record an accepted no-op. If it names
  another project, record a no-op reason and do not mutate this task tree.
- Domain repo commits are planner checkpoints, not worker actions and not a
  separate event loop. When done task output has accumulated in
  ${input.projectDir}, use the checkpoint helper, review dirty files against the
  task tree, run domain checks, and commit a coherent done slice. Do not
  commit active/review work or broad mixed diffs. Record the commit hash in the
  done task trace/context or parent branch before moving on.

Use these commands from the app directory:
- bun run task-tree summary
- bun run task-tree packet
- bun run task-tree frontier
- bun run task-tree confirm-runnable --limit 10
- bun run task-tree add <task-id> --parent <lane-id> --goal "..." --output <path> --acceptance "..." --conflict-scope <scope> [--state backlog|blocked] [--blocker "..."] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO] [--next-check-at ISO] [--fallback-at ISO] [--fallback-action "..."]
- bun run task-tree mark-done <task-id> --summary "why the review is accepted"
- bun run task-tree mark-done <task-id> --resolution replaced --summary "why this blocked leaf is replaced by the family-level wait"
- bun run task-tree requeue-active <task-id> --reason "why the active attempt is stale or not running" [--fresh-session]
- bun run task-tree rollup-parent <parent-id> --summary "what this branch now knows and what remains" [--archive-done <child-id> ...] [--limit 50]
- bun run task-tree compact-done --limit 50  # recovery only; prefer rollup-parent after owner summary
- bun run task-tree assign <task-id> [--worker ${input.domainWorker}|${input.opsWorker}]
- bun run task-tree update-text <task-id> [--goal "..."] [--acceptance "..."] [--acceptance "..."] [--blocker "..."] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO] [--next-check-at ISO] [--fallback-at ISO] [--fallback-action "..."] [--clear-blocker]
- bun run task-tree show <task-id>
- bun run domain:checkpoint
- bun run domain:checkpoint -- --json

Useful domain workspace commands:
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && bun run status -- --json
- cd ${input.projectDir} && bun run check
- cd ${input.projectDir} && git status --short
- cd ${input.projectDir} && git diff --stat

Mounted AKS RP Go source is available at ${input.sourceDir}. Use it before
accepting any source-holder, devbox, handwritten-source, or authoritative-source
blocker. For VirtualMachine prerelease work, start from:
- ${input.sourceDir}/test/e2ev3/sigs/rp/virtualmachine/suites/prerelease.go
- ${input.sourceDir}/test/e2ev3/sigs/rp/virtualmachine/suites/checkin.go
If those files or referenced scenario definitions answer the question, update
or create source-backed spec/replay/model work instead of owner-send or
response-await tasks.

Do not edit the runtime task tree file directly. Use the task-tree commands
so updates take the tree lock, repair rollups, keep kanban in sync, and avoid
overwriting newer planner/watchdog changes. If the current primitive is not
enough, create a focused app-tooling task under the relevant lane instead of
hand-writing the tree.
Do not rewrite ${input.appDir}/project.json or convert it to markdown. It is an
app manifest, not the planning workspace. Put project thinking, focus state,
review findings, and follow-up work in the task tree through task-tree tools.

Current app: ${input.appDir}
Domain workspace: ${input.projectDir}
Source workspace: ${input.sourceDir}
Agent: ${input.agent}
Domain worker: ${input.domainWorker}
Ops worker: ${input.opsWorker}

Event review from step 1:
${input.eventReview}

Current compact task-tree packet:
\`\`\`json
${JSON.stringify(compactPlannerPacketForPrompt(input.packet), null, 2)}
\`\`\`
${humanSteeringBlock(input.humanSteering)}

${input.trigger}`.trim();
}

function buildEventReviewPrompt(input: {
  appDir: string;
  projectDir: string;
  sourceDir: string;
  agent: string;
  trigger: string;
  packet: unknown;
  humanSteering: Record<string, unknown>[];
}): string {
  return `Planner Event Review Step

This is step 1 of 2 for a planner wake. React to the event and compact packet,
inspect related context only when needed, and produce a concise event review for
the next planning step. Do not edit the task tree and do not assign tasks in
this step.

Keep this review bounded. Prefer the packet over rediscovery. Use at most three
read-only commands unless the trigger is a task completion, human steering,
project-scoped learning feedback, or a metric/stale-active event that clearly
needs deeper evidence.

Focus:
- What woke the planner?
- Which runnable backlog, active, review, or blocked tasks are relevant?
- Did a worker claim need validation? If yes, what evidence should planning
  trust or distrust?
- Is this a problem event? If yes, which blocked/failed/review tasks share the
  problemKey, and should planning create/link a visible problem-solving task,
  retry affected work, or mark an escalation?
- Is there stale active work, misleading completion, real blocker, human
  steering, project-scoped learning feedback, metric breach, or normal refill?
- If this is blocked-frontier review, which parent group or repeated blocker
  group from blocked_frontier_summary should app-ops burn down first?
- Did blocked_action_warnings flag passive response-await or source-exactness
  overblocking? If yes, which warning family should planning repair first?
- Are any active/runnable tasks marked context.specLoopFollowup=true? Treat
  those as valid repo-local non-pass reconciliation work, not as live cloud
  reruns or duplicate blocked waits.
- What specific task-tree updates should the next step consider?
- If pending high-priority human steering identifies a missing root task/lane,
  call that out as a required planning decision.

Use commands from the app directory when needed:
- bun run task-tree packet
- bun run task-tree show <task-id>
- bun run task-tree frontier

Useful domain workspace commands when needed:
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && bun run status -- --json
- rg -n "Scenario_|NewScenario|suites.Static" ${input.sourceDir}/test/e2ev3

Mounted AKS RP Go source is available at ${input.sourceDir}. If the wake is
about missing source, source-holder waits, devbox paths, or VM prerelease
coverage, call out that planning must inspect the mounted source before keeping
any external-source blocker.

Current app: ${input.appDir}
Domain workspace: ${input.projectDir}
Source workspace: ${input.sourceDir}
Agent: ${input.agent}
Role: app-ops event review. Do not decide AKS product correctness here.

Compact task-tree packet:
\`\`\`json
${JSON.stringify(compactPlannerPacketForPrompt(input.packet), null, 2)}
\`\`\`
${humanSteeringBlock(input.humanSteering)}

${input.trigger}

Finish with a short section starting with EVENT_REVIEW:.`.trim();
}

async function runOwnerStep(input: {
  ctx: WorkflowContext;
  agent: string;
  prompt: string;
  sessionId: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.agent, input.prompt, input.sessionId, {
        timeoutMs:
          input.timeoutMs ??
          timeoutFromEnv("AKS_RP_E2E_PLANNER_STEP_TIMEOUT_MS", 240_000),
      })
    : input.ctx.runAgent(input.agent, input.prompt);
}

function dispatchAssignedTasks(
  ctx: WorkflowContext,
  assignments: TaskAssignment[],
): void {
  for (const assignment of assignments) {
    try {
      ctx.dispatchEvent("project.task.assigned", {
        target: { project: "aks-rp-e2e", taskId: assignment.taskId },
        project: "aks-rp-e2e",
        ...assignment,
        requested_by: "project-planner",
      });
    } catch {
      // Local tests may not provide a dispatcher.
    }
  }
}

function dispatchLoopControllerPulses(
  ctx: WorkflowContext,
  pulses: LoopControllerPulse[],
): void {
  for (const pulse of pulses) {
    try {
      ctx.dispatchEvent("project.task.tick", {
        target: { project: "aks-rp-e2e", taskId: pulse.taskId },
        project: "aks-rp-e2e",
        taskId: pulse.taskId,
        task_id: pulse.taskId,
        action: pulse.action,
        reason: pulse.reason,
        requested_by: "project-planner",
      });
    } catch {
      // Local tests may not provide a dispatcher.
    }
  }
}

function splitLoopControllerAssignments(
  config: TaskTreeConfig,
  assignments: TaskAssignment[],
): {
  workerAssignments: TaskAssignment[];
  controllerPulses: LoopControllerPulse[];
} {
  const workerAssignments: TaskAssignment[] = [];
  const controllerPulses: LoopControllerPulse[] = [];
  for (const assignment of assignments) {
    const action = loopControllerActionForTask(config, assignment.taskId);
    if (!action) {
      workerAssignments.push(assignment);
      continue;
    }
    controllerPulses.push({
      taskId: assignment.taskId,
      action,
      reason: "planner-assignment-bridge",
    });
  }
  return { workerAssignments, controllerPulses };
}

function plannerProgressTaskIds(input: {
  assignments: TaskAssignment[];
  controllerPulses: LoopControllerPulse[];
}): string[] {
  return [
    ...input.assignments.map((assignment) => assignment.taskId),
    ...input.controllerPulses.map((pulse) => pulse.taskId),
  ];
}

function plannerProgressMessage(input: {
  prefix: string;
  assignments: TaskAssignment[];
  controllerPulses: LoopControllerPulse[];
}): string {
  const parts = [];
  if (input.assignments.length > 0) {
    parts.push(
      `assigned ${input.assignments.length} task(s): ${input.assignments
        .map((assignment) => assignment.taskId)
        .slice(0, 8)
        .join(", ")}`,
    );
  }
  if (input.controllerPulses.length > 0) {
    parts.push(
      `pulsed ${input.controllerPulses.length} loop controller(s): ${input.controllerPulses
        .map((pulse) => pulse.taskId)
        .slice(0, 8)
        .join(", ")}`,
    );
  }
  return `${input.prefix} ${parts.join("; ")}.`;
}

function taskState(task: NonNullable<ReturnType<typeof readTask>>): string {
  const state = task.status ?? task.state;
  return typeof state === "string" ? state : "backlog";
}

function taskTrace(
  task: NonNullable<ReturnType<typeof readTask>>,
): Record<string, unknown> {
  return task.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function currentAttemptId(
  task: NonNullable<ReturnType<typeof readTask>>,
): string {
  const value = taskTrace(task).current_attempt_id;
  return typeof value === "string" ? value : "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  const text = stringValue(value);
  return text ? [text] : [];
}

function reviewObject(trigger: ReturnType<typeof parseTriggerEvent>) {
  const review = triggerValue(trigger, "review");
  return review && typeof review === "object" && !Array.isArray(review)
    ? (review as Record<string, unknown>)
    : {};
}

function reviewValue(
  trigger: ReturnType<typeof parseTriggerEvent>,
  key: string,
): unknown {
  const topLevel = triggerValue(trigger, key);
  if (topLevel !== undefined) return topLevel;
  return reviewObject(trigger)[key];
}

function reviewString(
  trigger: ReturnType<typeof parseTriggerEvent>,
  key: string,
): string {
  return stringValue(reviewValue(trigger, key));
}

function reviewStringList(
  trigger: ReturnType<typeof parseTriggerEvent>,
  key: string,
): string[] {
  return stringList(reviewValue(trigger, key));
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function reviewedCompletionWorkflowResult(
  trigger: ReturnType<typeof parseTriggerEvent>,
): Record<string, unknown> | null {
  const completion = objectValue(triggerValue(trigger, "completion"));
  return (
    objectValue(completion?.workflowResult) ??
    objectValue(completion?.workflow_result) ??
    objectValue(triggerValue(trigger, "workflowResult")) ??
    objectValue(triggerValue(trigger, "workflow_result"))
  );
}

type AcceptedSpecVerifierResult = {
  specId: string;
  loopStatus: "pass" | "fail" | "error";
  runId: string;
  runUrl: string;
  resultPath: string;
  reason: string;
};

type QueuedPipelineRun = {
  runId: string;
  specIds: string[];
  runUrl: string;
};

function normalizeSpecVerifierStatus(
  value: unknown,
): "pass" | "fail" | "error" | "" {
  const status = stringValue(value).toLowerCase();
  if (status === "pass" || status === "passed" || status === "success") {
    return "pass";
  }
  if (status === "fail" || status === "failed" || status === "failure") {
    return "fail";
  }
  if (status === "error") return "error";
  return "";
}

function artifactResultPath(value: unknown): string {
  const refs = stringList(value);
  return refs.find((ref) => /result\.json$/i.test(ref)) ?? refs[0] ?? "";
}

function reviewedCompletion(
  trigger: ReturnType<typeof parseTriggerEvent>,
): Record<string, unknown> | null {
  return objectValue(triggerValue(trigger, "completion"));
}

function acceptedSpecVerifierResults(
  workflowResult: Record<string, unknown>,
): AcceptedSpecVerifierResult[] {
  const workflow = stringValue(workflowResult.workflow);
  if (
    workflow !== "single-spec-verifier" &&
    workflow !== "spec-result-review"
  ) {
    return [];
  }
  const details = objectValue(workflowResult.details);
  const subject = objectValue(workflowResult.subject);
  if (!details) return [];

  const runId = stringValue(details.runId);
  const runUrl = stringValue(details.runUrl);
  const aggregateResultPath = stringValue(details.resultPath);
  const aggregateReason = stringValue(details.reason);
  const rawSpecResults = Array.isArray(details.specResults)
    ? details.specResults
    : [];

  if (rawSpecResults.length === 0) {
    const specId =
      stringValue(subject?.id) || stringValue(details.specId) || "";
    const loopStatus = normalizeSpecVerifierStatus(details.specStatus);
    const resultPath = aggregateResultPath;
    if (
      !specId ||
      !loopStatus ||
      (loopStatus === "pass" && details.liveVerified !== true) ||
      !runId ||
      !resultPath
    ) {
      return [];
    }
    return [
      {
        specId,
        loopStatus,
        runId,
        runUrl,
        resultPath,
        reason: aggregateReason,
      },
    ];
  }

  const results = rawSpecResults
    .map((entry) => objectValue(entry))
    .filter((entry): entry is Record<string, unknown> => !!entry)
    .map((entry) => {
      const specId = stringValue(entry.specId) || stringValue(entry.id);
      const loopStatus = normalizeSpecVerifierStatus(
        entry.specStatus ?? entry.status,
      );
      const resultPath =
        stringValue(entry.resultPath) ||
        artifactResultPath(entry.artifactRefs) ||
        aggregateResultPath;
      return {
        specId,
        loopStatus,
        runId: stringValue(entry.runId) || runId,
        runUrl: stringValue(entry.runUrl) || runUrl,
        resultPath,
        reason: stringValue(entry.reason) || aggregateReason,
        liveVerified:
          entry.liveVerified === true || details.liveVerified === true,
      };
    });

  if (
    results.some(
      (result) =>
        !result.specId ||
        !result.loopStatus ||
        !result.runId ||
        !result.resultPath ||
        (result.loopStatus === "pass" && result.liveVerified !== true),
    )
  ) {
    return [];
  }

  const accepted: AcceptedSpecVerifierResult[] = [];
  for (const result of results) {
    if (!result.loopStatus) continue;
    accepted.push({
      specId: result.specId,
      loopStatus: result.loopStatus,
      runId: result.runId,
      runUrl: result.runUrl,
      resultPath: result.resultPath,
      reason: result.reason,
    });
  }
  return accepted;
}

function applyAcceptedSpecVerifierResults(input: {
  config: TaskTreeConfig;
  taskId: string;
  trigger: ReturnType<typeof parseTriggerEvent>;
}): string[] {
  const workflowResult = reviewedCompletionWorkflowResult(input.trigger);
  if (!workflowResult) {
    return [];
  }
  const verifierResults = acceptedSpecVerifierResults(workflowResult);
  if (!verifierResults.length) return [];

  const statePath = defaultSpecLoopStatePath(input.config.appDir);
  if (!existsSync(statePath)) return [];
  const state = readJsonFile<SpecLoopState | null>(statePath, null);
  if (!state?.specs) return [];

  const acceptedSpecIds: string[] = [];
  for (const result of verifierResults) {
    if (!state.specs[result.specId]) continue;
    updateSpecLoopSpec(state, result.specId, {
      status: result.loopStatus,
      taskId: input.taskId,
      lastRunId: result.runId,
      lastRunUrl: result.runUrl || null,
      lastResultPath: result.resultPath,
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
      heartbeatAt: new Date().toISOString(),
      ...(result.loopStatus === "pass"
        ? {
            failureClass: null,
            diagnosis: null,
            errorFingerprint: null,
          }
        : {
            diagnosis: result.reason,
          }),
      review: {
        ...(state.specs[result.specId]?.review ?? {}),
        acceptedRunId: result.runId,
        acceptedResultPath: result.resultPath,
        acceptedStatus: result.loopStatus,
        acceptedByTaskId: input.taskId,
        acceptedAt: new Date().toISOString(),
      },
    });
    acceptedSpecIds.push(result.specId);
  }
  if (!acceptedSpecIds.length) return [];
  saveSpecLoopState(statePath, state);
  appendToolJournal(input.config, {
    kind: "spec_loop_reviewed_spec_result_accepted",
    task_id: input.taskId,
    spec_ids: acceptedSpecIds,
  });
  return acceptedSpecIds;
}

function openSpecResultFixForwardExists(input: {
  config: TaskTreeConfig;
  specId: string;
  runId: string;
}): boolean {
  const tree = readTaskTree(input.config);
  const openStates = new Set([
    "active",
    "backlog",
    "blocked",
    "review",
    "waiting",
  ]);
  for (const task of Object.values(tree.tasks ?? {})) {
    const state = taskState(task);
    if (!openStates.has(state)) continue;
    const context = taskContext(task);
    const source = objectValue(context.sourceSpecResult);
    if (
      stringValue(source?.specId) === input.specId &&
      stringValue(source?.runId) === input.runId
    ) {
      return true;
    }
  }
  return false;
}

function createAcceptedSpecResultFixForwardTasks(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
  attemptId: string;
  results: AcceptedSpecVerifierResult[];
}): string[] {
  if (!input.task.parent_id) return [];
  const createdTaskIds: string[] = [];
  const sourceContext = taskContext(input.task);
  for (const result of input.results) {
    if (result.loopStatus === "pass") continue;
    if (
      openSpecResultFixForwardExists({
        config: input.config,
        specId: result.specId,
        runId: result.runId,
      })
    ) {
      continue;
    }
    const id = uniqueTaskId(
      input.config,
      `fix-${slugForTaskId(result.specId)}-run-${result.runId}`,
    );
    createTask(input.config, {
      id,
      parentId: input.task.parent_id,
      state: "backlog",
      kind: "domain_leaf",
      priority: taskPriority(input.task),
      owner: input.task.owner,
      workflow:
        typeof input.task.workflow === "string" && input.task.workflow.trim()
          ? input.task.workflow
          : "default-task-worker",
      goal: `Diagnose and fix the reviewed non-pass result for ${result.specId} from run ${result.runId}. Work only this spec slice unless current facts prove a shared helper/root cause, then record that exact shared scope in the result.`,
      inputs: [
        `Reviewed task: ${input.task.id}`,
        `Attempt: ${input.attemptId}`,
        `Spec: ${result.specId}`,
        `Run: ${result.runId}`,
        `Result path: ${result.resultPath}`,
        `Observed status: ${result.loopStatus}`,
        `Observed reason: ${result.reason}`,
      ],
      outputs: [
        `evidence/archive/fix-${slugForTaskId(result.specId)}-run-${result.runId}.md`,
      ],
      acceptance: [
        "Read the exact result artifact plus current spec/test/runner files before deciding.",
        "Classify the failure from current facts and preserve the raw failure packet.",
        "Apply the smallest bounded domain fix when safe, or return an exact wait/escalation with proof.",
        "Run the smallest truthful verification or queue a structured ADO rerun after local gates pass.",
        "Finish with a complete FIX_FORWARD_RESULT block.",
      ],
      forbidden: [
        "Do not rerun the same input after the same error without a changed input, changed diagnosis, or new external fact.",
        "Do not mark product behavior from this result without checking official/API/design/source evidence when needed.",
      ],
      conflict_scope: [
        ...new Set([
          ...taskStringList(input.task, "conflict_scope"),
          `spec:${result.specId}`,
          `ado-run:${result.runId}`,
          `fix-forward:${result.specId}:${result.runId}`,
        ]),
      ],
      context: {
        ...sourceContext,
        workflow: "fix-forward",
        specId: result.specId,
        representedSpecIds: [result.specId],
        sourceSpecResult: {
          sourceTaskId: input.task.id,
          sourceAttemptId: input.attemptId,
          specId: result.specId,
          status: result.loopStatus,
          runId: result.runId,
          runUrl: result.runUrl,
          resultPath: result.resultPath,
          reason: result.reason,
        },
      },
    });
    createdTaskIds.push(id);
  }
  if (createdTaskIds.length > 0) {
    appendToolJournal(input.config, {
      kind: "accepted_spec_result_fix_forward_tasks_created",
      source_task_id: input.task.id,
      task_ids: createdTaskIds,
    });
  }
  return createdTaskIds;
}

function textFromValues(...values: unknown[]): string {
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") return JSON.stringify(value);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function specIdsFromStructuredQueuedRun(
  queuedRun: Record<string, unknown> | null,
  task: NonNullable<ReturnType<typeof readTask>>,
): string[] {
  const ids = new Set<string>();
  const structuredSpecIds = Array.isArray(queuedRun?.specIds)
    ? queuedRun.specIds
    : Array.isArray(queuedRun?.spec_ids)
      ? queuedRun.spec_ids
      : [];
  for (const value of structuredSpecIds) {
    if (typeof value !== "string") continue;
    const specId = value.trim();
    if (specId) ids.add(specId.startsWith("spec.") ? specId : `spec.${specId}`);
  }
  for (const scope of taskStringList(task, "conflict_scope")) {
    if (!scope.startsWith("spec:")) continue;
    const scoped = scope.slice("spec:".length).trim();
    if (!scoped) continue;
    ids.add(scoped.startsWith("spec.") ? scoped : `spec.${scoped}`);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function queuedPipelineRunFromAcceptedReview(input: {
  trigger: ReturnType<typeof parseTriggerEvent>;
  task: NonNullable<ReturnType<typeof readTask>>;
}): QueuedPipelineRun | null {
  const workflowResult = reviewedCompletionWorkflowResult(input.trigger);
  const details = objectValue(workflowResult?.details);
  const structuredQueued =
    objectValue(details?.queuedRun) ??
    objectValue(details?.queuedPipelineRun) ??
    objectValue(details?.acceptedQueuedPipelineRun);

  const runId =
    stringValue(structuredQueued?.runId) ||
    stringValue(structuredQueued?.run_id);
  if (!runId) return null;
  const specIds = specIdsFromStructuredQueuedRun(structuredQueued, input.task);
  const runUrl =
    stringValue(structuredQueued?.runUrl) ||
    stringValue(structuredQueued?.run_url) ||
    stringValue(details?.runUrl) ||
    `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=${runId}`;
  return { runId, specIds, runUrl };
}

function slugForTaskId(value: string): string {
  return (
    value
      .replace(/^spec\./, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "pipeline"
  );
}

function openPipelineWaitExists(
  config: TaskTreeConfig,
  runId: string,
): boolean {
  const tree = readTaskTree(config);
  const openStates = new Set([
    "active",
    "backlog",
    "blocked",
    "review",
    "waiting",
  ]);
  for (const task of Object.values(tree.tasks ?? {})) {
    const state = taskState(task);
    if (!openStates.has(state)) continue;
    const context = taskContext(task);
    const blocker = objectValue(task.blocker);
    const waitingFor = objectValue(blocker?.waiting_for);
    const trace = objectValue(task.trace);
    const structuredRunIds = [
      stringValue(context.runId),
      stringValue(context.workflowRunId),
      stringValue(context.activeWorkflowRunId),
      stringValue(context.lastRunId),
      stringValue(context.acceptedQueuedPipelineRunId),
      stringValue(context.accepted_queued_pipeline_run_id),
      stringValue(waitingFor?.runId),
      stringValue(waitingFor?.run_id),
      stringValue(trace?.runId),
      stringValue(trace?.workflowRunId),
    ].filter(Boolean);
    if (structuredRunIds.includes(runId)) return true;
  }
  return false;
}

function createAcceptedQueuedPipelineWait(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
  attemptId: string;
  summary: string;
  queuedRun: QueuedPipelineRun;
}): string | null {
  if (!input.task.parent_id) return null;
  if (openPipelineWaitExists(input.config, input.queuedRun.runId)) return null;
  const scopeId = input.queuedRun.specIds[0] ?? input.task.id;
  const id = uniqueTaskId(
    input.config,
    `wait-${slugForTaskId(scopeId)}-ado-run-${input.queuedRun.runId}-result`,
  );
  const specText = input.queuedRun.specIds.length
    ? ` for ${input.queuedRun.specIds.join(", ")}`
    : "";
  const blocker = `Wait for Azure DevOps run ${input.queuedRun.runId}${specText} queued by accepted task ${input.task.id}.`;
  createTask(input.config, {
    id,
    parentId: input.task.parent_id,
    state: "blocked",
    kind: "domain_leaf",
    priority: taskPriority(input.task),
    owner: input.task.owner,
    goal: `${blocker} When it is terminal, inspect the artifacts and record the exact pass/fail/error result.`,
    inputs: [
      `Reviewed task: ${input.task.id}`,
      `Attempt: ${input.attemptId}`,
      `ADO run: ${input.queuedRun.runId}`,
      ...input.queuedRun.specIds.map((specId) => `Spec: ${specId}`),
    ],
    outputs: ["runs/test-results/"],
    acceptance: [
      "The Azure DevOps run reaches terminal status and the result artifact is inspected.",
      "The affected spec or feature branch records pass, repair, exact wait, or escalation from the returned artifact.",
    ],
    conflict_scope: [
      ...new Set([
        ...taskStringList(input.task, "conflict_scope"),
        ...input.queuedRun.specIds.map((specId) => `spec:${specId}`),
        `ado-run:${input.queuedRun.runId}`,
      ]),
    ],
    context: {
      ...taskContext(input.task),
      acceptedQueuedPipelineRun: {
        sourceTaskId: input.task.id,
        sourceAttemptId: input.attemptId,
        runId: input.queuedRun.runId,
        runUrl: input.queuedRun.runUrl,
        specIds: input.queuedRun.specIds,
        summary: input.summary,
      },
      terminalPipelineWaitReview: {
        runId: input.queuedRun.runId,
        runUrl: input.queuedRun.runUrl,
        namedSpecIds: input.queuedRun.specIds,
      },
    },
    blocker,
    blockerCategory: "external-wait",
    blockerOwner: "ado",
    resumeCondition: `Resume when Azure DevOps run ${input.queuedRun.runId} is terminal and its artifacts are available.`,
  });
  withTreeLock(input.config, () => {
    const tree = readTaskTree(input.config);
    const task = tree.tasks[id];
    if (!task) return;
    const blockedAt = new Date().toISOString();
    const nextCheckAt = new Date(
      Date.parse(blockedAt) + 10 * 60 * 1000,
    ).toISOString();
    const fallbackAt = new Date(
      Date.parse(blockedAt) + 2 * 60 * 60 * 1000,
    ).toISOString();
    task.blocker = {
      condition: blocker,
      category: "external-wait",
      owner: "ado",
      blocked_at: blockedAt,
      waiting_for: {
        type: "ado.pipeline_run.completed",
        runId: input.queuedRun.runId,
        runUrl: input.queuedRun.runUrl,
        specIds: input.queuedRun.specIds,
        sourceTaskId: input.task.id,
        sourceAttemptId: input.attemptId,
      },
      observed_by: {
        workflow: "project-execution-watchdog",
        trigger: "project.task.reviewed",
      },
      observation_method:
        "Watchdog checks the named Azure DevOps run and moves this wait to review when the run is terminal; the reviewer then consumes artifacts and records the exact result.",
      next_check_at: nextCheckAt,
      resume_condition: `Resume when Azure DevOps run ${input.queuedRun.runId} is terminal and its artifacts are available.`,
      fallback_at: fallbackAt,
      fallback_action:
        "If the run is still not reviewable at fallback, refresh this exact wait with current ADO status or escalate the artifact/reachability issue.",
    };
    task.trace = {
      ...(task.trace ?? {}),
      accepted_queued_pipeline_wait_created_at: blockedAt,
      accepted_queued_pipeline_source_task_id: input.task.id,
      accepted_queued_pipeline_source_attempt_id: input.attemptId,
      accepted_queued_pipeline_run_id: input.queuedRun.runId,
    };
    saveTaskTreeWithKanbanSnapshot(input.config, tree);
  });
  appendToolJournal(input.config, {
    kind: "accepted_review_queued_pipeline_wait_created",
    task_id: id,
    source_task_id: input.task.id,
    run_id: input.queuedRun.runId,
    spec_ids: input.queuedRun.specIds,
  });
  return id;
}

function normalizeReviewDecision(value: unknown): ReviewDecision | null {
  return value === "accept" ||
    value === "redo" ||
    value === "followup" ||
    value === "blocked" ||
    value === "escalate"
    ? value
    : null;
}

function firstText(...groups: string[][]): string {
  for (const group of groups) {
    const found = group.find((entry) => entry.trim());
    if (found) return found.trim();
  }
  return "";
}

function taskPriority(
  task: NonNullable<ReturnType<typeof readTask>>,
): "P0" | "P1" | "P2" | "P3" {
  return task.priority === "P0" ||
    task.priority === "P1" ||
    task.priority === "P2" ||
    task.priority === "P3"
    ? task.priority
    : "P2";
}

function taskStringList(
  task: NonNullable<ReturnType<typeof readTask>>,
  key: "outputs" | "conflict_scope",
): string[] {
  return Array.isArray(task[key])
    ? task[key].filter((entry): entry is string => typeof entry === "string")
    : [];
}

function taskContext(
  task: NonNullable<ReturnType<typeof readTask>>,
): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function taskConflictScopes(task: TaskNode): string[] {
  return Array.isArray(task.conflict_scope)
    ? task.conflict_scope.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function specLoopStateForReview(config: TaskTreeConfig): SpecLoopState | null {
  const path = defaultSpecLoopStatePath(config.appDir);
  if (!existsSync(path)) return null;
  return readJsonFile<SpecLoopState | null>(path, null);
}

function specFamily(specId: string): string {
  return (
    specId
      .replace(/^spec\./, "")
      .split(".")[0]
      ?.trim() || "unknown"
  );
}

function representedSpecIdsForReviewTask(
  task: NonNullable<ReturnType<typeof readTask>>,
): string[] {
  const ids = new Set<string>();
  const context = taskContext(task);
  for (const key of ["representedSpecIds", "specIds"]) {
    for (const value of stringList(context[key])) ids.add(value);
  }
  const specId = stringValue(context.specId);
  if (specId) ids.add(specId);
  for (const scope of taskStringList(task, "conflict_scope")) {
    if (scope.startsWith("spec:")) {
      const scopedSpecId = scope.slice("spec:".length).trim();
      if (scopedSpecId) ids.add(scopedSpecId);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function specLoopMaxDirectAttempts(
  config: TaskTreeConfig,
  state: SpecLoopState,
): number {
  const loopTask = readTask(
    config,
    state.loopTaskId || "aks-spec-verification-loop",
  );
  const value = loopTask
    ? taskContext(loopTask).maxDirectAttemptsPerSpec
    : null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3;
}

function canDirectlyRunSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  if (spec.status === "pending" || spec.status === "done") {
    return !spec.lastRunUrl || (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
  }
  if (spec.status !== "error" && spec.status !== "fail") return false;
  return (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
}

function isRetryExhaustedSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  const status = spec.status || "pending";
  if (status === "pending") {
    return !canDirectlyRunSpec(state, specId, maxDirectAttemptsPerSpec);
  }
  if (status !== "error" && status !== "fail") return false;
  return (spec.attempts ?? 0) >= maxDirectAttemptsPerSpec;
}

function taskHasStructuredBlocker(
  task: NonNullable<ReturnType<typeof readTask>> | undefined,
): boolean {
  return !!task?.blocker && typeof task.blocker === "object";
}

function specLoopSpecHasStructuredSuccessor(
  spec: SpecLoopSpecState | undefined,
): boolean {
  if (!spec) return false;
  const record = spec as SpecLoopSpecState & {
    successorDisposition?: unknown;
    resumeCondition?: unknown;
  };
  if (
    typeof record.successorDisposition === "string" &&
    record.successorDisposition.trim()
  ) {
    return true;
  }
  if (
    typeof record.resumeCondition === "string" &&
    record.resumeCondition.trim()
  ) {
    return true;
  }
  return !!spec.review && typeof spec.review === "object";
}

function specLoopFollowupGroupKeys(
  task: NonNullable<ReturnType<typeof readTask>> | undefined,
): Set<string> {
  const keys = new Set<string>();
  if (!task) return keys;
  const context = taskContext(task);
  if (context.specLoopFollowup === true) {
    const status = context.status;
    const family = context.featureFamily;
    if (typeof status === "string" && typeof family === "string") {
      keys.add(`${status}:${family}`);
    }
  }
  for (const scope of taskStringList(task, "conflict_scope")) {
    const trimmed = scope.trim();
    if (!trimmed.startsWith("spec-loop-followup:")) continue;
    const [, statusPart, familyPart] = trimmed.split(":");
    if (statusPart?.trim() && familyPart?.trim()) {
      keys.add(`${statusPart.trim()}:${familyPart.trim()}`);
    }
  }
  return keys;
}

function taskTextMentionsSpecId(
  task: NonNullable<ReturnType<typeof readTask>> | undefined,
  specId: string,
): boolean {
  if (!task) return false;
  const haystack = JSON.stringify({
    goal: task.goal,
    acceptance: task.acceptance,
    inputs: task.inputs,
    context: task.context,
    blocker: task.blocker,
  }).toLowerCase();
  return haystack.includes(specId.toLowerCase());
}

function taskTextMentionCountsAsSpecOwner(
  task: NonNullable<ReturnType<typeof readTask>> | undefined,
  specId: string,
): boolean {
  if (!taskTextMentionsSpecId(task, specId)) return false;
  return taskState(task) !== "blocked" || taskHasStructuredBlocker(task);
}

function specLoopExactOwnerTaskId(input: {
  config: TaskTreeConfig;
  state: SpecLoopState;
  specId: string;
  excludeTaskId?: string;
}): string | null {
  const spec = input.state.specs?.[input.specId];
  const tree = readTaskTree(input.config);
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  const isRepresenting = (
    task: NonNullable<ReturnType<typeof readTask>> | undefined,
  ): task is NonNullable<ReturnType<typeof readTask>> =>
    !!task &&
    task.id !== input.excludeTaskId &&
    representingStates.has(taskState(task));

  const taskIds = new Set<string>();
  if (typeof spec?.taskId === "string" && spec.taskId.trim()) {
    taskIds.add(spec.taskId.trim());
  }
  for (const task of Object.values(tree.tasks ?? {})) {
    if (!isRepresenting(task)) continue;
    if (
      taskStringList(task, "conflict_scope").includes(`spec:${input.specId}`)
    ) {
      taskIds.add(task.id);
      continue;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      taskIds.add(task.id);
    }
  }

  for (const taskId of taskIds) {
    const task = tree.tasks?.[taskId];
    if (!isRepresenting(task)) continue;
    if (
      taskStringList(task, "conflict_scope").includes(`spec:${input.specId}`)
    ) {
      return taskId;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) return taskId;
    if (specLoopFollowupGroupKeys(task).size > 0) return taskId;
    if (
      spec?.taskId === taskId &&
      specLoopSpecHasStructuredSuccessor(spec) &&
      taskHasStructuredBlocker(task)
    ) {
      return taskId;
    }
  }

  return null;
}

function representedSpecLoopFollowupGroups(input: {
  config: TaskTreeConfig;
  excludeTaskId?: string;
}): Set<string> {
  const tree = readTaskTree(input.config);
  const represented = new Set<string>();
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  for (const task of Object.values(tree.tasks ?? {})) {
    if (task.id === input.excludeTaskId) continue;
    if (!representingStates.has(taskState(task))) continue;
    for (const key of specLoopFollowupGroupKeys(task)) represented.add(key);
  }
  return represented;
}

function specLoopAcceptStructuralGaps(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
}): string[] {
  if (taskContext(input.task).specLoopFollowup !== true) return [];
  const state = specLoopStateForReview(input.config);
  if (!state?.specs) return [];
  const representedSpecIds = representedSpecIdsForReviewTask(input.task).filter(
    (specId) => !!state.specs?.[specId],
  );
  if (representedSpecIds.length === 0) return [];

  const maxDirectAttempts = specLoopMaxDirectAttempts(input.config, state);
  const representedGroups = representedSpecLoopFollowupGroups({
    config: input.config,
    excludeTaskId: input.task.id,
  });
  const unowned: string[] = [];
  for (const specId of representedSpecIds) {
    if (!isRetryExhaustedSpec(state, specId, maxDirectAttempts)) continue;
    const status = state.specs[specId]?.status || "pending";
    const groupStatus = status === "pending" ? "pending" : status;
    if (representedGroups.has(`${groupStatus}:${specFamily(specId)}`)) {
      continue;
    }
    if (
      specLoopExactOwnerTaskId({
        config: input.config,
        state,
        specId,
        excludeTaskId: input.task.id,
      })
    ) {
      continue;
    }
    unowned.push(specId);
  }
  return unowned;
}

function isBlockedOverdueAuditTask(
  task: NonNullable<ReturnType<typeof readTask>>,
): boolean {
  const context = taskContext(task);
  const metricId = stringValue(context.metricId);
  return (
    context.blockedOverdueAudit === true ||
    metricId === "aks-rp-e2e.process.blocked.overdue-unworked-count" ||
    metricId === "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count"
  );
}

function blockedOverdueScope(parentId: unknown): string {
  if (parentId === "aks-spec-verification-loop") return "spec-loop";
  if (parentId === "aks-feature-compact-loop") return "compact-loop";
  if (parentId === "project") return "project";
  return "";
}

function blockedOverdueScopeAliases(scope: string): string[] {
  const aliases = new Set([scope]);
  if (scope.endsWith("-loop")) {
    aliases.add(scope.slice(0, -"-loop".length));
  }
  if (scope === "spec-loop") aliases.add("spec-verification");
  if (scope === "compact-loop") aliases.add("feature-compact");
  if (scope === "project") aliases.add("project-root");
  return [...aliases];
}

function blockedWaitOverdueAt(task: TaskNode): number | null {
  const blocker = objectValue(task.blocker);
  const overdueAt = [
    blocker?.next_check_at,
    blocker?.nextCheckAt,
    blocker?.resume_at,
    blocker?.resumeAt,
    blocker?.fallback_at,
    blocker?.fallbackAt,
  ]
    .map((value) => Date.parse(stringValue(value)))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)[0];
  return Number.isFinite(overdueAt) ? overdueAt : null;
}

function taskCoversBlockedOverdueWait(
  candidate: TaskNode,
  blockedTask: TaskNode,
  sourceTaskId: string,
): boolean {
  if (candidate.id === sourceTaskId) return false;
  if (candidate.id === blockedTask.id) return false;
  if (
    typeof candidate.id === "string" &&
    typeof blockedTask.parent_id === "string" &&
    candidate.id === blockedTask.parent_id
  ) {
    return false;
  }
  const blockedTaskId =
    typeof blockedTask.id === "string" ? blockedTask.id.trim() : "";
  if (
    blockedTaskId &&
    structuredBlockedTaskIds(candidate).includes(blockedTaskId)
  ) {
    return true;
  }

  const scope = blockedOverdueScope(blockedTask.parent_id);
  if (!scope) return false;
  const aliases = blockedOverdueScopeAliases(scope);
  return taskConflictScopes(candidate).some((conflictScope) => {
    if (
      conflictScope === `ops:blocked-overdue:${scope}` ||
      conflictScope.startsWith(`ops:blocked-overdue:${scope}:`)
    ) {
      return true;
    }
    return aliases.some(
      (alias) =>
        conflictScope === `ops:${alias}-overdue-blocked-frontier` ||
        conflictScope.startsWith(`ops:${alias}-overdue-blocked-frontier-`) ||
        conflictScope === `ops:${alias}-overdue-frontier` ||
        conflictScope.startsWith(`ops:${alias}-overdue-frontier-`),
    );
  });
}

function acceptedOverdueBlockedWaitGaps(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
  summary: string;
  findings: string[];
  feedback: string[];
  suggestedFollowups: string[];
}): string[] {
  if (!isBlockedOverdueAuditTask(input.task)) return [];

  const tree = readTaskTree(input.config);
  const auditedBlockedTaskIds = structuredBlockedTaskIds(input.task);
  if (auditedBlockedTaskIds.length === 0) {
    return ["missing-structured-blocked-task-ids"];
  }
  const audited = new Set(auditedBlockedTaskIds);
  const tasks = Object.values(tree.tasks) as TaskNode[];
  const activeOrReview = tasks.filter((task) =>
    ["active", "review"].includes(taskState(task)),
  );
  const now = Date.now();

  return tasks
    .filter((task) => {
      if (taskState(task) !== "blocked") return false;
      if ((task.children ?? []).length > 0) return false;
      const id = typeof task.id === "string" ? task.id : "";
      return id && audited.has(id);
    })
    .flatMap((blockedTask) => {
      const overdueAt = blockedWaitOverdueAt(blockedTask);
      if (overdueAt === null || overdueAt > now) return [];
      const covered = activeOrReview.some((candidate) =>
        taskCoversBlockedOverdueWait(candidate, blockedTask, input.task.id),
      );
      return covered && blockedTask.id ? [] : [blockedTask.id ?? "unknown"];
    });
}

function structuredBlockedTaskIds(
  task: NonNullable<ReturnType<typeof readTask>>,
): string[] {
  const ids = new Set<string>();
  const context = taskContext(task);
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      ids.add(value.trim());
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const id = stringValue(record.taskId ?? record.task_id ?? record.id);
    if (id) ids.add(id);
  };
  const collectArray = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const entry of value) collect(entry);
  };

  collectArray(context.blockedTaskIds);
  collectArray(context.blocked_task_ids);
  collectArray(context.blockedTasks);
  collectArray(context.blocked_tasks);
  collectArray(context.auditedBlockedTaskIds);
  collectArray(context.audited_blocked_task_ids);
  collectArray(context.auditedBlockedTasks);
  collectArray(context.audited_blocked_tasks);
  collectArray(context.offenderTaskIds);
  collectArray(context.offender_task_ids);

  return [...ids].sort((a, b) => a.localeCompare(b));
}

function uniqueTaskId(config: TaskTreeConfig, base: string): string {
  const normalized =
    base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "review-followup";
  if (!readTask(config, normalized)) return normalized;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalized}-${index}`;
    if (!readTask(config, candidate)) return candidate;
  }
  throw new Error(`Could not allocate unique task id for ${base}`);
}

function reviewedSuccessorConflictScopes(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
  summary: string;
  findings: string[];
  feedback: string[];
  suggestedFollowups: string[];
  reviewAction?: ReviewAction | null;
}): string[] {
  const scopes = new Set(taskStringList(input.task, "conflict_scope"));
  for (const scope of input.reviewAction?.conflictScopes ?? []) {
    scopes.add(scope);
  }
  const context = taskContext(input.task);
  const metricId = typeof context.metricId === "string" ? context.metricId : "";
  const isBlockedOverdueAudit =
    context.blockedOverdueAudit === true ||
    metricId === "aks-rp-e2e.process.blocked.overdue-unworked-count" ||
    metricId === "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count";
  if (!isBlockedOverdueAudit) return [...scopes];

  const structuredScopes = new Set(
    structuredBlockedTaskIds(input.task)
      .map((taskId) =>
        blockedOverdueScope(readTask(input.config, taskId)?.parent_id),
      )
      .filter(Boolean),
  );
  if (
    structuredScopes.has("compact-loop") ||
    taskStringList(input.task, "conflict_scope").some((scope) =>
      scope.includes("compact-loop"),
    )
  ) {
    scopes.add("ops:blocked-overdue:compact-loop");
  } else if (
    structuredScopes.has("spec-loop") ||
    taskStringList(input.task, "conflict_scope").some((scope) =>
      scope.includes("spec-loop"),
    )
  ) {
    scopes.add("ops:blocked-overdue:spec-loop");
  } else {
    scopes.add("ops:blocked-overdue:project");
  }
  return [...scopes];
}

type ReviewedBlockedProjectAction = {
  goal: string;
  owner?: string;
  parentId?: string;
  idBase?: string;
  kind?: string;
  outputs?: string[];
  acceptance: string[];
  state?: "backlog" | "blocked";
  blockerOwner?: string;
  blockerCategory?: string;
  resumeAt?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
  resumeCondition?: string;
  blockerCondition?: string;
};

type ReviewAction = {
  actionKind: string;
  goal?: string;
  owner?: string;
  parentId?: string;
  idBase?: string;
  kind?: string;
  outputs?: string[];
  acceptance?: string[];
  conflictScopes?: string[];
};

function taskIdLeaf(id: string): string {
  return id.split("/").filter(Boolean).pop() || id;
}

function reviewActionFromValue(value: unknown): ReviewAction | null {
  const action = objectValue(value);
  const actionKind = stringValue(
    action?.actionKind ?? action?.action_kind ?? action?.kind,
  );
  if (!actionKind) return null;
  return {
    actionKind,
    goal: stringValue(action?.goal),
    owner: stringValue(action?.owner),
    parentId: stringValue(action?.parentId ?? action?.parent_id),
    idBase: stringValue(action?.idBase ?? action?.id_base),
    kind: stringValue(action?.taskKind ?? action?.task_kind),
    outputs: stringList(action?.outputs),
    acceptance: stringList(action?.acceptance),
    conflictScopes: stringList(
      action?.conflictScopes ?? action?.conflict_scope,
    ),
  };
}

function reviewedBlockedProjectAction(input: {
  task?: TaskNode;
  decision: ReviewDecision;
  action: ReviewAction | null;
  suggestedFollowups: string[];
}): ReviewedBlockedProjectAction | null {
  if (!input.action) return null;

  if (input.action.actionKind === "app-state-repair") {
    const sourceId = input.task?.id ? taskIdLeaf(input.task.id) : "review";
    return {
      goal:
        input.action.goal ||
        firstText(input.suggestedFollowups) ||
        `Apply the app-owned task-tree or loop-state repair required by reviewed task ${input.task?.id ?? "unknown"}.`,
      owner: input.action.owner || "app-ops",
      parentId: input.action.parentId || "project",
      idBase: input.action.idBase || `ops/apply-${sourceId}-state-repair`,
      kind: input.action.kind || "domain_leaf",
      outputs: input.action.outputs?.length
        ? input.action.outputs
        : [
            "task tree",
            ".state/feature-compact-loop/state.json",
            ".state/spec-loop/state.json",
            "evidence/archive/",
          ],
      acceptance: input.action.acceptance?.length
        ? input.action.acceptance
        : [
            "The app-owned task-tree or loop-state repair is applied through supported app mechanisms.",
            "The affected branch records the exact restored holder, state pointer, or refreshed wait with evidence.",
          ],
      state: "backlog",
    };
  }

  if (
    input.action.actionKind === "publish-domain-repair-and-rerun" &&
    input.decision === "blocked"
  ) {
    return {
      goal:
        input.action.goal ||
        firstText(input.suggestedFollowups) ||
        "Publish the repair commit or equivalent descendant to origin/dev, then run the required local checks and queue the bounded Azure DevOps rerun described by the review.",
      owner: input.action.owner,
      parentId: input.action.parentId,
      idBase: input.action.idBase,
      kind: input.action.kind,
      outputs: input.action.outputs,
      acceptance: input.action.acceptance?.length
        ? input.action.acceptance
        : [
            "The project-side blocker is resolved with concrete evidence.",
            "The affected task branch records the publication, rerun, and next verification result.",
          ],
      state: "backlog",
    };
  }

  if (input.action.actionKind === "schedule-domain-rerun") {
    const sourceId = input.task?.id ? taskIdLeaf(input.task.id) : "review";
    const resumeSignal = firstText(input.suggestedFollowups);
    const extractedIso =
      (resumeSignal.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/) ||
        [])[0] || "";
    const resumeAt = extractedIso || undefined;
    const state =
      input.decision === "blocked" || resumeAt ? "blocked" : "backlog";
    const nextCheckAt = resumeAt;
    const fallbackAt = resumeAt
      ? new Date(Date.parse(resumeAt) + 6 * 60 * 60 * 1000).toISOString()
      : undefined;
    const taskId = input.task?.id ?? "";
    const taskParentId = input.task?.parent_id ?? "";
    const opsScoped =
      taskId === "ops" ||
      taskId.startsWith("ops/") ||
      taskId.startsWith("ops-") ||
      taskParentId === "ops" ||
      taskParentId.startsWith("ops/") ||
      taskParentId.startsWith("ops-");
    const owner = input.action.owner || (opsScoped ? "app-ops" : input.task?.owner);
    return {
      goal:
        input.action.goal ||
        firstText(input.suggestedFollowups) ||
        `Resume the reviewed domain rerun or wait-window check for ${input.task?.id ?? "unknown"} at the named window and carry the exact same-lineage action forward.`,
      owner,
      parentId: input.action.parentId || input.task?.parent_id,
      idBase: input.action.idBase || sourceId,
      kind: input.action.kind || input.task?.kind || "domain_leaf",
      outputs: input.action.outputs,
      acceptance: input.action.acceptance?.length
        ? input.action.acceptance
        : [
            "The worker resumes at or after the named review/fallback window and records the current lineage result with concrete evidence.",
            "The affected task branch records the resulting refresh, rerun, wait replacement, or next verification step without duplicating passive waits.",
          ],
      state,
      blockerOwner: opsScoped ? "app-ops" : "human",
      blockerCategory: "external-wait",
      resumeAt,
      nextCheckAt,
      fallbackAt,
      fallbackAction:
        input.action.goal ||
        firstText(input.suggestedFollowups) ||
        "If the same review window opens unanswered, refresh or reassign this exact successor rather than creating a duplicate passive wait.",
      resumeCondition:
        input.action.goal ||
        firstText(input.suggestedFollowups) ||
        `Resume the reviewed domain rerun or fallback check for ${input.task?.id ?? "unknown"} at the named window.`,
      blockerCondition:
        `Future-window successor created from reviewed task ${input.task?.id ?? "unknown"}; do not start before its named review window opens. ${
          firstText(input.suggestedFollowups) ||
          input.action.goal ||
          ""
        }`.trim(),
    };
  }

  return null;
}

function createReviewedSuccessor(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
  decision: ReviewDecision;
  attemptId: string;
  summary: string;
  findings: string[];
  feedback: string[];
  suggestedFollowups: string[];
  reviewAction: ReviewAction | null;
}): string {
  if (!input.task.parent_id) {
    throw new Error(
      `Reviewed task ${input.task.id} has no parent for successor`,
    );
  }
  const followupText =
    firstText(input.suggestedFollowups, input.feedback, input.findings) ||
    `Resolve reviewed ${input.decision} result for ${input.task.id}.`;
  const projectAction = reviewedBlockedProjectAction({
    task: input.task,
    decision: input.decision,
    action: input.reviewAction,
    suggestedFollowups: input.suggestedFollowups,
  });
  const id = uniqueTaskId(
    input.config,
    projectAction?.idBase ||
      `${input.task.id}-${input.decision === "followup" ? "followup" : input.decision}`,
  );
  const isBlocked =
    input.decision === "blocked" || input.decision === "escalate";
  const createsRunnableProjectAction =
    !!projectAction && projectAction.state !== "blocked";
  const shouldBlockSuccessor =
    projectAction?.state === "blocked" ||
    (isBlocked && !createsRunnableProjectAction);
  const blocker =
    firstText(input.feedback, input.findings, [input.summary]) ||
    `Reviewed task ${input.task.id} needs ${input.decision} handling.`;
  const blockerOwner = input.decision === "escalate" ? "human" : "external";
  const resumeCondition =
    firstText(input.suggestedFollowups) ||
    `Resume when ${input.decision} condition for ${input.task.id} is resolved.`;
  const successorContext: Record<string, unknown> = {
    ...taskContext(input.task),
    reviewedTask: {
      taskId: input.task.id,
      attemptId: input.attemptId,
      decision: input.decision,
      summary: input.summary,
      findings: input.findings,
      feedback: input.feedback,
      suggestedFollowups: input.suggestedFollowups,
      ...(input.reviewAction ? { reviewAction: input.reviewAction } : {}),
    },
  };
  if (projectAction?.owner === "app-ops") {
    delete successorContext.workflow;
  }
  createTask(input.config, {
    id,
    parentId: projectAction?.parentId || input.task.parent_id,
    state:
      projectAction?.state || (shouldBlockSuccessor ? "blocked" : "backlog"),
    kind: projectAction?.kind || input.task.kind || "domain_leaf",
    priority: taskPriority(input.task),
    owner: projectAction?.owner || input.task.owner,
    workflow: input.task.workflow,
    goal: createsRunnableProjectAction
      ? projectAction.goal
      : shouldBlockSuccessor
        ? `Resolve ${input.decision} review for ${input.task.id}: ${blocker}`
        : followupText,
    inputs: [`Reviewed task: ${input.task.id}`, `Attempt: ${input.attemptId}`],
    outputs: projectAction?.outputs?.length
      ? projectAction.outputs
      : taskStringList(input.task, "outputs").length
        ? taskStringList(input.task, "outputs")
        : ["task tree"],
    acceptance: createsRunnableProjectAction
      ? projectAction.acceptance
      : shouldBlockSuccessor
        ? [
            "The external wait or escalation has a concrete result, or a replacement runnable task is created.",
            "The affected task branch records the result and next verification step.",
          ]
        : [
            "The review follow-up is resolved with concrete evidence.",
            "The affected task branch records the result and next verification step.",
          ],
    conflict_scope: reviewedSuccessorConflictScopes(input),
    context: successorContext,
    ...(shouldBlockSuccessor
      ? {
          blocker: projectAction?.blockerCondition || blocker,
          blockerCategory: projectAction?.blockerCategory || "external-wait",
          blockerOwner: projectAction?.blockerOwner || blockerOwner,
          resumeCondition: projectAction?.resumeCondition || resumeCondition,
          ...(projectAction?.resumeAt ? { resumeAt: projectAction.resumeAt } : {}),
          ...(projectAction?.nextCheckAt
            ? { nextCheckAt: projectAction.nextCheckAt }
            : {}),
          ...(projectAction?.fallbackAt
            ? { fallbackAt: projectAction.fallbackAt }
            : {}),
          ...(projectAction?.fallbackAction
            ? { fallbackAction: projectAction.fallbackAction }
            : {}),
        }
      : {}),
  });
  if (projectAction) {
    withTreeLock(input.config, () => {
      const tree = readTaskTree(input.config);
      const task = tree.tasks[id];
      if (!task) return;
      if (projectAction.owner) task.owner = projectAction.owner;
      if (projectAction.kind) task.kind = projectAction.kind;
      if (projectAction.outputs?.length) task.outputs = projectAction.outputs;
      task.acceptance = projectAction.acceptance;
      saveTaskTreeWithKanbanSnapshot(input.config, tree);
    });
  }
  if (!shouldBlockSuccessor) return id;

  withTreeLock(input.config, () => {
    const tree = readTaskTree(input.config);
    const task = tree.tasks[id];
    if (!task) return;
    const blockedAt = new Date().toISOString();
    const nextCheckAt =
      projectAction?.nextCheckAt ||
      new Date(Date.parse(blockedAt) + 10 * 60 * 1000).toISOString();
    const fallbackAt =
      projectAction?.fallbackAt ||
      new Date(Date.parse(blockedAt) + 24 * 60 * 60 * 1000).toISOString();
    task.blocker = {
      condition: projectAction?.blockerCondition || blocker,
      category: projectAction?.blockerCategory || "external-wait",
      owner: projectAction?.blockerOwner || blockerOwner,
      blocked_at: blockedAt,
      waiting_for: {
        type:
          input.decision === "escalate" ? "owner.decision" : "blocker.resolved",
        reviewedTaskId: input.task.id,
        reviewedAttemptId: input.attemptId,
        successorTaskId: id,
        source: "project.task.reviewed",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.task.reviewed",
      },
      observation_method:
        "Project planner created this reviewed blocked successor from the review result; on the next owner/planner pass, refresh it with concrete returned evidence, replace it with runnable work, or keep the wait with updated blocker proof.",
      ...(projectAction?.resumeAt ? { resume_at: projectAction.resumeAt } : {}),
      next_check_at: nextCheckAt,
      resume_condition: projectAction?.resumeCondition || resumeCondition,
      fallback_at: fallbackAt,
      fallback_action:
        projectAction?.fallbackAction ||
        "If the reviewed blocker is still unresolved at fallback time, create or reuse a concrete recovery/escalation task, or refresh this exact wait with current evidence.",
    };
    task.trace = {
      ...(task.trace ?? {}),
      blocked_contract_seeded_at: blockedAt,
      blocked_contract_seeded_by: "project-planner",
      reviewed_source_task_id: input.task.id,
      reviewed_source_attempt_id: input.attemptId,
    };
    saveTaskTreeWithKanbanSnapshot(input.config, tree);
  });
  return id;
}

function requeueReviewedBlockedProjectActions(
  config: TaskTreeConfig,
): string[] {
  const requeuedTaskIds: string[] = [];
  const now = new Date().toISOString();

  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    for (const task of Object.values(tree.tasks) as TaskNode[]) {
      const state = String(task.status ?? task.state ?? "");
      if (state !== "blocked") continue;
      const context =
        task.context &&
        typeof task.context === "object" &&
        !Array.isArray(task.context)
          ? (task.context as Record<string, unknown>)
          : {};
      const reviewedTask =
        context.reviewedTask &&
        typeof context.reviewedTask === "object" &&
        !Array.isArray(context.reviewedTask)
          ? (context.reviewedTask as Record<string, unknown>)
          : null;
      if (!reviewedTask) continue;

      const decision = normalizeReviewDecision(reviewedTask.decision);
      const reviewAction = reviewActionFromValue(reviewedTask.reviewAction);
      const action = reviewedBlockedProjectAction({
        task,
        decision: decision ?? "blocked",
        action: reviewAction,
        suggestedFollowups: stringList(reviewedTask.suggestedFollowups),
      });
      if (!action) continue;
      if (reviewAction?.actionKind === "app-state-repair") {
        continue;
      }
      if (action.state === "blocked") {
        continue;
      }

      task.state = "backlog";
      task.status = "backlog";
      task.blocker = undefined;
      task.goal = action.goal;
      task.owner = action.owner || task.owner;
      task.kind = action.kind || task.kind;
      if (action.outputs?.length) task.outputs = action.outputs;
      task.acceptance = action.acceptance;
      task.trace = {
        ...(task.trace ?? {}),
        requeued_at: now,
        requeued_by: "project-planner",
        requeue_reason:
          "reviewed blocked successor contains actionable project-side origin/dev publication and rerun work",
        previous_nonterminal_status: state,
      };
      if (typeof task.id === "string") {
        requeuedTaskIds.push(task.id);
      }
    }

    if (requeuedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
  });

  if (requeuedTaskIds.length > 0) {
    appendToolJournal(config, {
      kind: "reviewed_blocked_project_actions_requeued",
      task_ids: requeuedTaskIds,
      reason:
        "reviewed blocked successors described project-side origin/dev publication/rerun work",
    });
  }

  return requeuedTaskIds;
}

function applyReviewedTaskEvent(
  config: TaskTreeConfig,
  trigger: ReturnType<typeof parseTriggerEvent>,
): ReviewedTaskApplyResult {
  if (trigger?.type !== "project.task.reviewed") {
    return {
      handled: false,
      applied: false,
      message: "Trigger is not project.task.reviewed.",
    };
  }

  const taskId =
    reviewString(trigger, "taskId") || reviewString(trigger, "task_id");
  const attemptId =
    reviewString(trigger, "attemptId") || reviewString(trigger, "attempt_id");
  const decision = normalizeReviewDecision(reviewValue(trigger, "decision"));
  if (!taskId || !attemptId || !decision) {
    return {
      handled: true,
      applied: false,
      message:
        "Ignored project.task.reviewed because taskId, attemptId, and decision are required.",
    };
  }

  const task = readTask(config, taskId);
  if (!task) {
    return {
      handled: true,
      applied: false,
      decision,
      taskId,
      message: `Ignored stale reviewed event for ${taskId}: task was not found.`,
    };
  }
  const state = taskState(task);
  if (state !== "review") {
    return {
      handled: true,
      applied: false,
      decision,
      taskId,
      message: `Ignored stale reviewed event for ${taskId}: task is ${state}, not review.`,
    };
  }
  const liveAttemptId = currentAttemptId(task);
  if (liveAttemptId && liveAttemptId !== attemptId) {
    return {
      handled: true,
      applied: false,
      decision,
      taskId,
      message: `Ignored stale reviewed event for ${taskId}: attempt ${attemptId} is not current.`,
    };
  }

  const summary =
    reviewString(trigger, "summary") ||
    `Reviewer decision ${decision} for ${taskId}.`;
  const findings = reviewStringList(trigger, "findings");
  const feedback = reviewStringList(trigger, "feedback");
  const suggestedFollowups = [
    ...reviewStringList(trigger, "suggestedFollowups"),
    ...reviewStringList(trigger, "suggested_followups"),
  ];
  const reviewAction =
    reviewActionFromValue(reviewValue(trigger, "reviewAction")) ??
    reviewActionFromValue(reviewValue(trigger, "review_action"));

  if (decision === "accept") {
    if (
      findings.some(
        (finding) =>
          finding === "validation-note:worker-cited-missing-durable-evidence",
      )
    ) {
      return rejectAcceptOnInvariant({
        config,
        taskId,
        attemptId,
        invariant: "task.accept.requires-existing-durable-evidence",
        summary: `Accept cannot close ${taskId}: worker cited durable evidence that is missing from the app/domain repo.`,
        details: {
          reviewerDecision: decision,
          findings,
          feedback,
          suggestedFollowups,
        },
      });
    }
    const unownedSpecIds = specLoopAcceptStructuralGaps({ config, task });
    if (unownedSpecIds.length > 0) {
      const invariantSummary = `Spec-loop accept cannot close ${taskId}: ${unownedSpecIds.length} represented retry-drained spec(s) still lack an open structural owner: ${unownedSpecIds
        .slice(0, 8)
        .join(", ")}.`;
      return rejectAcceptOnInvariant({
        config,
        taskId,
        attemptId,
        invariant: "spec-loop.accept.requires-structural-owner",
        summary: invariantSummary,
        details: {
          unownedSpecIds,
          reviewerDecision: decision,
          findings,
          feedback,
          suggestedFollowups,
        },
      });
    }
    const overdueWaitGaps = acceptedOverdueBlockedWaitGaps({
      config,
      task,
      summary,
      findings,
      feedback,
      suggestedFollowups,
    });
    if (overdueWaitGaps.length > 0) {
      const invariantSummary = `Overdue-wait accept cannot close ${taskId}: ${overdueWaitGaps.length} named blocked wait(s) would remain overdue without active/review recovery or refreshed future fallback: ${overdueWaitGaps
        .slice(0, 8)
        .join(", ")}.`;
      return rejectAcceptOnInvariant({
        config,
        taskId,
        attemptId,
        invariant: "blocked-overdue.accept.requires-covered-fresh-waits",
        summary: invariantSummary,
        details: {
          overdueWaitGaps,
          reviewerDecision: decision,
          findings,
          feedback,
          suggestedFollowups,
        },
      });
    }
    const workflowResult = reviewedCompletionWorkflowResult(trigger);
    const acceptedResults = workflowResult
      ? acceptedSpecVerifierResults(workflowResult)
      : [];
    const acceptedSpecIds = applyAcceptedSpecVerifierResults({
      config,
      taskId,
      trigger,
    });
    const acceptedSpecIdSet = new Set(acceptedSpecIds);
    const fixForwardTaskIds = acceptedSpecIds.length
      ? createAcceptedSpecResultFixForwardTasks({
          config,
          task,
          attemptId,
          results: acceptedResults.filter((result) =>
            acceptedSpecIdSet.has(result.specId),
          ),
        })
      : [];
    const queuedRun = acceptedSpecIds.length
      ? null
      : queuedPipelineRunFromAcceptedReview({ trigger, task });
    const queuedWaitTaskId = queuedRun
      ? createAcceptedQueuedPipelineWait({
          config,
          task,
          attemptId,
          summary,
          queuedRun,
        })
      : null;
    const acceptedReviewAction = reviewAction
      ? reviewedBlockedProjectAction({
          task,
          decision,
          action: reviewAction,
          suggestedFollowups,
        })
      : null;
    const acceptedReviewActionTaskId =
      acceptedReviewAction && !queuedWaitTaskId && fixForwardTaskIds.length === 0
        ? createReviewedSuccessor({
            config,
            task,
            decision,
            attemptId,
            summary,
            findings,
            feedback,
            suggestedFollowups,
            reviewAction,
          })
        : null;
    markTaskDone(config, { taskId, summary, reviewDecision: decision });
    return {
      handled: true,
      applied: true,
      decision,
      taskId,
      successorTaskId:
        acceptedReviewActionTaskId ??
        queuedWaitTaskId ??
        fixForwardTaskIds[0] ??
        undefined,
      message: acceptedSpecIds.length
        ? `Applied accept review for ${taskId}; recorded structured verifier result for ${acceptedSpecIds.join(", ")}${
            fixForwardTaskIds.length
              ? ` and created ${fixForwardTaskIds.length} fix-forward task(s): ${fixForwardTaskIds.join(", ")}`
              : ""
          }.`
        : queuedWaitTaskId
          ? `Applied accept review for ${taskId}; created pipeline wait ${queuedWaitTaskId}.`
          : acceptedReviewActionTaskId
            ? `Applied accept review for ${taskId}; created ${acceptedReviewActionTaskId}.`
          : `Applied accept review for ${taskId}.`,
    };
  }

  if (decision === "redo") {
    rejectTaskReview(config, {
      taskId,
      reason: firstText(feedback, findings, [summary]),
      freshSession: true,
    });
    return {
      handled: true,
      applied: true,
      decision,
      taskId,
      message: `Applied redo review for ${taskId}.`,
    };
  }

  const successorTaskId = createReviewedSuccessor({
    config,
    task,
    decision,
    attemptId,
    summary,
    findings,
    feedback,
    suggestedFollowups,
    reviewAction,
  });
  markTaskDone(config, {
    taskId,
    resolution: decision === "followup" ? "completed" : "replaced",
    summary: `Reviewer decision ${decision}; successor ${successorTaskId}: ${summary}`,
    reviewDecision: decision,
  });
  return {
    handled: true,
    applied: true,
    decision,
    taskId,
    successorTaskId,
    message: `Applied ${decision} review for ${taskId}; created ${successorTaskId}.`,
  };
}

function numericTriggerField(
  record: Record<string, unknown>,
  keys: string[],
): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function stringTriggerField(
  record: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function applyStallReviewedEvent(
  config: TaskTreeConfig,
  trigger: ReturnType<typeof parseTriggerEvent>,
): StallReviewedApplyResult {
  if (trigger?.type !== "project.stall.reviewed") {
    return {
      handled: false,
      applied: false,
      requeuedTaskIds: [],
      message: "Trigger is not project.stall.reviewed.",
    };
  }

  const judgment = stringValue(triggerValue(trigger, "judgment"));
  const loopSummaries = triggerValue(trigger, "loopSummaries");
  if (
    judgment !== "needs-work" &&
    judgment !== "repaired" &&
    judgment !== "inconclusive"
  ) {
    return {
      handled: true,
      applied: false,
      requeuedTaskIds: [],
      message: `Stall review judgment ${judgment || "unknown"} does not require deterministic loop requeue.`,
    };
  }
  if (!Array.isArray(loopSummaries)) {
    return {
      handled: true,
      applied: false,
      requeuedTaskIds: [],
      message: "Stall review did not include loopSummaries.",
    };
  }

  const taskIdsToRequeue = loopSummaries
    .filter((entry): entry is Record<string, unknown> => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return false;
      }
      const completionReady = entry.completion_ready ?? entry.completionReady;
      const unrepresented = numericTriggerField(entry, [
        "unrepresented_non_terminal_count",
        "unrepresentedNonTerminalCount",
      ]);
      const nonTerminal = numericTriggerField(entry, [
        "non_terminal_count",
        "nonTerminalCount",
      ]);
      return (
        completionReady === false && (unrepresented > 0 || nonTerminal > 0)
      );
    })
    .map((entry) => stringTriggerField(entry, ["task_id", "taskId"]))
    .filter((taskId) => loopControllerTaskIds.has(taskId));

  if (taskIdsToRequeue.length === 0) {
    return {
      handled: true,
      applied: false,
      requeuedTaskIds: [],
      message:
        "Stall review contained no durable loop roots with unrepresented non-terminal work.",
    };
  }

  const requeuedTaskIds: string[] = [];
  const now = new Date().toISOString();
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    for (const taskId of taskIdsToRequeue) {
      const task = tree.tasks[taskId];
      if (!task) continue;
      const state = String(task.status ?? task.state ?? "backlog");
      if (state === "active" || state === "backlog") continue;
      task.status = "backlog";
      task.state = "backlog";
      task.blocker = undefined;
      task.trace = {
        ...(task.trace ?? {}),
        reopened_at: now,
        reopened_by: "project-planner",
        reopen_reason:
          "project.stall.reviewed reported unrepresented non-terminal loop records",
        previous_nonterminal_status: state,
        current_attempt_id: undefined,
        worker_started_attempt_id: undefined,
      };
      requeuedTaskIds.push(taskId);
    }
    if (requeuedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
  });

  return {
    handled: true,
    applied: requeuedTaskIds.length > 0,
    requeuedTaskIds,
    message: requeuedTaskIds.length
      ? `Requeued stalled durable loop root(s): ${requeuedTaskIds.join(", ")}.`
      : "Stall review roots were already runnable or active.",
  };
}

function routineRefillReason(rawTask: string): string | null {
  const reason = triggerValue(parseTriggerEvent(rawTask), "reason");
  if (typeof reason !== "string") return null;
  return [
    "watchdog-runnable-backlog",
    // Compatibility for events emitted before the task-state cleanup.
    "watchdog-ready-work",
  ].includes(reason)
    ? reason
    : null;
}

function isBlockedFrontierReviewReason(reason: unknown): boolean {
  return [
    "scheduled-blocked-frontier-review",
    "blocked-frontier-review",
    "watchdog-blocked-frontier-review",
  ].includes(typeof reason === "string" ? reason : "");
}

function completedTaskIdFromTrigger(rawTask: string): string {
  const trigger = parseTriggerEvent(rawTask);
  const value =
    triggerValue(trigger, "completedTaskId") ??
    triggerValue(trigger, "completed_task_id");
  return typeof value === "string" ? value : "";
}

function taskCompletedWakeAlreadySettled(
  config: TaskTreeConfig,
  rawTask: string,
): boolean {
  const completedTaskId = completedTaskIdFromTrigger(rawTask);
  if (!completedTaskId) return false;
  return readTask(config, completedTaskId) === null;
}

function settledActiveNoopResult(input: {
  config: TaskTreeConfig;
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  quickAssignments: TaskAssignment[];
  quickControllerPulses: LoopControllerPulse[];
}): string | null {
  const trigger = parseTriggerEvent(input.rawTask);
  const reason = triggerValue(trigger, "reason");
  const metricId = triggerValue(trigger, "metricId");
  const noHumanSteering = input.humanSteering.length === 0;
  const noRunnableOrReviewFrontier =
    input.packet.frontier.runnable.length === 0 &&
    input.packet.frontier.review.length === 0 &&
    (input.packet.frontier.waiting ?? []).length === 0;
  const hasActiveOrBlockedFrontier =
    input.packet.active_task_ids.length > 0 ||
    input.packet.frontier.blocked.length > 0;
  const settledAfterCompletion =
    reason === "task-completed" &&
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0 &&
    noHumanSteering &&
    noRunnableOrReviewFrontier &&
    hasActiveOrBlockedFrontier &&
    taskCompletedWakeAlreadySettled(input.config, input.rawTask);
  const hasOnlyActiveFrontier =
    input.packet.active_task_ids.length > 0 && noRunnableOrReviewFrontier;
  const citedStaleActiveIds = staleActiveTaskIds(input.rawTask);
  const liveActiveIds = new Set([
    ...input.packet.active_task_ids,
    ...input.packet.frontier.active,
  ]);
  const citedStillActive = citedStaleActiveIds.filter((taskId) =>
    liveActiveIds.has(taskId),
  );
  const settledWithActiveWork =
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0 &&
    noHumanSteering &&
    hasOnlyActiveFrontier &&
    input.packet.frontier.blocked.length === 0;
  const routineLearningTickCoveredByActiveWork =
    reason === "regular-learning-tick" &&
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0 &&
    noHumanSteering &&
    hasOnlyActiveFrontier;
  const activeOpsTaskIds = [...liveActiveIds].filter(
    (taskId) => taskId === "ops" || taskId.startsWith("ops/"),
  );
  const blockedOverdueMetricCoveredByActiveOps =
    [
      "aks-rp-e2e.process.blocked.overdue-unworked-count",
      "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
    ].includes(typeof metricId === "string" ? metricId : "") &&
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0 &&
    noHumanSteering &&
    hasOnlyActiveFrontier &&
    activeOpsTaskIds.length === liveActiveIds.size &&
    activeOpsTaskIds.length > 0 &&
    activeOpsCoversBlockedOverdueOffenders({
      config: input.config,
      rawTask: input.rawTask,
      activeOpsTaskIds,
    });
  const blockedFrontierFutureWaitCoveredByActiveOps =
    isBlockedFrontierReviewReason(reason) &&
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0 &&
    noHumanSteering &&
    noRunnableOrReviewFrontier &&
    input.packet.frontier.blocked.length > 0 &&
    activeOpsTaskIds.length === liveActiveIds.size &&
    activeOpsTaskIds.length > 0 &&
    (triggerNumber(input.rawTask, "blockedOverdueCount") ?? 0) === 0 &&
    (triggerNumber(input.rawTask, "blockedMissingWatchCount") ?? 0) === 0 &&
    triggerOverdueOwnerActions(input.rawTask).length === 0 &&
    (() => {
      const blockedTasks = triggerBlockedTasks(input.rawTask);
      if (blockedTasks.length === 0) return false;
      return blockedTasks.every(
        (task) => futureBlockedWatchAt(task) !== null,
      );
    })();
  const noWorkMetricFalsePositiveCoveredByRunningActive =
    [
      "aks-rp-e2e.task.no-work-with-gaps",
      "aks-rp-e2e.task.ready-starvation-with-gaps",
    ].includes(typeof metricId === "string" ? metricId : "") &&
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0 &&
    noHumanSteering &&
    hasOnlyActiveFrontier &&
    [...liveActiveIds].length > 0 &&
    [...liveActiveIds].every((taskId) => {
      const task = readTask(input.config, taskId);
      const sessionId =
        typeof task?.session_id === "string" ? task.session_id : "";
      return (
        !!sessionId && runtimeSessionIsRunning(input.config.appDir, sessionId)
      );
    });
  if (
    reason === "watchdog-stale-active-review" &&
    citedStaleActiveIds.length > 0 &&
    citedStillActive.length === 0 &&
    noHumanSteering &&
    hasOnlyActiveFrontier
  ) {
    return "Watchdog stale-active review was a false positive: active work is still running, and every cited stale-active task is already settled/non-active after live-tree revalidation.";
  }
  if (
    reason === "watchdog-stale-active-review" &&
    citedStillActive.length > 0 &&
    citedStillActive.every((taskId) => {
      const task = readTask(input.config, taskId);
      const sessionId =
        typeof task?.session_id === "string" ? task.session_id : "";
      return (
        !!sessionId && runtimeSessionIsRunning(input.config.appDir, sessionId)
      );
    }) &&
    noHumanSteering &&
    hasOnlyActiveFrontier
  ) {
    return "Watchdog stale-active review was a false positive: every cited stale-active task still has a currently running runtime session after live-tree revalidation.";
  }
  if (settledAfterCompletion) {
    return "Task-completed wake is already settled in the task tree: the completed task no longer exists in the live tree, no review task remains, and no runnable frontier needs owner judgment.";
  }
  if (routineLearningTickCoveredByActiveWork) {
    return "Regular-learning tick is already covered by active work: no runnable/review frontier needs owner planning, and the current frontier is active-only plus any already-truthful blocked waits.";
  }
  if (blockedOverdueMetricCoveredByActiveOps) {
    return `Blocked-overdue metric wake is already under active app-ops repair: active frontier is ops-only (${activeOpsTaskIds.join(", ")}), no runnable/review frontier remains, and the planner should wait for the in-flight repair task rather than spend a full owner planning session re-triaging the same overdue-wait signal.`;
  }
  if (blockedFrontierFutureWaitCoveredByActiveOps) {
    return `Blocked-frontier future-wait review is already under active app-ops repair: active frontier is ops-only (${activeOpsTaskIds.join(", ")}), sampled blocked waits remain future-dated, and the planner should wait for the in-flight repair task rather than spend a full owner planning session re-reviewing the same all-blocked frontier.`;
  }
  if (noWorkMetricFalsePositiveCoveredByRunningActive) {
    return `No-work metric wake is already covered by currently running active work: active frontier remains ${[...liveActiveIds].join(", ")}, no runnable/review frontier exists, and the planner should wait for the in-flight assignment rather than invent duplicate refill from future-window waits.`;
  }
  if (!settledWithActiveWork) return null;
  if (reason === "task-completed") {
    return "Task-completed wake is already settled in the task tree: no review task remains, active work is still running, and no runnable/blocked frontier needs owner judgment.";
  }
  return null;
}

function staleActiveTaskIds(rawTask: string): string[] {
  const trigger = parseTriggerEvent(rawTask);
  const staleActiveTasks = triggerValue(trigger, "staleActiveTasks");
  if (!Array.isArray(staleActiveTasks)) return [];
  return staleActiveTasks
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const taskId =
          (entry as { taskId?: unknown; task_id?: unknown }).taskId ??
          (entry as { task_id?: unknown }).task_id;
        return typeof taskId === "string" ? taskId : "";
      }
      return "";
    })
    .filter(Boolean);
}

function triggerRunnableBacklogTaskIds(rawTask: string): string[] {
  const trigger = parseTriggerEvent(rawTask);
  const value = triggerValue(trigger, "runnableBacklogTaskIds");
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function triggerRunnableBacklogTreeUpdatedAt(rawTask: string): string {
  const trigger = parseTriggerEvent(rawTask);
  const value = triggerValue(trigger, "runnableBacklogTreeUpdatedAt");
  return typeof value === "string" ? value : "";
}

function triggerRunnableBacklogSnapshotAt(rawTask: string): string {
  const trigger = parseTriggerEvent(rawTask);
  const value = triggerValue(trigger, "runnableBacklogSnapshotAt");
  return typeof value === "string" ? value : "";
}

function triggerOffenderTaskIds(rawTask: string): string[] {
  const trigger = parseTriggerEvent(rawTask);
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      ids.add(value.trim());
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    const id = stringValue(record.taskId ?? record.task_id ?? record.id);
    if (id) ids.add(id);
  };
  const collectArray = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const entry of value) collect(entry);
  };

  collectArray(triggerValue(trigger, "offenderTaskIds"));
  collectArray(triggerValue(trigger, "offender_task_ids"));
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function activeOpsCoversBlockedOverdueOffenders(input: {
  config: TaskTreeConfig;
  rawTask: string;
  activeOpsTaskIds: string[];
}): boolean {
  const offenderTaskIds = triggerOffenderTaskIds(input.rawTask);
  if (offenderTaskIds.length === 0) return true;

  const activeOpsTasks = input.activeOpsTaskIds
    .map((taskId) => readTask(input.config, taskId))
    .filter((task): task is NonNullable<typeof task> => !!task);
  if (activeOpsTasks.length === 0) return false;

  return offenderTaskIds.every((taskId) => {
    const blockedTask = readTask(input.config, taskId);
    if (!blockedTask || taskState(blockedTask) !== "blocked") return true;
    return activeOpsTasks.some((candidate) =>
      taskCoversBlockedOverdueWait(candidate, blockedTask, ""),
    );
  });
}

function staleRunnableBacklogNoopResult(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  quickAssignments: TaskAssignment[];
  quickControllerPulses: LoopControllerPulse[];
}): string | null {
  if (routineRefillReason(input.rawTask) !== "watchdog-runnable-backlog")
    return null;
  if (input.humanSteering.length > 0) return null;
  if (input.quickAssignments.length > 0) return null;
  if (input.quickControllerPulses.length > 0) return null;

  const triggerIds = triggerRunnableBacklogTaskIds(input.rawTask);
  if (triggerIds.length === 0) return null;
  if (input.packet.frontier.runnable.length > 0) return null;
  if ((input.packet.frontier.waiting ?? []).length > 0) return null;

  const liveRunnable = new Set(input.packet.frontier.runnable);
  const liveReview = new Set(input.packet.frontier.review);
  const liveActiveOrReview = new Set([
    ...input.packet.active_task_ids,
    ...input.packet.frontier.review,
  ]);
  const nonRunnableIds = triggerIds.filter(
    (taskId) => !liveRunnable.has(taskId),
  );
  if (nonRunnableIds.length !== triggerIds.length) return null;

  const citedReviewIds = triggerIds.filter((taskId) => liveReview.has(taskId));
  if (citedReviewIds.length > 0) return null;

  const movedActiveOrReview = triggerIds.filter((taskId) =>
    liveActiveOrReview.has(taskId),
  );
  const settledOrMissing = triggerIds.filter(
    (taskId) => !liveActiveOrReview.has(taskId),
  );
  const treeUpdatedAt = triggerRunnableBacklogTreeUpdatedAt(input.rawTask);
  const snapshotAt = triggerRunnableBacklogSnapshotAt(input.rawTask);
  const freshnessParts = [
    treeUpdatedAt ? `trigger tree updated_at=${treeUpdatedAt}` : "",
    snapshotAt ? `snapshotAt=${snapshotAt}` : "",
    `live runnable frontier=${JSON.stringify(input.packet.frontier.runnable)}`,
    movedActiveOrReview.length
      ? `moved active/review=${JSON.stringify(movedActiveOrReview)}`
      : "",
    settledOrMissing.length
      ? `settled/missing=${JSON.stringify(settledOrMissing)}`
      : "",
  ].filter(Boolean);

  return `Watchdog runnable-backlog wake is stale: trigger IDs ${JSON.stringify(triggerIds)} are no longer confirm-runnable in the live frontier. ${freshnessParts.join("; ")}.`;
}

type TriggerReviewTask = {
  taskId: string;
  updatedAt?: string;
};

function triggerReviewTasks(rawTask: string): TriggerReviewTask[] {
  const trigger = parseTriggerEvent(rawTask);
  const value = triggerValue(trigger, "reviewTasks");
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): TriggerReviewTask | null => {
      if (!entry || typeof entry !== "object") return null;
      const taskId =
        (entry as { taskId?: unknown; task_id?: unknown }).taskId ??
        (entry as { task_id?: unknown }).task_id;
      if (typeof taskId !== "string" || !taskId.trim()) return null;
      const updatedAt =
        typeof (entry as { updatedAt?: unknown; updated_at?: unknown })
          .updatedAt === "string"
          ? ((entry as { updatedAt?: string }).updatedAt ?? undefined)
          : typeof (entry as { updated_at?: unknown }).updated_at === "string"
            ? ((entry as { updated_at?: string }).updated_at ?? undefined)
            : undefined;
      return { taskId, updatedAt };
    })
    .filter((entry): entry is TriggerReviewTask => Boolean(entry));
}

function staleReviewPendingNoopResult(input: {
  config: TaskTreeConfig;
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  quickAssignments: TaskAssignment[];
  quickControllerPulses: LoopControllerPulse[];
}): string | null {
  const reason = triggerValue(parseTriggerEvent(input.rawTask), "reason");
  if (reason !== "watchdog-review-pending") return null;
  if (input.humanSteering.length > 0) return null;
  if (input.quickAssignments.length > 0) return null;
  if (input.quickControllerPulses.length > 0) return null;

  const triggerTasks = triggerReviewTasks(input.rawTask);
  if (triggerTasks.length === 0) return null;

  const liveReview = new Set(input.packet.frontier.review);
  if (triggerTasks.some((task) => liveReview.has(task.taskId))) return null;
  if (input.packet.active_task_ids.length === 0) return null;

  const states = triggerTasks.map((task) => {
    const liveTask = readTask(input.config, task.taskId);
    return {
      taskId: task.taskId,
      state:
        liveTask == null
          ? "missing"
          : typeof liveTask.state === "string"
            ? liveTask.state
            : typeof liveTask.status === "string"
              ? liveTask.status
              : "present",
      updatedAt: task.updatedAt,
    };
  });
  if (states.some((task) => task.state === "review")) return null;

  const activeIds = input.packet.active_task_ids;
  const blockedIds = input.packet.frontier.blocked;
  const contextParts = [
    `trigger review IDs=${JSON.stringify(triggerTasks.map((task) => task.taskId))}`,
    `live review frontier=${JSON.stringify(input.packet.frontier.review)}`,
    `live states=${JSON.stringify(states)}`,
    activeIds.length ? `active=${JSON.stringify(activeIds)}` : "",
    blockedIds.length
      ? `blocked=${JSON.stringify(blockedIds.slice(0, 8))}`
      : "",
  ].filter(Boolean);

  return `Watchdog review-pending wake is stale: the cited review task(s) are no longer live review items. ${contextParts.join("; ")}.`;
}

type TriggerBlockedTask = {
  taskId: string;
  blocker: string;
  nextCheckAt?: string;
  resumeAt?: string;
  resumeCondition?: string;
  fallbackAt?: string;
  fallbackAction?: string;
};

type TriggerOverdueOwnerAction = {
  taskId: string;
  owner?: string;
  watchAt?: string;
  recoveryRequired?: string;
};

function triggerNumber(rawTask: string, key: string): number | null {
  const value = triggerValue(parseTriggerEvent(rawTask), key);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function triggerBlockedTasks(rawTask: string): TriggerBlockedTask[] {
  const trigger = parseTriggerEvent(rawTask);
  const value = triggerValue(trigger, "blockedTasks");
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const taskId =
        (entry as { taskId?: unknown; task_id?: unknown }).taskId ??
        (entry as { task_id?: unknown }).task_id;
      if (typeof taskId !== "string" || !taskId.trim()) return null;
      const blocker =
        typeof (entry as { blocker?: unknown }).blocker === "string"
          ? ((entry as { blocker?: string }).blocker ?? "")
          : "";
      const nextCheckAt =
        typeof (entry as { nextCheckAt?: unknown }).nextCheckAt === "string"
          ? ((entry as { nextCheckAt?: string }).nextCheckAt ?? "")
          : typeof (entry as { next_check_at?: unknown }).next_check_at ===
              "string"
            ? ((entry as { next_check_at?: string }).next_check_at ?? "")
            : "";
      const resumeAt =
        typeof (entry as { resumeAt?: unknown }).resumeAt === "string"
          ? ((entry as { resumeAt?: string }).resumeAt ?? "")
          : typeof (entry as { resume_at?: unknown }).resume_at === "string"
            ? ((entry as { resume_at?: string }).resume_at ?? "")
            : "";
      const resumeCondition =
        typeof (entry as { resumeCondition?: unknown }).resumeCondition ===
        "string"
          ? ((entry as { resumeCondition?: string }).resumeCondition ?? "")
          : typeof (entry as { resume_condition?: unknown })
                .resume_condition === "string"
            ? ((entry as { resume_condition?: string }).resume_condition ?? "")
            : "";
      const fallbackAt =
        typeof (entry as { fallbackAt?: unknown }).fallbackAt === "string"
          ? ((entry as { fallbackAt?: string }).fallbackAt ?? "")
          : typeof (entry as { fallback_at?: unknown }).fallback_at === "string"
            ? ((entry as { fallback_at?: string }).fallback_at ?? "")
            : "";
      const fallbackAction =
        typeof (entry as { fallbackAction?: unknown }).fallbackAction ===
        "string"
          ? ((entry as { fallbackAction?: string }).fallbackAction ?? "")
          : typeof (entry as { fallback_action?: unknown }).fallback_action ===
              "string"
            ? ((entry as { fallback_action?: string }).fallback_action ?? "")
            : "";
      return {
        taskId,
        blocker,
        ...(nextCheckAt.trim() ? { nextCheckAt: nextCheckAt.trim() } : {}),
        ...(resumeAt.trim() ? { resumeAt: resumeAt.trim() } : {}),
        ...(resumeCondition.trim()
          ? { resumeCondition: resumeCondition.trim() }
          : {}),
        ...(fallbackAt.trim() ? { fallbackAt: fallbackAt.trim() } : {}),
        ...(fallbackAction.trim()
          ? { fallbackAction: fallbackAction.trim() }
          : {}),
      };
    })
    .filter((entry): entry is TriggerBlockedTask => Boolean(entry));
}

function triggerOverdueOwnerActions(
  rawTask: string,
): TriggerOverdueOwnerAction[] {
  const trigger = parseTriggerEvent(rawTask);
  const value = triggerValue(trigger, "overdueOwnerActions");
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const taskId =
        (entry as { taskId?: unknown; task_id?: unknown }).taskId ??
        (entry as { task_id?: unknown }).task_id;
      if (typeof taskId !== "string" || !taskId.trim()) return null;
      const owner =
        typeof (entry as { owner?: unknown }).owner === "string"
          ? ((entry as { owner?: string }).owner ?? "").trim()
          : undefined;
      const watchAt =
        typeof (entry as { watchAt?: unknown }).watchAt === "string"
          ? ((entry as { watchAt?: string }).watchAt ?? "").trim()
          : typeof (entry as { watch_at?: unknown }).watch_at === "string"
            ? ((entry as { watch_at?: string }).watch_at ?? "").trim()
            : undefined;
      const recoveryRequired =
        typeof (entry as { recoveryRequired?: unknown }).recoveryRequired ===
        "string"
          ? (
              (entry as { recoveryRequired?: string }).recoveryRequired ?? ""
            ).trim()
          : typeof (entry as { recovery_required?: unknown })
                .recovery_required === "string"
            ? (
                (entry as { recovery_required?: string }).recovery_required ??
                ""
              ).trim()
            : undefined;
      return {
        taskId: taskId.trim(),
        ...(owner ? { owner } : {}),
        ...(watchAt ? { watchAt } : {}),
        ...(recoveryRequired ? { recoveryRequired } : {}),
      };
    })
    .filter((entry): entry is TriggerOverdueOwnerAction => Boolean(entry));
}

function futureTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) && ts > Date.now() ? ts : null;
}

function futureBlockedWatchAt(task: TriggerBlockedTask): number | null {
  const candidates = [
    futureTimestamp(task.nextCheckAt),
    futureTimestamp(task.resumeAt),
    futureTimestamp(task.fallbackAt),
  ].filter((ts): ts is number => typeof ts === "number");
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

function blockedFrontierFutureWaitNoopResult(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  quickAssignments: TaskAssignment[];
  quickControllerPulses: LoopControllerPulse[];
}): string | null {
  const reason = triggerValue(parseTriggerEvent(input.rawTask), "reason");
  if (!isBlockedFrontierReviewReason(reason)) return null;
  if (input.humanSteering.length > 0) return null;
  if (input.quickAssignments.length > 0) return null;
  if (input.quickControllerPulses.length > 0) return null;
  if (input.packet.active_task_ids.length > 0) return null;
  if (input.packet.frontier.runnable.length > 0) return null;
  if (input.packet.frontier.review.length > 0) return null;
  if ((input.packet.frontier.waiting ?? []).length > 0) return null;

  const blockedCount = triggerNumber(input.rawTask, "blockedCount");
  const blockedOverdueCount = triggerNumber(
    input.rawTask,
    "blockedOverdueCount",
  );
  const blockedMissingWatchCount = triggerNumber(
    input.rawTask,
    "blockedMissingWatchCount",
  );
  if (
    blockedCount !== null &&
    blockedCount !== input.packet.frontier.blocked.length
  ) {
    return null;
  }
  if (blockedOverdueCount !== null && blockedOverdueCount > 0) return null;
  if (blockedMissingWatchCount !== null && blockedMissingWatchCount > 0) {
    return null;
  }
  if (triggerOverdueOwnerActions(input.rawTask).length > 0) return null;

  const blockedTasks = triggerBlockedTasks(input.rawTask);
  if (blockedTasks.length === 0) return null;

  const liveBlocked = new Set(input.packet.frontier.blocked);
  const triggerIds = blockedTasks.map((task) => task.taskId);
  if (triggerIds.some((taskId) => !liveBlocked.has(taskId))) return null;

  const futureWatchDates = blockedTasks
    .map(futureBlockedWatchAt)
    .filter((ts): ts is number => typeof ts === "number");
  if (futureWatchDates.length !== blockedTasks.length) return null;

  const earliestWatchAt = new Date(Math.min(...futureWatchDates)).toISOString();
  return `Blocked-frontier wake is already represented by structured future-dated external waits (${triggerIds.join(", ")}). No local runnable/review work exists, and the earliest cited watch window is ${earliestWatchAt}. Skipping app-ops planning until returned proof arrives or that window opens.`;
}

function singleAssignmentShortCircuitResult(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  quickAssignments: TaskAssignment[];
  quickControllerPulses: LoopControllerPulse[];
  aggressivePush: boolean;
}): string | null {
  if (input.aggressivePush) return null;
  if (triggerOverdueOwnerActions(input.rawTask).length > 0) return null;
  const reason = triggerValue(parseTriggerEvent(input.rawTask), "reason");
  if (
    ![
      "task-completed",
      "watchdog-capacity-underfilled",
      "planner-timeout-underfilled-frontier",
    ].includes(typeof reason === "string" ? reason : "")
  ) {
    return null;
  }
  if (input.humanSteering.length > 0) return null;
  if (
    input.quickAssignments.length === 0 &&
    input.quickControllerPulses.length === 0
  )
    return null;
  if (input.packet.frontier.review.length > 0) return null;
  if ((input.packet.frontier.waiting ?? []).length > 0) return null;
  if (
    input.packet.active_task_ids.length === 0 &&
    input.quickControllerPulses.length === 0
  )
    return null;

  const assignedTaskIds = plannerProgressTaskIds({
    assignments: input.quickAssignments,
    controllerPulses: input.quickControllerPulses,
  });
  return `Bounded ${reason} wake already achieved a truthful refill/assignment (${assignedTaskIds.join(", ")}) with no remaining human-steering or review frontier. Short-circuiting after the first deterministic refill/bounded successor assignment.`;
}

function appendNoopPlannerRun(input: {
  appDir: string;
  result: string;
  steps: string[];
  packet: TaskPlanningPacket;
  initialRepair: ReturnType<typeof repairTaskTreeRollups>;
  assignedTaskIds?: string[];
  pulsedControllerTaskIds?: string[];
}): void {
  const assignedTaskIds = input.assignedTaskIds ?? [];
  const pulsedControllerTaskIds = input.pulsedControllerTaskIds ?? [];
  appendPlannerRun(input.appDir, {
    kind: "planner_wake",
    status:
      assignedTaskIds.length || pulsedControllerTaskIds.length
        ? "assigned"
        : "idle",
    ran_agent: false,
    steps: input.steps,
    assigned_task_ids: assignedTaskIds,
    pulsed_controller_task_ids: pulsedControllerTaskIds,
    repaired_rollups: input.initialRepair.repaired,
    active_task_ids: input.packet.active_task_ids,
    result: input.result,
  });
}

function syncPlannerProjectReadout(config: TaskTreeConfig): void {
  try {
    syncProjectReadout(config);
  } catch {
    // Keep planner progress authoritative in the task tree even when
    // project.json summary refresh fails; the next wake can retry.
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const sourceRoot = sourceDir(ctx.task);
  const configuredMaxConcurrent = maxConcurrent(ctx.task, null);
  const aggressivePush = projectPushMode(appDir) === "aggressive-push";
  const agent =
    field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent;
  const worker =
    field(ctx.task, "worker") ??
    field(ctx.task, "domainWorker") ??
    field(ctx.task, "domain_worker") ??
    "aks-explorer";
  const domainWorker =
    field(ctx.task, "domainWorker") ??
    field(ctx.task, "domain_worker") ??
    worker;
  const opsWorker =
    field(ctx.task, "opsWorker") ?? field(ctx.task, "ops_worker") ?? agent;
  const config = taskTreeConfig({
    appDir,
    projectDir,
    worker,
    maxConcurrent: configuredMaxConcurrent,
  });

  let humanSteering = recentHumanSteering(ctx);
  const initialRepair = repairTaskTreeRollups(config);
  compactDoneLeaves(config, {
    limit: 50,
    reason: "planner task-tree maintenance",
  });
  requeueReviewedBlockedProjectActions(config);
  syncPlannerProjectReadout(config);
  const trigger = parseTriggerEvent(ctx.task);
  const overdueOwnerActionCount = triggerOverdueOwnerActions(ctx.task).length;
  const reviewedApply = applyReviewedTaskEvent(config, trigger);
  if (reviewedApply.handled) {
    const controllerPulses = assignPlannerRunnableBacklogTasks(config, {
      worker,
      domainWorker,
      opsWorker,
    });
    const drainedAssignments = drainTaskAssignments(config);
    const bridgedAssignments = splitLoopControllerAssignments(
      config,
      drainedAssignments,
    );
    const assignments = bridgedAssignments.workerAssignments;
    controllerPulses.push(...bridgedAssignments.controllerPulses);
    dispatchAssignedTasks(ctx, assignments);
    dispatchLoopControllerPulses(ctx, controllerPulses);
    const finalRepair = repairTaskTreeRollups(config);
    syncPlannerProjectReadout(config);
    const packet = planningPacket(config);
    const progressTaskIds = plannerProgressTaskIds({
      assignments,
      controllerPulses,
    });
    appendPlannerRun(appDir, {
      kind: "planner_wake",
      status: progressTaskIds.length
        ? "assigned"
        : reviewedApply.applied
          ? "settled"
          : "idle",
      ran_agent: false,
      steps: reviewedApply.applied
        ? ["task-reviewed-apply", "quick-refill"]
        : ["task-reviewed-stale-noop"],
      assigned_task_ids: assignments.map((assignment) => assignment.taskId),
      pulsed_controller_task_ids: controllerPulses.map((pulse) => pulse.taskId),
      repaired_rollups: [...initialRepair.repaired, ...finalRepair.repaired],
      active_task_ids: packet.active_task_ids,
      result: reviewedApply.message,
    });
    return ctx.done(
      progressTaskIds.length
        ? `${reviewedApply.message} ${plannerProgressMessage({
            prefix: "Planner",
            assignments,
            controllerPulses,
          })}`
        : reviewedApply.message,
    );
  }
  const stallReviewedApply = applyStallReviewedEvent(config, trigger);
  if (stallReviewedApply.handled && stallReviewedApply.applied) {
    const controllerPulses = assignPlannerRunnableBacklogTasks(config, {
      worker,
      domainWorker,
      opsWorker,
    });
    const drainedAssignments = drainTaskAssignments(config);
    const bridgedAssignments = splitLoopControllerAssignments(
      config,
      drainedAssignments,
    );
    const assignments = bridgedAssignments.workerAssignments;
    controllerPulses.push(...bridgedAssignments.controllerPulses);
    dispatchAssignedTasks(ctx, assignments);
    dispatchLoopControllerPulses(ctx, controllerPulses);
    const finalRepair = repairTaskTreeRollups(config);
    syncPlannerProjectReadout(config);
    const packet = planningPacket(config);
    const progressTaskIds = plannerProgressTaskIds({
      assignments,
      controllerPulses,
    });
    appendPlannerRun(appDir, {
      kind: "planner_wake",
      status: progressTaskIds.length ? "assigned" : "settled",
      ran_agent: false,
      steps: ["stall-reviewed-apply", "quick-refill"],
      assigned_task_ids: assignments.map((assignment) => assignment.taskId),
      pulsed_controller_task_ids: controllerPulses.map((pulse) => pulse.taskId),
      repaired_rollups: [...initialRepair.repaired, ...finalRepair.repaired],
      active_task_ids: packet.active_task_ids,
      result: stallReviewedApply.message,
    });
    return ctx.done(
      progressTaskIds.length
        ? `${stallReviewedApply.message} ${plannerProgressMessage({
            prefix: "Planner",
            assignments,
            controllerPulses,
          })}`
        : stallReviewedApply.message,
    );
  }
  const quickControllerPulses = assignPlannerRunnableBacklogTasks(config, {
    worker,
    domainWorker,
    opsWorker,
  });
  const quickDrainedAssignments = drainTaskAssignments(config);
  const quickBridgedAssignments = splitLoopControllerAssignments(
    config,
    quickDrainedAssignments,
  );
  const quickAssignments = quickBridgedAssignments.workerAssignments;
  quickControllerPulses.push(...quickBridgedAssignments.controllerPulses);
  dispatchAssignedTasks(ctx, quickAssignments);
  dispatchLoopControllerPulses(ctx, quickControllerPulses);
  syncPlannerProjectReadout(config);
  let packet = planningPacket(config);

  const noopResult = settledActiveNoopResult({
    config,
    rawTask: ctx.task,
    packet,
    humanSteering,
    quickAssignments,
    quickControllerPulses,
  });
  if (noopResult) {
    appendNoopPlannerRun({
      appDir,
      result: noopResult,
      steps: ["settled-active-noop"],
      packet,
      initialRepair,
    });
    return ctx.done(noopResult);
  }

  const staleRunnableNoop = staleRunnableBacklogNoopResult({
    rawTask: ctx.task,
    packet,
    humanSteering,
    quickAssignments,
    quickControllerPulses,
  });
  if (staleRunnableNoop) {
    appendNoopPlannerRun({
      appDir,
      result: staleRunnableNoop,
      steps: ["stale-runnable-backlog-noop"],
      packet,
      initialRepair,
    });
    return ctx.done(staleRunnableNoop);
  }

  const staleReviewNoop = staleReviewPendingNoopResult({
    config,
    rawTask: ctx.task,
    packet,
    humanSteering,
    quickAssignments,
    quickControllerPulses,
  });
  if (staleReviewNoop) {
    appendNoopPlannerRun({
      appDir,
      result: staleReviewNoop,
      steps: ["stale-review-pending-noop"],
      packet,
      initialRepair,
    });
    return ctx.done(staleReviewNoop);
  }

  const singleAssignmentNoop = singleAssignmentShortCircuitResult({
    rawTask: ctx.task,
    packet,
    humanSteering,
    quickAssignments,
    quickControllerPulses,
    aggressivePush,
  });
  if (singleAssignmentNoop) {
    appendNoopPlannerRun({
      appDir,
      result: singleAssignmentNoop,
      steps: ["assigned-refill-short-circuit"],
      packet,
      initialRepair,
      assignedTaskIds: quickAssignments.map((assignment) => assignment.taskId),
      pulsedControllerTaskIds: quickControllerPulses.map(
        (pulse) => pulse.taskId,
      ),
    });
    return ctx.done(singleAssignmentNoop);
  }

  const blockedFrontierFutureWaitNoop = blockedFrontierFutureWaitNoopResult({
    rawTask: ctx.task,
    packet,
    humanSteering,
    quickAssignments,
    quickControllerPulses,
  });
  if (blockedFrontierFutureWaitNoop) {
    appendNoopPlannerRun({
      appDir,
      result: blockedFrontierFutureWaitNoop,
      steps: ["blocked-frontier-future-wait-noop"],
      packet,
      initialRepair,
    });
    return ctx.done(blockedFrontierFutureWaitNoop);
  }

  if (
    (quickAssignments.length > 0 || quickControllerPulses.length > 0) &&
    overdueOwnerActionCount === 0 &&
    humanSteering.length === 0 &&
    packet.frontier.review.length === 0 &&
    (packet.active_task_ids.length >= config.maxConcurrent ||
      quickControllerPulses.length > 0)
  ) {
    appendPlannerRun(appDir, {
      kind: "planner_wake",
      status: "assigned",
      ran_agent: false,
      steps: ["quick-refill"],
      assigned_task_ids: quickAssignments.map(
        (assignment) => assignment.taskId,
      ),
      pulsed_controller_task_ids: quickControllerPulses.map(
        (pulse) => pulse.taskId,
      ),
      repaired_rollups: initialRepair.repaired,
      active_task_ids: packet.active_task_ids,
      result:
        "Quick refill dispatched runnable backlog tasks or pulsed durable loop controllers; skipped app-ops planning for this routine wake.",
    });
    return ctx.done(
      plannerProgressMessage({
        prefix: "Planner quick-refill",
        assignments: quickAssignments,
        controllerPulses: quickControllerPulses,
      }),
    );
  }

  if (hasRunningPlannerSession(appDir, agent, "")) {
    appendPlannerRun(appDir, {
      kind: "planner_wake",
      status:
        quickAssignments.length || quickControllerPulses.length
          ? "assigned"
          : "idle",
      ran_agent: false,
      steps: ["planner-session-dedupe-noop"],
      assigned_task_ids: quickAssignments.map(
        (assignment) => assignment.taskId,
      ),
      pulsed_controller_task_ids: quickControllerPulses.map(
        (pulse) => pulse.taskId,
      ),
      repaired_rollups: initialRepair.repaired,
      active_task_ids: packet.active_task_ids,
      result:
        "Skipped app-ops planning because another workflow:project-planner session is already running for app-ops; rely on the in-flight planner wake instead of starting an overlapping app-ops session.",
    });
    return ctx.done(
      quickAssignments.length || quickControllerPulses.length
        ? plannerProgressMessage({
            prefix:
              "Planner dedupe made refill progress while another app-ops planner session is already running:",
            assignments: quickAssignments,
            controllerPulses: quickControllerPulses,
          })
        : "Planner dedupe skipped app-ops planning because another workflow:project-planner session is already running for app-ops.",
    );
  }

  let eventReviewResult: unknown;
  let plannerResult: unknown;
  const eventReviewSessionId = plannerSessionId("event_review");
  const planningUpdateSessionId = plannerSessionId("planning_update");
  try {
    eventReviewResult = await runOwnerStep({
      ctx,
      agent,
      sessionId: eventReviewSessionId,
      timeoutMs: timeoutFromEnv(
        "AKS_RP_E2E_PLANNER_EVENT_REVIEW_TIMEOUT_MS",
        180_000,
      ),
      prompt: buildEventReviewPrompt({
        appDir,
        projectDir,
        sourceDir: sourceRoot,
        agent,
        trigger: triggerBlock(ctx.task),
        packet,
        humanSteering,
      }),
    });
    packet = planningPacket(config);
    humanSteering = recentHumanSteering(ctx);
    plannerResult = await runOwnerStep({
      ctx,
      agent,
      sessionId: planningUpdateSessionId,
      timeoutMs: timeoutFromEnv(
        "AKS_RP_E2E_PLANNER_UPDATE_TIMEOUT_MS",
        360_000,
      ),
      prompt: buildPlannerPrompt({
        appDir,
        projectDir,
        sourceDir: sourceRoot,
        agent,
        domainWorker,
        opsWorker,
        eventReview: resultText(eventReviewResult).slice(0, 5000),
        trigger: triggerBlock(ctx.task),
        packet,
        humanSteering,
        wakeReason: triggerValue(parseTriggerEvent(ctx.task), "reason") as
          string | null,
        aggressivePush,
      }),
    });
  } catch (err) {
    plannerResult = {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  const finalRepair = repairTaskTreeRollups(config);
  syncPlannerProjectReadout(config);
  packet = planningPacket(config);

  const ownerDrainedAssignments = drainTaskAssignments(config);
  const ownerBridgedAssignments = splitLoopControllerAssignments(
    config,
    ownerDrainedAssignments,
  );
  let ownerAssignments = ownerBridgedAssignments.workerAssignments;
  const ownerControllerPulses = ownerBridgedAssignments.controllerPulses;
  dispatchAssignedTasks(ctx, ownerAssignments);
  dispatchLoopControllerPulses(ctx, ownerControllerPulses);
  const controllerPulses = [...quickControllerPulses, ...ownerControllerPulses];
  const assignments = [...quickAssignments, ...ownerAssignments];
  const progressTaskIds = plannerProgressTaskIds({
    assignments,
    controllerPulses,
  });
  const runStatus = progressTaskIds.length ? "assigned" : "settled";
  appendPlannerRun(appDir, {
    kind: "planner_wake",
    status: runStatus,
    ran_agent: true,
    steps: ["event-review", "planning-update"],
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    pulsed_controller_task_ids: controllerPulses.map((pulse) => pulse.taskId),
    repaired_rollups: [...initialRepair.repaired, ...finalRepair.repaired],
    active_task_ids: packet.active_task_ids,
    event_review: resultText(eventReviewResult).slice(0, 2000),
    result: resultText(plannerResult).slice(0, 4000),
  });

  const plannerMessage = progressTaskIds.length
    ? `${plannerProgressMessage({
        prefix: "Planner",
        assignments,
        controllerPulses,
      })} Agent result: ${resultText(plannerResult)}`
    : `Planner assigned no tasks. Agent ran event-review and planning-update. Result: ${resultText(plannerResult)}`;
  if ((plannerResult as { status?: string }).status === "escalated")
    return ctx.escalate(plannerMessage);
  return ctx.done(plannerMessage);
}

if (import.meta.main) {
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer",
    agent: "aks-explorer",
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}
