import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  AppEvent,
  ExecutionResult,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  emitGymEvent,
  gymAppRoot,
  gymEvent,
  gymProjectRoot,
  gymProjectsRoot,
} from "./lib/context";
import { safeKey, triggerDetails } from "./lib/trigger";

export const name = "regression-run";
export const description =
  "Run the standalone Gym CLI and persist an autonomous regression outcome.";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  command: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
) => Promise<ProcessResult>;

export const runProcess: ProcessRunner = async (command, options) => {
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: options.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
};

export interface FinishIdentityInspection {
  commit: string;
  patchSha256: string;
  clean: boolean;
}

export type FinishIdentityInspector = (
  worktree: string,
  commit: string,
) => FinishIdentityInspection;

export const inspectFinishIdentity: FinishIdentityInspector = (
  worktree,
  commit,
) => {
  const head = Bun.spawnSync(["git", "-C", worktree, "rev-parse", "HEAD"]);
  const status = Bun.spawnSync([
    "git",
    "-C",
    worktree,
    "status",
    "--porcelain",
  ]);
  const patch = Bun.spawnSync([
    "git",
    "-C",
    worktree,
    "show",
    "--format=",
    "--binary",
    commit,
  ]);
  if (head.exitCode !== 0 || status.exitCode !== 0 || patch.exitCode !== 0) {
    throw new Error("finish-result candidate identity inspection failed");
  }
  return {
    commit: head.stdout.toString().trim(),
    patchSha256: createHash("sha256").update(patch.stdout).digest("hex"),
    clean: status.stdout.toString().trim().length === 0,
  };
};

function validatedName(
  value: unknown,
  label: string,
  fallback: string,
): string {
  const result = String(value ?? fallback);
  const segments = result.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment),
    )
  ) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return result;
}

function trials(value: unknown): number {
  const parsed = Number(value ?? 3);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("trials must be an integer from 1 through 5");
  }
  return parsed;
}

function requestedScenarios(details: Record<string, unknown>): string[] {
  const values = Array.isArray(details.scenarios)
    ? details.scenarios
    : details.scenario
      ? [details.scenario]
      : [];
  return values.map((value) => validatedName(value, "scenario", ""));
}

interface FrozenIdentity {
  path: string;
  sha256: string;
}

interface FinishResultComparisonEnvelope {
  mode: "finish-result-comparison";
  requestId: string;
  executionRequestId: string;
  priorRequestId: string;
  outcome: string;
  baseline: { artifact: string; sha256: string };
  candidate: { worktree: string; commit: string; patchSha256: string };
  sampleScope: { positive: string[]; negative: string[] };
  requiredProof: string[];
  constraints: string[];
  returnPath: string;
}

interface ComparisonEnvelope {
  requestId: string;
  executionRequestId: string;
  outcome: string;
  scope: {
    baseline: FrozenIdentity;
    candidate: FrozenIdentity;
    comparisonArtifact: FrozenIdentity;
    expectedLifecycleTypes: string[];
    negativeControls: string[];
  };
  acceptanceProof: string[];
  constraints: string[];
  reviewAndFailureBranch?: string;
}

function nonEmptyStringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === "string" && item.trim())
  ) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  return value as string[];
}

