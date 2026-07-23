import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  Type,
  type ProjectAppConditionSpec,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import { reconcileSpecLive } from "./spec-live-reconciliation.js";

export const name = "master-validation-failure";
export const description =
  "Investigate one progressively observed master-validation failure; keep it open until a test fix or product fix is verified by a passing staging proof.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const repository = "aks-e2e-spec-runner";
const targetBranch = "main";
const targetRef = "origin/main";
const azCli =
  process.env.AZURE_CLI_PATH ||
  (existsSync("/app/.state/.local/bin/az")
    ? "/app/.state/.local/bin/az"
    : "az");

type FailureInput = {
  taskId: string;
  generation: number;
  specId: string;
  pipelineRunId: string;
  failureFingerprint: string;
  artifactPath: string;
  sourceCommit: string;
  reason: string;
  category: string;
  status: string;
};

type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeCommit?: { commitId?: unknown };
  url?: unknown;
};

type Decision = {
  classification: "test_issue" | "prod_issue" | "inconclusive";
  summary: string;
  evidence: string[];
  changedFiles: string[];
};

const decisionSchema = Type.Object({
  classification: Type.Union([
    Type.Literal("test_issue"),
    Type.Literal("prod_issue"),
    Type.Literal("inconclusive"),
  ]),
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 })),
  changedFiles: Type.Array(Type.String({ minLength: 1 })),
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

function matchingJsonObject(raw: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return raw.slice(start, index + 1);
  }
  return null;
}

export function parseFailureInput(raw: string): FailureInput | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
  if (!object) return null;
  try {
    const payload = record(JSON.parse(object));
    const input = record(payload.input);
    const parsed: FailureInput = {
      taskId: text(payload.taskId),
      generation: Math.max(1, Number(payload.generation ?? 1) || 1),
      specId: text(input.specId),
      pipelineRunId: text(input.pipelineRunId),
      failureFingerprint: text(input.failureFingerprint),
      artifactPath: text(input.artifactPath),
      sourceCommit: text(input.sourceCommit),
      reason: text(input.reason),
      category: text(input.category),
      status: text(input.status),
    };
    return parsed.taskId && parsed.specId && parsed.failureFingerprint
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function command(
  executable: string,
  args: string[],
  cwd: string,
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      AZURE_CONFIG_DIR: process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
    },
  });
  const output = {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && output.status !== 0) {
    throw new Error(output.stderr || output.stdout || `${executable} failed`);
  }
  return output;
}

function git(cwd: string, args: string[], allowFailure = false) {
  return command("git", args, cwd, allowFailure);
}

function azJson(cwd: string, args: string[]): unknown {
  const result = command(
    azCli,
    [
      ...args,
      "--organization",
      organization,
      "--project",
      adoProject,
      "-o",
      "json",
    ],
    cwd,
  );
  return JSON.parse(result.stdout || "null");
}

function pullRequests(repoDir: string, sourceBranch: string): PullRequest[] {
  const value = azJson(repoDir, [
    "repos",
    "pr",
    "list",
    "--repository",
    repository,
    "--source-branch",
    sourceBranch,
    "--target-branch",
    targetBranch,
    "--status",
    "all",
    "--top",
    "20",
  ]);
  return Array.isArray(value) ? (value as PullRequest[]) : [];
}

export function productRecoveryCondition(
  input: FailureInput,
): ProjectAppConditionSpec {
  return {
    id: `master-validation-product-recovery-${input.failureFingerprint}`,
    type: "pipeline.spec.observed",
    subject: "project:aks-rp-e2e",
    expected: {
      specId: input.specId,
      status: "pass",
      sourceBranch: "refs/heads/main",
    },
  };
}

function triggerEvent(raw: string): Record<string, unknown> | null {
  const marker = raw.indexOf("## Trigger Event");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
  if (!object) return null;
  try {
    return record(JSON.parse(object));
  } catch {
    return null;
  }
}

function laterRun(candidate: string, baseline: string): boolean {
  const candidateNumber = Number(candidate);
  const baselineNumber = Number(baseline);
  if (Number.isFinite(candidateNumber) && Number.isFinite(baselineNumber)) {
    return candidateNumber > baselineNumber;
  }
  return Boolean(candidate && baseline && candidate !== baseline);
}

