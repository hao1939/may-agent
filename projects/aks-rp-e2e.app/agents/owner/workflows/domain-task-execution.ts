import { spawnSync } from "node:child_process";
import {
  projectAppTaskHandlerResultSchema,
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import { integrateDirectlyIntoDev } from "./lib/direct-dev-integration.js";

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

export function reconciliationTaskId(raw: string): string | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
  if (!object) return null;
  try {
    const taskId = (JSON.parse(object) as { taskId?: unknown }).taskId;
    return typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
  } catch {
    return null;
  }
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
  const prompt = [
    "Execute the bounded AKS reconciliation task below.",
    "",
    `Your task-owned Git worktree is ${ctx.workspaceDir}.`,
    "All relative filesystem tools already run there. Do not create another branch or worktree and do not switch the shared canonical checkout.",
    "Inspect current source and task evidence, make only the smallest accepted domain change, run scoped verification, and commit every accepted file change on the supplied task branch.",
    "Do not push or create a pull request. After your converged judgment, this workflow integrates the clean accepted branch directly into dev; a dev conflict returns to you on the same task for repair.",
    "A converged result must leave the worktree clean. If work cannot be committed cleanly, return needs-owner with exact recovery evidence; use waiting only for an external fact with an exact Condition.",
    `The currently running task is ${currentTaskId ?? "identified in the Reconciliation Task payload"}. The workflow result itself updates this task. Never return an update-task, close-task, or unblock-task action targeting it.`,
    "The generic reconciler alone mutates task state. Use typed actions only for other tasks that independently need a change.",
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
  if (ownerResult.state !== "converged") {
    return ctx.done(ownerResult.summary, ownerResult);
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
  });

  if (integration.state === "conflict") {
    const conflictResult = await ctx.runAgent(
      ctx.agent,
      [
        "Resolve the direct dev integration conflict for the same bounded AKS task.",
        `Work only in ${workspaceDir}; the merge with ${integration.targetRef} is already in progress.`,
        "Resolve only this task's conflicting files, preserve the accepted task intent, rerun scoped verification, commit the merge, and leave the worktree clean.",
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
    const conflictOwnerResult = await correctSelfTargetingActions({
      ctx,
      currentTaskId,
      phase: "integration conflict repair",
      sessionId: conflictResult.sessionId,
      result: conflictResult.structuredResult as ProjectAppTaskHandlerResult,
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
    integration = integrateDirectlyIntoDev({
      repoDir,
      workspaceDir,
      sourceBranch,
      sourceCommit,
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
          `integration-error:${integration.error}`,
        ],
      },
    );
  }

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
