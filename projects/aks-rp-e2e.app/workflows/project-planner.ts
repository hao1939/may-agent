/**
 * project-planner — refill/review loop for aks-rp-e2e.
 *
 * The planner workflow is not the project brain. It wakes the project owner
 * agent with task-tree tools, then emits task assignment events explicitly
 * requested by that planner session.
 */

import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  appendPlannerRun,
  assignRunnableBacklogTasks,
  drainTaskAssignments,
  planningPacket,
  repairTaskTreeRollups,
  requeueStaleActiveTasks,
  seedModelGapBacklog,
  taskTreeConfig,
  type TaskAssignment,
  type TaskPlanningPacket,
} from "./lib/task-tree-tools.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  triggerBlock,
  triggerValue,
} from "./lib/workflow-input.ts";

export const name = "project-planner";
export const description =
  "Wake the project owner to plan in tasks/tree.json, then emit explicit project.task.assigned events.";

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

function timeoutFromEnv(name: string, fallbackMs: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallbackMs;
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
    const rows = ["project.owner.requested", "project.planning.requested"]
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
  return `\n\n## Pending Human Steering Overrides\n\nThese high-priority human steering events are durable planner input. Review them before routine watchdog/refill work. If a steering event asks for a concrete tree correction, either make that correction in tasks/tree.json or record an explicit refusal/blocker in the tree.\n\n\`\`\`json\n${JSON.stringify(events, null, 2)}\n\`\`\``;
}

function buildPlannerPrompt(input: {
  appDir: string;
  projectDir: string;
  agent: string;
  eventReview: string;
  trigger: string;
  packet: unknown;
  humanSteering: Record<string, unknown>[];
}): string {
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
- Failure/blocking is first-class project work. When a review task exposes a
  blocker or failure, classify the problem, create or link one visible
  problem-solving task in the tree, and let the problem-solver event loop work
  it. Prefer one shared problem task for a shared root cause such as staging ARM
  auth, not one duplicate blocker task per affected replay. Use the stable
  problemKey from project.problem.* events when present.
- When project.problem.resolved, project.problem.escalated, or
  project.problem.unknown wakes you, reconcile the solver result into the
  affected task branch: retry or supersede affected tasks when resolved; mark
  precise external blockers or human escalation state when escalated; triage or
  request follow-up investigation when the solver could not classify the result.
  The solver reports facts; you own tree decisions.
- Treat the task tree as the project-specific source of truth. Read root and
  lane context before deciding that the project is complete or blocked.
- Project-specific progress signals, completion criteria, gap reconciliation,
  execution intent, and user steering belong in tasks/tree.json as task context
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
  Do not stop merely because one rollup or one new leaf was created.
- If the frontier is empty, do not stop at analysis. Add concrete work under one
  of the durable value-loop lanes according to the task-tree context, unless
  that context and current evidence show an exact external blocker.
- High-priority human steering is planner input, not discussion noise. Process
  it before routine watchdog/refill work. If the user points out a missing root
  task/lane, either create the missing task under the requested parent or record
  a concrete refusal/blocker in the tree.
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
- bun run task-tree add <task-id> --parent <lane-id> --goal "..." --output <path> --acceptance "..." --conflict-scope <scope> [--state backlog|blocked]
- bun run task-tree mark-done <task-id> --summary "why the review is accepted"
- bun run task-tree assign <task-id> [--worker ${input.agent}]
- bun run task-tree update-text <task-id> [--goal "..."] [--acceptance "..."] [--acceptance "..."] [--blocker "..."] [--clear-blocker]
- bun run task-tree show <task-id>
- bun run domain:checkpoint
- bun run domain:checkpoint -- --json

Useful domain workspace commands:
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && bun run status -- --json
- cd ${input.projectDir} && bun run check
- cd ${input.projectDir} && git status --short
- cd ${input.projectDir} && git diff --stat

Do not edit ${input.appDir}/tasks/tree.json directly. Use the task-tree commands
so updates take the tree lock, repair rollups, keep kanban in sync, and avoid
overwriting newer planner/watchdog changes. If the current primitive is not
enough, create a focused app-tooling task under the relevant lane instead of
hand-writing the tree.
Do not rewrite ${input.appDir}/project.json or convert it to markdown. It is an
app manifest, not the planning workspace. Put project thinking, focus state,
review findings, and follow-up work in tasks/tree.json through task-tree tools.

Current app: ${input.appDir}
Domain workspace: ${input.projectDir}
Agent: ${input.agent}

Event review from step 1:
${input.eventReview}

Current compact task-tree packet:
\`\`\`json
${JSON.stringify(input.packet, null, 2)}
\`\`\`
${humanSteeringBlock(input.humanSteering)}

${input.trigger}`.trim();
}