export function passingRecoveryObservation(
  raw: string,
  input: FailureInput,
): Record<string, unknown> | null {
  const trigger = triggerEvent(raw);
  if (!trigger || text(trigger.type) !== "pipeline.spec.observed") return null;
  const data = record(trigger.data);
  const value = (key: string) => text(trigger[key] ?? data[key]);
  return value("specId") === input.specId &&
    value("status").toLowerCase() === "pass" &&
    value("sourceBranch") === "refs/heads/main" &&
    laterRun(value("pipelineRunId"), input.pipelineRunId)
    ? { ...data, ...trigger }
    : null;
}

export function shouldReconcileTestFix(input: {
  hasPullRequest: boolean;
  sourceIsInTarget: boolean;
}): boolean {
  return input.hasPullRequest || !input.sourceIsInTarget;
}

export function failureObservationIsStale(
  failureSourceCommit: string,
  currentMainCommit: string,
): boolean {
  return Boolean(
    failureSourceCommit &&
    currentMainCommit &&
    failureSourceCommit !== currentMainCommit,
  );
}

function waiting(
  ctx: WorkflowContext,
  summary: string,
  evidence: string[],
  condition: ProjectAppConditionSpec,
): WorkflowResult {
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence,
    actions: [],
    conditions: [condition],
  });
}

function notificationPath(ctx: WorkflowContext, key: string): string {
  return join(
    ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
    ".state",
    "master-validation-notifications",
    `${createHash("sha256").update(key).digest("hex")}.json`,
  );
}