function frozenIdentity(value: unknown, label: string): FrozenIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a frozen artifact identity`);
  }
  const identity = value as Record<string, unknown>;
  const path = typeof identity.path === "string" ? identity.path.trim() : "";
  const sha256 =
    typeof identity.sha256 === "string" ? identity.sha256.trim() : "";
  if (
    !path ||
    path.startsWith("/") ||
    path.split("/").includes("..") ||
    !/^[a-f0-9]{64}$/.test(sha256)
  ) {
    throw new Error(`${label} has an invalid path or SHA-256`);
  }
  return { path, sha256 };
}

function finishResultComparisonEnvelope(
  details: Record<string, unknown>,
): FinishResultComparisonEnvelope | null {
  if (details.mode !== "finish-result-comparison") return null;
  const baseline =
    details.baseline &&
    typeof details.baseline === "object" &&
    !Array.isArray(details.baseline)
      ? (details.baseline as Record<string, unknown>)
      : {};
  const candidate =
    details.candidate &&
    typeof details.candidate === "object" &&
    !Array.isArray(details.candidate)
      ? (details.candidate as Record<string, unknown>)
      : {};
  const sampleScope =
    details.sampleScope &&
    typeof details.sampleScope === "object" &&
    !Array.isArray(details.sampleScope)
      ? (details.sampleScope as Record<string, unknown>)
      : {};
  const requestId = String(details.requestId ?? "").trim();
  const executionRequestId = String(details.executionRequestId ?? "").trim();
  const priorRequestId = String(details.priorRequestId ?? "").trim();
  const outcome = String(details.outcome ?? "").trim();
  const artifact = String(baseline.artifact ?? "").trim();
  const baselineSha256 = String(baseline.sha256 ?? "").trim();
  const worktree = String(candidate.worktree ?? "").trim();
  const commit = String(candidate.commit ?? "").trim();
  const patchSha256 = String(candidate.patchSha256 ?? "").trim();
  const returnPath = String(details.returnPath ?? "").trim();
  if (!requestId) throw new Error("finish-result requestId is required");
  if (!executionRequestId)
    throw new Error("finish-result executionRequestId is required");
  if (!priorRequestId || priorRequestId === requestId)
    throw new Error("finish-result priorRequestId must be distinct");
  if (!outcome) throw new Error("finish-result outcome is required");
  if (
    !artifact.startsWith("/app/.state/sessions/") ||
    !artifact.endsWith("/result.json") ||
    artifact.split("/").includes("..") ||
    !/^[a-f0-9]{64}$/.test(baselineSha256)
  ) {
    throw new Error("finish-result baseline identity is invalid");
  }
  if (
    !worktree.startsWith("/app/projects/") ||
    worktree.split("/").includes("..") ||
    !/^[a-f0-9]{40}$/.test(commit) ||
    !/^[a-f0-9]{64}$/.test(patchSha256)
  ) {
    throw new Error("finish-result candidate identity is invalid");
  }
  if (
    !returnPath.startsWith("/app/projects/gym/.state/proofs/") ||
    returnPath.split("/").includes("..")
  ) {
    throw new Error("finish-result returnPath must stay under Gym proofs");
  }
  return {
    mode: "finish-result-comparison",
    requestId,
    executionRequestId,
    priorRequestId,
    outcome,
    baseline: { artifact, sha256: baselineSha256 },
    candidate: { worktree, commit, patchSha256 },
    sampleScope: {
      positive: nonEmptyStringArray(
        sampleScope.positive,
        "finish-result positive controls",
      ),
      negative: nonEmptyStringArray(
        sampleScope.negative,
        "finish-result negative controls",
      ),
    },
    requiredProof: nonEmptyStringArray(
      details.requiredProof,
      "finish-result requiredProof",
    ),
    constraints: nonEmptyStringArray(
      details.constraints,
      "finish-result constraints",
    ),
    returnPath,
  };
}

function comparisonEnvelope(
  details: Record<string, unknown>,
): ComparisonEnvelope | null {
  if (details.mode === "finish-result-comparison") return null;
  const shaped = [
    "outcome",
    "scope",
    "acceptanceProof",
    "baseline",
    "candidate",
    "comparisonArtifact",
    "requiredProof",
    "sampleScope",
  ].some((key) => Object.hasOwn(details, key));
  if (!shaped) return null;
  const scope =
    details.scope &&
    typeof details.scope === "object" &&
    !Array.isArray(details.scope)
      ? (details.scope as Record<string, unknown>)
      : {};
  const requestId =
    typeof details.requestId === "string" ? details.requestId.trim() : "";
  const executionRequestId =
    typeof details.executionRequestId === "string"
      ? details.executionRequestId.trim()
      : "";
  const outcome =
    typeof details.outcome === "string" ? details.outcome.trim() : "";
  if (!requestId) throw new Error("comparison requestId is required");
  if (!executionRequestId)
    throw new Error("comparison executionRequestId is required");
  if (!outcome) throw new Error("comparison outcome is required");
  return {
    requestId,
    executionRequestId,
    outcome,
    scope: {
      baseline: frozenIdentity(scope.baseline, "comparison baseline"),
      candidate: frozenIdentity(scope.candidate, "comparison candidate"),
      comparisonArtifact: frozenIdentity(
        scope.comparisonArtifact,
        "comparison artifact",
      ),
      expectedLifecycleTypes: nonEmptyStringArray(
        scope.expectedLifecycleTypes,
        "comparison expectedLifecycleTypes",
      ),
      negativeControls: nonEmptyStringArray(
        scope.negativeControls,
        "comparison negativeControls",
      ),
    },
    acceptanceProof: nonEmptyStringArray(
      details.acceptanceProof,
      "comparison acceptanceProof",
    ),
    constraints: nonEmptyStringArray(
      details.constraints,
      "comparison constraints",
    ),
    ...(typeof details.reviewAndFailureBranch === "string" &&
    details.reviewAndFailureBranch.trim()
      ? { reviewAndFailureBranch: details.reviewAndFailureBranch }
      : {}),
  };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

type RegressionEmission =
  | "comparison-completed"
  | "finish-result-completed"
  | "completed"
  | "review-required"
  | "runtime-failed"
  | "runtime-review-required";

/**
 * Task-owned regression emission contract:
 * - one admitted request and semantic emission always produce the same key;
 * - different semantic emissions from that request always produce different keys.
 */
export function regressionEmissionLocalKey(
  ctx: WorkflowContext,
  emission: RegressionEmission,
): string {
  const details = triggerDetails(ctx) ?? {};
  const admittedInput =
    ctx.reconciliation?.input &&
    typeof ctx.reconciliation.input === "object" &&
    !Array.isArray(ctx.reconciliation.input)
      ? (ctx.reconciliation.input as Record<string, unknown>)
      : ctx.input && typeof ctx.input === "object" && !Array.isArray(ctx.input)
        ? (ctx.input as Record<string, unknown>)
        : {};
  const requestIdentity =
    [
      details.requestId,
      details.request_id,
      details.correlatedOwnerRequestId,
      details.ownerRequestId,
      details.requestKey,
      details.correlationId,
      details.id,
      admittedInput.requestId,
      admittedInput.request_id,
      admittedInput.correlatedOwnerRequestId,
      admittedInput.ownerRequestId,
      admittedInput.requestKey,
      admittedInput.correlationId,
      admittedInput.id,
    ].find(
      (value) =>
        (typeof value === "string" && value.trim().length > 0) ||
        typeof value === "number",
    ) ??
    ctx.reconciliation?.taskId ??
    "regression-request";
  const requestHash = createHash("sha256")
    .update(String(requestIdentity).trim())
    .digest("hex")
    .slice(0, 20);
  return `regression-${requestHash}-${emission}`;
}

function regressionEvent(
  ctx: WorkflowContext,
  emission: RegressionEmission,
  type: string,
  data: Record<string, unknown>,
): AppEvent<Record<string, unknown>> {
  return {
    ...gymEvent(type, data),
    localKey: regressionEmissionLocalKey(ctx, emission),
  };
}

function runDirectory(stdout: string): string | null {
  for (const line of stdout.trim().split(/\r?\n/).reverse()) {
    const candidate = line.trim();
    if (candidate.startsWith("/") && existsSync(candidate)) {
      return resolve(candidate);
    }
  }
  return null;
}

function summarizeRun(runDir: string): Record<string, unknown> {
  const manifest = JSON.parse(
    readFileSync(join(runDir, "manifest.json"), "utf8"),
  ) as Record<string, any>;
  const trialRows = Array.isArray(manifest.trials) ? manifest.trials : [];
  const counts = { pass: 0, fail: 0, invalid: 0 };
  for (const row of trialRows) {
    const verdict = String(
      row.machine_verdict ?? "invalid",
    ) as keyof typeof counts;
    if (verdict in counts) counts[verdict]++;
  }
  const unapproved = trialRows
    .filter((row) => row.label_status !== "approved")
    .map((row) => row.scenario)
    .filter((value, index, all) => all.indexOf(value) === index);
  return {
    schema_version: 1,
    run_id: manifest.run_id,
    run_dir: runDir,
    benchmark: manifest.benchmark,
    agent: manifest.agent,
    scenarios: manifest.scenarios,
    trials_per_scenario: manifest.trials_per_scenario,
    counts,
    unapproved_scenarios: unapproved,
    review_required:
      counts.fail > 0 || counts.invalid > 0 || unapproved.length > 0,
    completed_at: manifest.completed_at,
  };
}

async function regressionFailure(
  ctx: WorkflowContext,
  benchmark: string,
  reason: string,
  evidence: Record<string, unknown>,
): Promise<ExecutionResult> {
  const failureKey = createHash("sha256")
    .update(JSON.stringify({ benchmark, reason, evidence }))
    .digest("hex")
    .slice(0, 20);
  const failureDir = join(gymAppRoot(ctx), ".state", "failures");
  const failurePath = join(failureDir, `${failureKey}.json`);
  mkdirSync(failureDir, { recursive: true });
  writeFileSync(
    failurePath,
    `${JSON.stringify(
      {
        schema_version: 1,
        failure_id: failureKey,
        benchmark,
        reason,
        evidence,
        captured_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  await emitGymEvent(
    ctx,
    regressionEvent(ctx, "runtime-failed", "gym.regression.failed", {
      benchmark,
      reason,
      failurePath,
      ...evidence,
    }),
  );
  await emitGymEvent(
    ctx,
    regressionEvent(ctx, "runtime-review-required", "gym.review.requested", {
      kind: "regression-runtime",
      requestKey: `regression-runtime-${failureKey}`,
      failurePath,
    }),
  );
  return ctx.done(reason, {
    state: "converged",
    summary: reason,
    evidence: [failurePath],
    actions: [],
  });
}

async function runFinishResultComparison(
  ctx: WorkflowContext,
  envelope: FinishResultComparisonEnvelope,
  processRunner: ProcessRunner,
  identityInspector: FinishIdentityInspector,
): Promise<ExecutionResult> {
  const baselineBytes = readFileSync(envelope.baseline.artifact);
  const baselineActualSha256 = createHash("sha256")
    .update(baselineBytes)
    .digest("hex");
  const baseline = JSON.parse(baselineBytes.toString("utf8")) as Record<
    string,
    unknown
  >;
  const finishParams =
    baseline.finishParams &&
    typeof baseline.finishParams === "object" &&
    !Array.isArray(baseline.finishParams)
      ? (baseline.finishParams as Record<string, unknown>)
      : {};
  const candidate = identityInspector(
    envelope.candidate.worktree,
    envelope.candidate.commit,
  );
  const fences = {
    baseline: {
      requiredSha256: envelope.baseline.sha256,
      actualSha256: baselineActualSha256,
      match: baselineActualSha256 === envelope.baseline.sha256,
    },
    candidate: {
      requiredCommit: envelope.candidate.commit,
      actualCommit: candidate.commit,
      commitMatch: candidate.commit === envelope.candidate.commit,
      requiredPatchSha256: envelope.candidate.patchSha256,
      actualPatchSha256: candidate.patchSha256,
      patchMatch: candidate.patchSha256 === envelope.candidate.patchSha256,
      clean: candidate.clean,
    },
  };
  if (
    !fences.baseline.match ||
    !fences.candidate.commitMatch ||
    !fences.candidate.patchMatch ||
    !fences.candidate.clean
  ) {
    return ctx.blocked("finish-result identity fence mismatch", fences);
  }

  const command = [
    "bun",
    "test",
    "src/app/session-terminal.test.ts",
    "src/app/app-task-runtime.test.ts",
    "--timeout",
    "30000",
  ];
  const execution = await processRunner(command, {
    cwd: envelope.candidate.worktree,
    env: { ...process.env },
  });
  const combinedOutput = `${execution.stdout}\n${execution.stderr}`;
  const passed = Number(
    combinedOutput.match(/(?:^|\n)\s*(\d+) pass\b/)?.[1] ?? 0,
  );
  const failed = Number(
    combinedOutput.match(/(?:^|\n)\s*(\d+) fail\b/)?.[1] ?? 0,
  );
  const baselineNestedResult =
    finishParams.status === "success" &&
    Object.hasOwn(finishParams, "result") &&
    finishParams.result !== null;
  const comparisonPassed =
    execution.exitCode === 0 &&
    failed === 0 &&
    passed > 0 &&
    baselineNestedResult;
  const matrix = [
    {
      id: "identity-baseline-sha256",
      class: "preflight",
      result: "pass",
    },
    {
      id: "identity-candidate-commit",
      class: "preflight",
      result: "pass",
    },
    {
      id: "identity-candidate-patch-sha256",
      class: "preflight",
      result: "pass",
    },
    ...envelope.sampleScope.positive.map((control) => ({
      id: control,
      class: "positive-control",
      result: comparisonPassed ? "pass" : "fail",
    })),
    ...envelope.sampleScope.negative.map((control) => ({
      id: control,
      class: "negative-control",
      result: comparisonPassed ? "pass" : "fail",
    })),
  ];
  const disposition = comparisonPassed ? "approve-for-proposal" : "reject";
  const record = {
    artifactType: "gym.finish-result-comparison-terminal.v2",
    disposition,
    correlation: {
      sourceRequestId: envelope.requestId,
      priorFailedRequestId: envelope.priorRequestId,
      executionRequestId: envelope.executionRequestId,
      taskId: ctx.reconciliation?.taskId ?? null,
      workflow: name,
      resultLocalKey: regressionEmissionLocalKey(
        ctx,
        "finish-result-completed",
      ),
    },
    envelope,
    priorFailure: {
      acceptedAsComparisonEvidence: false,
      reason:
        "The prior request produced a generic May-alignment run after comparison semantics were lost; it is immutable negative evidence only.",
    },
    identityFences: fences,
    execution: {
      correctedComparisonLaunches: 1,
      retries: 0,
      genericSubstitutions: 0,
      command,
      exitCode: execution.exitCode,
      passed,
      failed,
    },
    baselineObservation: {
      status: baseline.status ?? null,
      topLevelResultPresent: Object.hasOwn(baseline, "result"),
      nestedResultPresent: baselineNestedResult,
    },
    matrix,
    rolloutProposal: {
      scope:
        "Propose only the exact finish-result persistence candidate for a separately approved limited canary; this comparison does not activate May Runtime.",
      risks: [
        "failed or null result promoted as success",
        "duplicate completion consumption",
        "historical nested-only readback regression",
        "secret leakage",
        "unrelated Gym routing drift",
      ],
      monitoring: [
        "terminal result schema and status",
        "at-most-once completion consumption",
        "historical nested-only compatibility",
        "zero secret hits",
        "unrelated Gym routing tests",
      ],
      rollback:
        "Git-revert the exact Gym consumer commit; any separately approved Runtime canary rolls back by Git-reverting candidate commit 0ff56f626cbfb3646a098deef4042c8b262d1bd3.",
    },
  };
  const contentHash = createHash("sha256")
    .update(canonicalJson(record))
    .digest("hex");
  const artifact = { contentHash, record };
  const artifactDir = envelope.returnPath;
  const artifactPath = join(
    artifactDir,
    `terminal.${disposition}.${contentHash}.json`,
  );
  mkdirSync(artifactDir, { recursive: true });
  const serialized = `${canonicalJson(artifact)}\n`;
  if (existsSync(artifactPath)) {
    if (readFileSync(artifactPath, "utf8") !== serialized) {
      throw new Error(
        `Existing finish-result artifact differs: ${artifactPath}`,
      );
    }
  } else {
    writeFileSync(artifactPath, serialized, { flag: "wx" });
  }
  const artifactSha256 = createHash("sha256").update(serialized).digest("hex");

  await emitGymEvent(
    ctx,
    regressionEvent(
      ctx,
      "finish-result-completed",
      "gym.regression.finish-result.completed",
      {
        requestId: envelope.requestId,
        priorRequestId: envelope.priorRequestId,
        executionRequestId: envelope.executionRequestId,
        disposition,
        contentHash,
        artifactSha256,
        artifactPath,
        launchCount: 1,
      },
    ),
  );
  const summary = `Finish-result comparison ${disposition}: ${contentHash}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    result: {
      disposition,
      envelope,
      contentHash,
      artifactSha256,
      artifactPath,
      launchCount: 1,
      matrix,
    },
    evidence: [artifactPath],
    actions: [],
  });
}

async function runComparison(
  ctx: WorkflowContext,
  envelope: ComparisonEnvelope,
): Promise<ExecutionResult> {
  const sourceRoot = join(gymProjectsRoot(ctx), "may-agent");
  const identities = {
    baseline: envelope.scope.baseline,
    candidate: envelope.scope.candidate,
    comparisonArtifact: envelope.scope.comparisonArtifact,
  };
  const reads = {} as Record<
    keyof typeof identities,
    {
      path: string;
      requiredSha256: string;
      actualSha256?: string;
      match: boolean;
      error?: string;
    }
  >;
  let comparison: Record<string, unknown> = {};
  for (const [name, identity] of Object.entries(identities) as Array<
    [keyof typeof identities, FrozenIdentity]
  >) {
    const artifactPath = resolve(sourceRoot, identity.path);
    try {
      const content = readFileSync(artifactPath);
      const actualSha256 = createHash("sha256").update(content).digest("hex");
      reads[name] = {
        path: artifactPath,
        requiredSha256: identity.sha256,
        actualSha256,
        match: actualSha256 === identity.sha256,
      };
      if (name === "comparisonArtifact") {
        comparison = JSON.parse(content.toString("utf8")) as Record<
          string,
          unknown
        >;
      }
    } catch (error) {
      reads[name] = {
        path: artifactPath,
        requiredSha256: identity.sha256,
        match: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const representativeRows = Array.isArray(comparison.representativeComparisons)
    ? (comparison.representativeComparisons as Array<Record<string, unknown>>)
    : [];
  const positiveCoverage = envelope.scope.expectedLifecycleTypes.filter(
    (type) =>
      representativeRows.some(
        (row) => row.eventType === type && row.classification === "expected",
      ),
  );
  const negativeCoverage = envelope.scope.negativeControls.filter((family) =>
    representativeRows.some(
      (row) => row.controlFamily === family && row.classification === "visible",
    ),
  );
  const identitiesMatch = Object.values(reads).every((read) => read.match);
  const coverageComplete =
    positiveCoverage.length === envelope.scope.expectedLifecycleTypes.length &&
    negativeCoverage.length === envelope.scope.negativeControls.length;
  const disposition = !identitiesMatch
    ? "reject"
    : coverageComplete
      ? "approve"
      : "hold";
  const record = {
    artifactType: "gym.exact-comparison-terminal-disposition.v1",
    disposition,
    correlation: {
      sourceRequestId: envelope.requestId,
      executionRequestId: envelope.executionRequestId,
      taskId: ctx.reconciliation?.taskId ?? null,
      workflow: name,
      resultLocalKey: regressionEmissionLocalKey(ctx, "comparison-completed"),
    },
    envelope,
    evidence: {
      identities: reads,
      positiveCoverage: {
        required: envelope.scope.expectedLifecycleTypes,
        observed: positiveCoverage,
      },
      negativeCoverage: {
        required: envelope.scope.negativeControls,
        observed: negativeCoverage,
      },
      representativeRowCount: representativeRows.length,
    },
    decisionReason: !identitiesMatch
      ? "One or more frozen artifact identities did not match."
      : coverageComplete
        ? "Every required positive and negative control has representative comparison evidence."
        : "The frozen aggregate comparison lacks representative positive or negative-control rows required for approval.",
  };
  const contentHash = createHash("sha256")
    .update(canonicalJson(record))
    .digest("hex");
  const artifact = { contentHash, record };
  const artifactDir = join(
    gymProjectRoot(ctx),
    ".state",
    "proofs",
    `exact-comparison-${safeKey(envelope.requestId, "request")}`,
  );
  const artifactPath = join(artifactDir, `terminal.${contentHash}.json`);
  mkdirSync(artifactDir, { recursive: true });
  const serializedArtifact = `${canonicalJson(artifact)}\n`;
  if (existsSync(artifactPath)) {
    if (readFileSync(artifactPath, "utf8") !== serializedArtifact) {
      throw new Error(`Existing comparison artifact differs: ${artifactPath}`);
    }
  } else {
    writeFileSync(artifactPath, serializedArtifact, { flag: "wx" });
  }

  await emitGymEvent(
    ctx,
    regressionEvent(
      ctx,
      "comparison-completed",
      "gym.regression.comparison.completed",
      {
        requestId: envelope.requestId,
        executionRequestId: envelope.executionRequestId,
        disposition,
        contentHash,
        artifactPath,
      },
    ),
  );
  const summary = `Exact Gym comparison ${disposition}: ${contentHash}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    result: { disposition, contentHash, artifactPath },
    evidence: [artifactPath],
    actions: [],
  });
}

