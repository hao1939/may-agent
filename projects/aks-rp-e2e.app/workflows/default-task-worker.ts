/**
 * default-task-worker — generic LLM-backed task execution.
 *
 * Handles project.task.assigned by waking the dispatched task session. The
 * planner owns the task tree; this workflow executes and reports
 * completion.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  workflowResult,
  type StructuredWorkflowResult,
  type WorkflowContext,
  type WorkflowResult,
  type WorkflowResultStatus,
} from "@may-agent/sdk";
import {
  readTaskTree,
  taskEventSnapshot,
  withTreeLock,
  type TaskTreeConfig,
  type TaskNode,
} from "./lib/task-tree-store.ts";
import {
  appendToolJournal,
  completeTask,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
  type TaskCompletionClaim,
} from "./lib/task-tree-tools.ts";
import { syncProjectReadout } from "./lib/project-readout-sync.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  sourceDir,
  triggerString,
  type TriggerEvent,
} from "./lib/workflow-input.ts";

export const name = "default-task-worker";
export const description =
  "Execute one aks-rp-e2e task with the default assigned agent session.";

type TaskReviewRoute = {
  required: boolean;
  reason: string;
};

type TaskProblemRoute = {
  action: "none" | "request";
  category?: string;
  diagnosis?: string;
  resumeCondition?: string;
};

type FixForwardResult = {
  workflow: "fix-forward";
  subject?: unknown;
  classification?: unknown;
  diagnosis?: unknown;
  minimumDiagnosisPacket?: unknown;
  changedFiles?: unknown;
  verification?: unknown;
  nextAction?: unknown;
  nextActionReason?: unknown;
};

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
  ) => Promise<unknown>;
};

function normalizedFinishDeliverablePaths(result: unknown): string[] {
  const finishResult = (
    result as {
      finishResult?: { deliverables?: Array<{ path?: unknown }> };
    }
  )?.finishResult;
  const deliverables = Array.isArray(finishResult?.deliverables)
    ? finishResult.deliverables
    : [];
  return [
    ...new Set(
      deliverables
        .map((item) =>
          typeof item?.path === "string" ? item.path.trim() : "",
        )
        .filter(Boolean),
    ),
  ];
}

function resolveDeliverableTexts(result: unknown): string[] {
  const texts: string[] = [];
  for (const deliverablePath of normalizedFinishDeliverablePaths(result)) {
    const absolutePath = isAbsolute(deliverablePath)
      ? deliverablePath
      : resolve("/app/projects/aks-rp-e2e", deliverablePath);
    if (!existsSync(absolutePath)) continue;
    try {
      const text = readFileSync(absolutePath, "utf8").trim();
      if (text) texts.push(text);
    } catch {
      // Best-effort only; keep the worker completion durable even if a cited
      // deliverable cannot be read locally.
    }
  }
  return texts;
}

function resultTextCandidates(result: unknown): string[] {
  const candidates: string[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown, depth: number): void {
    if (value == null || depth > 4 || seen.has(value)) return;
    if (typeof value === "string") {
      if (value.trim()) candidates.push(value);
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of [
      "lastAssistantText",
      "message",
      "summary",
      "errorMessage",
      "status",
      "finishResult",
      "messages",
      "error",
    ]) {
      visit(record[key], depth + 1);
    }
    for (const nested of Object.values(record)) {
      visit(nested, depth + 1);
    }
  }

  visit(result, 0);
  return candidates;
}

function fixForwardResultFromSessionResult(
  result: unknown,
): FixForwardResult | null {
  for (const candidate of [
    ...resultTextCandidates(result),
    ...resolveDeliverableTexts(result),
  ]) {
    const parsed = parseFixForwardResult(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function resultEvidence(result: unknown): string[] {
  return normalizedFinishDeliverablePaths(result);
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function taskContextString(task: TaskNode, key: string): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isFixForwardTask(task: TaskNode): boolean {
  return taskContextString(task, "workflow") === "fix-forward";
}

function isCompactFixForwardTask(task: TaskNode): boolean {
  const context = taskContext(task);
  const subjectKind = taskContextString(task, "subjectKind");
  return (
    isFixForwardTask(task) &&
    (context.featureCompactFollowup === true ||
      context.featureCompactFocusedDiagnostic === true ||
      subjectKind.includes("compact"))
  );
}

function matchingJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseFixForwardResult(text: string): FixForwardResult | null {
  const marker = text.search(/FIX_FORWARD_RESULT/i);
  if (marker < 0) return null;
  const scoped = text.slice(marker);
  const fenced = scoped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  const firstBrace = scoped.indexOf("{");
  if (firstBrace >= 0) {
    const objectText = matchingJsonObject(scoped, firstBrace);
    if (objectText) candidates.push(objectText);
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        (parsed as { workflow?: unknown }).workflow === "fix-forward"
      ) {
        return parsed as FixForwardResult;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function completionControllerTick(
  task: TaskNode,
  input: {
    attemptId: string;
    result: TaskCompletionClaim;
    summary: string;
    completion: Record<string, unknown>;
  },
): { type: string; payload: Record<string, unknown> } | null {
  const loopTaskId = taskContextString(task, "loopTaskId");
  if (!loopTaskId) return null;

  const byWorkflow: Record<
    string,
    { type: string; action: string; reason: string }
  > = {
    "single-spec-verifier": {
      type: "project.task.tick",
      action: "spec-loop",
      reason: "spec-loop-child-completed",
    },
    "feature-reference-collector": {
      type: "project.task.tick",
      action: "feature-reference-loop",
      reason: "feature-reference-child-completed",
    },
    "feature-compact-planner": {
      type: "project.task.tick",
      action: "feature-compact-loop",
      reason: "feature-compact-child-completed",
    },
  };
  const route = byWorkflow[String(task.workflow ?? "")];
  if (!route) return null;

  return {
    type: route.type,
    payload: {
      project: "aks-rp-e2e",
      action: route.action,
      taskId: loopTaskId,
      task_id: loopTaskId,
      target: { project: "aks-rp-e2e", taskId: loopTaskId },
      reason: route.reason,
      sourceTaskId: task.id,
      source_task_id: task.id,
      attemptId: input.attemptId,
      attempt_id: input.attemptId,
      result: input.result,
      claim: input.result,
      summary: input.summary,
      params: {
        loopTaskId,
        completedTaskId: task.id,
        completedTask: input.completion,
      },
    },
  };
}

export function buildTaskTreeConfig(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  configuredMaxConcurrent: number,
  trigger: TriggerEvent | null = null,
): TaskTreeConfig {
  const assignedWorker = triggerString(trigger, "worker").trim();
  const taskId =
    triggerString(trigger, "taskId").trim() ||
    triggerString(trigger, "task_id").trim();
  const assignedTaskOwner = taskId
    ? String(readTaskTree(taskTreeConfig({ appDir, projectDir, worker: "", maxConcurrent: configuredMaxConcurrent })).tasks[taskId]?.owner ?? "").trim()
    : "";
  const taskWorker = (field(ctx.task, "worker") ?? "").trim();
  const taskAgent = (field(ctx.task, "agent") ?? "").trim();
  const contextAgent = typeof ctx.agent === "string" ? ctx.agent.trim() : "";
  const worker =
    assignedWorker ||
    assignedTaskOwner ||
    taskWorker ||
    taskAgent ||
    contextAgent;
  return {
    ...taskTreeConfig({
      appDir,
      projectDir,
      worker,
      maxConcurrent: configuredMaxConcurrent,
    }),
    worker,
    maxConcurrent: configuredMaxConcurrent,
  };
}

function buildWorkerPrompt(input: {
  appDir: string;
  projectDir: string;
  sourceDir: string;
  task: unknown;
  attemptId: string;
}): string {
  const task = input.task as TaskNode;
  const fixForwardInstructions = isFixForwardTask(task)
    ? `
This task is a fix-forward task. Handle failures as a decision problem, not a
blind retry problem.

Required order:
1. Name the exact subject: one spec, one compact feature, or one coherent
   feature family.
2. Classify the failure. Use needs-diagnosis only when you cannot classify from
   the available facts, and then collect diagnosis before any rerun.
3. Preserve raw facts: run id, result path, failing assertion, request/response
   excerpt, command, target, branch, and artifact refs when available.
4. Compare inputFingerprints and errorFingerprints from the task context before
   rerunning.
5. Pick one smallest truthful next action: bounded domain fix, ops fix, focused
   follow-up, exact blocked wait, escalation, or terminal finding with proof.

Do not rerun the same input after the same error without a changed input,
changed diagnosis, or new external fact. Do not turn "I am unsure" into
blocked. Do not hide agent/tool/pipeline/artifact failure as AKS product
behavior.
If you cite a durable evidence memo or other file in deliverables, include the
complete FIX_FORWARD_RESULT block in that same file as well as in your final
worker response. The worker may need to recover the structured result from the
cited deliverable when the runtime/session summary omits it.

Finish your worker response with this structured block:

FIX_FORWARD_RESULT:
\`\`\`json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "spec | compact-feature | feature-family",
    "id": "exact subject id"
  },
  "classification": "request-shape-invalid | test-code-bug | compact-plan-conflict | pipeline-infrastructure | missing-result-artifact | product-behavior-mismatch | capacity-exhausted | needs-diagnosis | other-known-class",
  "diagnosis": "specific root-cause diagnosis or the exact missing fact",
  "minimumDiagnosisPacket": {
    "target": "target profile",
    "branch": "branch",
    "runId": "pipeline/run id or empty when unavailable",
    "resultPath": "result artifact path or empty when unavailable",
    "failingPhase": "phase or empty",
    "failingAssertion": "assertion or empty",
    "requestOrResponseExcerpt": "short excerpt or empty",
    "referencesChecked": ["official/API/design/source references checked"],
    "inputFingerprint": "current input fingerprint or empty",
    "errorFingerprint": "current error fingerprint or empty"
  },
  "changedFiles": ["files changed, if any"],
  "verification": {
    "runId": "verification run id or empty",
    "resultPath": "verification result path or empty",
    "status": "pass | fail | error | not-run"
  },
  "nextAction": "done | rerun-after-change | create-domain-repair | create-ops-repair | exact-wait | escalate",
  "nextActionReason": "why this next action is the smallest truthful move"
}
\`\`\`
`
    : "";
  const compactFixForwardInstructions = isCompactFixForwardTask(task)
    ? `
Compact fix-forward training:
- Do not broad-rerun a compact feature family just because many records are in
  package-partial or live-workflow error. First compare the supplied
  inputFingerprints and errorFingerprints.
- If current facts still point to exact existing holders, terminal
  dispositions, or environment/product waits, report nextAction="exact-wait" or
  nextAction="done" with the exact holder/result path. Do not invent a rerun.
- If you update compact-loop state or write an evidence memo, include those
  paths in changedFiles and verification.resultPath.
- Evidence must be fresh for this attempt unless the correct result is
  "existing evidence remains exact". If you reuse an older evidence path, say
  that explicitly in FIX_FORWARD_RESULT.diagnosis and verification.resultPath,
  and explain why no new evidence file or rerun is needed.
- Do not claim "done" from stale compact evidence alone. A done/exact-wait
  result must name the current attempt evidence path, the existing exact holder,
  or the exact prior evidence that remains authoritative.
- The reviewer will reject useful prose without FIX_FORWARD_RESULT. Always end
  with a complete FIX_FORWARD_RESULT block, even when the correct outcome is
  "no rerun; exact wait remains".
- For family tasks, subject.kind should be "feature-family" and subject.id
  should be the compact error class or family name. For focused branch tasks,
  subject.kind should be "compact-feature" or "spec" and subject.id should name
  the exact feature/spec.
`
    : "";
  return `Task Worker Mode

You are executing exactly one aks-rp-e2e task dispatched by the planner.
Do not reshape the tree, create sibling branches, roll up parents, or run
planner work from this session.
If the assigned task asks for planning work, child-task creation, branch
creation, dispatch, acceptance/review decisions, rollups, or other broad tree
changes, treat that as planner/app-ops review output: write the
plan/proposal/evidence in the right workspace and report what the planner should
add to the tree.
If the assigned task is a bounded existing-task metadata repair that explicitly
names supported task-tree commands such as \`task-tree set-outputs\` or
\`task-tree update-text\`, you may run only those exact commands against the
named existing task ids. Never edit the runtime task tree file directly, and do not
add/reassign/accept/reject tasks from this session.

Use the task as the context container. Read the relevant domain files, do the
task body, write the requested output/evidence, then finish with a structured
agent result status:

  success | partial | blocked | failure

Use blocked only for a real blocker with a concrete resume condition.
If the work is too large or wrongly decomposed, record a blocked summary that
explains the exact decomposition problem. The planner reviews the latest task
state after worker progress and decides whether to accept, retry, repair,
replace, split, or keep the task blocked.
Your summary is review material, not routing protocol. Do not rely on special
phrases to trigger follow-up behavior; state the result, evidence, diagnosis, and
resume condition plainly.

Mounted AKS RP Go source may be available at ${input.sourceDir}. Treat it as
context, not ground truth. Ground truth for expected AKS behavior comes from
official docs, public API specs, accepted design docs, and live test results.
Use the domain workspace as the place where runnable specs, scenario tests,
runner code, compact plans, workflow YAML, and feature knowledge are fixed.

App: ${input.appDir}
Domain workspace: ${input.projectDir}
Source workspace: ${input.sourceDir}
Attempt: ${input.attemptId}

Loop state paths in task inputs or outputs, such as
\`.state/spec-loop/state.json\` and
\`.state/feature-compact-loop/state.json\`, are app-owned state paths rooted at
${input.appDir}. The domain workspace may contain mirrored snapshots for
human/domain review, but controller-visible loop state must be updated through
the app path unless the task explicitly says otherwise. Domain feature/spec
files, compact packages, test code, run artifacts, and evidence notes stay
rooted at ${input.projectDir}.

Before any worker-initiated live Azure DevOps pipeline dispatch for single specs or compact
feature reruns, run the local live dependency and admission policies against
the exact spec set from ${input.projectDir}. Use both commands:

  bun runner/check-private-source-policy.ts --specs <comma-separated-spec-ids>
  bun runner/check-live-admission.ts --specs <comma-separated-spec-ids>

If either policy fails, do not dispatch the pipeline. Repair the selected
scenario tests so they are self-contained and live-admissible, or finish
partial/blocked with the exact policy output and resume condition. An Azure DevOps pipeline run
that fails only because either local policy would have failed is not acceptable
completion evidence.

For spec-loop or compact-loop repair tasks, the app is only the organizer. If
the root cause is test code, generated tests, runner behavior, compact planner,
workflow YAML, live target/env wiring, or spec execution behavior, make the fix
in the domain workspace (${input.projectDir}), commit it, push it to the target
branch, then verify it with the Azure DevOps pipeline that runs the affected spec or
compact plan. App-only notes, memos, or task-state updates do not fix those
failures and are not enough to claim success. Update app evidence only as an
audit trail after the domain fix is pushed and verified.

If the assigned task is reviewing a terminal Azure DevOps pipeline wait, treat
that as domain result review with explicit inputs. Do not touch the task tree,
do not edit app loop state, and do not finish by saying only that the pipeline
is terminal or that someone should review the artifacts.

Use the run id and spec ids from task.context.terminalPipelineWaitReview,
task.context.terminalGitHubWaitReview, task.trace.terminal_pipeline_wait_run_id,
or task.trace.terminal_github_wait_run_id. Then:

1. Look for already downloaded artifacts under ${input.projectDir}/workspace,
   ${input.projectDir}/evidence/archive, and app .state artifact paths named by
   the task.
2. If artifacts are missing and Azure DevOps access is available, download them
   with the existing Azure DevOps artifact flow or equivalent az pipelines
   artifact commands into a task-specific workspace directory.
3. Inspect the exact result.json/spec-runner result for each named spec. A
   successful pipeline conclusion is not enough by itself.
4. Record the concrete result: same spec id, target, run id, result path, real
   cluster/resource group when required, failed verdict assertions, cleanup, and
   next action.
5. If the artifact cannot be obtained, finish partial/blocked with the exact
   artifact recovery step. If the artifact is present, classify pass/fail/error
   from the artifact and write the durable domain evidence or structured result
   requested by the task. The app-side planner/controller consumes that result
   later and owns task-tree or loop-state updates.

For metric, watchdog, blocked-frontier, and overdue-wait audit tasks, compute
the baseline as if the current audit/recovery task did not exist. Do not let the
assigned task's own id, goal text, conflict scope, or review state suppress the
blocked waits it is supposed to inspect. Report both the pre-audit contributor
set and the post-action represented set when they differ.
${fixForwardInstructions}
${compactFixForwardInstructions}

Assigned task:
\`\`\`json
${JSON.stringify(input.task, null, 2)}
\`\`\``.trim();
}

async function runTaskAgent(input: {
  ctx: WorkflowContext;
  worker: string;
  sessionId: string;
  prompt: string;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.worker, input.prompt, input.sessionId)
    : input.ctx.runAgent(input.worker, input.prompt);
}

const EMPTY_ASSISTANT_TURN = "Agent ended with an empty assistant turn";

function sessionSummaryForCompletion(result: unknown): string {
  const typed = result as {
    status?: string;
    errorMessage?: string;
    error?: unknown;
    lastAssistantText?: string | null;
    finishResult?: { summary?: unknown };
  };
  const summary = resultText(result);
  const finishSummary =
    typeof typed?.finishResult?.summary === "string"
      ? typed.finishResult.summary.trim()
      : "";
  const lastAssistantText =
    typeof typed?.lastAssistantText === "string"
      ? typed.lastAssistantText.trim()
      : "";
  const hasRuntimeError =
    (typeof typed?.errorMessage === "string" && typed.errorMessage.trim()) ||
    (typed?.error &&
      typeof typed.error === "object" &&
      ((typeof (typed.error as { message?: unknown }).message === "string" &&
        (typed.error as { message?: string }).message?.trim()) ||
        (typeof (typed.error as { error?: unknown }).error === "string" &&
          String((typed.error as { error?: string }).error).trim())));

  if (hasRuntimeError) return summary;
  if (
    typed?.status === "error" &&
    typed?.lastAssistantText == null &&
    (!finishSummary || finishSummary === EMPTY_ASSISTANT_TURN)
  ) {
    return "Worker runtime error: session ended with status=error before any usable assistant output or structured finish summary.";
  }
  return summary;
}

function workerResultFromSession(
  result: unknown,
  _text: string,
): TaskCompletionClaim {
  const typed = result as {
    status?: string;
    finishResult?: { status?: string };
  };
  const status = typed?.status;
  const finishStatus = typed?.finishResult?.status;

  // Structured finish() status is the worker's deliberate completion claim.
  if (finishStatus === "success") return "done";
  if (finishStatus === "partial") return "partial";
  if (finishStatus === "blocked" || finishStatus === "failure")
    return "blocked";

  // Generic session success without structured finish is ambiguous. Treat it
  // conservatively as partial so owner/review can judge the work.
  if (status === "success" || status === "ok" || status === "partial")
    return "partial";

  return "blocked";
}

function workflowStatusFromClaim(
  claim: TaskCompletionClaim,
): WorkflowResultStatus {
  if (claim === "done") return "done";
  if (claim === "blocked") return "blocked";
  return "partial";
}

function completionWorkflowResult(
  task: TaskNode,
  input: {
    result: TaskCompletionClaim;
    summary: string;
    evidence: string[];
    problem: TaskProblemRoute;
    details?: Record<string, unknown>;
  },
): StructuredWorkflowResult {
  const problem =
    input.problem.action === "request" && input.problem.category
      ? {
          category: input.problem.category,
          diagnosis: input.problem.diagnosis ?? input.summary,
          resumeCondition: input.problem.resumeCondition,
        }
      : null;
  return workflowResult({
    workflow:
      typeof task.workflow === "string" && task.workflow.trim()
        ? task.workflow.trim()
        : "default-task-worker",
    subject: {
      kind: "task",
      id: task.id,
    },
    status: workflowStatusFromClaim(input.result),
    summary: input.summary,
    artifacts: input.evidence,
    problem,
    details: {
      taskClaim: input.result,
      ...(input.details ?? {}),
    },
  });
}

export function emitTaskCompleted(
  ctx: WorkflowContext,
  task: TaskNode,
  input: {
    attemptId: string;
    result: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
    review?: TaskReviewRoute;
    problem?: TaskProblemRoute;
    workflowResult?: StructuredWorkflowResult;
    details?: Record<string, unknown>;
  },
): void {
  const evidence = input.evidence ?? [];
  const review = input.review ?? {
    required: true,
    reason: "worker-completion",
  };
  const problem = input.problem ?? {
    action: "none" as const,
  };
  const structuredResult =
    input.workflowResult ??
    completionWorkflowResult(task, {
      result: input.result,
      summary: input.summary,
      evidence,
      problem,
      details: input.details,
    });
  const completion = {
    taskId: task.id,
    task_id: task.id,
    attemptId: input.attemptId,
    attempt_id: input.attemptId,
    result: input.result,
    claim: input.result,
    summary: input.summary,
    evidenceRefs: evidence,
    evidence_refs: evidence,
    review,
    problem,
    workflowResult: structuredResult,
    workflow_result: structuredResult,
  };
  try {
    ctx.dispatchEvent("project.task.completed", {
      target: { project: "aks-rp-e2e", taskId: task.id },
      project: "aks-rp-e2e",
      ...taskEventSnapshot(task),
      attemptId: input.attemptId,
      attempt_id: input.attemptId,
      result: input.result,
      claim: input.result,
      summary: input.summary,
      evidenceRefs: evidence,
      evidence_refs: evidence,
      review,
      problem,
      workflowResult: structuredResult,
      workflow_result: structuredResult,
      completion,
    });
    const controllerTick = completionControllerTick(task, {
      attemptId: input.attemptId,
      result: input.result,
      summary: input.summary,
      completion,
    });
    if (controllerTick) {
      ctx.dispatchEvent(controllerTick.type, controllerTick.payload);
    }
  } catch {
    // Local test contexts may not provide a real dispatcher.
  }
}

export function taskAttemptId(task: TaskNode): string {
  const trace = task.trace;
  const value =
    trace && typeof trace === "object" && !Array.isArray(trace)
      ? trace.current_attempt_id
      : undefined;
  return typeof value === "string" ? value : "";
}

function taskStatus(task: TaskNode): string {
  return String(task.status ?? task.state ?? "");
}

export function traceValue(task: TaskNode, key: string): unknown {
  const trace = task.trace;
  return trace && typeof trace === "object" && !Array.isArray(trace)
    ? (trace as Record<string, unknown>)[key]
    : undefined;
}

export function markAttemptStartedOnce(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    attemptId: string;
  },
): { ok: true; task: TaskNode } | { ok: false; reason: string } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task)
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} was not found.`,
      };
    if (taskStatus(task) !== "active")
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} is ${taskStatus(task)}, not active.`,
      };
    if (taskAttemptId(task) !== input.attemptId)
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} attempt ${input.attemptId} is stale.`,
      };

    if (traceValue(task, "worker_started_attempt_id") === input.attemptId) {
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} attempt ${input.attemptId} is already running or already started.`,
      };
    }

    const now = new Date().toISOString();
    task.trace = {
      ...(task.trace ?? {}),
      worker_started_attempt_id: input.attemptId,
      worker_started_at: now,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_worker_started",
      task_id: task.id,
      attempt_id: input.attemptId,
      session_id: task.session_id,
      worker: config.worker,
    });
    return { ok: true, task };
  });
}

export function completeStartedAttempt(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    attemptId: string;
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
    workflowResult?: StructuredWorkflowResult;
  },
):
  { ok: true; task: TaskNode; late?: boolean } | { ok: false; reason: string } {
  const completionState = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) {
      return {
        ok: false as const,
        reason: `Assigned task ${input.taskId} no longer exists; completion for attempt ${input.attemptId} is obsolete.`,
      };
    }
    if (taskAttemptId(task) !== input.attemptId) {
      return {
        ok: false as const,
        reason: `Assigned task ${input.taskId} attempt ${input.attemptId} is no longer current; completion is obsolete.`,
      };
    }
    if (taskStatus(task) !== "active") {
      return {
        ok: false as const,
        reason: `Assigned task ${input.taskId} is ${taskStatus(task)}, not active; completion for attempt ${input.attemptId} is obsolete.`,
      };
    }
    return { ok: true as const };
  });
  if (completionState.ok === false) {
    const lateCompletion = recordLatePreviousAttemptCompletion(config, input);
    if (lateCompletion.ok) return lateCompletion;
    appendToolJournal(config, {
      kind: "task_worker_completion_ignored",
      task_id: input.taskId,
      attempt_id: input.attemptId,
      result: input.claim,
      reason: completionState.reason,
      summary: input.summary,
    });
    return { ok: false, reason: completionState.reason };
  }

  try {
    const task = completeTask(config, {
      taskId: input.taskId,
      claim: input.claim,
      summary: input.summary,
      evidence: input.evidence,
    });
    if (input.workflowResult) {
      withTreeLock(config, () => {
        const tree = readTaskTree(config);
        const latest = tree.tasks[input.taskId];
        if (!latest) return;
        latest.trace = {
          ...(latest.trace ?? {}),
          workflowResult: input.workflowResult,
        };
        saveTaskTreeWithKanbanSnapshot(config, tree);
      });
      task.trace = {
        ...(task.trace ?? {}),
        workflowResult: input.workflowResult,
      };
    }
    return { ok: true, task };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : `Unable to complete task ${input.taskId}`;
    appendToolJournal(config, {
      kind: "task_worker_completion_ignored",
      task_id: input.taskId,
      attempt_id: input.attemptId,
      result: input.claim,
      reason,
      summary: input.summary,
    });
    return { ok: false, reason };
  }
}

function claimRank(claim: TaskCompletionClaim): number {
  if (claim === "done") return 3;
  if (claim === "blocked") return 2;
  return 1;
}

function recordLatePreviousAttemptCompletion(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    attemptId: string;
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
    workflowResult?: StructuredWorkflowResult;
  },
): { ok: true; task: TaskNode; late: true } | { ok: false } {
  const recorded = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) return { ok: false as const };
    const trace =
      task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
        ? (task.trace as Record<string, unknown>)
        : {};
    if (trace.previous_attempt_id !== input.attemptId) {
      return { ok: false as const };
    }
    if (trace.stale_active_fresh_session !== true) {
      return { ok: false as const };
    }
    const status = taskStatus(task);
    if (status === "done") return { ok: false as const };

    const now = new Date().toISOString();
    const priorCompletions = Array.isArray(trace.late_worker_completions)
      ? trace.late_worker_completions
      : [];
    const lateCompletion = {
      attempt_id: input.attemptId,
      result: input.claim,
      summary: input.summary,
      evidence: input.evidence ?? [],
      ...(input.workflowResult ? { workflowResult: input.workflowResult } : {}),
      recorded_at: now,
    };
    const currentClaim =
      typeof trace.last_worker_claim === "string"
        ? (trace.last_worker_claim as TaskCompletionClaim)
        : undefined;
    const shouldPromote =
      status === "review" &&
      (!currentClaim || claimRank(input.claim) > claimRank(currentClaim));

    task.trace = {
      ...trace,
      late_worker_completions: [...priorCompletions, lateCompletion].slice(-5),
      late_worker_completion_recorded_at: now,
      late_worker_completion_attempt_id: input.attemptId,
    };
    if (shouldPromote) {
      task.result = input.summary;
      task.evidence = input.evidence ?? task.evidence;
      task.trace = {
        ...(task.trace ?? {}),
        last_worker_result: input.claim,
        last_worker_claim: input.claim,
        last_worker_summary: input.summary,
        last_worker_completed_at: now,
        last_worker_evidence: input.evidence ?? [],
        ...(input.workflowResult
          ? { workflowResult: input.workflowResult }
          : {}),
        late_worker_completion_promoted_at: now,
      };
    }

    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_worker_late_completion_recorded",
      task_id: input.taskId,
      attempt_id: input.attemptId,
      result: input.claim,
      promoted: shouldPromote,
      summary: input.summary,
      evidence: input.evidence ?? [],
      workflowResult: input.workflowResult,
    });
    return { ok: true as const, task, late: true as const };
  });
  return recorded.ok
    ? { ok: true, task: recorded.task, late: true }
    : { ok: false };
}

async function runAssignedMode(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  sourceRoot: string,
  config: TaskTreeConfig,
  trigger: TriggerEvent | null,
): Promise<WorkflowResult> {
  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  if (!taskId)
    return ctx.done(
      "Task assignment event ignored because it did not include taskId.",
    );
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!attemptId)
    return ctx.done(
      `Task assignment for ${taskId} ignored because it did not include attemptId.`,
    );

  const start = markAttemptStartedOnce(config, { taskId, attemptId });
  if (start.ok === false) return ctx.done(start.reason);
  const task = start.task;

  const result = await runTaskAgent({
    ctx,
    worker: config.worker,
    sessionId:
      task.session_id || `s_task_${task.id.replace(/[^A-Za-z0-9_-]+/g, "_")}`,
    prompt: buildWorkerPrompt({
      appDir,
      projectDir,
      sourceDir: sourceRoot,
      task,
      attemptId,
    }),
  });
  const message = sessionSummaryForCompletion(result);
  const claim = workerResultFromSession(result, message);
  const evidence = resultEvidence(result);
  const fixForwardResult = isFixForwardTask(task)
    ? fixForwardResultFromSessionResult(result)
    : null;
  const fixForwardDetails = isFixForwardTask(task)
    ? {
        fixForward: fixForwardResult,
        fixForwardStructuredResultPresent: Boolean(fixForwardResult),
      }
    : undefined;
  const completion = completeStartedAttempt(config, {
    taskId: task.id,
    attemptId,
    claim,
    summary: message || "Worker session returned without a completion summary.",
    evidence,
  });
  if (completion.ok === false) {
    return ctx.done(
      `Task worker ignored obsolete completion for ${task.id} attempt ${attemptId}; result was ${claim}. ${completion.reason}`,
    );
  }
  const completedTask = completion.task;
  try {
    syncProjectReadout(config);
  } catch {
    // Keep worker completion durable even if compact project.json readout sync
    // fails; planner/watchdog can resync on their next pulse.
  }
  emitTaskCompleted(ctx, completedTask, {
    attemptId,
    result: claim,
    summary: message || "Worker session returned without a completion summary.",
    evidence,
    details: fixForwardDetails,
  });
  return ctx.done(
    `Task worker handled ${task.id} attempt ${attemptId}; result is ${claim}. Agent result: ${message}`,
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const sourceRoot = sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const configuredMaxConcurrent = maxConcurrent(ctx.task, trigger);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    configuredMaxConcurrent,
    trigger,
  );

  if (trigger?.type === "project.task.assigned") {
    return runAssignedMode(
      ctx,
      appDir,
      projectDir,
      sourceRoot,
      config,
      trigger,
    );
  }

  return ctx.done(
    `Task worker ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
  );
}

if (import.meta.main) {
  if (process.env.MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT !== "1") {
    console.error(
      "Direct workflow entrypoint is disabled by default. Set MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT=1 to run it.",
    );
    process.exit(0);
  }
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer\nmaxConcurrent: 3",
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