function notifyHuman(
  ctx: WorkflowContext,
  input: FailureInput,
  kind: "product" | "test-pr",
  content: string,
  extra: Record<string, unknown> = {},
): boolean {
  const key = `${kind}:${input.specId}:${input.failureFingerprint}`;
  const path = notificationPath(ctx, key);
  if (existsSync(path)) return false;
  ctx.dispatchEvent("message.created", {
    target: { project: "aks-rp-e2e", human: true },
    from: "aks-explorer",
    to: "human:operator",
    content,
    priority: kind === "product" ? "P1" : "P2",
    intent:
      kind === "product"
        ? "master-validation-product-issue"
        : "master-validation-test-fix-pr",
    project: "aks-rp-e2e",
    taskId: input.taskId,
    specId: input.specId,
    pipelineRunId: input.pipelineRunId,
    failureFingerprint: input.failureFingerprint,
    ...extra,
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ key, sentAt: new Date().toISOString(), ...extra }, null, 2)}\n`,
  );
  return true;
}

async function reconcileTestIssue(
  ctx: WorkflowContext,
  input: FailureInput,
): Promise<WorkflowResult> {
  const result = await reconcileSpecLive(ctx, { targetBranch: targetBranch });
  const resultRecord = record(result);
  const evidence = Array.isArray(resultRecord.evidence)
    ? resultRecord.evidence.map(text).filter(Boolean)
    : [];
  const pullRequestId =
    evidence
      .find((entry) => entry.startsWith("pull-request:"))
      ?.slice("pull-request:".length) ?? "";
  const fixCommit =
    evidence
      .find((entry) => entry.startsWith("source-commit:"))
      ?.slice("source-commit:".length) ?? "";
  if (pullRequestId) {
    notifyHuman(
      ctx,
      input,
      "test-pr",
      [
        `AKS master validation found and live-verified a test fix for ${input.specId}.`,
        `Failed aggregate run: ${input.pipelineRunId}`,
        `Pull request: ${pullRequestId}`,
        ...(fixCommit ? [`Exact tested commit: ${fixCommit}`] : []),
        `Status: ${text(resultRecord.summary)}`,
      ].join("\n"),
      { pullRequestId, ...(fixCommit ? { fixCommit } : {}) },
    );
  }
  return result;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const input = parseFailureInput(ctx.task);
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const workspaceDir = ctx.workspaceDir ?? repoDir;
  if (!input || workspaceDir === repoDir) {
    const summary = `${name} requires a valid failure observation and a main-based task worktree.`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [`workspace:${workspaceDir}`],
    });
  }

  const recovery = passingRecoveryObservation(ctx.task, input);
  if (recovery) {
    const recoveryRunId = text(recovery.pipelineRunId);
    const summary = `${input.specId} recovered in later current-main master-validation run ${recoveryRunId}.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [
        `blocking-pipeline-run:${input.pipelineRunId}`,
        `recovery-pipeline-run:${recoveryRunId}`,
        `source-commit:${text(recovery.sourceCommit)}`,
        `artifact:${text(recovery.artifactPath)}`,
      ],
      actions: [],
    });
  }

  try {
    git(repoDir, ["fetch", "origin", targetBranch]);
    const sourceBranch = git(workspaceDir, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    ]).stdout;
    const headCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const baseCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
    if (failureObservationIsStale(input.sourceCommit, baseCommit)) {
      const summary = `${input.specId} failed on older main@${input.sourceCommit}; current ${targetRef}@${baseCommit} must provide the next spec verdict before any further source repair.`;
      return waiting(
        ctx,
        summary,
        [
          `blocking-pipeline-run:${input.pipelineRunId}`,
          `failure-source-commit:${input.sourceCommit}`,
          `current-main-commit:${baseCommit}`,
        ],
        productRecoveryCondition(input),
      );
    }
    const existingPr = pullRequests(repoDir, sourceBranch)[0];
    const sourceIsInTarget =
      git(repoDir, ["merge-base", "--is-ancestor", headCommit, targetRef], true)
        .status === 0;
    if (
      shouldReconcileTestFix({
        hasPullRequest: Boolean(existingPr),
        sourceIsInTarget,
      })
    ) {
      return reconcileTestIssue(ctx, input);
    }

    if (git(workspaceDir, ["status", "--porcelain=v1"]).stdout) {
      const summary =
        "Failure investigation worktree is dirty before deterministic publication.";
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: [`workspace:${workspaceDir}`],
      });
    }

    const result = await ctx.runAgent(
      ctx.agent,
      [
        `Investigate the early master-validation failure for ${input.specId}.`,
        `Aggregate pipeline run: ${input.pipelineRunId}`,
        `Failure status/category: ${input.status}/${input.category || "unknown"}`,
        `Failure reason: ${input.reason || "not recorded"}`,
        `Downloaded slice artifact: ${input.artifactPath || "not available"}`,
        `The tested main commit was ${input.sourceCommit || "unknown"}.`,
        `Work only in ${workspaceDir}, which is based on ${targetRef}@${baseCommit}.`,
        "Classify the root cause as test_issue, prod_issue, or inconclusive.",
        "For test_issue, make the smallest source fix, run scoped local verification, commit it, and leave the worktree clean. Do not push or create a PR; the workflow owns publication.",
        "For prod_issue or inconclusive, do not modify source. Cite exact artifact/log evidence.",
        "Do not stop or wait for the aggregate pipeline; investigate this completed slice now.",
      ].join("\n\n"),
      { timeoutMs: 1_800_000, schema: decisionSchema },
    );
    if (result.status === "error" || result.status === "interrupted") {
      throw new Error("Failure investigation agent session did not complete");
    }
    const decision = result.structuredResult as Decision;
    const nextCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const dirty = git(workspaceDir, ["status", "--porcelain=v1"]).stdout;
    if (dirty) {
      const summary =
        "Failure investigation left uncommitted changes; publication was refused.";
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: [...decision.evidence, `workspace:${workspaceDir}`],
      });
    }

    if (decision.classification === "prod_issue") {
      if (nextCommit !== headCommit) {
        const summary =
          "Product issue classification unexpectedly changed source; owner review is required.";
        return ctx.done(summary, {
          state: "needs-owner",
          summary,
          evidence: [...decision.evidence, `unexpected-commit:${nextCommit}`],
        });
      }
      notifyHuman(
        ctx,
        input,
        "product",
        [
          `AKS master validation found a product issue in ${input.specId}.`,
          `Pipeline run: ${input.pipelineRunId}`,
          `Summary: ${decision.summary}`,
          `Evidence: ${decision.evidence.join("; ")}`,
        ].join("\n"),
      );
      const summary = `Classified ${input.specId} as a product issue and notified the human operator; the failure remains open until a deployed product fix passes this spec from current main.`;
      return waiting(
        ctx,
        summary,
        decision.evidence,
        productRecoveryCondition(input),
      );
    }

    if (decision.classification === "inconclusive") {
      const summary = `The ${input.specId} failure remains inconclusive: ${decision.summary}`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: decision.evidence,
      });
    }

    if (nextCommit === headCommit) {
      const summary = `The failure was classified as a test issue, but no fix commit was produced for ${input.specId}.`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: decision.evidence,
      });
    }
    return reconcileTestIssue(ctx, input);
  } catch (error) {
    const summary = `Master-validation failure handling failed: ${error instanceof Error ? error.message : String(error)}`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [
        `spec:${input.specId}`,
        `pipeline-run:${input.pipelineRunId}`,
        `artifact:${input.artifactPath || "missing"}`,
      ],
    });
  }
}