export async function runRegression(
  ctx: WorkflowContext,
  processRunner: ProcessRunner = runProcess,
  identityInspector: FinishIdentityInspector = inspectFinishIdentity,
): Promise<ExecutionResult> {
  const details = triggerDetails(ctx);
  if (!details)
    return ctx.blocked("Regression trigger event is missing or invalid");

  let finishEnvelope: FinishResultComparisonEnvelope | null;
  let envelope: ComparisonEnvelope | null;
  try {
    finishEnvelope = finishResultComparisonEnvelope(details);
    envelope = comparisonEnvelope(details);
  } catch (error) {
    return ctx.blocked(error instanceof Error ? error.message : String(error));
  }
  if (finishEnvelope) {
    try {
      return await runFinishResultComparison(
        ctx,
        finishEnvelope,
        processRunner,
        identityInspector,
      );
    } catch (error) {
      return ctx.blocked(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  if (envelope) return runComparison(ctx, envelope);

  let benchmark: string;
  let agent: string;
  let trialCount: number;
  let scenarios: string[];
  try {
    benchmark = validatedName(details.benchmark, "benchmark", "may-alignment");
    agent = validatedName(details.agent, "agent", "may");
    trialCount = trials(details.trials);
    scenarios = requestedScenarios(details);
  } catch (error) {
    return ctx.blocked(error instanceof Error ? error.message : String(error));
  }

  const gymRoot = gymProjectRoot(ctx);
  const command = [
    "bun",
    "run",
    "loop",
    "--",
    "test",
    "--benchmark",
    benchmark,
    "--agent",
    agent,
    "--trials",
    String(trialCount),
  ];
  for (const scenario of scenarios) command.push("--scenario", scenario);

  const result = await processRunner(command, {
    cwd: gymRoot,
    env: {
      ...process.env,
      GYM_AGENTS_ROOT: join(dirname(gymProjectsRoot(ctx)), "agents"),
    },
  });
  if (result.exitCode !== 0) {
    return regressionFailure(
      ctx,
      benchmark,
      `Gym regression process exited ${result.exitCode}`,
      {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-4_000),
      },
    );
  }

  const runDir = runDirectory(result.stdout);
  if (!runDir || !existsSync(join(runDir, "manifest.json"))) {
    return regressionFailure(
      ctx,
      benchmark,
      "Gym completed without a readable run directory",
      {
        stdout: result.stdout.slice(-2_000),
        stderr: result.stderr.slice(-2_000),
      },
    );
  }

  const outcome = summarizeRun(runDir);
  const runId = safeKey(outcome.run_id, "unknown-run");
  const stateDir = join(gymAppRoot(ctx), ".state", "runs");
  const outcomePath = join(stateDir, `${runId}.json`);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(outcomePath, `${JSON.stringify(outcome, null, 2)}\n`);

  await emitGymEvent(
    ctx,
    regressionEvent(ctx, "completed", "gym.regression.completed", {
      ...outcome,
      outcomePath,
    }),
  );
  if (outcome.review_required) {
    await emitGymEvent(
      ctx,
      regressionEvent(ctx, "review-required", "gym.review.requested", {
        kind: "regression",
        requestKey: `regression-${runId}`,
        runId: outcome.run_id,
        runDir,
        outcomePath,
      }),
    );
  }

  const summary = `Gym regression ${String(outcome.run_id)} completed: ${JSON.stringify(outcome.counts)}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [outcomePath],
    actions: [],
  });
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  return runRegression(ctx);
}
