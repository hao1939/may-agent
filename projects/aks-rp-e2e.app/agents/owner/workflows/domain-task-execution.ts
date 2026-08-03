import { spawnSync } from "node:child_process";
import {
  projectAppTaskHandlerResultSchema,
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import { integrateDirectlyIntoDev } from "./lib/direct-dev-integration.js";
import {
  isRunnableScenarioNormalization,
  scenarioNormalizationInvariant,
  type ScenarioNormalizationInput,
} from "./lib/scenario-normalization-invariant.js";
import {
  pipelineWaitCondition,
  reconcileSpecLive,
} from "./spec-live-reconciliation.js";

export const name = "domain-task-execution";
export const description =
  "Execute one bounded AKS domain patch in its task worktree and integrate accepted changes directly into dev.";
export const workspace = "task";

function gitValue(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return (result.stdout ?? "").trim();
}

function optionalGitValue(cwd: string, ...args: string[]): string | null {
  try {
    return gitValue(cwd, ...args);
  } catch {
    return null;
  }
}

function workspaceChanges(cwd: string): string {
  return gitValue(cwd, "status", "--porcelain=v1", "--untracked-files=all");
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
    if (char === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

type ReconciliationTaskPayload = {
  taskId?: unknown;
  input?: unknown;
  children?: {
    live?: unknown;
  };
};

function reconciliationTaskPayload(
  raw: string,
): ReconciliationTaskPayload | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
  if (!object) return null;
  try {
    return JSON.parse(object) as ReconciliationTaskPayload;
  } catch {
    return null;
  }
}

export function reconciliationTaskId(raw: string): string | null {
  const taskId = reconciliationTaskPayload(raw)?.taskId;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
}

function reconciliationTaskHasLiveChildren(raw: string): boolean {
  const liveChildren = reconciliationTaskPayload(raw)?.children?.live;
  return Array.isArray(liveChildren) && liveChildren.length > 0;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function queuedPipelineRunId(raw: string): string | null {
  const input = reconciliationTaskPayload(raw)?.input;
  if (!input || typeof input !== "object") return null;
  return stringValue(
    (input as Record<string, unknown>).queuedPipelineRunId ??
      (input as Record<string, unknown>).pipelineRunId,
  );
}

function pipelineRunIdFromEvidence(
  result: ProjectAppTaskHandlerResult,
): string | null {
  const runIds = new Set<string>();
  for (const text of [result.summary, ...(result.evidence ?? [])]) {
    if (typeof text !== "string") continue;
    for (const match of text.matchAll(/\bpipeline-run:(\d+)\b/g)) {
      runIds.add(match[1]);
    }
  }
  if (runIds.size !== 1) return null;
  return [...runIds][0] ?? null;
}

function exactPipelineWaitCoverage(
  rawTask: string,
  result: ProjectAppTaskHandlerResult,
): ProjectAppTaskHandlerResult | null {
  const runId =
    queuedPipelineRunId(rawTask) ?? pipelineRunIdFromEvidence(result);
  if (!runId) return null;
  return {
    ...result,
    conditions: [pipelineWaitCondition(runId)],
    evidence: [
      ...(result.evidence ?? []),
      `pipeline-wait-recovered:${runId}`,
    ],
  };
}

function selfTargetingActionIndexes(
  result: ProjectAppTaskHandlerResult,
  taskId: string | null,
): number[] {
  if (!taskId) return [];
  return (result.actions ?? []).flatMap((action, index) =>
    action.kind !== "create-task" && action.taskId === taskId ? [index] : [],
  );
}

async function correctSelfTargetingActions(input: {
  ctx: WorkflowContext;
  currentTaskId: string | null;
  phase: string;
  sessionId: string;
  result: ProjectAppTaskHandlerResult;
}): Promise<ProjectAppTaskHandlerResult> {
  const indexes = selfTargetingActionIndexes(input.result, input.currentTaskId);
  if (!indexes.length || !input.currentTaskId) return input.result;

  const prompt = [
    `Correct the structured result from the ${input.phase} phase; do not redo the domain work.`,
    `The result cannot be applied because actions ${indexes.join(", ")} target the currently running task ${input.currentTaskId}.`,
    "The workflow result itself converges or waits the current task. Remove every action targeting that task and preserve your domain judgment and evidence.",
    "Actions may still target other tasks when independently necessary. If changing the current task definition is essential, return needs-owner with exact evidence instead of a self-targeting action.",
    "Previous result:",
    JSON.stringify(input.result, null, 2),
  ].join("\n\n");
  const correction = input.ctx.runAgentSession
    ? await input.ctx.runAgentSession(
        input.ctx.agent,
        prompt,
        input.sessionId,
        {
          timeoutMs: 600_000,
          schema: projectAppTaskHandlerResultSchema,
        },
      )
    : await input.ctx.runAgent(input.ctx.agent, prompt, {
        timeoutMs: 600_000,
        schema: projectAppTaskHandlerResultSchema,
      });
  if (correction.status === "error" || correction.status === "interrupted") {
    return {
      state: "needs-owner",
      summary: `The ${input.phase} result targeted its own running task and the correction session failed`,
      evidence: [
        `task:${input.currentTaskId}`,
        `invalid-action-indexes:${indexes.join(",")}`,
        `correction-session:${correction.sessionId}`,
      ],
    };
  }

  const corrected = correction.structuredResult as ProjectAppTaskHandlerResult;
  const remaining = selfTargetingActionIndexes(corrected, input.currentTaskId);
  if (remaining.length) {
    return {
      state: "needs-owner",
      summary: `The ${input.phase} result still targets its own running task after correction`,
      evidence: [
        `task:${input.currentTaskId}`,
        `invalid-action-indexes:${remaining.join(",")}`,
        `correction-session:${correction.sessionId}`,
      ],
    };
  }
  return corrected;
}

function waitsOnDirectChild(
  result: ProjectAppTaskHandlerResult,
  taskId: string | null,
): boolean {
  if (!taskId) return false;
  return (result.actions ?? []).some(
    (action) => action.kind === "create-task" && action.parentId === taskId,
  );
}

function convergedWithLiveChildProblem(
  result: ProjectAppTaskHandlerResult,
  taskId: string | null,
  hasExistingLiveChild: boolean,
): string | null {
  if (result.state !== "converged") return null;
  if (!hasExistingLiveChild && !waitsOnDirectChild(result, taskId)) return null;
  return `Converged result for ${taskId ?? "the current task"} cannot be applied while it has or creates a live direct child`;
}

async function correctConvergedWithLiveChild(input: {
  ctx: WorkflowContext;
  currentTaskId: string | null;
  hasExistingLiveChild: boolean;
  phase: string;
  sessionId: string;
  result: ProjectAppTaskHandlerResult;
}): Promise<ProjectAppTaskHandlerResult> {
  let ownerResult = input.result;
  let sessionId = input.sessionId;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const problem = convergedWithLiveChildProblem(
      ownerResult,
      input.currentTaskId,
      input.hasExistingLiveChild,
    );
    if (!problem) return ownerResult;

    const prompt = [
      `Correct the structured result from the ${input.phase} phase; do not redo the domain work.`,
      `Hard validation failure: ${problem}.`,
      "Decide from the current evidence whether the child work is genuinely required.",
      `If it is required, preserve or create the direct child and return state "waiting" for ${input.currentTaskId ?? "the current task"}; infrastructure will wake the parent after the child changes state.`,
      'If it is not required, remove the child-creating action and return state "converged" with the existing completion evidence.',
      "Do not claim the parent converged while leaving live child work behind.",
      "Previous result:",
      JSON.stringify(ownerResult, null, 2),
    ].join("\n\n");
    const correction = input.ctx.runAgentSession
      ? await input.ctx.runAgentSession(input.ctx.agent, prompt, sessionId, {
          timeoutMs: 600_000,
          schema: projectAppTaskHandlerResultSchema,
        })
      : await input.ctx.runAgent(input.ctx.agent, prompt, {
          timeoutMs: 600_000,
          schema: projectAppTaskHandlerResultSchema,
        });
    if (correction.status === "error" || correction.status === "interrupted") {
      return {
        state: "needs-owner",
        summary: `The ${input.phase} result could not be corrected to a valid parent/child state`,
        evidence: [
          `task:${input.currentTaskId ?? "unknown"}`,
          `child-state-validation:${attempt}`,
          `correction-session:${correction.sessionId}`,
        ],
      };
    }

    sessionId = correction.sessionId;
    ownerResult = await correctSelfTargetingActions({
      ctx: input.ctx,
      currentTaskId: input.currentTaskId,
      phase: `${input.phase} parent-child correction`,
      sessionId,
      result: correction.structuredResult as ProjectAppTaskHandlerResult,
    });
  }

  const problem = convergedWithLiveChildProblem(
    ownerResult,
    input.currentTaskId,
    input.hasExistingLiveChild,
  );
  if (!problem) return ownerResult;
  return {
    state: "needs-owner",
    summary: `The ${input.phase} result still contradicts its live child state after correction`,
    evidence: [
      ...(ownerResult.evidence ?? []),
      `task:${input.currentTaskId ?? "unknown"}`,
      "child-state-validation:failed",
      `child-state-problem:${problem}`,
    ],
  };
}

function waitingCoverageProblem(
  result: ProjectAppTaskHandlerResult,
  taskId: string | null,
  hasExistingLiveChild: boolean,
): string | null {
  if (result.state !== "waiting") return null;
  if ((result.conditions?.length ?? 0) > 0) return null;
  if (waitsOnDirectChild(result, taskId)) return null;
  if (hasExistingLiveChild) return null;
  return `Waiting result for ${taskId ?? "the current task"} requires one exact Condition or a direct child task created with parentId ${taskId ?? "<current-task-id>"}`;
}

async function correctWaitingCoverage(input: {
  ctx: WorkflowContext;
  currentTaskId: string | null;
  hasExistingLiveChild: boolean;
  phase: string;
  sessionId: string;
  result: ProjectAppTaskHandlerResult;
}): Promise<ProjectAppTaskHandlerResult> {
  let ownerResult = input.result;
  let sessionId = input.sessionId;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const problem = waitingCoverageProblem(
      ownerResult,
      input.currentTaskId,
      input.hasExistingLiveChild,
    );
    if (!problem) return ownerResult;

    const exactPipelineWait = exactPipelineWaitCoverage(input.ctx.task, ownerResult);
    if (exactPipelineWait) return exactPipelineWait;

    const prompt = [
      `Correct the structured result from the ${input.phase} phase; do not redo the domain work.`,
      `Hard validation failure: ${problem}.`,
      `If ${input.currentTaskId ?? "the current task"} should keep waiting, either attach one exact machine-observable Condition to the current task or create one direct child task under ${input.currentTaskId ?? "the current task"} that truthfully carries the wait, then return state "waiting" for the parent.`,
      "If your earlier evidence only proves an already-completed holder or stale wait, do not leave the current task waiting without new coverage; either converge the current task or create the replacement direct child that now carries the wait.",
      "Preserve the prior domain judgment and evidence unless the current facts force a different next step.",
      "Previous result:",
      JSON.stringify(ownerResult, null, 2),
    ].join("\n\n");
    const correction = input.ctx.runAgentSession
      ? await input.ctx.runAgentSession(input.ctx.agent, prompt, sessionId, {
          timeoutMs: 600_000,
          schema: projectAppTaskHandlerResultSchema,
        })
      : await input.ctx.runAgent(input.ctx.agent, prompt, {
          timeoutMs: 600_000,
          schema: projectAppTaskHandlerResultSchema,
        });
    if (correction.status === "error" || correction.status === "interrupted") {
      return {
        state: "needs-owner",
        summary: `The ${input.phase} result could not be corrected to an exact wait shape`,
        evidence: [
          `task:${input.currentTaskId ?? "unknown"}`,
          `waiting-validation:${attempt}`,
          `correction-session:${correction.sessionId}`,
        ],
      };
    }

    sessionId = correction.sessionId;
    ownerResult = await correctSelfTargetingActions({
      ctx: input.ctx,
      currentTaskId: input.currentTaskId,
      phase: `${input.phase} wait-shape correction`,
      sessionId,
      result: correction.structuredResult as ProjectAppTaskHandlerResult,
    });
  }

  const problem = waitingCoverageProblem(
    ownerResult,
    input.currentTaskId,
    input.hasExistingLiveChild,
  );
  if (!problem) return ownerResult;
  return {
    state: "needs-owner",
    summary: `The ${input.phase} result still lacks exact waiting coverage after correction`,
    evidence: [
      ...(ownerResult.evidence ?? []),
      `task:${input.currentTaskId ?? "unknown"}`,
      `waiting-validation:failed`,
      `waiting-problem:${problem}`,
    ],
  };
}

async function completeScenarioNormalization(input: {
  ctx: WorkflowContext;
  currentTaskId: string | null;
  sessionId: string;
  normalizationInput: ScenarioNormalizationInput | undefined;
  result: ProjectAppTaskHandlerResult;
}): Promise<ProjectAppTaskHandlerResult> {
  const scenarioTestPath =
    typeof input.normalizationInput?.scenarioTestPath === "string"
      ? input.normalizationInput.scenarioTestPath.trim()
      : "";
  if (!scenarioTestPath || input.result.state !== "converged") {
    return input.result;
  }

  let ownerResult = input.result;
  let sessionId = input.sessionId;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const invariant = scenarioNormalizationInvariant(
      input.ctx.workspaceDir!,
      input.normalizationInput,
    );
    if (!invariant?.stillListed) return ownerResult;

    const prompt = [
      "Continue the same bounded scenario-normalization task; it is not complete yet.",
      `The strict inventory still lists ${scenarioTestPath}.`,
      "A sibling .test.ts wrapper that still imports the plain .ts carrier is progress, not completion.",
      "Preserve behavior and active spec coverage, move required code into the direct .test.ts implementation or a shared library outside features/*/tests/*.ts, remove the plain carrier, rerun scoped checks plus the strict inventory, commit all accepted changes, and leave the worktree clean.",
      "Do not create another task, branch, worktree, push, PR, or app-state change. Return the structured result for this same task.",
      "Task:",
      input.ctx.task,
    ].join("\n\n");
    const correction = input.ctx.runAgentSession
      ? await input.ctx.runAgentSession(input.ctx.agent, prompt, sessionId, {
          timeoutMs: 1_800_000,
          schema: projectAppTaskHandlerResultSchema,
        })
      : await input.ctx.runAgent(input.ctx.agent, prompt, {
          timeoutMs: 1_800_000,
          schema: projectAppTaskHandlerResultSchema,
        });
    if (correction.status === "error" || correction.status === "interrupted") {
      return {
        state: "needs-owner",
        summary: "Scenario normalization correction session failed",
        evidence: [
          `task:${input.currentTaskId ?? "unknown"}`,
          `scenario-test-path:${scenarioTestPath}`,
          `correction-session:${correction.sessionId}`,
          `correction-attempt:${attempt}`,
        ],
      };
    }
    sessionId = correction.sessionId;
    ownerResult = await correctSelfTargetingActions({
      ctx: input.ctx,
      currentTaskId: input.currentTaskId,
      phase: "scenario normalization correction",
      sessionId,
      result: correction.structuredResult as ProjectAppTaskHandlerResult,
    });
    if (ownerResult.state !== "converged") return ownerResult;
  }

  const invariant = scenarioNormalizationInvariant(
    input.ctx.workspaceDir!,
    input.normalizationInput,
  );
  return {
    state: "needs-owner",
    summary:
      "Scenario normalization remains incomplete after three correction turns",
    evidence: [
      ...(ownerResult.evidence ?? []),
      `task:${input.currentTaskId ?? "unknown"}`,
      `scenario-test-path:${scenarioTestPath}`,
      `strict-inventory-still-lists:${String(invariant?.stillListed ?? "unknown")}`,
    ],
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.workspaceDir || ctx.workspaceDir === ctx.projectDir) {
    return ctx.blocked(
      "Domain task execution requires a prepared task worktree",
      {
        workspaceDir: ctx.workspaceDir ?? null,
        projectDir: ctx.projectDir ?? null,
      },
    );
  }

  const currentTaskId = reconciliationTaskId(ctx.task);
  const taskPayload = reconciliationTaskPayload(ctx.task);
  const hasExistingLiveChild = reconciliationTaskHasLiveChildren(ctx.task);
  const normalizationInput = taskPayload?.input;
  if (isRunnableScenarioNormalization(normalizationInput)) {
    return reconcileSpecLive(ctx);
  }
  const attemptBaseCommit = optionalGitValue(
    ctx.workspaceDir,
    "rev-parse",
    "HEAD",
  );
  const prompt = [
    "Execute the bounded AKS reconciliation task below.",
    "",
    `Your task-owned Git worktree is ${ctx.workspaceDir}.`,
    "All relative filesystem tools already run there. Do not create another branch or worktree and do not switch the shared canonical checkout.",
    "Inspect current source and task evidence, make only the smallest accepted domain change, run scoped verification, and commit every accepted file change on the supplied task branch.",
    "This workflow publishes real domain source patches. For a disposition recheck, repo-ref wake, or unchanged wait, return hot evidence in the structured result and leave the branch unchanged; never commit an evidence-only memo merely to record the review.",
    "Do not push or create a pull request. After your converged judgment, this workflow integrates the clean accepted branch directly into dev; a dev conflict returns to you on the same task for repair.",
    "A converged result must leave the worktree clean. If work cannot be committed cleanly, return needs-owner with exact recovery evidence; use waiting only for an external fact with an exact Condition.",
    `If the truthful next step is carried by another task, create or update that holder as a direct child of ${currentTaskId ?? "the current task"} and return waiting only after the child exists or the current task has its own exact Condition.`,
    'If you already have an exact queued Azure DevOps run id, preserve that wait on this same task with condition type "pipeline-run.state", subject "pipeline-run:<runId>", and expected { field: "state", anyOf: ["completed"] } instead of prose-only waiting.',
    `The currently running task is ${currentTaskId ?? "identified in the Reconciliation Task payload"}. The workflow result itself updates this task. Never return an update-task, close-task, or unblock-task action targeting it.`,
    "Only the generic reconciler may change task state. Use typed actions for other tasks that independently need a change.",
    'For a master-validation product-recovery wait, use the semantic pass event: type pipeline.spec.observed, subject project:aks-rp-e2e, expected { specId: "<spec id>", status: "pass", sourceBranch: "refs/heads/main" }. The project subject is the routing scope; the expected fields select the exact proof.',
    "",
    ctx.task,
  ].join("\n");

  const result = await ctx.runAgent(ctx.agent, prompt, {
    timeoutMs: 1_800_000,
    schema: projectAppTaskHandlerResultSchema,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("AKS domain task session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
      workspaceDir: ctx.workspaceDir,
    });
  }

  let ownerResult = await correctSelfTargetingActions({
    ctx,
    currentTaskId,
    phase: "domain execution",
    sessionId: result.sessionId,
    result: result.structuredResult as ProjectAppTaskHandlerResult,
  });
  ownerResult = await correctConvergedWithLiveChild({
    ctx,
    currentTaskId,
    hasExistingLiveChild,
    phase: "domain execution",
    sessionId: result.sessionId,
    result: ownerResult,
  });
  ownerResult = await correctWaitingCoverage({
    ctx,
    currentTaskId,
    hasExistingLiveChild,
    phase: "domain execution",
    sessionId: result.sessionId,
    result: ownerResult,
  });
  ownerResult = await completeScenarioNormalization({
    ctx,
    currentTaskId,
    sessionId: result.sessionId,
    normalizationInput,
    result: ownerResult,
  });
  ownerResult = await correctConvergedWithLiveChild({
    ctx,
    currentTaskId,
    hasExistingLiveChild,
    phase: "scenario normalization correction",
    sessionId: result.sessionId,
    result: ownerResult,
  });
  ownerResult = await correctWaitingCoverage({
    ctx,
    currentTaskId,
    hasExistingLiveChild,
    phase: "domain execution",
    sessionId: result.sessionId,
    result: ownerResult,
  });
  if (ownerResult.state !== "converged") {
    return ctx.done(ownerResult.summary, ownerResult);
  }

  if (!attemptBaseCommit) {
    return ctx.done("Domain task workspace has no readable attempt baseline", {
      state: "needs-owner",
      summary: "Domain task workspace has no readable attempt baseline",
      evidence: [
        ...(ownerResult.evidence ?? []),
        `workspace:${ctx.workspaceDir}`,
      ],
    });
  }

  const workspaceDir = ctx.workspaceDir;
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  if (workspaceChanges(workspaceDir)) {
    return ctx.done("Domain task left uncommitted workspace changes", {
      state: "needs-owner",
      summary: "Domain task left uncommitted workspace changes",
      evidence: [`workspace:${workspaceDir}`],
    });
  }

  const sourceBranch = gitValue(
    workspaceDir,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  );
  let sourceCommit = gitValue(workspaceDir, "rev-parse", "HEAD");
  let integration = integrateDirectlyIntoDev({
    repoDir,
    workspaceDir,
    sourceBranch,
    sourceCommit,
    taskBaseCommit: attemptBaseCommit,
  });

  if (
    integration.state === "conflict" ||
    integration.state === "requires-replay"
  ) {
    if (integration.state === "requires-replay") {
      gitValue(repoDir, "fetch", "origin", "dev");
    }
    const replayBaseCommit =
      integration.state === "conflict"
        ? integration.replayBaseCommit
        : gitValue(repoDir, "rev-parse", "origin/dev");
    const replayFacts =
      integration.state === "conflict"
        ? [
            `Replaying this turn's task-owned commits onto ${integration.targetRef}@${replayBaseCommit} is already in progress.`,
            `Conflict evidence: ${integration.error}`,
            "Resolve only this task's conflicting files and continue the cherry-pick.",
          ]
        : [
            `The retained source ${integration.sourceCommit} cannot be isolated from attempt baseline ${integration.taskBaseCommit}.`,
            `Structured replay reason: ${integration.reason}.`,
            ...(integration.mergeCommits.length
              ? [
                  `Merge commits in the attempted task range: ${integration.mergeCommits.join(",")}.`,
                ]
              : []),
            `Replay only this task's owned change onto ${integration.targetRef}@${replayBaseCommit}; do not merge stale branch history wholesale.`,
          ];
    const conflictResult = await ctx.runAgent(
      ctx.agent,
      [
        "Reconcile the direct dev lineage for the same bounded AKS task.",
        `Work only in ${workspaceDir}.`,
        ...replayFacts,
        "Preserve the accepted task intent, rerun scoped verification, and leave one clean linear commit lineage descending from the named origin/dev commit.",
        "Do not push, create a PR, create another task, or edit app state. Return the same structured task result when the bounded work is truthful.",
        "Task:",
        ctx.task,
      ].join("\n\n"),
      {
        timeoutMs: 1_800_000,
        schema: projectAppTaskHandlerResultSchema,
      },
    );
    if (
      conflictResult.status === "error" ||
      conflictResult.status === "interrupted"
    ) {
      return ctx.blocked("AKS domain integration repair session failed", {
        sessionId: conflictResult.sessionId,
        status: conflictResult.status,
        summary: conflictResult.lastAssistantText,
        workspaceDir,
      });
    }
    let conflictOwnerResult = await correctSelfTargetingActions({
      ctx,
      currentTaskId,
      phase: "integration conflict repair",
      sessionId: conflictResult.sessionId,
      result: conflictResult.structuredResult as ProjectAppTaskHandlerResult,
    });
    conflictOwnerResult = await correctWaitingCoverage({
      ctx,
      currentTaskId,
      hasExistingLiveChild,
      phase: "integration conflict repair",
      sessionId: conflictResult.sessionId,
      result: conflictOwnerResult,
    });
    if (conflictOwnerResult.state !== "converged") {
      return ctx.done(conflictOwnerResult.summary, conflictOwnerResult);
    }
    if (workspaceChanges(workspaceDir)) {
      return ctx.done("Domain integration repair left uncommitted changes", {
        state: "needs-owner",
        summary: "Domain integration repair left uncommitted changes",
        evidence: [
          ...(conflictOwnerResult.evidence ?? []),
          `workspace:${workspaceDir}`,
        ],
      });
    }
    ownerResult = {
      ...ownerResult,
      summary: conflictOwnerResult.summary,
      evidence: [
        ...(ownerResult.evidence ?? []),
        ...(conflictOwnerResult.evidence ?? []),
      ],
      actions: [
        ...(ownerResult.actions ?? []),
        ...(conflictOwnerResult.actions ?? []),
      ],
    };
    sourceCommit = gitValue(workspaceDir, "rev-parse", "HEAD");
    const baselineInSource = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", replayBaseCommit, sourceCommit],
      { cwd: workspaceDir, encoding: "utf8" },
    );
    const mergeCommits = gitValue(
      workspaceDir,
      "rev-list",
      "--merges",
      `${replayBaseCommit}..${sourceCommit}`,
    );
    if (baselineInSource.status !== 0 || mergeCommits) {
      return ctx.done("Domain integration repair left an invalid lineage", {
        state: "needs-owner",
        summary: "Domain integration repair left an invalid lineage",
        evidence: [
          ...(ownerResult.evidence ?? []),
          `replay-base:${replayBaseCommit}`,
          `source-commit:${sourceCommit}`,
          ...(mergeCommits ? [`merge-commits:${mergeCommits}`] : []),
        ],
      });
    }
    integration = integrateDirectlyIntoDev({
      repoDir,
      workspaceDir,
      sourceBranch,
      sourceCommit,
      taskBaseCommit: replayBaseCommit,
    });
  }

  if (integration.state === "unchanged") {
    const summary = `${ownerResult.summary} No task-owned commit was created in this bounded turn; dev remained at ${integration.targetCommit}.`;
    return ctx.done(summary, {
      ...ownerResult,
      state: "converged",
      summary,
      evidence: [
        ...(ownerResult.evidence ?? []),
        `source-branch:${sourceBranch}`,
        `source-commit:${sourceCommit}`,
        `target-ref:${integration.targetRef}`,
        `target-commit:${integration.targetCommit}`,
        "integration:no-task-owned-commit",
      ],
    });
  }

  if (integration.state !== "integrated") {
    return ctx.done(
      "Domain task could not integrate its verified branch into dev",
      {
        state: "needs-owner",
        summary: "Domain task could not integrate its verified branch into dev",
        evidence: [
          ...(ownerResult.evidence ?? []),
          `source-branch:${sourceBranch}`,
          `source-commit:${sourceCommit}`,
          `target-ref:${integration.targetRef}`,
          `integration-error:${
            integration.state === "requires-replay"
              ? `replay remained unresolved (${integration.reason})`
              : integration.error
          }`,
        ],
      },
    );
  }

  sourceCommit = integration.sourceCommit;

  const summary = `${ownerResult.summary} Integrated ${sourceCommit} directly into dev@${integration.targetCommit}.`;
  return ctx.done(summary, {
    ...ownerResult,
    state: "converged",
    summary,
    evidence: [
      ...(ownerResult.evidence ?? []),
      `source-branch:${sourceBranch}`,
      `source-commit:${sourceCommit}`,
      `target-ref:${integration.targetRef}`,
      `integrated-commit:${integration.targetCommit}`,
    ],
  });
}
