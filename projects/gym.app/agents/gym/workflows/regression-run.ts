import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
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

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function stringList(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  return value as string[];
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(source[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new Error("canonical JSON cannot encode undefined");
  }
  return encoded;
}

function comparisonShaped(details: Record<string, unknown>): boolean {
  return [
    "outcome",
    "scope",
    "acceptanceProof",
    "baseline",
    "candidate",
    "comparisonArtifact",
    "requiredProof",
    "sampleScope",
  ].some((key) => Object.hasOwn(details, key));
}

interface ComparisonEnvelope {
  outcome: string;
  scope: Record<string, unknown>;
  acceptanceProof: string[];
  constraints: string[];
  requestId: string;
  reviewAndFailureBranch?: string;
}

function comparisonEnvelope(
  details: Record<string, unknown>,
): ComparisonEnvelope {
  const scope = record(details.scope, "scope");
  const baseline = record(scope.baseline, "scope.baseline");
  const candidate = record(scope.candidate, "scope.candidate");
  const comparisonArtifact = record(
    scope.comparisonArtifact,
    "scope.comparisonArtifact",
  );
  for (const [label, identity] of [
    ["scope.baseline", baseline],
    ["scope.candidate", candidate],
    ["scope.comparisonArtifact", comparisonArtifact],
  ] as const) {
    requiredString(identity.path, `${label}.path`);
    const digest = requiredString(identity.sha256, `${label}.sha256`);
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`${label}.sha256 must be a lowercase SHA-256`);
    }
  }
  stringList(scope.expectedLifecycleTypes, "scope.expectedLifecycleTypes");
  stringList(scope.negativeControls, "scope.negativeControls");
  const envelope: ComparisonEnvelope = {
    outcome: requiredString(details.outcome, "outcome"),
    scope,
    acceptanceProof: stringList(details.acceptanceProof, "acceptanceProof"),
    constraints: stringList(details.constraints, "constraints"),
    requestId: requiredString(details.requestId, "requestId"),
  };
  if (Object.hasOwn(details, "reviewAndFailureBranch")) {
    envelope.reviewAndFailureBranch = requiredString(
      details.reviewAndFailureBranch,
      "reviewAndFailureBranch",
    );
  }
  return envelope;
}

function comparisonSourcePath(
  ctx: WorkflowContext,
  requestedPath: unknown,
): string {
  const relativePath = requiredString(requestedPath, "comparison source path");
  if (relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error("comparison source path must be project-relative");
  }
  const sourceRoot = resolve(gymProjectsRoot(ctx), "may-agent");
  const sourcePath = resolve(sourceRoot, relativePath);
  const rel = relative(sourceRoot, sourcePath);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error("comparison source path escapes the source project");
  }
  return sourcePath;
}

function sqlEventTypes(sql: string): Set<string> {
  return new Set(
    [...sql.matchAll(/'([a-zA-Z0-9._-]+)'/g)].map((match) => match[1]!),
  );
}