function buildEventReviewPrompt(input: {
  appDir: string;
  projectDir: string;
  agent: string;
  trigger: string;
  packet: unknown;
  humanSteering: Record<string, unknown>[];
}): string {
  return `Planner Event Review Step

This is step 1 of 2 for a planner wake. React to the event and compact packet,
inspect related context only when needed, and produce a concise event review for
the next planning step. Do not edit tasks/tree.json and do not assign tasks in
this step.

Keep this review bounded. Prefer the packet over rediscovery. Use at most three
read-only commands unless the trigger is a task completion, human steering, or a
metric/stale-active event that clearly needs deeper evidence.

Focus:
- What woke the planner?
- Which runnable backlog, active, review, or blocked tasks are relevant?
- Did a worker claim need validation? If yes, what evidence should planning
  trust or distrust?
- Is this a problem event? If yes, which blocked/failed/review tasks share the
  problemKey, and should planning create/link a visible problem-solving task,
  retry affected work, or mark an escalation?
- Is there stale active work, misleading completion, real blocker, human
  steering, metric breach, or normal refill?
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

Current app: ${input.appDir}
Domain workspace: ${input.projectDir}
Agent: ${input.agent}

Compact task-tree packet:
\`\`\`json
${JSON.stringify(input.packet, null, 2)}
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
        project: "aks-rp-e2e",
        ...assignment,
        requested_by: "project-planner",
      });
    } catch {
      // Local tests may not provide a dispatcher.
    }
  }
}

function frontierUnderfilled(
  packet: TaskPlanningPacket,
  maxConcurrentTasks: number,
): boolean {
  return (
    packet.frontier.runnable.length === 0 &&
    packet.active_task_ids.length < maxConcurrentTasks
  );
}

function frontierNeedsBacklogDepth(packet: TaskPlanningPacket): boolean {
  return packet.frontier.runnable.length === 0;
}

function routineRefillReason(rawTask: string): string | null {
  const reason = triggerValue(parseTriggerEvent(rawTask), "reason");
  if (typeof reason !== "string") return null;
  return [
    "watchdog-open-work-reconcile",
    "watchdog-capacity-underfilled",
    "watchdog-runnable-backlog",
    // Compatibility for events emitted before the task-state cleanup.
    "watchdog-ready-work",
    "watchdog-settled-active-project-refill",
  ].includes(reason)
    ? reason
    : null;
}

function cheapDeterministicWakeReason(rawTask: string): string | null {
  const routineReason = routineRefillReason(rawTask);
  if (routineReason) return routineReason;
  const reason = triggerValue(parseTriggerEvent(rawTask), "reason");
  return reason === "regular-learning-tick" ? reason : null;
}

function canUseDeterministicRefill(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  maxConcurrentTasks: number;
}): boolean {
  if (!cheapDeterministicWakeReason(input.rawTask)) return false;
  if (input.humanSteering.length > 0) return false;
  if (input.packet.frontier.review.length > 0) return false;
  return frontierUnderfilled(input.packet, input.maxConcurrentTasks);
}

function canSkipOwnerAfterQuickAssignments(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  quickAssignments: TaskAssignment[];
  maxConcurrentTasks: number;
}): boolean {
  if (input.quickAssignments.length === 0) return false;
  if (input.humanSteering.length > 0) return false;
  if (input.packet.frontier.review.length > 0) return false;
  return (
    input.packet.active_task_ids.length >= input.maxConcurrentTasks ||
    cheapDeterministicWakeReason(input.rawTask) !== null
  );
}

function regularLearningTickNoopResult(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  requeuedStaleTaskIds: string[];
  quickAssignments: TaskAssignment[];
}): string | null {
  if (cheapDeterministicWakeReason(input.rawTask) !== "regular-learning-tick")
    return null;
  if (input.humanSteering.length > 0) return null;
  if (input.requeuedStaleTaskIds.length > 0) return null;
  if (input.quickAssignments.length > 0) return null;
  if (input.packet.frontier.review.length > 0) {
    return "Regular learning tick found pending review work already visible in the frontier; skipping owner-agent planning until the review/task-completed flow changes the tree.";
  }
  if (
    input.packet.active_task_ids.length > 0 &&
    input.packet.frontier.runnable.length === 0
  ) {
    return "Regular learning tick found active work already running and no deterministic refill was needed; skipping owner-agent planning until the frontier changes.";
  }
  return null;
}

function settledActiveNoopResult(input: {
  rawTask: string;
  packet: TaskPlanningPacket;
  humanSteering: Record<string, unknown>[];
  requeuedStaleTaskIds: string[];
}): string | null {
  const reason = triggerValue(parseTriggerEvent(input.rawTask), "reason");
  const noHumanOrRequeueWork =
    input.humanSteering.length === 0 && input.requeuedStaleTaskIds.length === 0;
  const hasOnlyActiveFrontier =
    input.packet.active_task_ids.length > 0 &&
    input.packet.frontier.runnable.length === 0 &&
    input.packet.frontier.review.length === 0;
  const settledWithActiveWork =
    noHumanOrRequeueWork &&
    hasOnlyActiveFrontier &&
    input.packet.frontier.blocked.length === 0;
  if (
    reason === "watchdog-stale-active-review" &&
    staleActiveTaskIds(input.rawTask).length > 0 &&
    noHumanOrRequeueWork &&
    hasOnlyActiveFrontier
  ) {
    return "Watchdog stale-active review was a false positive: no listed task was requeued, active work is still running, and every cited stale-active task is already settled/non-active after live-tree revalidation.";
  }
  if (!settledWithActiveWork) return null;
  if (reason === "task-completed") {
    return "Task-completed wake is already settled in the task tree: no review task remains, active work is still running, and no runnable/blocked frontier needs owner judgment.";
  }
  return null;
}

function resultLooksInterrupted(result: unknown): boolean {
  const text = resultText(result).toLowerCase();
  const status = (result as { status?: unknown })?.status;
  return (
    status === "error" ||
    status === "interrupted" ||
    text.includes("timed out") ||
    text.includes("interrupted")
  );
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
  requeuedStaleTaskIds: string[];
}): string | null {
  if (routineRefillReason(input.rawTask) !== "watchdog-runnable-backlog")
    return null;
  if (input.humanSteering.length > 0) return null;
  if (input.quickAssignments.length > 0) return null;
  if (input.requeuedStaleTaskIds.length > 0) return null;

  const triggerIds = triggerRunnableBacklogTaskIds(input.rawTask);
  if (triggerIds.length === 0) return null;
  if (input.packet.frontier.runnable.length > 0) return null;

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

function appendNoopPlannerRun(input: {
  appDir: string;
  result: string;
  steps: string[];
  packet: TaskPlanningPacket;
  initialRepair: ReturnType<typeof repairTaskTreeRollups>;
  requeuedStaleTaskIds: string[];
  startedAtMs: number;
}): void {
  appendPlannerRun(input.appDir, {
    kind: "planner_wake",
    status: "idle",
    ran_agent: false,
    steps: input.steps,
    assigned_task_ids: [],
    repaired_rollups: input.initialRepair.repaired,
    requeued_stale_task_ids: input.requeuedStaleTaskIds,
    seeded_task_ids: [],
    seed_skipped: [],
    active_task_ids: input.packet.active_task_ids,
    durationMs: Math.max(0, Date.now() - input.startedAtMs),
    result: input.result,
  });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const startedAtMs = Date.now();
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const configuredMaxConcurrent = maxConcurrent(ctx.task, null);
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
  const requeuedStaleTaskIds = requeueStaleActiveTasks(config, {
    taskIds: staleActiveTaskIds(ctx.task),
    reason: "watchdog-stale-active-review",
  });
  assignRunnableBacklogTasks(config, { worker });
  const quickAssignments = drainTaskAssignments(config);
  dispatchAssignedTasks(ctx, quickAssignments);
  let packet = planningPacket(config);

  const noopResult = settledActiveNoopResult({
    rawTask: ctx.task,
    packet,
    humanSteering,
    requeuedStaleTaskIds,
  });
  if (noopResult) {
    appendNoopPlannerRun({
      appDir,
      result: noopResult,
      steps: ["settled-active-noop"],
      packet,
      initialRepair,
      requeuedStaleTaskIds,
      startedAtMs,
    });
    return ctx.done(noopResult);
  }

  const staleRunnableNoop = staleRunnableBacklogNoopResult({
    rawTask: ctx.task,
    packet,
    humanSteering,
    quickAssignments,
    requeuedStaleTaskIds,
  });
  if (staleRunnableNoop) {
    appendNoopPlannerRun({
      appDir,
      result: staleRunnableNoop,
      steps: ["stale-runnable-backlog-noop"],
      packet,
      initialRepair,
      requeuedStaleTaskIds,
      startedAtMs,
    });
    return ctx.done(staleRunnableNoop);
  }

  const regularLearningTickNoop = regularLearningTickNoopResult({
    rawTask: ctx.task,
    packet,
    humanSteering,
    requeuedStaleTaskIds,
    quickAssignments,
  });
  if (regularLearningTickNoop) {
    appendNoopPlannerRun({
      appDir,
      result: regularLearningTickNoop,
      steps: ["regular-learning-tick-noop"],
      packet,
      initialRepair,
      requeuedStaleTaskIds,
      startedAtMs,
    });
    return ctx.done(regularLearningTickNoop);
  }

  if (
    canSkipOwnerAfterQuickAssignments({
      rawTask: ctx.task,
      packet,
      humanSteering,
      quickAssignments,
      maxConcurrentTasks: config.maxConcurrent,
    })
  ) {
    const wakeReason = cheapDeterministicWakeReason(ctx.task);
    appendPlannerRun(appDir, {
      kind: "planner_wake",
      status: "assigned",
      ran_agent: false,
      steps: [
        wakeReason === "regular-learning-tick"
          ? "regular-learning-tick-quick-path"
          : "quick-refill",
      ],
      assigned_task_ids: quickAssignments.map(
        (assignment) => assignment.taskId,
      ),
      repaired_rollups: initialRepair.repaired,
      requeued_stale_task_ids: requeuedStaleTaskIds,
      active_task_ids: packet.active_task_ids,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      result:
        wakeReason === "regular-learning-tick"
          ? "Regular learning tick assigned already-runnable work and skipped owner-agent planning."
          : "Quick refill assigned runnable backlog tasks up to worker capacity; skipped owner-agent planning for this routine wake.",
    });
    return ctx.done(
      wakeReason === "regular-learning-tick"
        ? `Planner regular-learning-tick quick path assigned ${quickAssignments.length} task(s): ${quickAssignments
            .map((assignment) => assignment.taskId)
            .slice(0, 8)
            .join(", ")}.`
        : `Planner quick-refill assigned ${quickAssignments.length} task(s): ${quickAssignments
            .map((assignment) => assignment.taskId)
            .slice(0, 8)
            .join(", ")}.`,
    );
  }

  if (
    canUseDeterministicRefill({
      rawTask: ctx.task,
      packet,
      humanSteering,
      maxConcurrentTasks: config.maxConcurrent,
    })
  ) {
    const reason = cheapDeterministicWakeReason(ctx.task);
    const openSlots = Math.max(
      0,
      config.maxConcurrent -
        packet.active_task_ids.length -
        packet.frontier.runnable.length,
    );
    const seedReason = `${reason === "regular-learning-tick" ? "regular-learning-tick" : "routine-refill"}:${reason}`;
    const seedResult = seedModelGapBacklog(config, {
      limit: Math.min(2, openSlots),
      reason: seedReason,
    });
    if (seedResult.created.length > 0) {
      assignRunnableBacklogTasks(config, { worker });
      const seededAssignments = drainTaskAssignments(config);
      dispatchAssignedTasks(ctx, seededAssignments);
      packet = planningPacket(config);
      appendPlannerRun(appDir, {
        kind: "planner_wake",
        status: seededAssignments.length ? "assigned" : "seeded",
        ran_agent: false,
        steps: ["deterministic-refill"],
        assigned_task_ids: seededAssignments.map(
          (assignment) => assignment.taskId,
        ),
        repaired_rollups: initialRepair.repaired,
        requeued_stale_task_ids: requeuedStaleTaskIds,
        seeded_task_ids: seedResult.created,
        seed_reason: seedReason,
        seed_skipped: seedResult.skipped.slice(0, 12),
        active_task_ids: packet.active_task_ids,
        durationMs: Math.max(0, Date.now() - startedAtMs),
        result:
          "Routine watchdog refill seeded model-gap work without owner-agent planning.",
      });
      return ctx.done(
        `Planner deterministic-refill seeded ${seedResult.created.length} task(s) and assigned ${seededAssignments.length}: ${seedResult.created
          .slice(0, 8)
          .join(", ")}.`,
      );
    }

    // Deterministic refill found no model gaps — all work is done.
    // Short-circuit instead of falling through to an expensive agent session.
    appendPlannerRun(appDir, {
      kind: "planner_wake",
      status: "idle",
      ran_agent: false,
      steps: ["deterministic-refill-exhausted"],
      assigned_task_ids: [],
      repaired_rollups: initialRepair.repaired,
      requeued_stale_task_ids: requeuedStaleTaskIds,
      seeded_task_ids: [],
      seed_reason: seedReason,
      seed_skipped: seedResult.skipped.slice(0, 12),
      active_task_ids: packet.active_task_ids,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      result:
        "Routine watchdog refill found no model gaps and no open frontier. Skipping agent session.",
    });
    return ctx.done(
      "Planner deterministic-refill exhausted: no model gaps remain and no open frontier work. Skipping agent session.",
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
        240_000,
      ),
      prompt: buildPlannerPrompt({
        appDir,
        projectDir,
        agent,
        eventReview: resultText(eventReviewResult).slice(0, 5000),
        trigger: triggerBlock(ctx.task),
        packet,
        humanSteering,
      }),
    });
  } catch (err) {
    plannerResult = {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  const finalRepair = repairTaskTreeRollups(config);
  packet = planningPacket(config);

  let ownerAssignments = drainTaskAssignments(config);
  let seedResult: ReturnType<typeof seedModelGapBacklog> | undefined =
    undefined;
  let seedReason: string | undefined;
  if (
    ownerAssignments.length === 0 &&
    frontierUnderfilled(packet, config.maxConcurrent)
  ) {
    const openSlots = Math.max(
      0,
      config.maxConcurrent -
        packet.active_task_ids.length -
        packet.frontier.runnable.length,
    );
    seedReason = resultLooksInterrupted(plannerResult)
      ? "planner-timeout-underfilled-frontier"
      : "planner-left-underfilled-frontier";
    seedResult = seedModelGapBacklog(config, {
      limit: Math.min(2, openSlots),
      reason: seedReason,
    });
    if (seedResult.created.length > 0) {
      assignRunnableBacklogTasks(config, { worker });
      ownerAssignments = drainTaskAssignments(config);
      dispatchAssignedTasks(ctx, ownerAssignments);
      packet = planningPacket(config);
    }
  } else if (
    ownerAssignments.length === 0 &&
    frontierNeedsBacklogDepth(packet)
  ) {
    seedReason = resultLooksInterrupted(plannerResult)
      ? "planner-timeout-execution-full-backlog-empty"
      : "planner-left-execution-full-backlog-empty";
    seedResult = seedModelGapBacklog(config, {
      limit: 2,
      reason: seedReason,
      prefer: "source-spec",
    });
    if (seedResult.created.length > 0) {
      packet = planningPacket(config);
    }
  } else {
    dispatchAssignedTasks(ctx, ownerAssignments);
  }
  const assignments = [...quickAssignments, ...ownerAssignments];
  const runStatus = assignments.length
    ? "assigned"
    : seedResult?.created.length
      ? "seeded"
      : "settled";
  appendPlannerRun(appDir, {
    kind: "planner_wake",
    status: runStatus,
    ran_agent: true,
    steps: ["event-review", "planning-update"],
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    requeued_stale_task_ids: requeuedStaleTaskIds,
    repaired_rollups: [...initialRepair.repaired, ...finalRepair.repaired],
    seeded_task_ids: seedResult?.created ?? [],
    seed_reason: seedResult?.created.length ? seedReason : undefined,
    seed_skipped: seedResult?.skipped?.slice(0, 12) ?? [],
    active_task_ids: packet.active_task_ids,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    event_review: resultText(eventReviewResult).slice(0, 2000),
    result: resultText(plannerResult).slice(0, 4000),
  });

  const plannerMessage = assignments.length
    ? `Planner assigned ${assignments.length} task(s): ${assignments
        .map((assignment) => assignment.taskId)
        .slice(0, 8)
        .join(", ")}. Agent result: ${resultText(plannerResult)}`
    : seedResult?.created.length
      ? `Planner seeded ${seedResult.created.length} backlog task(s): ${seedResult.created
          .slice(0, 8)
          .join(", ")}. Agent result: ${resultText(plannerResult)}`
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
