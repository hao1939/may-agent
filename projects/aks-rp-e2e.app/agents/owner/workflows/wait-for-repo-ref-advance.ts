import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type {
  ProjectAppConditionSpec,
  WorkflowContext,
  WorkflowIoContract,
  WorkflowResult,
} from "@may-agent/sdk";
import { workflowResultVersion } from "@may-agent/sdk";

export const name = "wait-for-repo-ref-advance";
export const description =
  "Preserve an exact same-spec wait until a watched repo ref advances, then hand the task back to the owner for the bounded recheck.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "wait-for-repo-ref-advance-v1",
  input: {
    required: ["input.baseRef", "input.resumeBaselineCommit"],
    optional: ["input.specId", "input.sourceCommit", "input.publicationBranch"],
    description:
      "Gate a same-spec publication/recheck task on a supported repo-ref change event instead of synthetic successor residue.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions", "conditions"],
    description:
      "Returns waiting with an exact repo-ref Condition while the baseline is unchanged, otherwise hands the task back to the owner for the bounded recheck.",
  },
};

type ReconciliationPayload = {
  taskId?: unknown;
  input?: Record<string, unknown>;
  paths?: { projectDir?: unknown };
};

type RepoAdvanceGateInput = {
  taskId: string;
  repoRef: string;
  baselineCommit: string;
  currentCommit: string;
  specId?: string;
  sourceCommit?: string;
  publicationBranch?: string;
};

function nonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
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

export function parseReconciliationTaskPayload(
  raw: string,
): ReconciliationPayload | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const firstBrace = scoped.indexOf("{");
  if (firstBrace < 0) return null;
  const objectText = matchingJsonObject(scoped, firstBrace);
  if (!objectText) return null;
  try {
    const parsed = JSON.parse(objectText) as ReconciliationPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function repoRefAdvanceCondition(repoRef: string): ProjectAppConditionSpec {
  const digest = createHash("sha256")
    .update(repoRef)
    .digest("hex")
    .slice(0, 12);
  return {
    id: `repo-ref-advance-${digest}`,
    type: "aks.repo-ref.changed",
    subject: `repoRef:${repoRef}`,
    expected: {
      field: "repoRef",
      equals: repoRef,
    },
    owner: "app-ops",
  };
}

function runGit(
  projectDir: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr || result.error?.message || "",
  };
}

export function decideRepoRefAdvanceGate(input: RepoAdvanceGateInput): {
  state: "waiting" | "needs-owner";
  summary: string;
  evidence: string[];
  conditions?: ProjectAppConditionSpec[];
} {
  const scope = input.specId ? ` for ${input.specId}` : "";
  const publication = input.publicationBranch
    ? ` against publication branch ${input.publicationBranch}`
    : "";
  const sourceCommit = input.sourceCommit
    ? ` and source commit ${input.sourceCommit}`
    : "";
  const evidence = [
    `repo-ref:${input.repoRef}`,
    `resume-baseline:${input.baselineCommit}`,
    `current-commit:${input.currentCommit}`,
    ...(input.sourceCommit ? [`source-commit:${input.sourceCommit}`] : []),
    ...(input.publicationBranch
      ? [`publication-branch:${input.publicationBranch}`]
      : []),
  ];

  if (input.currentCommit === input.baselineCommit) {
    return {
      state: "waiting",
      summary: `Keep ${input.taskId} waiting on a supported repo-ref wake: ${input.repoRef} is still baseline ${input.baselineCommit}${scope}${publication}${sourceCommit}, so the exact same-spec recheck should sleep until the ref advances.`,
      evidence,
      conditions: [repoRefAdvanceCondition(input.repoRef)],
    };
  }

  return {
    state: "needs-owner",
    summary: `${input.repoRef} advanced from baseline ${input.baselineCommit} to ${input.currentCommit}${scope}${publication}. Hand the task back to the owner to perform the bounded same-spec recheck instead of preserving a synthetic wait.`,
    evidence,
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const payload = parseReconciliationTaskPayload(ctx.task);
  const taskId = nonEmptyString(payload?.taskId) || "unknown-task";
  const workflowInput = payload?.input ?? {};
  const repoRef = nonEmptyString(workflowInput.baseRef) || "origin/dev";
  const baselineCommit = nonEmptyString(workflowInput.resumeBaselineCommit);
  const projectDir =
    ctx.projectDir ||
    nonEmptyString(payload?.paths?.projectDir) ||
    "/app/projects/aks-rp-e2e";

  if (!baselineCommit) {
    const summary = `${taskId} cannot use ${name}: input.resumeBaselineCommit is missing.`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [`workflow:${name}`, `task:${taskId}`],
    });
  }

  const current = runGit(projectDir, ["rev-parse", "--verify", repoRef]);
  if (current.status !== 0) {
    const summary = `${taskId} cannot verify ${repoRef} for ${name}: ${current.stderr.trim() || `git rev-parse exited ${current.status}`}`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [
        `workflow:${name}`,
        `repo-ref:${repoRef}`,
        `resume-baseline:${baselineCommit}`,
      ],
    });
  }

  const decision = decideRepoRefAdvanceGate({
    taskId,
    repoRef,
    baselineCommit,
    currentCommit: current.stdout.trim(),
    specId: nonEmptyString(workflowInput.specId),
    sourceCommit: nonEmptyString(workflowInput.sourceCommit),
    publicationBranch: nonEmptyString(workflowInput.publicationBranch),
  });
  return ctx.done(decision.summary, decision);
}
