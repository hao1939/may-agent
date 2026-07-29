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

type RepoRefExternalProducer = {
  supported: boolean;
  evidence: string[];
  reason?: string;
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

function parseTriggerEvent(raw: string): Record<string, unknown> | null {
  for (const marker of ["## Trigger Observation", "## Trigger Event"]) {
    const start = raw.indexOf(marker);
    if (start < 0) continue;
    const scoped = raw.slice(start);
    const firstBrace = scoped.indexOf("{");
    if (firstBrace < 0) continue;
    const objectText = matchingJsonObject(scoped, firstBrace);
    if (!objectText) continue;
    try {
      const parsed = JSON.parse(objectText);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next supported marker.
    }
  }
  return null;
}

function repoRefAdvanceCondition(
  taskId: string,
  repoRef: string,
  baselineCommit: string,
): ProjectAppConditionSpec {
  const digest = createHash("sha256")
    .update(`${taskId}\n${repoRef}\n${baselineCommit}`)
    .digest("hex")
    .slice(0, 12);
  return {
    id: `repo-ref-advance-${digest}`,
    type: "aks.repo-ref.observed",
    subject: `repoRef:${repoRef}`,
    expected: {
      field: "commit",
      notEquals: baselineCommit,
    },
    owner: "app-ops",
  };
}

function nonBasePublicationBranch(
  publicationBranch: string,
  repoRef: string,
): string {
  const normalized = publicationBranch.trim();
  if (!normalized) return "";
  const comparable = normalized.replace(/^refs\/heads\//, "");
  const baseComparable = repoRef.replace(/^origin\//, "");
  if (
    comparable === "dev" ||
    comparable === baseComparable ||
    comparable === repoRef
  ) {
    return "";
  }
  return normalized;
}

export function repoRefWaitExternalProducer(input: {
  taskId: string;
  repoRef: string;
  baselineCommit: string;
  specId?: string;
  sourceCommit?: string;
  publicationBranch?: string;
  pullRequestId?: string;
  sourceBranch?: string;
  authorizedRef?: string;
}): RepoRefExternalProducer {
  const sourceCommit = nonEmptyString(input.sourceCommit);
  const publicationBranch = nonEmptyString(input.publicationBranch);
  const pullRequestId = nonEmptyString(input.pullRequestId);
  const sourceBranch = nonEmptyString(input.sourceBranch);
  const authorizedRef = nonEmptyString(input.authorizedRef);
  const evidence: string[] = [];

  if (sourceCommit && sourceCommit !== input.baselineCommit) {
    evidence.push(`source-commit:${sourceCommit}`);
  }
  const pendingBranch =
    nonBasePublicationBranch(publicationBranch, input.repoRef) ||
    nonBasePublicationBranch(sourceBranch, input.repoRef) ||
    nonBasePublicationBranch(authorizedRef, input.repoRef);
  if (pendingBranch) {
    evidence.push(`pending-branch:${pendingBranch}`);
  }
  if (pullRequestId) {
    evidence.push(`pull-request:${pullRequestId}`);
  }

  if (evidence.length > 0) {
    return { supported: true, evidence };
  }

  return {
    supported: false,
    evidence: [
      `task:${input.taskId}`,
      `repo-ref:${input.repoRef}`,
      `resume-baseline:${input.baselineCommit}`,
      ...(input.specId ? [`spec-id:${input.specId}`] : []),
      ...(sourceCommit ? [`source-commit:${sourceCommit}`] : []),
      ...(publicationBranch ? [`publication-branch:${publicationBranch}`] : []),
      ...(sourceBranch ? [`source-branch:${sourceBranch}`] : []),
      ...(authorizedRef ? [`authorized-ref:${authorizedRef}`] : []),
      ...(pullRequestId ? [`pull-request:${pullRequestId}`] : []),
    ],
    reason:
      "repo-ref waits must name a concrete pending source branch/commit, PR, publication branch, or other exact external producer that can change the scoped authority; generic origin/dev churn is not such a producer",
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

function fetchRepoRef(
  projectDir: string,
  repoRef: string,
): { status: number | null; stdout: string; stderr: string } {
  const [remote, ...branchParts] = repoRef.split("/");
  const branch = branchParts.join("/").trim();
  if (!remote?.trim() || !branch) {
    return { status: 0, stdout: "", stderr: "" };
  }
  return runGit(projectDir, ["fetch", remote.trim(), branch]);
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
      conditions: [
        repoRefAdvanceCondition(
          input.taskId,
          input.repoRef,
          input.baselineCommit,
        ),
      ],
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
  const trigger = parseTriggerEvent(ctx.task);
  const taskId = nonEmptyString(payload?.taskId) || "unknown-task";
  const workflowInput = payload?.input ?? {};
  const repoRef = nonEmptyString(workflowInput.baseRef) || "origin/dev";
  const baselineCommit = nonEmptyString(workflowInput.resumeBaselineCommit);
  const specId = nonEmptyString(workflowInput.specId);
  const sourceCommit = nonEmptyString(workflowInput.sourceCommit);
  const publicationBranch = nonEmptyString(workflowInput.publicationBranch);
  const projectDir =
    nonEmptyString(payload?.paths?.projectDir) ||
    ctx.projectDir ||
    "/app/projects/aks-rp-e2e";

  if (!baselineCommit) {
    const summary = `${taskId} cannot use ${name}: input.resumeBaselineCommit is missing.`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [`workflow:${name}`, `task:${taskId}`],
    });
  }

  const producer = repoRefWaitExternalProducer({
    taskId,
    repoRef,
    baselineCommit,
    specId,
    sourceCommit,
    publicationBranch,
    pullRequestId: nonEmptyString((workflowInput as Record<string, unknown>).pullRequestId),
    sourceBranch: nonEmptyString((workflowInput as Record<string, unknown>).sourceBranch),
    authorizedRef: nonEmptyString((workflowInput as Record<string, unknown>).authorizedRef),
  });
  if (!producer.supported) {
    const summary = `${taskId} cannot use ${name}: ${producer.reason}. Preserve the truthful same-task compact frontier or an exact non-repo wait instead of binding a generic origin/dev advance.`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [`workflow:${name}`, ...producer.evidence],
    });
  }

  const fetched = fetchRepoRef(projectDir, repoRef);
  if (fetched.status !== 0) {
    const summary = `${taskId} cannot refresh ${repoRef} for ${name}: ${fetched.stderr.trim() || `git fetch exited ${fetched.status}`}`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [
        `workflow:${name}`,
        `repo-ref:${repoRef}`,
        `resume-baseline:${baselineCommit}`,
        `project-dir:${projectDir}`,
      ],
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
        `project-dir:${projectDir}`,
      ],
    });
  }

  const currentCommit = current.stdout.trim();
  const triggerType = nonEmptyString(trigger?.type);
  const triggerData =
    trigger?.data && typeof trigger.data === "object"
      ? (trigger.data as Record<string, unknown>)
      : {};
  const triggerCommit =
    nonEmptyString(trigger?.commit) || nonEmptyString(triggerData.commit);
  if (
    currentCommit === baselineCommit &&
    triggerType === "aks.repo-ref.observed" &&
    triggerCommit &&
    triggerCommit !== baselineCommit
  ) {
    const summary = `${taskId} received a stale satisfied repo-ref wake for ${repoRef}: the trigger observed ${triggerCommit}, but current repo state in ${projectDir} is still baseline ${baselineCommit}. Hand the task back to the owner to rebind or retry from current repo truth instead of preserving a stale true wait.`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [
        `workflow:${name}`,
        `repo-ref:${repoRef}`,
        `resume-baseline:${baselineCommit}`,
        `trigger-commit:${triggerCommit}`,
        `current-commit:${currentCommit}`,
        `project-dir:${projectDir}`,
      ],
    });
  }

  const decision = decideRepoRefAdvanceGate({
    taskId,
    repoRef,
    baselineCommit,
    currentCommit,
    specId,
    sourceCommit,
    publicationBranch,
  });
  return ctx.done(decision.summary, decision);
}