async function runComparison(
  ctx: WorkflowContext,
  details: Record<string, unknown>,
): Promise<ExecutionResult> {
  let envelope: ComparisonEnvelope;
  try {
    envelope = comparisonEnvelope(details);
  } catch (error) {
    return ctx.blocked(error instanceof Error ? error.message : String(error));
  }

  try {
    const executionRequestId = requiredString(
      details.executionRequestId ?? envelope.requestId,
      "executionRequestId",
    );
    const baselineIdentity = record(envelope.scope.baseline, "scope.baseline");
    const candidateIdentity = record(
      envelope.scope.candidate,
      "scope.candidate",
    );
    const comparisonIdentity = record(
      envelope.scope.comparisonArtifact,
      "scope.comparisonArtifact",
    );
    const baselinePath = comparisonSourcePath(ctx, baselineIdentity.path);
    const candidatePath = comparisonSourcePath(ctx, candidateIdentity.path);
    const comparisonPath = comparisonSourcePath(ctx, comparisonIdentity.path);
    const baselineText = readFileSync(baselinePath, "utf8");
    const candidateText = readFileSync(candidatePath, "utf8");
    const comparisonText = readFileSync(comparisonPath, "utf8");
    const observedBaselineSha = sha256(baselineText);
    const observedCandidateSha = sha256(candidateText);
    const observedComparisonSha = sha256(comparisonText);
    if (observedBaselineSha !== baselineIdentity.sha256) {
      throw new Error("baseline content does not match its frozen SHA-256");
    }
    if (observedCandidateSha !== candidateIdentity.sha256) {
      throw new Error("candidate content does not match its frozen SHA-256");
    }
    if (observedComparisonSha !== comparisonIdentity.sha256) {
      throw new Error("comparison artifact does not match its frozen SHA-256");
    }
    const suppliedComparison = record(
      JSON.parse(comparisonText),
      "comparison artifact",
    );

    const baselineTypes = sqlEventTypes(baselineText);
    const candidateTypes = sqlEventTypes(candidateText);
    const addedExclusions = [...candidateTypes]
      .filter((type) => !baselineTypes.has(type))
      .sort();
    const removedExclusions = [...baselineTypes]
      .filter((type) => !candidateTypes.has(type))
      .sort();
    const expectedLifecycleTypes = [
      ...stringList(
        envelope.scope.expectedLifecycleTypes,
        "scope.expectedLifecycleTypes",
      ),
    ].sort();
    const frozenBaseline = record(
      suppliedComparison.frozenBaseline,
      "comparison artifact frozenBaseline",
    );
    const exactCandidate = record(
      suppliedComparison.exactCandidate,
      "comparison artifact exactCandidate",
    );
    const declaredAddedExclusions = stringList(
      exactCandidate.onlyAddedExclusions,
      "comparison artifact exactCandidate.onlyAddedExclusions",
    ).sort();
    const dominantPopulation = record(
      suppliedComparison.dominantPopulation,
      "comparison artifact dominantPopulation",
    );
    const lifecycleRows = Array.isArray(dominantPopulation.rows)
      ? dominantPopulation.rows.map((row, index) =>
          record(row, `comparison artifact dominantPopulation.rows[${index}]`),
        )
      : [];
    const retainedRows = Array.isArray(
      suppliedComparison.retainedUnhandledPopulation,
    )
      ? suppliedComparison.retainedUnhandledPopulation.map((row, index) =>
          record(
            row,
            `comparison artifact retainedUnhandledPopulation[${index}]`,
          ),
        )
      : [];
    const identityCorrelation =
      frozenBaseline.path === baselineIdentity.path &&
      frozenBaseline.sha256 === baselineIdentity.sha256 &&
      exactCandidate.path === candidateIdentity.path &&
      exactCandidate.sha256 === candidateIdentity.sha256;
    const declaredDeltaMatches =
      canonicalJson(declaredAddedExclusions) ===
      canonicalJson(expectedLifecycleTypes);
    const lifecycleCoverage = expectedLifecycleTypes.every((type) =>
      lifecycleRows.some(
        (row) => row.eventType === type && Number(row.count ?? 0) > 0,
      ),
    );
    const exactNarrowDelta =
      identityCorrelation &&
      declaredDeltaMatches &&
      canonicalJson(addedExclusions) ===
        canonicalJson(expectedLifecycleTypes) &&
      removedExclusions.length === 0;

    // The frozen evidence has representative positive lifecycle rows and some
    // retained unhandled rows, but it does not map a representative row to every
    // requested negative-control family. Fail safely with HOLD rather than
    // interpreting generic retained event types as proof for those families.
    const negativeControlCoverage = false;
    const disposition = exactNarrowDelta ? "hold" : "reject";
    const artifact = {
      schemaVersion: 1,
      kind: "gym-exact-comparison",
      disposition,
      rationale: exactNarrowDelta
        ? "The frozen identities, SQL delta, and representative lifecycle rows agree, but the supplied immutable inputs do not map representative row-level evidence to every requested negative-control family."
        : "The frozen candidate or comparison evidence does not have the exact requested narrow exclusion delta.",
      request: envelope,
      requestCanonicalSha256: sha256(canonicalJson(envelope)),
      correlation: {
        sourceRequestId: envelope.requestId,
        appRequestId: executionRequestId,
        taskId: ctx.reconciliation?.taskId ?? null,
        taskInputCanonicalSha256: sha256(canonicalJson(details)),
        workflow: name,
        resultEventType: "gym.regression.completed",
        resultLocalKey: regressionEmissionLocalKey(ctx, "completed"),
      },
      comparison: {
        baseline: {
          path: baselineIdentity.path,
          sha256: observedBaselineSha,
        },
        candidate: {
          path: candidateIdentity.path,
          sha256: observedCandidateSha,
        },
        suppliedComparisonArtifact: {
          path: comparisonIdentity.path,
          sha256: observedComparisonSha,
        },
        identityCorrelation,
        addedExclusions,
        removedExclusions,
        declaredAddedExclusions,
        expectedLifecycleTypes,
        exactNarrowDelta,
        lifecycleCoverage,
        lifecycleRows,
        retainedUnhandledRows: retainedRows,
        negativeControlsRequested: envelope.scope.negativeControls,
        negativeControlCoverage,
        negativeControlCoverageReason:
          "The immutable comparison artifact does not map representative rows to every named negative-control family.",
      },
      negativeEvidence: {
        eventId: 6053212,
        runId: "may-alignment-test-20260824T213516Z-97905d9c",
        acceptedAsComparison: false,
      },
    };
    const artifactText = `${canonicalJson(artifact)}\n`;
    const artifactSha256 = sha256(artifactText);
    const proofDir = join(
      gymProjectRoot(ctx),
      ".state",
      "proofs",
      `exact-comparison-${safeKey(envelope.requestId, "request")}`,
    );
    const artifactPath = join(proofDir, `${artifactSha256}.json`);
    mkdirSync(proofDir, { recursive: true });
    if (existsSync(artifactPath)) {
      const existing = readFileSync(artifactPath, "utf8");
      if (existing !== artifactText) {
        throw new Error("content-addressed comparison artifact collision");
      }
    } else {
      writeFileSync(artifactPath, artifactText, { flag: "wx" });
    }

    await emitGymEvent(
      ctx,
      regressionEvent(ctx, "completed", "gym.regression.completed", {
        kind: "exact-comparison",
        requestId: envelope.requestId,
        executionRequestId,
        disposition,
        artifactPath,
        artifactSha256,
      }),
    );
    const summary = `Exact comparison ${envelope.requestId} completed with ${disposition.toUpperCase()} disposition.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      result: { disposition, artifactPath, artifactSha256 },
      evidence: [artifactPath],
      actions: [],
    });
  } catch (error) {
    return ctx.blocked(error instanceof Error ? error.message : String(error));
  }
}

function requestedScenarios(details: Record<string, unknown>): string[] {
  const values = Array.isArray(details.scenarios)
    ? details.scenarios
    : details.scenario
      ? [details.scenario]
      : [];
  return values.map((value) => validatedName(value, "scenario", ""));
}

type RegressionEmission =
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
      details.executionRequestId,
      admittedInput.executionRequestId,
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

export async function runRegression(
  ctx: WorkflowContext,
  processRunner: ProcessRunner = runProcess,
): Promise<ExecutionResult> {
  const details = triggerDetails(ctx);
  if (!details)
    return ctx.blocked("Regression trigger event is missing or invalid");

  if (comparisonShaped(details)) {
    return runComparison(ctx, details);
  }

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
