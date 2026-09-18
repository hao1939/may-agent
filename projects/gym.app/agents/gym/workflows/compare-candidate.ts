import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { configureGymRoot } from "@may-agent/gym/loop";
import {
  fingerprintTree,
  readManifest,
  resolveRunDir,
} from "../../../../gym/src/loop/store";

export const name = "compare-candidate";
export const description =
  "Compare one exact frozen May or Scout candidate against one frozen Gym baseline and retain a complete command receipt.";

type Comparison = {
  requestId: string;
  agent: "may" | "scout";
  baselineRunId: string;
  candidate: string;
  candidateFingerprint: string;
  benchmark: string;
  scorerRevision: string;
  frameworkRevision: string;
  model: string;
  scenarios: string[];
  trials: number;
  timeoutMs: number;
  totalAllowanceMs: number;
};

function text(value: unknown, field: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`comparison requires ${field}`);
  return result;
}

export function parseComparison(value: unknown): Comparison {
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const agent = text(data.agent, "agent");
  if (agent !== "may" && agent !== "scout")
    throw new Error("comparison agent must be may or scout");
  const trials = Number(data.trials),
    timeoutMs = Number(data.timeoutMs),
    totalAllowanceMs = Number(data.totalAllowanceMs);
  const scenarios = Array.isArray(data.scenarios)
    ? data.scenarios.map(String).filter(Boolean)
    : [];
  if (new Set(scenarios).size !== scenarios.length)
    throw new Error("comparison scenarios must be unique");
  if (!Number.isInteger(trials) || trials < 1 || trials > 5)
    throw new Error("trials must be 1 through 5");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000)
    throw new Error("timeoutMs must be at least 1000");
  if (
    !Number.isInteger(totalAllowanceMs) ||
    totalAllowanceMs < timeoutMs ||
    totalAllowanceMs > 3_600_000
  )
    throw new Error("invalid totalAllowanceMs");
  if (scenarios.length < 4)
    throw new Error(
      "comparison requires incident, paraphrase, opposite-control and unrelated-transfer scenarios",
    );
  return {
    requestId: text(data.requestId, "requestId"),
    agent,
    baselineRunId: text(data.baselineRunId, "baselineRunId"),
    candidate: text(data.candidate, "candidate"),
    candidateFingerprint: text(
      data.candidateFingerprint,
      "candidateFingerprint",
    ),
    benchmark: text(data.benchmark, "benchmark"),
    scorerRevision: text(data.scorerRevision, "scorerRevision"),
    frameworkRevision: text(data.frameworkRevision, "frameworkRevision"),
    model: text(data.model, "model"),
    scenarios,
    trials,
    timeoutMs,
    totalAllowanceMs,
  };
}

