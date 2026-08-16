import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import {
  projectAppTaskHandlerResultSchema,
  type ProjectAppTaskHandlerResult,
  type ProjectAppTaskVerificationContext,
  type ProjectAppTaskVerificationResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk/legacy";
import {
  AKS_DIRECT_DEV_VALIDATION_COMMANDS,
  integrateDirectlyIntoDev,
} from "./lib/direct-dev-integration.js";
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

export function assertIsolatedWriteDispatch(input: {
  workspaceDir?: string | null;
  projectDir: string;
  cwd: string;
}): void {
  if (!input.workspaceDir || !existsSync(input.workspaceDir)) {
    throw new Error(
      `Write-producing agent dispatch requires an existing task workspace: ${input.workspaceDir ?? "missing"}`,
    );
  }

  const workspace = realpathSync(input.workspaceDir);
  const project = realpathSync(input.projectDir);
  const cwd = realpathSync(input.cwd);
  if (workspace === project) {
    throw new Error(
      `Write-producing agent dispatch refused canonical workspace ${workspace}`,
    );
  }
  if (cwd === project) {
    throw new Error(
      `Write-producing agent dispatch refused canonical execution cwd ${cwd}`,
    );
  }
}

function guardWriteDispatch(ctx: WorkflowContext): void {
  assertIsolatedWriteDispatch({
    workspaceDir: ctx.workspaceDir,
    projectDir: ctx.projectDir,
    cwd: ctx.workspaceDir ?? ctx.projectDir,
  });
}

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
  outcome?: unknown;
  acceptance?: unknown;
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

function reconciliationTaskLiveChildren(raw: string): unknown[] {
  const liveChildren = reconciliationTaskPayload(raw)?.children?.live;
  return Array.isArray(liveChildren) ? liveChildren : [];
}

function reconciliationTaskHasLiveChildren(raw: string): boolean {
  return reconciliationTaskLiveChildren(raw).length > 0;
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

function requiredAcceptedSourceCommit(raw: string): string | null {
  const input = reconciliationTaskPayload(raw)?.input;
  if (!input || typeof input !== "object") return null;
  const values = input as Record<string, unknown>;
  const commit = stringValue(
    values.acceptedCommit ?? values.acceptedRecoveryCommit,
  );
  return commit && /^[0-9a-f]{40}$/i.test(commit) ? commit : null;
}

function taskInput(raw: string): Record<string, unknown> | null {
  const input = reconciliationTaskPayload(raw)?.input;
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : null;
}

function requiresWatchdogSafeBulkRegeneration(raw: string): boolean {
  const payload = reconciliationTaskPayload(raw);
  if (!payload) return false;
  const input = taskInput(raw);
  if (
    input?.bulkRegeneration === true ||
    input?.watchdogSafeBulkRegeneration === true
  ) {
    return true;
  }

  const acceptance = Array.isArray(payload.acceptance)
    ? payload.acceptance.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const corpus = [
    stringValue(payload.taskId),
    stringValue(payload.outcome),
    ...acceptance,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n")
    .toLowerCase();
  const requestsRegeneration =
    /\bregenerat(?:e|es|ed|ing|ion)\b|\bdeterministic artifacts?\b/.test(
      corpus,
    );
  const requestsBulkScope =
    /\bbulk\b|\brepository-wide\b|\ball\s+\d+\b|\bevery\s+(?:stale\s+)?(?:package|artifact|plan)\b|\b\d+\/\d+\s+fresh\b/.test(
      corpus,
    );
  return requestsRegeneration && requestsBulkScope;
}

function requestedWorkspaceDir(raw: string): string | null {
  return stringValue(taskInput(raw)?.workspaceDir);
}

type CleanRetainedAuthority = {
  workspaceDir: string;
  head: string;
};

function cleanRetainedAuthority(
  raw: string,
):
  | { declared: false }
  | { declared: true; value: CleanRetainedAuthority | null } {
  const input = taskInput(raw);
  const workspaceDir = stringValue(input?.cleanRetainedWorktree);
  const head = stringValue(input?.cleanRetainedHead);
  if (!workspaceDir && !head) return { declared: false };
  if (!workspaceDir || !head || !/^[0-9a-f]{40}$/i.test(head)) {
    return { declared: true, value: null };
  }
  return { declared: true, value: { workspaceDir, head } };
}

type PreservedWorkspaceAdoption = {
  workspaceDir: string;
  expectedBranch: string;
  expectedHead: string;
  expectedDirty?: boolean;
  expectedOperation?: "none" | "merge" | "rebase" | "cherry-pick" | "revert";
};

function preservedWorkspaceAdoption(raw: string): unknown {
  return taskInput(raw)?.preservedWorkspaceAdoption;
}

function canonicalPath(path: string): string {
  const canonical = realpathSync(path);
  if (canonical !== path) {
    throw new Error(
      `workspace path is not canonical: declared=${path} canonical=${canonical}`,
    );
  }
  return canonical;
}

function activeGitOperation(cwd: string): string | null {
  const paths: Array<[string, string]> = [
    ["merge", "MERGE_HEAD"],
    ["rebase", "rebase-merge"],
    ["rebase", "rebase-apply"],
    ["cherry-pick", "CHERRY_PICK_HEAD"],
    ["revert", "REVERT_HEAD"],
  ];
  for (const [operation, gitPath] of paths) {
    const resolved = optionalGitValue(cwd, "rev-parse", "--git-path", gitPath);
    if (resolved && existsSync(resolved)) return operation;
  }
  return null;
}

function recoveryOnlyResult(
  workspaceDir: string,
  ownerResult: ProjectAppTaskHandlerResult,
): ProjectAppTaskHandlerResult {
  const workspace = (() => {
    try {
      return realpathSync(workspaceDir);
    } catch {
      return workspaceDir;
    }
  })();
  const head =
    optionalGitValue(workspaceDir, "rev-parse", "HEAD") ?? "unreadable";
  const branch =
    optionalGitValue(
      workspaceDir,
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    ) ?? "detached-or-unreadable";
  const status = (() => {
    try {
      return workspaceChanges(workspaceDir);
    } catch {
      return "unreadable";
    }
  })();
  const operation = (() => {
    try {
      return activeGitOperation(workspaceDir) ?? "none";
    } catch {
      return "unreadable";
    }
  })();
  return {
    ...ownerResult,
    summary: `Recovery-only non-converged result: ${ownerResult.summary}`,
    evidence: [
      `recovery-worktree:${workspace}`,
      `recovery-head:${head}`,
      `recovery-branch:${branch}`,
      `recovery-status:${status ? "dirty" : "clean"}`,
      `recovery-status-porcelain:${status || "none"}`,
      `recovery-operation:${operation}`,
      ...(ownerResult.evidence ?? []).map(
        (item) => `recovery-owner-evidence:${item}`,
      ),
      "material-success-candidate:none",
    ],
  };
}

type TaskBranchGate =
  | { ok: true; evidence: string[] }
  | { ok: false; summary: string; evidence: string[] };

function requestsUnchangedDisposition(
  result: ProjectAppTaskHandlerResult,
): boolean {
  return result.evidence.includes("disposition:unchanged");
}

function unchangedDispositionGate(input: {
  result: ProjectAppTaskHandlerResult;
  workspaceDir: string;
  expectedWorkspace: string;
  expectedBranch: string;
  baselineCommit: string;
}): TaskBranchGate {
  const workspace = realpathSync(input.workspaceDir);
  const repositoryRoot = realpathSync(
    gitValue(input.workspaceDir, "rev-parse", "--show-toplevel"),
  );
  const branch = gitValue(
    input.workspaceDir,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  );
  const head = gitValue(input.workspaceDir, "rev-parse", "HEAD");
  const status = workspaceChanges(input.workspaceDir);
  const baselineTree = gitValue(
    input.workspaceDir,
    "rev-parse",
    `${input.baselineCommit}^{tree}`,
  );
  const headTree = gitValue(input.workspaceDir, "rev-parse", `${head}^{tree}`);
  const hotEvidence = input.result.evidence.filter(
    (item) =>
      item.startsWith("hot-evidence:") &&
      item.slice("hot-evidence:".length).trim().length > 0,
  );
  const evidence = [
    `task-worktree:${workspace}`,
    `task-branch:${branch}`,
    `task-head:${head}`,
    `task-status:${status ? "dirty" : "clean"}`,
    `unchanged-base-commit:${input.baselineCommit}`,
    `unchanged-base-tree:${baselineTree}`,
    `unchanged-head-tree:${headTree}`,
  ];

  if (workspace !== input.expectedWorkspace || repositoryRoot !== workspace) {
    return {
      ok: false,
      summary: "Unchanged disposition was proven outside the supplied task worktree",
      evidence: [
        ...evidence,
        `expected-task-worktree:${input.expectedWorkspace}`,
        `repository-root:${repositoryRoot}`,
      ],
    };
  }
  if (branch !== input.expectedBranch) {
    return {
      ok: false,
      summary: "Unchanged disposition was proven from the wrong task branch",
      evidence: [...evidence, `expected-task-branch:${input.expectedBranch}`],
    };
  }
  if (status) {
    return {
      ok: false,
      summary: "Unchanged disposition left the task worktree dirty",
      evidence,
    };
  }
  if (baselineTree !== headTree) {
    return {
      ok: false,
      summary: "Unchanged disposition contains a source-changing tree",
      evidence: [...evidence, "material-success-candidate:requires-source-gate"],
    };
  }
  if (hotEvidence.length === 0) {
    return {
      ok: false,
      summary: "Unchanged disposition is missing current review evidence",
      evidence: [...evidence, "required-evidence-prefix:hot-evidence:"],
    };
  }
  return {
    ok: true,
    evidence: [...evidence, "integration:validated-unchanged-disposition"],
  };
}

function patchId(cwd: string, commit: string): string | null {
  const shown = spawnSync(
    "git",
    ["show", "--pretty=format:", "--binary", commit],
    {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  if (shown.status !== 0) return null;
  const hashed = spawnSync("git", ["patch-id", "--stable"], {
    cwd,
    encoding: "utf8",
    input: shown.stdout,
    timeout: 120_000,
  });
  if (hashed.status !== 0) return null;
  return (hashed.stdout ?? "").trim().split(/\s+/)[0] || null;
}

function taskBranchGate(input: {
  workspaceDir: string;
  expectedWorkspace: string;
  expectedBranch: string;
  baselineCommit: string;
  acceptedCommit: string | null;
  allowAcceptedTransplant?: boolean;
}): TaskBranchGate {
  const workspace = realpathSync(input.workspaceDir);
  const repositoryRoot = realpathSync(
    gitValue(input.workspaceDir, "rev-parse", "--show-toplevel"),
  );
  const branch = gitValue(
    input.workspaceDir,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  );
  const head = gitValue(input.workspaceDir, "rev-parse", "HEAD");
  const status = workspaceChanges(input.workspaceDir);
  const sourceCommits = gitValue(
    input.workspaceDir,
    "rev-list",
    "--first-parent",
    "--reverse",
    `${input.baselineCommit}..${head}`,
  )
    .split("\n")
    .filter(Boolean);
  const changedFiles = gitValue(
    input.workspaceDir,
    "diff",
    "--name-only",
    input.baselineCommit,
    head,
  )
    .split("\n")
    .filter(Boolean)
    .sort();
  const mergeCommits = new Set(
    optionalGitValue(
      input.workspaceDir,
      "rev-list",
      "--merges",
      `${input.baselineCommit}..${head}`,
    )
      ?.split("\n")
      .filter(Boolean) ?? [],
  );
  const materialCommits = sourceCommits.filter(
    (commit) => !mergeCommits.has(commit),
  );
  const evidence = [
    `task-worktree:${workspace}`,
    `task-branch:${branch}`,
    `task-head:${head}`,
    `task-status:${status ? "dirty" : "clean"}`,
    `task-source-commits:${sourceCommits.join(",") || "none"}`,
    `task-changed-files:${changedFiles.join(",") || "none"}`,
  ];

  if (workspace !== input.expectedWorkspace || repositoryRoot !== workspace) {
    return {
      ok: false,
      summary:
        "Final source proof was collected outside the supplied task worktree",
      evidence: [
        ...evidence,
        `expected-task-worktree:${input.expectedWorkspace}`,
        `repository-root:${repositoryRoot}`,
      ],
    };
  }
  if (branch !== input.expectedBranch) {
    return {
      ok: false,
      summary: "Final source proof was collected from the wrong task branch",
      evidence: [...evidence, `expected-task-branch:${input.expectedBranch}`],
    };
  }
  if (status) {
    return {
      ok: false,
      summary: "Final task branch is not clean",
      evidence: [...evidence, "material-success-candidate:none"],
    };
  }
  if (sourceCommits.length === 0 && !input.acceptedCommit) {
    return {
      ok: false,
      summary: "Final task branch contains zero accepted source patches",
      evidence: [...evidence, "material-success-candidate:none"],
    };
  }
  if (sourceCommits.length > 0 && materialCommits.length === 0) {
    return {
      ok: false,
      summary:
        "Final task branch contains merge-only ancestry without an accepted source patch",
      evidence: [
        ...evidence,
        `task-merge-commits:${[...mergeCommits].join(",")}`,
        "material-success-candidate:none",
      ],
    };
  }
  if (sourceCommits.length > 0 && changedFiles.length === 0) {
    return {
      ok: false,
      summary: "Final task branch contains no material changed files",
      evidence: [...evidence, "material-success-candidate:none"],
    };
  }
  for (const commit of sourceCommits) {
    if (
      spawnSync("git", ["merge-base", "--is-ancestor", commit, head], {
        cwd: input.workspaceDir,
      }).status !== 0
    ) {
      return {
        ok: false,
        summary: "A task-owned source commit is not reachable from final HEAD",
        evidence: [...evidence, `unreachable-task-source-commit:${commit}`],
      };
    }
  }

  if (input.acceptedCommit) {
    const acceptedReachable =
      spawnSync(
        "git",
        ["merge-base", "--is-ancestor", input.acceptedCommit, head],
        { cwd: input.workspaceDir },
      ).status === 0;
    if (!acceptedReachable) {
      const transplantCommit =
        input.allowAcceptedTransplant && sourceCommits.length === 1
          ? sourceCommits[0]
          : null;
      const acceptedPatch = patchId(input.workspaceDir, input.acceptedCommit);
      const transplantPatch = transplantCommit
        ? patchId(input.workspaceDir, transplantCommit)
        : null;
      if (!acceptedPatch || acceptedPatch !== transplantPatch) {
        return {
          ok: false,
          summary:
            "The accepted source commit is not reachable from final task HEAD and no exact current-lineage transplant was verified",
          evidence: [
            ...evidence,
            `unreachable-accepted-source-commit:${input.acceptedCommit}`,
          ],
        };
      }
      evidence.push(
        `accepted-source-transplant:${input.acceptedCommit}->${transplantCommit}`,
        `accepted-source-patch-id:${acceptedPatch}`,
      );
    } else {
      evidence.push(`reachable-accepted-source-commit:${input.acceptedCommit}`);
    }
  }

  return { ok: true, evidence };
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
    evidence: [...(result.evidence ?? []), `pipeline-wait-recovered:${runId}`],
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
  guardWriteDispatch(input.ctx);
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
    guardWriteDispatch(input.ctx);
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

function liveChildId(child: unknown): string | null {
  if (typeof child === "string" && child.trim()) return child.trim();
  if (!child || typeof child !== "object") return null;
  const record = child as Record<string, unknown>;
  return stringValue(record.taskId ?? record.id);
}

function hasProjectedExistingLiveChild(
  result: ProjectAppTaskHandlerResult,
  existingLiveChildren: unknown[],
): boolean {
  const closedTaskIds = new Set(
    (result.actions ?? [])
      .filter((action) => action.kind === "close-task")
      .map((action) => action.taskId),
  );
  return existingLiveChildren.some((child) => {
    const id = liveChildId(child);
    // Preserve conservative coverage when an older payload does not expose an ID.
    return !id || !closedTaskIds.has(id);
  });
}

function waitingCoverageProblem(
  result: ProjectAppTaskHandlerResult,
  taskId: string | null,
  existingLiveChildren: unknown[],
): string | null {
  if (result.state !== "waiting") return null;
  if ((result.conditions?.length ?? 0) > 0) return null;
  if (waitsOnDirectChild(result, taskId)) return null;
  if (hasProjectedExistingLiveChild(result, existingLiveChildren)) return null;
  return `Waiting result for ${taskId ?? "the current task"} requires one exact Condition or a direct child task created with parentId ${taskId ?? "<current-task-id>"} that remains live after its actions are applied`;
}

async function correctWaitingCoverage(input: {
  ctx: WorkflowContext;
  currentTaskId: string | null;
  existingLiveChildren: unknown[];
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
      input.existingLiveChildren,
    );
    if (!problem) return ownerResult;

    const exactPipelineWait = exactPipelineWaitCoverage(
      input.ctx.task,
      ownerResult,
    );
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
    guardWriteDispatch(input.ctx);
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
    input.existingLiveChildren,
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
    guardWriteDispatch(input.ctx);
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

function exactEvidenceValue(
  result: ProjectAppTaskHandlerResult,
  prefix: string,
): string | null {
  const values = result.evidence
    .filter((item) => item.startsWith(prefix))
    .map((item) => item.slice(prefix.length).trim())
    .filter(Boolean);
  return values.length === 1 ? values[0] : null;
}

function verificationRejected(
  result: ProjectAppTaskHandlerResult,
  summary: string,
  finding: string,
  evidence: string[] = [],
): ProjectAppTaskVerificationResult {
  return {
    accepted: false,
    summary: `Domain task convergence rejected: ${summary}`,
    evidence: [
      ...result.evidence,
      `verification-finding:${finding}`,
      ...evidence,
    ],
  };
}

export async function verify(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
): Promise<ProjectAppTaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: true,
      summary: `Domain task ${result.state} disposition does not claim source convergence.`,
      evidence: [...result.evidence],
    };
  }

  if (result.evidence.includes("integration:no-task-owned-commit")) {
    return verificationRejected(
      result,
      "the result explicitly records that no task-owned commit was created",
      "no-task-owned-commit",
    );
  }

  let workspace: string;
  let projectDir: string;
  let repositoryRoot: string;
  try {
    workspace = realpathSync(context.workspaceDir);
    projectDir = realpathSync(context.projectDir);
    repositoryRoot = realpathSync(
      gitValue(workspace, "rev-parse", "--show-toplevel"),
    );
  } catch (error) {
    return verificationRejected(
      result,
      "the task worktree cannot be resolved",
      "unreadable-task-worktree",
      [error instanceof Error ? error.message : String(error)],
    );
  }

  const claimedWorkspace = exactEvidenceValue(result, "task-worktree:");
  if (
    workspace === projectDir ||
    repositoryRoot !== workspace ||
    !claimedWorkspace ||
    claimedWorkspace !== workspace
  ) {
    return verificationRejected(
      result,
      "source proof does not identify the supplied isolated task worktree",
      "wrong-task-worktree",
      [
        `verification-worktree:${workspace}`,
        `verification-repository-root:${repositoryRoot}`,
        `verification-claimed-worktree:${claimedWorkspace ?? "missing"}`,
      ],
    );
  }

  let status: string;
  try {
    status = workspaceChanges(workspace);
  } catch (error) {
    return verificationRejected(
      result,
      "the task worktree status cannot be read",
      "unreadable-task-worktree-status",
      [error instanceof Error ? error.message : String(error)],
    );
  }
  if (status) {
    return verificationRejected(
      result,
      "the task worktree is dirty",
      "dirty-task-worktree",
      [`verification-status-porcelain:${status}`],
    );
  }

  if (result.evidence.includes("integration:validated-unchanged-disposition")) {
    const claimedBranch = exactEvidenceValue(result, "task-branch:");
    const claimedHead = exactEvidenceValue(result, "task-head:");
    const claimedBase = exactEvidenceValue(result, "unchanged-base-commit:");
    const claimedBaseTree = exactEvidenceValue(result, "unchanged-base-tree:");
    const claimedHeadTree = exactEvidenceValue(result, "unchanged-head-tree:");
    const branch = optionalGitValue(
      workspace,
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    );
    const head = optionalGitValue(workspace, "rev-parse", "HEAD");
    const baseTree = claimedBase
      ? optionalGitValue(workspace, "rev-parse", `${claimedBase}^{tree}`)
      : null;
    const headTree = head
      ? optionalGitValue(workspace, "rev-parse", `${head}^{tree}`)
      : null;
    const hasHotEvidence = result.evidence.some((item) =>
      item.startsWith("hot-evidence:"),
    );
    if (
      !hasHotEvidence ||
      !claimedBranch ||
      claimedBranch !== branch ||
      !claimedHead ||
      claimedHead !== head ||
      !claimedBase ||
      !/^[0-9a-f]{40}$/i.test(claimedBase) ||
      !claimedBaseTree ||
      claimedBaseTree !== baseTree ||
      !claimedHeadTree ||
      claimedHeadTree !== headTree ||
      baseTree !== headTree
    ) {
      return verificationRejected(
        result,
        "the unchanged disposition no longer matches its exact clean branch and tree proof",
        "invalid-unchanged-disposition-proof",
        [
          `verification-branch:${branch ?? "unresolved"}`,
          `verification-head:${head ?? "unresolved"}`,
          `verification-base-tree:${baseTree ?? "unresolved"}`,
          `verification-head-tree:${headTree ?? "unresolved"}`,
          `verification-hot-evidence:${hasHotEvidence ? "present" : "missing"}`,
        ],
      );
    }
    return {
      accepted: true,
      summary: `Accepted validated unchanged disposition at ${head}.`,
      evidence: [
        ...result.evidence,
        `verification-worktree:${workspace}`,
        `verification-branch:${branch}`,
        `verification-head:${head}`,
        "verification-status:clean",
        "verification-unchanged-disposition:accepted",
      ],
    };
  }

  const acceptedCommit = exactEvidenceValue(result, "source-commit:");
  if (!acceptedCommit || !/^[0-9a-f]{40}$/i.test(acceptedCommit)) {
    return verificationRejected(
      result,
      "one exact accepted source commit is required",
      "missing-accepted-source-commit",
    );
  }

  const ownedCommits = exactEvidenceValue(result, "task-source-commits:")
    ?.split(",")
    .map((commit) => commit.trim())
    .filter(Boolean);
  if (
    !ownedCommits?.length ||
    ownedCommits.some((commit) => !/^[0-9a-f]{40}$/i.test(commit))
  ) {
    return verificationRejected(
      result,
      "the task-owned source commit set is missing or malformed",
      "invalid-task-source-commits",
    );
  }

  const commitExists = spawnSync(
    "git",
    ["cat-file", "-e", `${acceptedCommit}^{commit}`],
    { cwd: workspace, encoding: "utf8", timeout: 120_000 },
  );
  const commitFiles = optionalGitValue(
    workspace,
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    acceptedCommit,
  );
  if (commitExists.status !== 0 || !commitFiles) {
    return verificationRejected(
      result,
      "the accepted source commit is missing or contains no source change",
      "missing-or-empty-accepted-source-commit",
      [`accepted-source-commit:${acceptedCommit}`],
    );
  }

  let provenanceSource: string | null = null;
  if (!ownedCommits.includes(acceptedCommit)) {
    const provenance = exactEvidenceValue(result, "integration-provenance:");
    const match = provenance?.match(/^([0-9a-f]{40})->([0-9a-f]{40})$/i);
    if (
      !match ||
      match[2] !== acceptedCommit ||
      !ownedCommits.includes(match[1])
    ) {
      return verificationRejected(
        result,
        "the accepted integration commit has no explicit task-owned provenance chain",
        "accepted-commit-not-task-owned",
        [`accepted-source-commit:${acceptedCommit}`],
      );
    }

    provenanceSource = match[1];
    const sourceExists = spawnSync(
      "git",
      ["cat-file", "-e", `${provenanceSource}^{commit}`],
      { cwd: workspace, encoding: "utf8", timeout: 120_000 },
    );
    const sourcePatch =
      sourceExists.status === 0 ? patchId(workspace, provenanceSource) : null;
    const acceptedPatch = patchId(workspace, acceptedCommit);
    if (!sourcePatch || sourcePatch !== acceptedPatch) {
      return verificationRejected(
        result,
        "the accepted integration commit is not a stable patch-equivalent replay of its task-owned source",
        "integration-provenance-patch-mismatch",
        [
          `provenance-source-commit:${provenanceSource}`,
          `provenance-source-patch-id:${sourcePatch ?? "unresolved"}`,
          `accepted-source-patch-id:${acceptedPatch ?? "unresolved"}`,
        ],
      );
    }
  }

  const fetch = spawnSync("git", ["fetch", "origin", "dev"], {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (fetch.status !== 0) {
    return verificationRejected(
      result,
      "origin/dev could not be freshly fetched",
      "origin-dev-fetch-failed",
      [fetch.stderr?.trim() || fetch.stdout?.trim() || "git fetch failed"],
    );
  }

  const originDev = optionalGitValue(projectDir, "rev-parse", "origin/dev");
  const integratedCommit = exactEvidenceValue(result, "integrated-commit:");
  if (
    !originDev ||
    !integratedCommit ||
    !/^[0-9a-f]{40}$/i.test(integratedCommit)
  ) {
    return verificationRejected(
      result,
      "exact integrated origin/dev proof is missing",
      "missing-integrated-commit",
      [`fetched-origin-dev:${originDev ?? "unresolved"}`],
    );
  }
  if (integratedCommit !== acceptedCommit) {
    return verificationRejected(
      result,
      "the accepted source commit does not identify the claimed integration commit",
      "integration-provenance-target-mismatch",
      [
        `accepted-source-commit:${acceptedCommit}`,
        `claimed-integrated-commit:${integratedCommit}`,
      ],
    );
  }

  const sourceIntegrated = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", acceptedCommit, "origin/dev"],
    { cwd: projectDir, encoding: "utf8", timeout: 120_000 },
  );
  const integrationObserved = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", integratedCommit, "origin/dev"],
    { cwd: projectDir, encoding: "utf8", timeout: 120_000 },
  );
  if (sourceIntegrated.status !== 0 || integrationObserved.status !== 0) {
    return verificationRejected(
      result,
      "the accepted and integrated commits are not ancestors of freshly fetched origin/dev",
      "unintegrated-source-commit",
      [
        `accepted-source-commit:${acceptedCommit}`,
        `claimed-integrated-commit:${integratedCommit}`,
        `fetched-origin-dev:${originDev}`,
      ],
    );
  }

  return {
    accepted: true,
    summary: `Accepted clean task-owned source ${acceptedCommit} integrated into freshly fetched origin/dev@${originDev}.`,
    evidence: [
      ...result.evidence,
      `verification-worktree:${workspace}`,
      "verification-status:clean",
      `verification-accepted-source-commit:${acceptedCommit}`,
      ...(provenanceSource
        ? [`verification-provenance-source-commit:${provenanceSource}`]
        : []),
      `verification-origin-dev:${originDev}`,
    ],
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const currentTaskId = reconciliationTaskId(ctx.task);
  const retainedAuthority = cleanRetainedAuthority(ctx.task);
  const adoptionRaw = preservedWorkspaceAdoption(ctx.task);
  let adoptedWorkspace: PreservedWorkspaceAdoption | null = null;
  let authorityEvidence: string[] = [];

  if (retainedAuthority.declared) {
    if (!retainedAuthority.value) {
      return ctx.blocked(
        "Clean-retained workspace authority is incomplete before agent dispatch",
        {
          taskId: currentTaskId,
          required:
            "canonical cleanRetainedWorktree plus a 40-character cleanRetainedHead",
          cleanRetainedWorktree:
            taskInput(ctx.task)?.cleanRetainedWorktree ?? null,
          cleanRetainedHead: taskInput(ctx.task)?.cleanRetainedHead ?? null,
        },
      );
    }
    if (adoptionRaw !== undefined) {
      return ctx.blocked(
        "Clean-retained authority cannot be combined with preserved-workspace adoption",
        { taskId: currentTaskId },
      );
    }

    const expectedWorkspace = retainedAuthority.value.workspaceDir;
    const expectedHead = retainedAuthority.value.head;
    try {
      const observedWorkspace = canonicalPath(expectedWorkspace);
      const repositoryRoot = canonicalPath(
        gitValue(observedWorkspace, "rev-parse", "--show-toplevel"),
      );
      const observedHead = gitValue(observedWorkspace, "rev-parse", "HEAD");
      const observedBranch = gitValue(
        observedWorkspace,
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
      );
      const observedStatus = workspaceChanges(observedWorkspace);
      const observedOperation = activeGitOperation(observedWorkspace);
      if (
        repositoryRoot !== observedWorkspace ||
        observedHead !== expectedHead ||
        observedStatus ||
        observedOperation
      ) {
        return ctx.blocked(
          "Clean-retained workspace lineage validation failed before agent dispatch",
          {
            taskId: currentTaskId,
            expectedWorkspace,
            observedWorkspace,
            repositoryRoot,
            expectedHead,
            observedHead,
            observedBranch,
            observedStatus: observedStatus || "clean",
            observedOperation,
            disposition: "rejected-before-agent-dispatch",
          },
        );
      }
      ctx = { ...ctx, workspaceDir: observedWorkspace };
      authorityEvidence = [
        `clean-retained-worktree:${observedWorkspace}`,
        `clean-retained-head:${observedHead}`,
        `clean-retained-branch:${observedBranch}`,
        "clean-retained-status:clean",
        "clean-retained-operation:none",
      ];
    } catch (error) {
      return ctx.blocked(
        "Clean-retained workspace lineage could not be validated before agent dispatch",
        {
          taskId: currentTaskId,
          expectedWorkspace,
          expectedHead,
          observedWorkspace: ctx.workspaceDir ?? null,
          error: error instanceof Error ? error.message : String(error),
          disposition: "rejected-before-agent-dispatch",
        },
      );
    }
  }

  if (adoptionRaw !== undefined) {
    const candidate =
      adoptionRaw &&
      typeof adoptionRaw === "object" &&
      !Array.isArray(adoptionRaw)
        ? (adoptionRaw as Record<string, unknown>)
        : null;
    const workspaceDir = stringValue(candidate?.workspaceDir);
    const expectedBranch = stringValue(candidate?.expectedBranch);
    const expectedHead = stringValue(candidate?.expectedHead);
    const expectedDirty = candidate?.expectedDirty;
    const expectedOperation = candidate?.expectedOperation;
    const validOperation =
      expectedOperation === undefined ||
      ["none", "merge", "rebase", "cherry-pick", "revert"].includes(
        String(expectedOperation),
      );
    const declaresCleanOperationFreeState =
      expectedDirty === false && expectedOperation === "none";
    const declaresRecoverableState =
      declaresCleanOperationFreeState ||
      expectedDirty === true ||
      (typeof expectedOperation === "string" && expectedOperation !== "none");

    if (
      !workspaceDir ||
      !expectedBranch ||
      !expectedHead ||
      !/^[0-9a-f]{40}$/i.test(expectedHead) ||
      (expectedDirty !== undefined && typeof expectedDirty !== "boolean") ||
      !validOperation ||
      !declaresRecoverableState ||
      (expectedDirty === false && expectedOperation !== "none") ||
      (expectedOperation === "none" && expectedDirty !== false)
    ) {
      return ctx.blocked(
        "Preserved-worktree adoption contract is invalid before agent dispatch",
        {
          taskId: currentTaskId,
          required:
            "workspaceDir, expectedBranch, 40-character expectedHead, and either expectedDirty:true/an active expectedOperation or the exact clean pair expectedDirty:false with expectedOperation:none",
        },
      );
    }

    try {
      const workspace = realpathSync(workspaceDir);
      const repositoryRoot = realpathSync(
        gitValue(workspace, "rev-parse", "--show-toplevel"),
      );
      const branch = gitValue(
        workspace,
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
      );
      const head = gitValue(workspace, "rev-parse", "HEAD");
      const dirty = Boolean(workspaceChanges(workspace));
      const operation = activeGitOperation(workspace);
      const declaredOperation =
        expectedOperation === "none" ? null : expectedOperation;
      if (
        workspace !== workspaceDir ||
        repositoryRoot !== workspace ||
        branch !== expectedBranch ||
        head !== expectedHead ||
        (typeof expectedDirty === "boolean" && dirty !== expectedDirty) ||
        (typeof expectedOperation === "string" &&
          operation !== declaredOperation)
      ) {
        return ctx.blocked(
          "Preserved-worktree adoption validation failed before agent dispatch",
          {
            taskId: currentTaskId,
            declaredWorkspaceDir: workspaceDir,
            realWorkspaceDir: workspace,
            repositoryRoot,
            expectedBranch,
            observedBranch: branch,
            expectedDirty: expectedDirty ?? null,
            observedDirty: dirty,
            expectedOperation: expectedOperation ?? null,
            observedOperation: operation,
          },
        );
      }
      adoptedWorkspace = {
        workspaceDir,
        expectedBranch,
        expectedHead,
        ...(typeof expectedDirty === "boolean" ? { expectedDirty } : {}),
        ...(typeof expectedOperation === "string"
          ? {
              expectedOperation:
                expectedOperation as PreservedWorkspaceAdoption["expectedOperation"],
            }
          : {}),
      };
      ctx = { ...ctx, workspaceDir };
    } catch (error) {
      return ctx.blocked(
        "Preserved-worktree adoption could not be validated before agent dispatch",
        {
          taskId: currentTaskId,
          declaredWorkspaceDir: workspaceDir,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  if (
    !ctx.workspaceDir ||
    ctx.workspaceDir === ctx.projectDir ||
    realpathSync(ctx.workspaceDir) === realpathSync(ctx.projectDir)
  ) {
    return ctx.blocked(
      "Domain task execution requires a prepared task worktree",
      {
        workspaceDir: ctx.workspaceDir ?? null,
        projectDir: ctx.projectDir ?? null,
      },
    );
  }

  const taskRequestedWorkspace = requestedWorkspaceDir(ctx.task);
  if (taskRequestedWorkspace && !adoptedWorkspace) {
    let suppliedWorkspace: string;
    let requestedWorkspace: string;
    try {
      suppliedWorkspace = realpathSync(ctx.workspaceDir);
      requestedWorkspace = realpathSync(taskRequestedWorkspace);
    } catch (error) {
      return ctx.blocked(
        "Domain task workspace authority could not be validated before agent dispatch",
        {
          taskId: currentTaskId,
          suppliedWorkspaceDir: ctx.workspaceDir,
          requestedWorkspaceDir: taskRequestedWorkspace,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
    if (suppliedWorkspace !== requestedWorkspace) {
      return ctx.blocked(
        "Domain task requested a preserved workspace that differs from the prepared execution worktree",
        {
          taskId: currentTaskId,
          suppliedWorkspaceDir: suppliedWorkspace,
          requestedWorkspaceDir: requestedWorkspace,
          disposition:
            "rejected-before-agent-dispatch; explicit preservedWorkspaceAdoption contract required",
        },
      );
    }
  }

  const taskPayload = reconciliationTaskPayload(ctx.task);
  const existingLiveChildren = reconciliationTaskLiveChildren(ctx.task);
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
  let expectedWorkspace = ctx.workspaceDir;
  try {
    expectedWorkspace = realpathSync(ctx.workspaceDir);
  } catch {
    // Non-converged owner results do not need Git proof; the final gate below
    // rejects an unreadable workspace before any source can be accepted.
  }
  const expectedBranch = optionalGitValue(
    ctx.workspaceDir,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  );
  const watchdogSafeBulkRegeneration = requiresWatchdogSafeBulkRegeneration(
    ctx.task,
  );
  const prompt = [
    "Execute the bounded AKS reconciliation task below.",
    "",
    `Your task-owned Git worktree is ${ctx.workspaceDir}.`,
    "All relative filesystem tools already run there. Do not create another branch or worktree and do not switch the shared canonical checkout.",
    "Inspect current source and task evidence, make only the smallest accepted domain change, run scoped verification, and commit every accepted file change on the supplied task branch.",
    'This workflow publishes real domain source patches. For a disposition recheck, repo-ref wake, or unchanged wait that truthfully converges without a source change, leave the branch unchanged and include exact evidence entries "disposition:unchanged" plus at least one nonempty "hot-evidence:<current fact>"; never commit an evidence-only memo merely to record the review. The workflow independently validates the supplied worktree, task branch, clean status, and baseline/head tree equivalence before accepting that disposition.',
    "Do not push or create a pull request. After your converged judgment, this workflow integrates the clean accepted branch directly into dev; a dev conflict returns to you on the same task for repair.",
    "Before any push, the workflow independently checks whitespace, runtime-data policy, private-source policy, scenario migration, schema, and live admission on the replayed candidate. Raw evidence/archive output is never a publishable deliverable.",
    ...(watchdogSafeBulkRegeneration
      ? [
          "Bulk deterministic regeneration watchdog contract:",
          "- Never run the repository-wide regeneration as one silent command. Partition the deterministic targets into bounded batches and use a timeout of at most 240000ms for every individual tool call, safely below the 300-second no-observation watchdog.",
          "- After every completed batch, call checkpoint() before starting the next batch. Record the completed target range/count, command result, task worktree, current Git status, and exact next batch so interruption can resume in this same task-owned worktree.",
          "- Keep the regeneration on this task and branch. Do not create successor carriers, another worktree, or a second scheduling queue merely to process later batches.",
          "- After all batches, review the exact allowed diff and semantic generated changes, then run compact-plan freshness, strict scenario inventory, and the full repository check as separately observable bounded calls. Commit only accepted deterministic outputs, leave the worktree clean, and let this workflow perform direct dev integration plus fresh-origin reachability verification.",
        ]
      : []),
    "A converged result must leave the worktree clean. If work cannot be committed cleanly, return needs-owner with exact recovery evidence; use waiting only for an external fact with an exact Condition.",
    `If the truthful next step is carried by another task, create or update that holder as a direct child of ${currentTaskId ?? "the current task"} and return waiting only after the child exists or the current task has its own exact Condition.`,
    'If you already have an exact queued Azure DevOps run id, preserve that wait on this same task with condition type "pipeline-run.state", subject "pipeline-run:<runId>", and expected { field: "state", anyOf: ["completed"] } instead of prose-only waiting.',
    `The currently running task is ${currentTaskId ?? "identified in the Reconciliation Task payload"}. The workflow result itself updates this task. Never return an update-task, close-task, or unblock-task action targeting it.`,
    "Only the generic reconciler may change task state. Use typed actions for other tasks that independently need a change.",
    'For a master-validation product-recovery wait, use the semantic pass event: type pipeline.spec.observed, subject project:aks-rp-e2e, expected { specId: "<spec id>", status: "pass", sourceBranch: "refs/heads/main" }. The project subject is the routing scope; the expected fields select the exact proof.',
    "",
    ctx.task,
  ].join("\n");

  guardWriteDispatch(ctx);
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
    result: {
      ...(result.structuredResult as ProjectAppTaskHandlerResult),
      evidence: [
        ...authorityEvidence,
        ...((result.structuredResult as ProjectAppTaskHandlerResult).evidence ??
          []),
      ],
    },
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
    existingLiveChildren,
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
    existingLiveChildren,
    phase: "domain execution",
    sessionId: result.sessionId,
    result: ownerResult,
  });
  if (ownerResult.state !== "converged") {
    const recovery = recoveryOnlyResult(ctx.workspaceDir, ownerResult);
    return ctx.done(recovery.summary, recovery);
  }

  if (!attemptBaseCommit || !expectedBranch) {
    const recovery = recoveryOnlyResult(ctx.workspaceDir, {
      state: "needs-owner",
      summary:
        "Domain task workspace has no readable attempt baseline or task branch",
      evidence: [
        ...(ownerResult.evidence ?? []),
        `workspace:${ctx.workspaceDir}`,
      ],
    });
    return ctx.done(recovery.summary, recovery);
  }

  const workspaceDir = ctx.workspaceDir;
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const recoveryDone = (
    result: ProjectAppTaskHandlerResult,
  ): WorkflowResult => {
    const recovery = recoveryOnlyResult(workspaceDir, result);
    return ctx.done(recovery.summary, recovery);
  };
  if (workspaceChanges(workspaceDir)) {
    return recoveryDone({
      state: "needs-owner",
      summary: "Domain task left uncommitted workspace changes",
      evidence: [`workspace:${workspaceDir}`],
    });
  }

  if (requestsUnchangedDisposition(ownerResult)) {
    const unchangedGate = unchangedDispositionGate({
      result: ownerResult,
      workspaceDir,
      expectedWorkspace,
      expectedBranch,
      baselineCommit: attemptBaseCommit,
    });
    if (!unchangedGate.ok) {
      return ctx.done(unchangedGate.summary, {
        state: "needs-owner",
        summary: unchangedGate.summary,
        evidence: [...(ownerResult.evidence ?? []), ...unchangedGate.evidence],
      });
    }
    const summary = `${ownerResult.summary} Validated as an unchanged disposition; no source integration was required.`;
    return ctx.done(summary, {
      ...ownerResult,
      state: "converged",
      summary,
      evidence: [...(ownerResult.evidence ?? []), ...unchangedGate.evidence],
    });
  }

  const requiredAcceptedCommit = requiredAcceptedSourceCommit(ctx.task);
  let finalGate = taskBranchGate({
    workspaceDir,
    expectedWorkspace,
    expectedBranch,
    baselineCommit: attemptBaseCommit,
    acceptedCommit: requiredAcceptedCommit,
  });
  if (!finalGate.ok) {
    return ctx.done(finalGate.summary, {
      state: "needs-owner",
      summary: finalGate.summary,
      evidence: [...(ownerResult.evidence ?? []), ...finalGate.evidence],
    });
  }
  ownerResult = {
    ...ownerResult,
    evidence: [...(ownerResult.evidence ?? []), ...finalGate.evidence],
  };

  const sourceBranch = expectedBranch;
  let sourceCommit = gitValue(workspaceDir, "rev-parse", "HEAD");
  let integrationProvenanceSourceCommit = sourceCommit;
  let integration = await integrateDirectlyIntoDev({
    repoDir,
    workspaceDir,
    sourceBranch,
    sourceCommit,
    taskBaseCommit: attemptBaseCommit,
    validationCommands: AKS_DIRECT_DEV_VALIDATION_COMMANDS,
  });

  if (integration.state === "unchanged" && requiredAcceptedCommit) {
    gitValue(repoDir, "fetch", "origin", "dev");
    gitValue(workspaceDir, "fetch", "origin", "dev");
    const targetCommit = gitValue(repoDir, "rev-parse", "origin/dev");
    const acceptedExists = spawnSync(
      "git",
      ["cat-file", "-e", `${requiredAcceptedCommit}^{commit}`],
      { cwd: workspaceDir, encoding: "utf8" },
    );
    const acceptedInTarget = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", requiredAcceptedCommit, "origin/dev"],
      { cwd: workspaceDir, encoding: "utf8" },
    );
    if (acceptedExists.status !== 0) {
      return ctx.done("Named accepted source commit is unavailable", {
        state: "needs-owner",
        summary: "Named accepted source commit is unavailable for replay",
        evidence: [
          ...(ownerResult.evidence ?? []),
          `accepted-commit:${requiredAcceptedCommit}`,
          `workspace:${workspaceDir}`,
        ],
      });
    }
    if (acceptedInTarget.status !== 0) {
      if (sourceCommit !== requiredAcceptedCommit) {
        return ctx.done("Named accepted source is not the retained task head", {
          state: "needs-owner",
          summary:
            "Named accepted source is absent from origin/dev but is not the retained task head",
          evidence: [
            ...(ownerResult.evidence ?? []),
            `accepted-commit:${requiredAcceptedCommit}`,
            `source-commit:${sourceCommit}`,
            `target-commit:${targetCommit}`,
          ],
        });
      }
      integration = {
        state: "requires-replay",
        reason: "source-outside-attempt-baseline",
        sourceCommit: requiredAcceptedCommit,
        taskBaseCommit: targetCommit,
        targetRef: "origin/dev",
        mergeCommits: [],
      };
    }
  }

  if (
    integration.state === "conflict" ||
    integration.state === "requires-replay" ||
    integration.state === "validation-failed"
  ) {
    if (integration.state === "requires-replay") {
      gitValue(repoDir, "fetch", "origin", "dev");
    }
    const replayBaseCommit =
      integration.state === "conflict" ||
      integration.state === "validation-failed"
        ? integration.replayBaseCommit
        : gitValue(repoDir, "rev-parse", "origin/dev");
    const replayFacts =
      integration.state === "conflict"
        ? [
            `Replaying this turn's task-owned commits onto ${integration.targetRef}@${replayBaseCommit} is already in progress.`,
            `Conflict evidence: ${integration.error}`,
            "Resolve only this task's conflicting files and continue the cherry-pick.",
          ]
        : integration.state === "validation-failed"
          ? [
              `The replayed candidate ${integration.sourceCommit} descends from ${integration.targetRef}@${replayBaseCommit}, but repository validation rejected it.`,
              `Validation evidence: ${integration.error}`,
              "Repair the rejected candidate in place and commit the correction.",
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
    guardWriteDispatch(ctx);
    const conflictResult = await ctx.runAgent(
      ctx.agent,
      [
        "Repair the same bounded AKS task before direct dev integration.",
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
      existingLiveChildren,
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
    finalGate = taskBranchGate({
      workspaceDir,
      expectedWorkspace,
      expectedBranch,
      baselineCommit: replayBaseCommit,
      acceptedCommit: requiredAcceptedCommit,
      allowAcceptedTransplant: true,
    });
    if (!finalGate.ok) {
      return ctx.done(finalGate.summary, {
        state: "needs-owner",
        summary: finalGate.summary,
        evidence: [...(ownerResult.evidence ?? []), ...finalGate.evidence],
      });
    }
    ownerResult = {
      ...ownerResult,
      evidence: [...(ownerResult.evidence ?? []), ...finalGate.evidence],
    };
    integrationProvenanceSourceCommit = sourceCommit;
    integration = await integrateDirectlyIntoDev({
      repoDir,
      workspaceDir,
      sourceBranch,
      sourceCommit,
      taskBaseCommit: replayBaseCommit,
      validationCommands: AKS_DIRECT_DEV_VALIDATION_COMMANDS,
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
      ...(sourceCommit !== integrationProvenanceSourceCommit
        ? [
            `integration-provenance:${integrationProvenanceSourceCommit}->${sourceCommit}`,
          ]
        : []),
      `target-ref:${integration.targetRef}`,
      `integrated-commit:${integration.targetCommit}`,
    ],
  });
}
