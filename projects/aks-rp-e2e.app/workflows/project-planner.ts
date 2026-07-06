/**
 * project-planner — refill/review loop for aks-rp-e2e.
 *
 * The planner workflow is not the project brain. It wakes the project owner
 * agent with task-tree tools, then emits task assignment events from owner
 * assignments or already-clear backlog dispatch.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  appendPlannerRun,
  appendToolJournal,
  assignTask,
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
  type SpecLoopState,
  type SpecLoopSpecState,
} from "./lib/spec-loop-store.ts";

export const name = "project-planner";
export const description =
  "Wake the project owner to plan in the task tree, then emit explicit worker assignments or durable loop controller ticks.";

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
  input: { worker?: string } = {},
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
      assignTask(config, { taskId, worker: input.worker });
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

function runtimeSessionIsTerminal(appDir: string, sessionId: string): boolean {
  if (!sessionId) return false;
  const dbPath = runtimeSessionDbPath(appDir);
  if (!existsSync(dbPath)) return false;
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
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
    if (!row) return false;
    const status = typeof row.status === "string" ? row.status : "";
    const outcome = typeof row.outcome === "string" ? row.outcome : "";
    if (typeof row.endedAt === "number" && Number.isFinite(row.endedAt)) {
      return true;
    }
    return ["done", "error", "failed", "cancelled", "canceled"].includes(
      status || outcome,
    );
  } catch {
    return false;
  } finally {
    db.close();
  }
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
- This wake is in the bounded single-assignment short-circuit family (${input.wakeReason}). If you create or assign one truthful deterministic refill or bounded successor and no human-steering or review frontier remains, stop immediately. Do not keep scanning unrelated blocked families or try to saturate all remaining capacity in this same wake.`
    : "";
  return `Planning Update Step

This is step 2 of 2 for the same planner wake. Use the event review from step
1 and the latest compact task-tree packet below. Now update the task tree,
repair bad decomposition, roll up completed work, create concrete next leaves,
and assign runnable backlog work when useful.

You are the project owner agent for aks-rp-e2e. The workflow is only a wakeup
adapter. You are the brain.

Core operating model:
- The task tree is your workspace and memory aid. It serves your planning; it
  is not the controller and it does not decide what happens by itself.
- Task-tree commands are your tools, not the workflow brain.
- Do not create planning/control task nodes.
- Do not run worker task bodies from the planner session.
- Keep work under durable project lanes: feature knowledge/specs, runner/replays,
  evidence feedback/model update, and user review workspace.
- If a task is too large or unclear, rewrite/split that branch once toward
  executable leaves. Do not cycle through rework tasks.
- Worker output is progress, not a final project decision. First review every
  review leaf according to the latest task state and trace.last_worker_result
  (or legacy trace.last_worker_claim).
  Accept only when evidence satisfies acceptance. If the result is weak,
  unsupported, non-terminal, or contradictory, repair/replace/retry through a
  concrete task. Mark blocked only after you have exact external evidence and a
  concrete resume condition.
- Do not mark an active assigned task done/replaced/cancelled while its current
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
  have assigned enough runnable work for this wake.
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
- bun run task-tree add <task-id> --parent <lane-id> --goal "..." --output <path> --acceptance "..." --conflict-scope <scope> [--state backlog|blocked] [--blocker "..."] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO]
- bun run task-tree mark-done <task-id> --summary "why the review is accepted"
- bun run task-tree mark-done <task-id> --resolution replaced --summary "why this blocked leaf is replaced by the family-level wait"
- bun run task-tree requeue-active <task-id> --reason "why the active attempt is stale or not running" [--fresh-session]
- bun run task-tree rollup-parent <parent-id> --summary "what this branch now knows and what remains" [--archive-done <child-id> ...] [--limit 50]
- bun run task-tree compact-done --limit 50  # recovery only; prefer rollup-parent after owner summary
- bun run task-tree assign <task-id> [--worker ${input.agent}]
- bun run task-tree update-text <task-id> [--goal "..."] [--acceptance "..."] [--acceptance "..."] [--blocker "..."] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO] [--clear-blocker]
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
  group from blocked_frontier_summary should the owner burn down first?
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

function createReviewedSuccessor(input: {
  config: TaskTreeConfig;
  task: NonNullable<ReturnType<typeof readTask>>;
  decision: ReviewDecision;
  attemptId: string;
  summary: string;
  findings: string[];
  feedback: string[];
  suggestedFollowups: string[];
}): string {
  if (!input.task.parent_id) {
    throw new Error(
      `Reviewed task ${input.task.id} has no parent for successor`,
    );
  }
  const followupText =
    firstText(input.suggestedFollowups, input.feedback, input.findings) ||
    `Resolve reviewed ${input.decision} result for ${input.task.id}.`;
  const id = uniqueTaskId(
    input.config,
    `${input.task.id}-${input.decision === "followup" ? "followup" : input.decision}`,
  );
  const isBlocked =
    input.decision === "blocked" || input.decision === "escalate";
  const blocker =
    firstText(input.feedback, input.findings, [input.summary]) ||
    `Reviewed task ${input.task.id} needs ${input.decision} handling.`;
  createTask(input.config, {
    id,
    parentId: input.task.parent_id,
    state: isBlocked ? "blocked" : "backlog",
    kind: input.task.kind ?? "domain_leaf",
    priority: taskPriority(input.task),
    owner: input.task.owner,
    workflow: input.task.workflow,
    goal: isBlocked
      ? `Resolve ${input.decision} review for ${input.task.id}: ${blocker}`
      : followupText,
    inputs: [`Reviewed task: ${input.task.id}`, `Attempt: ${input.attemptId}`],
    outputs: taskStringList(input.task, "outputs").length
      ? taskStringList(input.task, "outputs")
      : ["task tree"],
    acceptance: isBlocked
      ? [
          "The external wait or escalation has a concrete result, or a replacement runnable task is created.",
          "The affected task branch records the result and next verification step.",
        ]
      : [
          "The review follow-up is resolved with concrete evidence.",
          "The affected task branch records the result and next verification step.",
        ],
    conflict_scope: taskStringList(input.task, "conflict_scope"),
    context: {
      ...taskContext(input.task),
      reviewedTask: {
        taskId: input.task.id,
        attemptId: input.attemptId,
        decision: input.decision,
        summary: input.summary,
        findings: input.findings,
        feedback: input.feedback,
        suggestedFollowups: input.suggestedFollowups,
      },
    },
    ...(isBlocked
      ? {
          blocker,
          blockerCategory: "external-wait",
          blockerOwner: input.decision === "escalate" ? "human" : "external",
          resumeCondition:
            firstText(input.suggestedFollowups) ||
            `Resume when ${input.decision} condition for ${input.task.id} is resolved.`,
        }
      : {}),
  });
  return id;
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

  if (decision === "accept") {
    const unownedSpecIds = specLoopAcceptStructuralGaps({ config, task });
    if (unownedSpecIds.length > 0) {
      const followupSummary = `Spec-loop accept cannot close ${taskId}: ${unownedSpecIds.length} represented retry-drained spec(s) still lack an open structural owner: ${unownedSpecIds
        .slice(0, 8)
        .join(", ")}.`;
      const successorTaskId = createReviewedSuccessor({
        config,
        task,
        decision: "followup",
        attemptId,
        summary: followupSummary,
        findings: [
          ...findings,
          `Unowned represented specs: ${unownedSpecIds.join(", ")}`,
        ],
        feedback: [
          ...feedback,
          "Create or link an exact open holder task for every represented retry-drained spec before accepting this follow-up.",
        ],
        suggestedFollowups: [followupSummary, ...suggestedFollowups],
      });
      markTaskDone(config, {
        taskId,
        resolution: "completed",
        summary: `Reviewer decision accept converted to followup; successor ${successorTaskId}: ${followupSummary}`,
      });
      return {
        handled: true,
        applied: true,
        decision: "followup",
        taskId,
        successorTaskId,
        message: `Applied review for ${taskId}; converted accept to followup ${successorTaskId}.`,
      };
    }
    markTaskDone(config, { taskId, summary });
    return {
      handled: true,
      applied: true,
      decision,
      taskId,
      message: `Applied accept review for ${taskId}.`,
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
  });
  markTaskDone(config, {
    taskId,
    resolution: decision === "followup" ? "completed" : "replaced",
    summary: `Reviewer decision ${decision}; successor ${successorTaskId}: ${summary}`,
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
  const reason = triggerValue(parseTriggerEvent(input.rawTask), "reason");
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
  if (
    reason === "watchdog-stale-active-review" &&
    citedStaleActiveIds.length > 0 &&
    citedStillActive.length === 0 &&
    noHumanSteering &&
    hasOnlyActiveFrontier
  ) {
    return "Watchdog stale-active review was a false positive: active work is still running, and every cited stale-active task is already settled/non-active after live-tree revalidation.";
  }
  if (settledAfterCompletion) {
    return "Task-completed wake is already settled in the task tree: the completed task no longer exists in the live tree, no review task remains, and no runnable frontier needs owner judgment.";
  }
  if (routineLearningTickCoveredByActiveWork) {
    return "Regular-learning tick is already covered by active work: no runnable/review frontier needs owner planning, and the current frontier is active-only plus any already-truthful blocked waits.";
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
  resumeAt?: string;
  resumeCondition?: string;
  fallbackAt?: string;
  fallbackAction?: string;
};

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

function futureTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) && ts > Date.now() ? ts : null;
}

function futureBlockedWatchAt(task: TriggerBlockedTask): number | null {
  const candidates = [
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
  if (reason !== "watchdog-blocked-frontier-review") return null;
  if (input.humanSteering.length > 0) return null;
  if (input.quickAssignments.length > 0) return null;
  if (input.quickControllerPulses.length > 0) return null;
  if (input.packet.active_task_ids.length > 0) return null;
  if (input.packet.frontier.runnable.length > 0) return null;
  if (input.packet.frontier.review.length > 0) return null;
  if ((input.packet.frontier.waiting ?? []).length > 0) return null;

  const blockedTasks = triggerBlockedTasks(input.rawTask);
  if (blockedTasks.length === 0) return null;

  const liveBlocked = new Set(input.packet.frontier.blocked);
  const triggerIds = blockedTasks.map((task) => task.taskId);
  if (triggerIds.length !== input.packet.frontier.blocked.length) return null;
  if (triggerIds.some((taskId) => !liveBlocked.has(taskId))) return null;

  const futureWatchDates = blockedTasks
    .map(futureBlockedWatchAt)
    .filter((ts): ts is number => typeof ts === "number");
  if (futureWatchDates.length !== blockedTasks.length) return null;

  const earliestWatchAt = new Date(Math.min(...futureWatchDates)).toISOString();
  return `Blocked-frontier wake is already represented by structured future-dated external waits (${triggerIds.join(", ")}). No local runnable/review work exists, and the earliest cited watch window is ${earliestWatchAt}. Skipping owner-agent planning until returned proof arrives or that window opens.`;
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
    field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent;
  const config = taskTreeConfig({
    appDir,
    projectDir,
    worker,
    maxConcurrent: configuredMaxConcurrent,
  });

  let humanSteering = recentHumanSteering(ctx);
  const initialRepair = repairTaskTreeRollups(config);
  syncPlannerProjectReadout(config);
  const trigger = parseTriggerEvent(ctx.task);
  const reviewedApply = applyReviewedTaskEvent(config, trigger);
  if (reviewedApply.handled) {
    const controllerPulses = assignPlannerRunnableBacklogTasks(config, {
      worker,
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
        "Quick refill assigned runnable backlog tasks or pulsed durable loop controllers; skipped owner-agent planning for this routine wake.",
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
        "Skipped owner-agent planning because another workflow:project-planner session is already running for this owner; rely on the in-flight planner wake instead of starting an overlapping owner session.",
    });
    return ctx.done(
      quickAssignments.length || quickControllerPulses.length
        ? plannerProgressMessage({
            prefix:
              "Planner dedupe made refill progress while another owner-planner session is already running:",
            assignments: quickAssignments,
            controllerPulses: quickControllerPulses,
          })
        : "Planner dedupe skipped owner-agent planning because another workflow:project-planner session is already running for this owner.",
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