function sameValues(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    [...actual]
      .sort()
      .every((value, index) => value === [...expected].sort()[index])
  );
}
function bounded(value: string): string {
  return Buffer.byteLength(value) <= 65_536 ? value : value.slice(-65_536);
}
function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export async function compareCandidate(
  ctx: WorkflowContext,
): Promise<ExecutionResult> {
  let request: Comparison;
  try {
    request = parseComparison(ctx.input);
  } catch (error) {
    return ctx.blocked(String(error));
  }
  if (!ctx.workspace)
    return ctx.blocked("Comparison requires a granted App workspace");
  const root = resolve(ctx.workspace.projectRoot);
  configureGymRoot(root);
  let baselineDir: string, baseline: ReturnType<typeof readManifest>;
  try {
    baselineDir = resolveRunDir(request.baselineRunId);
    baseline = readManifest(baselineDir);
  } catch (error) {
    return ctx.blocked(`Frozen baseline unavailable: ${String(error)}`);
  }
  const candidateDir = resolve(
    ctx.workspace.root,
    "agents",
    ".lab",
    request.candidate,
  );
  const scorerPath = baseline.source.evaluator_snapshot
    ? join(baselineDir, baseline.source.evaluator_snapshot)
    : "";
  const preflight =
    baseline.run_id === request.baselineRunId &&
    baseline.agent === request.agent &&
    baseline.benchmark === request.benchmark &&
    sameValues(baseline.scenarios, request.scenarios) &&
    baseline.proof.models.length === 1 &&
    baseline.proof.models[0] === request.model &&
    baseline.proof.framework_revisions.length === 1 &&
    baseline.proof.framework_revisions[0] === request.frameworkRevision &&
    existsSync(candidateDir) &&
    fingerprintTree(candidateDir) === request.candidateFingerprint &&
    Boolean(scorerPath) &&
    existsSync(scorerPath) &&
    sha(scorerPath) === request.scorerRevision;
  if (!preflight)
    return ctx.blocked(
      "Frozen baseline/candidate/scenario/scorer/model/framework identity mismatch before comparison",
    );

  const args = [
    "bun",
    "run",
    "loop",
    "--",
    "verify",
    "--baseline",
    request.baselineRunId,
    "--candidate",
    request.candidate,
    "--trials",
    String(request.trials),
    "--timeout",
    String(request.timeoutMs),
  ];
  const startedAt = Date.now();
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stdout = "",
    stderr = "",
    exitCode = -1;
  try {
    child = Bun.spawn(args, {
      cwd: root,
      env: { ...process.env, GYM_AGENTS_ROOT: dirname(dirname(candidateDir)) },
      stdout: "pipe",
      stderr: "pipe",
    });
    const signal = (ctx as WorkflowContext & { signal?: AbortSignal }).signal;
    const onAbort = () => child?.kill();
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => child?.kill(), request.totalAllowanceMs);
    [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout as ReadableStream<Uint8Array>).text(),
      new Response(child.stderr as ReadableStream<Uint8Array>).text(),
      child.exited,
    ]);
    signal?.removeEventListener("abort", onAbort);
  } finally {
    if (timer) clearTimeout(timer);
  }
  stdout = bounded(stdout);
  stderr = bounded(stderr);
  const candidateRunId = stdout.trim().split(/\r?\n/).at(-1) ?? "";
  let runDir = "",
    manifest: ReturnType<typeof readManifest> | null = null,
    comparison: any = null;
  try {
    runDir = resolveRunDir(candidateRunId);
    manifest = readManifest(runDir);
    const comparisonPath = join(runDir, "comparison.json");
    comparison = JSON.parse(readFileSync(comparisonPath, "utf8"));
  } catch {
    /* held below */
  }
  const outputMatches =
    Boolean(manifest) &&
    manifest!.baseline_run_id === request.baselineRunId &&
    manifest!.agent === request.agent &&
    manifest!.benchmark === request.benchmark &&
    sameValues(manifest!.scenarios, request.scenarios) &&
    manifest!.proof.candidate_fingerprint === request.candidateFingerprint &&
    manifest!.proof.models.length === 1 &&
    manifest!.proof.models[0] === request.model &&
    manifest!.proof.framework_revisions.length === 1 &&
    manifest!.proof.framework_revisions[0] === request.frameworkRevision;
  const receipt = {
    schemaVersion: 1,
    stage: "comparison",
    request,
    argv: args,
    cwd: root,
    startedAt,
    endedAt: Date.now(),
    exitCode,
    stdout,
    stderr,
    baselineDir,
    candidateDir,
    runDir,
    outputMatches,
    comparison,
    verdict:
      exitCode === 0 && outputMatches && comparison?.gate === "pass"
        ? "candidate-supported"
        : "hold",
  };
  const outDir = join(ctx.workspace.appRoot, ".state", "comparisons");
  mkdirSync(outDir, { recursive: true });
  const hash = createHash("sha256")
      .update(JSON.stringify(receipt))
      .digest("hex"),
    receiptPath = join(outDir, `${hash}.json`);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const summary = `Frozen comparison ${receipt.verdict}; receipt ${receiptPath}. Gym evidence is not approval.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    response: summary,
    result: { receiptPath, receiptHash: hash, verdict: receipt.verdict },
    facts: [`comparison-receipt:${receiptPath}`, `comparison-hash:${hash}`],
    actions: [],
  });
}
export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  return compareCandidate(ctx);
}
