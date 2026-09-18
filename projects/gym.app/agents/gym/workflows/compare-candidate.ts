import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";

export const name = "compare-candidate";
export const description =
  "Compare one exact frozen May or Scout candidate against one frozen Gym baseline and retain a complete command receipt.";

export type Comparison = {
  requestId: string;
  agent: "may" | "scout";
  baselineRunId: string;
  baselinePath: string;
  baselineFingerprint: string;
  candidate: string;
  candidatePath: string;
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

type Manifest = {
  run_id: string;
  baseline_run_id: string | null;
  agent: string;
  benchmark: string;
  candidate: string;
  scenarios: string[];
  proof: {
    candidate_fingerprint: string | null;
    models: string[];
    framework_revisions: string[];
  };
  source: { evaluator_snapshot: string | null };
};

const OUTPUT_LIMIT = 65_536;
function text(value: unknown, field: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`comparison requires ${field}`);
  return result;
}
function safeSegment(value: string, field: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..")
    throw new Error(`comparison ${field} must be one safe path segment`);
  return value;
}
function absolutePath(value: unknown, field: string): string {
  const path = text(value, field);
  if (!isAbsolute(path))
    throw new Error(`comparison ${field} must be absolute`);
  return resolve(path);
}
export function parseComparison(value: unknown): Comparison {
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const agent = text(data.agent, "agent");
  if (agent !== "may" && agent !== "scout")
    throw new Error("comparison agent must be may or scout");
  const trials = Number(data.trials);
  const timeoutMs = Number(data.timeoutMs);
  const totalAllowanceMs = Number(data.totalAllowanceMs);
  const scenarios = Array.isArray(data.scenarios)
    ? data.scenarios.map(String).filter(Boolean)
    : [];
  if (new Set(scenarios).size !== scenarios.length)
    throw new Error("comparison scenarios must be unique");
  if (scenarios.length < 4)
    throw new Error(
      "comparison requires incident, paraphrase, opposite-control and unrelated-transfer scenarios",
    );
  if (!Number.isInteger(trials) || trials < 1 || trials > 5)
    throw new Error("trials must be 1 through 5");
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 60_000 ||
    timeoutMs % 60_000 !== 0
  )
    throw new Error(
      "timeoutMs must be whole minutes (at least 60000) for the standalone runner",
    );
  if (
    !Number.isInteger(totalAllowanceMs) ||
    totalAllowanceMs < timeoutMs ||
    totalAllowanceMs > 3_600_000
  )
    throw new Error("invalid totalAllowanceMs");
  return {
    requestId: text(data.requestId, "requestId"),
    agent,
    baselineRunId: safeSegment(
      text(data.baselineRunId, "baselineRunId"),
      "baselineRunId",
    ),
    baselinePath: absolutePath(data.baselinePath, "baselinePath"),
    baselineFingerprint: text(data.baselineFingerprint, "baselineFingerprint"),
    candidate: safeSegment(text(data.candidate, "candidate"), "candidate"),
    candidatePath: absolutePath(data.candidatePath, "candidatePath"),
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
function shaBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function shaFile(path: string): string {
  return shaBytes(readFileSync(path));
}
export function fingerprintTree(path: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relative: string): void => {
    const stat = lstatSync(current);
    hash.update(
      `${relative}\0${stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : "file"}\0`,
    );
    if (stat.isSymbolicLink()) hash.update(readlinkSync(current));
    else if (stat.isDirectory())
      for (const entry of readdirSync(current).sort())
        visit(join(current, entry), join(relative, entry));
    else hash.update(readFileSync(current));
  };
  visit(path, ".");
  return hash.digest("hex");
}
function json<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
function same(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((item, i) => item === [...expected].sort()[i])
  );
}
async function boundedStream(
  stream: ReadableStream<Uint8Array>,
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let kept = 0,
    bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (kept < OUTPUT_LIMIT) {
      const chunk = value.subarray(0, OUTPUT_LIMIT - kept);
      chunks.push(chunk);
      kept += chunk.byteLength;
    }
  }
  return {
    text: Buffer.concat(chunks).toString("utf8"),
    bytes,
    truncated: bytes > kept,
  };
}
function trustedRunDir(stateDir: string, stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1)
    throw new Error("runner stdout must contain exactly one run directory");
  const root = realpathSync(join(stateDir, "benchmarks"));
  const run = realpathSync(lines[0]!);
  if (!run.startsWith(`${root}${sep}`) || basename(run) === "")
    throw new Error(
      "runner returned a run directory outside granted Gym state",
    );
  return run;
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
  const gymRoot = resolve(ctx.workspace.projectRoot);
  const baselineDir = request.baselinePath;
  const candidateDir = request.candidatePath;
  if (
    basename(baselineDir) !== request.baselineRunId ||
    basename(candidateDir) !== request.candidate ||
    basename(dirname(candidateDir)) !== ".lab"
  )
    return ctx.blocked(
      "Frozen baseline/candidate artifact paths do not match their exact identities",
    );
  const agentsRoot = dirname(dirname(candidateDir));
  let baseline: Manifest;
  try {
    baseline = json<Manifest>(join(baselineDir, "manifest.json"));
  } catch (error) {
    return ctx.blocked(`Frozen baseline unavailable: ${String(error)}`);
  }
  const scorerPath = baseline.source.evaluator_snapshot
    ? resolve(baselineDir, baseline.source.evaluator_snapshot)
    : "";
  const preflight =
    baseline.run_id === request.baselineRunId &&
    fingerprintTree(baselineDir) === request.baselineFingerprint &&
    baseline.agent === request.agent &&
    baseline.benchmark === request.benchmark &&
    same(baseline.scenarios, request.scenarios) &&
    baseline.proof.models.length === 1 &&
    baseline.proof.models[0] === request.model &&
    baseline.proof.framework_revisions.length === 1 &&
    baseline.proof.framework_revisions[0] === request.frameworkRevision &&
    existsSync(candidateDir) &&
    fingerprintTree(candidateDir) === request.candidateFingerprint &&
    Boolean(scorerPath) &&
    scorerPath.startsWith(`${resolve(baselineDir)}${sep}`) &&
    existsSync(scorerPath) &&
    shaFile(scorerPath) === request.scorerRevision;
  if (!preflight)
    return ctx.blocked(
      "Frozen baseline/candidate/scenario/scorer/model/framework identity mismatch before comparison",
    );
  const signal =
    (ctx as WorkflowContext & { signal?: AbortSignal }).signal ??
    new AbortController().signal;
  signal.throwIfAborted();
  const outputRoot = resolve(ctx.workspace.output);
  const stateDir = join(outputRoot, "gym-state");
  const receiptDir = join(outputRoot, "comparisons");
  mkdirSync(join(stateDir, "benchmarks"), { recursive: true });
  mkdirSync(receiptDir, { recursive: true });
  const argv = [
    "setsid",
    process.env.BUN_EXEC_PATH || "bun",
    join(gymRoot, "src", "loop", "cli.ts"),
    "verify",
    "--baseline",
    baselineDir,
    "--candidate",
    request.candidate,
    "--trials",
    String(request.trials),
    "--timeout",
    String(request.timeoutMs / 60_000),
  ];
  const startedAt = Date.now();
  const child = Bun.spawn(argv, {
    cwd: gymRoot,
    env: {
      ...process.env,
      GYM_AGENTS_ROOT: agentsRoot,
      GYM_STATE_DIR: stateDir,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  let timedOut = false;
  const killGroup = (kind: "SIGTERM" | "SIGKILL") => {
    try {
      process.kill(-child.pid, kind);
    } catch {
      try {
        child.kill(kind);
      } catch {
        /* already exited */
      }
    }
  };
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  let terminationRequested = false;
  const terminate = () => {
    terminationRequested = true;
    killGroup("SIGTERM");
    forceTimer ??= setTimeout(() => killGroup("SIGKILL"), 1_000);
  };
  const abort = () => terminate();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    terminate();
  }, request.totalAllowanceMs);
  const [stdout, stderr, exitCode] = await Promise.all([
    boundedStream(child.stdout as ReadableStream<Uint8Array>),
    boundedStream(child.stderr as ReadableStream<Uint8Array>),
    child.exited,
  ]).finally(() => {
    clearTimeout(timer);
    // The Bun wrapper can exit after SIGTERM while a descendant in the same
    // process group remains alive. Complete cancellation before discarding the
    // escalation timer so an aborted/timed-out comparison cannot leak model work.
    if (terminationRequested) killGroup("SIGKILL");
    if (forceTimer) clearTimeout(forceTimer);
    signal.removeEventListener("abort", abort);
  });
  let runDir = "",
    manifest: Manifest | null = null,
    comparison: Record<string, unknown> | null = null;
  try {
    runDir = trustedRunDir(stateDir, stdout.text);
    manifest = json<Manifest>(join(runDir, "manifest.json"));
    comparison = json<Record<string, unknown>>(join(runDir, "comparison.json"));
  } catch {
    /* recorded as an unverifiable output below */
  }
  const outputScorer = manifest?.source.evaluator_snapshot
    ? resolve(runDir, manifest.source.evaluator_snapshot)
    : "";
  let artifactsUnchanged = false;
  try {
    artifactsUnchanged =
      fingerprintTree(baselineDir) === request.baselineFingerprint &&
      fingerprintTree(candidateDir) === request.candidateFingerprint;
  } catch {
    /* an unavailable or changed artifact cannot support the candidate */
  }
  const outputMatches =
    Boolean(manifest) &&
    artifactsUnchanged &&
    manifest!.run_id === basename(runDir) &&
    manifest!.baseline_run_id === request.baselineRunId &&
    manifest!.candidate === request.candidate &&
    manifest!.agent === request.agent &&
    manifest!.benchmark === request.benchmark &&
    same(manifest!.scenarios, request.scenarios) &&
    manifest!.proof.candidate_fingerprint === request.candidateFingerprint &&
    manifest!.proof.models.length === 1 &&
    manifest!.proof.models[0] === request.model &&
    manifest!.proof.framework_revisions.length === 1 &&
    manifest!.proof.framework_revisions[0] === request.frameworkRevision &&
    Boolean(outputScorer) &&
    outputScorer.startsWith(`${runDir}${sep}`) &&
    existsSync(outputScorer) &&
    shaFile(outputScorer) === request.scorerRevision &&
    comparison?.baseline_run_id === request.baselineRunId &&
    comparison?.candidate_run_id === manifest!.run_id;
  const verdict =
    exitCode === 0 &&
    !timedOut &&
    !signal.aborted &&
    outputMatches &&
    comparison?.gate === "pass"
      ? "candidate-supported"
      : "hold";
  const receipt = {
    schemaVersion: 1,
    stage: "comparison",
    request,
    argv,
    cwd: gymRoot,
    env: { GYM_AGENTS_ROOT: agentsRoot, GYM_STATE_DIR: stateDir },
    startedAt,
    endedAt: Date.now(),
    exitCode,
    timedOut,
    aborted: signal.aborted,
    stdout,
    stderr,
    baselineDir,
    candidateDir,
    runDir,
    outputMatches,
    comparison,
    verdict,
  };
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const receiptHash = shaBytes(receiptBytes);
  const receiptPath = join(receiptDir, `${receiptHash}.json`);
  writeFileSync(receiptPath, receiptBytes, { flag: "wx" });
  if (shaFile(receiptPath) !== receiptHash)
    throw new Error("saved comparison receipt hash mismatch");
  const summary = `Frozen comparison ${verdict}; receipt ${receiptPath}. Gym evidence is not approval.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    response: summary,
    result: { receiptPath, receiptHash, verdict },
    facts: [
      `comparison-receipt:${receiptPath}`,
      `comparison-hash:${receiptHash}`,
    ],
    actions: [],
  });
}
export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  return compareCandidate(ctx);
}
