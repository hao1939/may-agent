/**
 * single-spec-verifier — run one AKS RP E2E spec through Azure DevOps Pipelines.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import {
  workflowResult,
  workflowResultVersion,
  type StructuredWorkflowResult,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  readTaskTree,
  taskRevision,
  withTreeLock,
  type TaskNode,
  type TaskTreeConfig,
} from "./lib/task-tree-store.ts";
import {
  buildTaskTreeConfig,
  completeStartedAttempt,
  emitTaskCompleted,
  markAttemptStartedOnce,
  taskRevisionFromTrigger,
} from "./default-task-worker.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  sourceDir,
  triggerString,
} from "./lib/workflow-input.ts";
import {
  bindKnownWorkflowRun,
  defaultSpecLoopStatePath,
  featureSetPrioritySpecIds,
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopSpecState,
  type SpecLoopSpecStatus,
} from "./lib/spec-loop-store.ts";
import {
  defaultAdoAgentPool,
  dispatchWorkflow as dispatchPipelineWorkflow,
  downloadWorkflowRunArtifacts as downloadPipelineArtifacts,
  getWorkflowRun as getPipelineWorkflowRun,
  pipelineRunLookupPollIntervalMs,
  newestWorkflowRun as newestPipelineWorkflowRun,
  resolvePipelineClient,
  waitForWorkflowRun as waitForPipelineWorkflowRun,
  writePipelineDispatchMetadata,
  type PipelineDispatchMetadata,
  type PipelineRun,
} from "./lib/ado-pipelines.ts";
import {
  classifyFixForwardFailure,
  fixForwardErrorFingerprint,
  fixForwardInputFingerprint,
} from "./lib/fix-forward.ts";

export const name = "single-spec-verifier";
export const description =
  "Dispatch and review one single-spec Azure DevOps pipeline execution.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "single-spec-verifier-v1",
  input: {
    required: ["specId or task.context.specId"],
    optional: [
      "target",
      "mode",
      "task.context.adoPipeline",
      "task.context.branch",
      "task.context.timeoutMinutes",
      "task.context.stateRef",
      "task.context.loopTaskId",
    ],
    description:
      "Verify one AKS RP E2E spec. Direct input runs the repo-native spec command; task input dispatches and reviews the configured ADO single-spec pipeline.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["subject", "status", "artifacts", "checks", "problem", "details"],
    description:
      "Reports spec verification status, result artifacts, backend details, and exact problem information when the spec did not pass.",
  },
};

type CommandResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

type ProjectResult = {
  status?: string;
  target?: {
    surface?: string;
  };
  specResults?: Array<{
    specId?: string;
    status?: string;
    reason?: string;
    category?: string;
    artifactRefs?: string[];
  }>;
};

type WorkflowMetadata = {
  loop_key?: string;
};

type SpecRunnerArtifact = {
  specId?: string;
  status?: string;
  phase?: string;
  audit?: {
    subscriptionId?: string;
    resourceGroup?: string;
    clusterName?: string;
    apiVersion?: string;
  };
  probeEvidence?: {
    status?: string;
    config?: {
      subscriptionId?: string;
      location?: string;
      resourceGroup?: string;
      clusterName?: string;
    };
    cleanup?: {
      attempted?: boolean;
      status?: string;
      notes?: string[];
    };
    assertions?: Array<{
      name?: string;
      ok?: boolean;
      verdictImpact?: string;
      detail?: string;
    }>;
  };
  summary?: string;
};

type ArtifactIdentityInspection = {
  bundlePath: string;
  metadataPath: string | null;
  topLevelResultPath: string | null;
  loopKey: string;
  resultSpecId: string;
  artifactFamily: string;
  artifactResultPath: string;
  artifactIdentityPath: string;
  artifactLocalResultPath: string;
  artifactLocalStatusPath: string;
  childStatusPath: string;
  childResultPath: string;
  childSpecId: string;
  childStatus: string;
  childPhase: string;
  childEvidenceStatus: string;
  childFailedVerdictAssertions: string[];
  topLevelStatus: string;
  topLevelSpecResultsCount: number;
  sameSpecChildEvidence: boolean;
  sameSpecAggregationFailure: boolean;
  projectResult: ProjectResult | null;
  mismatches: string[];
};

function commandEnv(): NodeJS.ProcessEnv {
  const localBin = "/app/.state/.local/bin";
  const path = process.env.PATH ?? "";
  return {
    ...process.env,
    PATH: path.split(":").includes(localBin) ? path : `${localBin}:${path}`,
  };
}

function currentAttemptIsStillActive(
  config: TaskTreeConfig,
  taskId: string,
  attemptId: string,
): boolean {
  try {
    const tree = readTaskTree(config);
    const task = tree.tasks[taskId];
    if (!task || String(task.status ?? task.state ?? "") !== "active")
      return false;
    const trace =
      task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
        ? (task.trace as Record<string, unknown>)
        : {};
    return trace.current_attempt_id === attemptId;
  } catch {
    return false;
  }
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function contextString(task: TaskNode, key: string, fallback = ""): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function pipelineNameContext(task: TaskNode, fallback: string): string {
  return (
    contextString(task, "adoPipeline", "") ||
    contextString(task, "pipelineWorkflow", "") ||
    contextString(task, "githubWorkflow", fallback)
  );
}

function agentPoolContext(task: TaskNode): string {
  return (
    contextString(task, "agentPool", "") ||
    contextString(task, "agent_pool", "") ||
    defaultAdoAgentPool()
  );
}

function contextOptionalText(task: TaskNode, key: string): string {
  const value = taskContext(task)[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function optionalBooleanContext(task: TaskNode, key: string): boolean | null {
  const value = taskContext(task)[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return null;
}

function shouldPreflightSpecExecutionPolicy(input: {
  projectDir: string;
  task: TaskNode;
}): boolean {
  const explicit = optionalBooleanContext(
    input.task,
    "specExecutionPolicyPreflight",
  );
  if (explicit !== null) return explicit;
  return ["check-private-source-policy.ts", "check-live-admission.ts"].some(
    (script) => existsSync(join(input.projectDir, "runner", script)),
  );
}

type SpecExecutionPolicyResult = { ok: true } | { ok: false; reason: string };

function compactCommandOutput(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 2_000);
}

function checkSpecExecutionPolicy(input: {
  projectDir: string;
  specId: string;
  enabled: boolean;
}): SpecExecutionPolicyResult {
  if (!input.enabled) return { ok: true };
  const scripts = [
    "check-private-source-policy.ts",
    "check-live-admission.ts",
  ].filter((script) => existsSync(join(input.projectDir, "runner", script)));
  for (const script of scripts) {
    const result = spawnSync(
      "bun",
      [`runner/${script}`, "--spec", input.specId],
      {
        cwd: input.projectDir,
        encoding: "utf8",
        timeout: 30_000,
        env: commandEnv(),
      },
    );
    if (result.status === 0 && !result.error) continue;
    const output = compactCommandOutput(
      [result.stderr, result.stdout, result.error?.message]
        .filter(Boolean)
        .join("\n"),
    );
    return {
      ok: false,
      reason:
        output ||
        `${script} failed with status ${String(result.status ?? "unknown")}`,
    };
  }
  return { ok: true };
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs = 120_000,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: commandEnv(),
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleContainsExactLoopKey(title: string, loopKey: string): boolean {
  if (!loopKey) return false;
  if (title.includes(`[${loopKey}]`)) return true;
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_.-])${escapeRegExp(loopKey)}([^A-Za-z0-9_.-]|$)`,
  );
  return pattern.test(title);
}

function extractSpecIdsFromRunTitle(title: string): string[] {
  const matches = title.match(/spec\.[A-Za-z0-9][A-Za-z0-9.-]*/g) ?? [];
  return [...new Set(matches.map((value) => value.trim()).filter(Boolean))];
}

function workflowRunMatches(input: {
  displayTitle?: string;
  loopKey: string;
  specId: string;
}): boolean {
  const title = String(input.displayTitle ?? "");
  if (!title) return false;
  if (titleContainsExactLoopKey(title, input.loopKey)) return true;
  return extractSpecIdsFromRunTitle(title).includes(input.specId);
}

function isUnexpectedLoopKeyDispatchError(result: CommandResult): boolean {
  const detail = `${result.stderr}\n${result.stdout}\n${result.error ?? ""}`;
  return (
    (result.status === 422 || /"status"\s*:\s*"?422"?/i.test(detail)) &&
    /unexpected inputs provided/i.test(detail) &&
    /(loop_key|metadata)/i.test(detail)
  );
}

function findFiles(root: string, name: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) found.push(...findFiles(path, name));
    else if (entry === name) found.push(path);
  }
  return found;
}

function readProjectResult(path: string): ProjectResult | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ProjectResult;
  } catch {
    return null;
  }
}

function readWorkflowMetadata(path: string): WorkflowMetadata | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as WorkflowMetadata;
  } catch {
    return null;
  }
}

function readSpecRunnerArtifact(path: string): SpecRunnerArtifact | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SpecRunnerArtifact;
  } catch {
    return null;
  }
}

function expectedArtifactFamily(specId: string): string {
  return specId.replace(/^spec\./, "").replace(/\./g, "-");
}

function loopKeyFamily(loopKey: string): string {
  const trimmed = loopKey.trim();
  if (!trimmed) return "";
  const attemptMarker = trimmed.lastIndexOf("-a_");
  const family = attemptMarker > 0 ? trimmed.slice(0, attemptMarker) : trimmed;
  return family.replace(/-+$/g, "");
}

function readArtifactIdentity(input: {
  artifactDir: string;
  expectedSpecId: string;
  expectedLoopFamily: string;
}): ArtifactIdentityInspection | null {
  if (!existsSync(input.artifactDir)) return null;
  const bundles = readdirSync(input.artifactDir)
    .map((entry) => join(input.artifactDir, entry))
    .filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));
  const bundlePath = bundles[0];
  if (!bundlePath) return null;

  const metadataPath = join(bundlePath, "workflow-metadata.json");
  const topLevelResultPath =
    findFiles(bundlePath, "result.json")
      .filter(
        (path) => !/\/artifacts\/[^/]+\/spec-runner\/result\.json$/i.test(path),
      )
      .sort((a, b) => a.localeCompare(b))[0] ?? null;
  const projectResult = topLevelResultPath
    ? readProjectResult(topLevelResultPath)
    : null;
  const metadata = existsSync(metadataPath)
    ? readWorkflowMetadata(metadataPath)
    : null;
  const loopKey = String(metadata?.loop_key ?? "").trim();
  const resultSpecId = String(
    projectResult?.specResults?.[0]?.specId ?? "",
  ).trim();
  const topLevelStatus = String(projectResult?.status ?? "").trim();
  const topLevelSpecResultsCount = Array.isArray(projectResult?.specResults)
    ? projectResult.specResults.length
    : 0;
  const expectedFamily = expectedArtifactFamily(input.expectedSpecId);
  const artifactRefs = Array.isArray(
    projectResult?.specResults?.[0]?.artifactRefs,
  )
    ? projectResult.specResults[0].artifactRefs
        .map((ref) => String(ref ?? "").trim())
        .filter(Boolean)
    : [];
  const artifactResultPath =
    artifactRefs.find((ref) =>
      /\/artifacts\/[^/]+\/spec-runner\/result\.json$/i.test(ref),
    ) ?? "";
  const artifactIdentityPath =
    artifactResultPath ||
    artifactRefs.find((ref) =>
      /\/artifacts\/[^/]+\/spec-runner\/status\.json$/i.test(ref),
    ) ||
    "";
  const artifactFamilyMatch = artifactIdentityPath.match(
    /\/artifacts\/([^/]+)\/spec-runner\/(?:result|status)\.json$/i,
  );
  const artifactFamily = artifactFamilyMatch?.[1] ?? "";
  const artifactLocalResultPath = artifactFamily
    ? (findFiles(bundlePath, "result.json")
        .filter((path) =>
          new RegExp(
            `/artifacts/${escapeRegExp(artifactFamily)}/spec-runner/result\\.json$`,
            "i",
          ).test(path),
        )
        .sort((a, b) => a.localeCompare(b))[0] ?? "")
    : "";
  const artifactLocalStatusPath = artifactFamily
    ? (findFiles(bundlePath, "status.json")
        .filter((path) =>
          new RegExp(
            `/artifacts/${escapeRegExp(artifactFamily)}/spec-runner/status\\.json$`,
            "i",
          ).test(path),
        )
        .sort((a, b) => a.localeCompare(b))[0] ?? "")
    : "";
  const childStatusPath =
    findFiles(bundlePath, "status.json")
      .filter((path) =>
        new RegExp(
          `/artifacts/${expectedFamily}/spec-runner/status\\.json$`,
          "i",
        ).test(path),
      )
      .sort((a, b) => a.localeCompare(b))[0] ?? "";
  const childResultPath =
    findFiles(bundlePath, "result.json")
      .filter((path) =>
        new RegExp(
          `/artifacts/${expectedFamily}/spec-runner/result\\.json$`,
          "i",
        ).test(path),
      )
      .sort((a, b) => a.localeCompare(b))[0] ?? "";
  const childStatusArtifact = childStatusPath
    ? readSpecRunnerArtifact(childStatusPath)
    : null;
  const childResultArtifact = childResultPath
    ? readSpecRunnerArtifact(childResultPath)
    : null;
  const childSpecId = String(
    childResultArtifact?.specId ?? childStatusArtifact?.specId ?? "",
  ).trim();
  const childStatus = String(
    childResultArtifact?.status ?? childStatusArtifact?.status ?? "",
  ).trim();
  const childPhase = String(
    childResultArtifact?.phase ?? childStatusArtifact?.phase ?? "",
  ).trim();
  const childEvidenceStatus = String(
    childResultArtifact?.probeEvidence?.status ??
      childStatusArtifact?.probeEvidence?.status ??
      "",
  ).trim();
  const childFailedVerdictAssertions = (
    childResultArtifact?.probeEvidence?.assertions ??
    childStatusArtifact?.probeEvidence?.assertions ??
    []
  )
    .filter(
      (assertion) =>
        assertion?.ok === false &&
        ["preflight", "claim"].includes(
          String(assertion.verdictImpact ?? "")
            .trim()
            .toLowerCase(),
        ),
    )
    .map((assertion) =>
      [assertion.name, assertion.detail].filter(Boolean).join(": "),
    )
    .filter(Boolean);
  const sameSpecChildEvidence =
    !!childSpecId && childSpecId === input.expectedSpecId;
  const sameSpecAggregationFailure =
    !resultSpecId &&
    sameSpecChildEvidence &&
    loopKeyFamily(loopKey) === input.expectedLoopFamily;
  const mismatches: string[] = [];

  if (!loopKey) {
    mismatches.push("workflow-metadata.json missing loop_key");
  } else {
    const actualLoopFamily = loopKeyFamily(loopKey);
    if (actualLoopFamily !== input.expectedLoopFamily) {
      mismatches.push(
        `workflow-metadata loop_key family=${actualLoopFamily} does not equal expected family ${input.expectedLoopFamily}`,
      );
    }
  }

  if (!resultSpecId) {
    if (!sameSpecAggregationFailure) {
      mismatches.push("top-level result.json missing specResults[0].specId");
    }
  } else if (resultSpecId !== input.expectedSpecId) {
    mismatches.push(
      `top-level result specId=${resultSpecId} does not match expected ${input.expectedSpecId}`,
    );
  }

  if (!artifactIdentityPath) {
    // Older and reduced single-spec artifacts may omit artifactRefs entirely.
    // The top-level result specId and workflow loop key are the identity source
    // of truth in that case; artifactRefs only add a stronger family check when
    // present.
  } else if (!artifactFamily) {
    mismatches.push(
      `artifact identity path ${artifactIdentityPath} does not expose artifacts/<family>/spec-runner/result.json or status.json`,
    );
  } else if (artifactFamily !== expectedFamily) {
    mismatches.push(
      `artifact family=${artifactFamily} does not match expected ${expectedFamily}`,
    );
  }

  return {
    bundlePath,
    metadataPath: existsSync(metadataPath) ? metadataPath : null,
    topLevelResultPath,
    loopKey,
    resultSpecId,
    artifactFamily,
    artifactResultPath,
    artifactIdentityPath,
    artifactLocalResultPath,
    artifactLocalStatusPath,
    childStatusPath,
    childResultPath,
    childSpecId,
    childStatus,
    childPhase,
    childEvidenceStatus,
    childFailedVerdictAssertions,
    topLevelStatus,
    topLevelSpecResultsCount,
    sameSpecChildEvidence,
    sameSpecAggregationFailure,
    projectResult,
    mismatches,
  };
}

function classifyProjectResult(
  result: ProjectResult | null,
  specId: string,
): {
  loopStatus: SpecLoopSpecStatus;
  claim: "done" | "partial" | "blocked";
  reason: string;
} {
  if (!result) {
    return {
      loopStatus: "error",
      claim: "blocked",
      reason: "No parseable result.json artifact was found.",
    };
  }
  const spec =
    result.specResults?.find((entry) => entry.specId === specId) ??
    result.specResults?.[0];
  const reason = spec?.reason ?? "";
  const category = String(spec?.category ?? "")
    .trim()
    .toLowerCase();
  const targetSurface = String(result.target?.surface ?? "")
    .trim()
    .toLowerCase();
  const nonLiveSurface = ["dry-run-validation", "check-validation"].includes(
    targetSurface,
  );
  const passedStatus = String(spec?.status ?? result.status ?? "error")
    .trim()
    .toLowerCase();

  if (
    nonLiveSurface &&
    ["pass", "passed", "success", "succeeded"].includes(passedStatus)
  ) {
    return {
      loopStatus: "error",
      claim: "partial",
      reason:
        reason ||
        `Spec completed on non-live surface ${targetSurface}; dry-run/check validation is useful evidence but not a live pass verdict.`,
    };
  }
  if (category === "environment_blocker") {
    return {
      loopStatus: "error",
      claim: "partial",
      reason:
        reason ||
        "Spec hit a structured environment blocker; keep visible for agent diagnosis, retry, or test repair.",
    };
  }

  const status = String(spec?.status ?? result.status ?? "error")
    .trim()
    .toLowerCase();
  if (["pass", "passed", "success", "succeeded"].includes(status)) {
    return {
      loopStatus: "pass",
      claim: "done",
      reason: reason || "Spec passed.",
    };
  }
  if (["skip", "skipped"].includes(status)) {
    return {
      loopStatus: "error",
      claim: "partial",
      reason: reason || "Spec did not produce a live pass verdict.",
    };
  }
  if (["fail", "failed", "failure"].includes(status)) {
    return {
      loopStatus: "fail",
      claim: "partial",
      reason: reason || "Spec failed.",
    };
  }
  if (["block", "blocked"].includes(status)) {
    return {
      loopStatus: "error",
      claim: "partial",
      reason: reason || "Spec ended before a runnable test verdict.",
    };
  }
  return {
    loopStatus: "error",
    claim: "partial",
    reason: reason || `Spec ended with ${status}.`,
  };
}

function specFixForwardPatch(input: {
  specId: string;
  target: string;
  pipeline: string;
  branch: string;
  status: SpecLoopSpecStatus;
  reason: string;
  resultPath?: string | null;
}): Partial<SpecLoopSpecState> {
  if (input.status === "pass") {
    return {
      failureClass: null,
      diagnosis: null,
      inputFingerprint: fixForwardInputFingerprint({
        specId: input.specId,
        target: input.target,
        pipeline: input.pipeline,
        branch: input.branch,
      }),
      errorFingerprint: null,
    };
  }
  const failureClass = classifyFixForwardFailure({
    status: input.status,
    reason: input.reason,
  });
  const inputFingerprint = fixForwardInputFingerprint({
    specId: input.specId,
    target: input.target,
    pipeline: input.pipeline,
    branch: input.branch,
  });
  return {
    failureClass,
    diagnosis: input.reason,
    inputFingerprint,
    errorFingerprint: fixForwardErrorFingerprint({
      status: input.status,
      failureClass,
      reason: input.reason,
      resultPath: input.resultPath,
    }),
  };
}

function directInputSpecId(
  rawTask: string,
  trigger: ReturnType<typeof parseTriggerEvent>,
): string {
  return (
    triggerString(trigger, "specId") ||
    triggerString(trigger, "spec_id") ||
    triggerString(trigger, "spec") ||
    field(rawTask, "specId") ||
    field(rawTask, "spec_id") ||
    field(rawTask, "spec") ||
    ""
  ).trim();
}

function directInputMode(
  rawTask: string,
  trigger: ReturnType<typeof parseTriggerEvent>,
): "live" | "dry-run" | "check" {
  const raw = (triggerString(trigger, "mode") || field(rawTask, "mode") || "")
    .trim()
    .toLowerCase();
  if (raw === "check") return "check";
  if (
    raw === "dry-run" ||
    raw === "dryrun" ||
    raw === "dry_run" ||
    triggerString(trigger, "dryRun").toLowerCase() === "true" ||
    field(rawTask, "dryRun")?.toLowerCase() === "true"
  ) {
    return "dry-run";
  }
  return "live";
}

function directInputTarget(
  rawTask: string,
  trigger: ReturnType<typeof parseTriggerEvent>,
): string {
  return (
    triggerString(trigger, "target") ||
    field(rawTask, "target") ||
    "staging"
  ).trim();
}

function directInputTimeoutMs(
  rawTask: string,
  trigger: ReturnType<typeof parseTriggerEvent>,
): number {
  const raw =
    triggerString(trigger, "timeoutMinutes") ||
    triggerString(trigger, "timeout_minutes") ||
    field(rawTask, "timeoutMinutes") ||
    field(rawTask, "timeout_minutes") ||
    "";
  const minutes = Number.parseInt(raw, 10);
  return Number.isFinite(minutes) && minutes > 0
    ? minutes * 60_000
    : 3 * 60 * 60_000;
}

function lastDirectResultDir(output: string): string {
  const matches = [...output.matchAll(/runs\/test-results\/[A-Za-z0-9_.-]+/g)];
  return matches.length ? matches[matches.length - 1][0] : "";
}

function directSpecVerifierResult(input: {
  specId: string;
  target: string;
  mode: "live" | "dry-run" | "check";
  args: string[];
  command: CommandResult;
  resultDir: string;
  resultPath: string;
  classification: ReturnType<typeof classifyProjectResult>;
}): StructuredWorkflowResult {
  const passed = input.classification.loopStatus === "pass";
  const problem = passed
    ? null
    : {
        category: "single-spec-verification",
        diagnosis: input.classification.reason,
        resumeCondition:
          input.mode === "live"
            ? "rerun after the reported spec, scenario, runner, environment, or product issue is fixed"
            : "rerun live verification after dry-run/check issues are fixed",
      };
  return workflowResult({
    workflow: name,
    workflowVersion: workflowContract.version,
    subject: {
      kind: "spec",
      id: input.specId,
    },
    status: passed ? "done" : "partial",
    summary: [
      `Direct ${input.mode} verification for ${input.specId} classified as ${input.classification.loopStatus}.`,
      input.classification.reason,
      input.resultDir ? `Result: ${input.resultDir}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    artifacts: [input.resultDir, input.resultPath].filter(Boolean),
    checks: [
      {
        name: "repo-native-spec-command",
        status: input.command.ok ? "pass" : "fail",
      },
    ],
    problem,
    inputFingerprint: {
      specId: input.specId,
      target: input.target,
      mode: input.mode,
    },
    details: {
      backend: "repo-native-command",
      command: ["bun", ...input.args].join(" "),
      exitStatus: input.command.status,
      liveVerified: input.mode === "live" && passed,
      stdout: input.command.stdout.slice(-4_000),
      stderr: input.command.stderr.slice(-4_000),
      error: input.command.error,
    },
  });
}

function specRunnerArtifactForIdentity(
  identity: ArtifactIdentityInspection | null,
): SpecRunnerArtifact | null {
  if (!identity) return null;
  for (const path of [
    identity.childResultPath,
    identity.artifactLocalResultPath,
    identity.childStatusPath,
    identity.artifactLocalStatusPath,
  ]) {
    if (!path) continue;
    const artifact = readSpecRunnerArtifact(path);
    if (artifact) return artifact;
  }
  return null;
}

function artifactText(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function pipelineSpecVerifierResult(input: {
  specId: string;
  target: string;
  pipeline: string;
  branch: string;
  runId: string;
  runUrl: string | null;
  resultPath: string;
  classification: ReturnType<typeof classifyProjectResult>;
  download: CommandResult;
  watchOk: boolean;
  watchDetail?: string;
  identity: ArtifactIdentityInspection | null;
}): StructuredWorkflowResult {
  const passed = input.classification.loopStatus === "pass";
  const artifact = specRunnerArtifactForIdentity(input.identity);
  const resourceGroup =
    artifactText(artifact?.audit?.resourceGroup) ||
    artifactText(artifact?.probeEvidence?.config?.resourceGroup);
  const clusterName =
    artifactText(artifact?.audit?.clusterName) ||
    artifactText(artifact?.probeEvidence?.config?.clusterName);
  const subscriptionId =
    artifactText(artifact?.audit?.subscriptionId) ||
    artifactText(artifact?.probeEvidence?.config?.subscriptionId);
  const location = artifactText(artifact?.probeEvidence?.config?.location);
  const cleanupStatus = artifactText(artifact?.probeEvidence?.cleanup?.status);
  const failedVerdictAssertions =
    input.identity?.childFailedVerdictAssertions ?? [];
  const liveClusterObserved = Boolean(resourceGroup && clusterName);
  const problem = passed
    ? null
    : {
        category: "single-spec-verification",
        diagnosis: input.classification.reason,
        resumeCondition:
          input.classification.claim === "blocked"
            ? "recover the pipeline artifact or exact external wait, then inspect the same run result"
            : "fix the reported spec, scenario test, runner, environment, or product issue, then rerun this same spec",
      };

  return workflowResult({
    workflow: name,
    workflowVersion: workflowContract.version,
    subject: {
      kind: "spec",
      id: input.specId,
    },
    status: passed ? "done" : "partial",
    summary: [
      `Azure DevOps verification for ${input.specId} classified as ${input.classification.loopStatus}.`,
      input.classification.reason,
      input.runId ? `Run: ${input.runId}` : "",
      input.resultPath ? `Result: ${input.resultPath}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    artifacts: [
      input.resultPath,
      input.identity?.topLevelResultPath ?? "",
      input.identity?.childResultPath ?? "",
      input.identity?.childStatusPath ?? "",
    ].filter(Boolean),
    checks: [
      {
        name: "pipeline-run-completed",
        status: input.watchOk ? "pass" : "fail",
        detail: input.watchDetail,
      },
      {
        name: "artifact-download",
        status: input.download.ok ? "pass" : "fail",
      },
      {
        name: "same-spec-result",
        status:
          input.identity?.sameSpecChildEvidence || !input.identity
            ? "pass"
            : "fail",
      },
      {
        name: "live-aks-cluster-observed",
        status: liveClusterObserved ? "pass" : passed ? "fail" : "skip",
      },
    ],
    problem,
    inputFingerprint: {
      specId: input.specId,
      target: input.target,
      pipeline: input.pipeline,
      branch: input.branch,
    },
    details: {
      backend: "azure-devops-pipeline",
      runId: input.runId,
      runUrl: input.runUrl,
      resultPath: input.resultPath,
      specStatus: input.classification.loopStatus,
      claim: input.classification.claim,
      reason: input.classification.reason,
      liveVerified: passed && liveClusterObserved,
      target: input.target,
      branch: input.branch,
      pipeline: input.pipeline,
      subscriptionId,
      location,
      resourceGroup,
      clusterName,
      cleanupStatus,
      failedVerdictAssertions,
      liveClusterObserved,
      artifactIdentity: input.identity
        ? {
            bundlePath: input.identity.bundlePath,
            metadataPath: input.identity.metadataPath,
            loopKey: input.identity.loopKey,
            resultSpecId: input.identity.resultSpecId,
            childSpecId: input.identity.childSpecId,
            childStatus: input.identity.childStatus,
            childPhase: input.identity.childPhase,
            childEvidenceStatus: input.identity.childEvidenceStatus,
            mismatches: input.identity.mismatches,
          }
        : null,
    },
  });
}

function executeDirectSpecVerification(input: {
  projectDir: string;
  specId: string;
  target: string;
  mode: "live" | "dry-run" | "check";
  timeoutMs: number;
}): StructuredWorkflowResult {
  const args = ["run", "spec", input.specId, "--target", input.target];
  if (input.mode === "dry-run") args.push("--dry-run");
  if (input.mode === "check") args.push("--check");
  const result = spawnSync("bun", args, {
    cwd: input.projectDir,
    encoding: "utf8",
    timeout: input.timeoutMs,
    env: commandEnv(),
  });
  const command: CommandResult = {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
  const output = [command.stdout, command.stderr, command.error]
    .filter(Boolean)
    .join("\n");
  const resultDir = lastDirectResultDir(output);
  const resultPath = resultDir
    ? join(input.projectDir, resultDir, "result.json")
    : "";
  const parsedResult = resultPath ? readProjectResult(resultPath) : null;
  const syntheticResult: ProjectResult = {
    status: command.ok ? "pass" : "error",
    specResults: [
      {
        specId: input.specId,
        status: command.ok ? "pass" : "error",
        reason:
          compactCommandOutput(output) ||
          (command.ok
            ? "Repo-native spec command completed successfully."
            : "Repo-native spec command failed before writing a parseable result."),
        artifactRefs: resultDir ? [resultDir] : [],
      },
    ],
  };
  const classification = classifyProjectResult(
    parsedResult ?? syntheticResult,
    input.specId,
  );
  return directSpecVerifierResult({
    specId: input.specId,
    target: input.target,
    mode: input.mode,
    args,
    command,
    resultDir,
    resultPath,
    classification,
  });
}

function knownWorkflowRunId(task: TaskNode): string {
  const value =
    contextOptionalText(task, "knownWorkflowRunId") ||
    contextOptionalText(task, "runId") ||
    contextOptionalText(task, "workflowRunId");
  return value.trim();
}

function knownWorkflowRunUrl(task: TaskNode): string {
  const value =
    contextOptionalText(task, "knownWorkflowRunUrl") ||
    contextOptionalText(task, "runUrl") ||
    contextOptionalText(task, "workflowRunUrl");
  return value.trim();
}

function dispatchMetadataPath(input: {
  appDir: string;
  taskId: string;
  attemptId: string;
}): string {
  return join(
    input.appDir,
    ".state",
    "spec-loop",
    "dispatches",
    `${input.taskId}-${input.attemptId}.json`,
  );
}

function dispatchMetadataPayload(input: {
  dispatchedAt: string;
  workflow: string;
  branch: string;
  specId: string;
  target: string;
  agentPool: string;
  loopKey: string;
  taskId: string;
  attemptId: string;
  timeoutMinutes?: string;
  includeLoopKey: boolean;
  dispatch: CommandResult;
}): PipelineDispatchMetadata {
  const inputs: Record<string, string> = {
    specs: input.specId,
    target: input.target,
    agent_pool: input.agentPool,
  };
  if (input.timeoutMinutes) {
    inputs.timeout_minutes = input.timeoutMinutes;
  }
  if (input.includeLoopKey) {
    inputs.metadata = JSON.stringify({ loop_key: input.loopKey });
  }
  return {
    dispatchedAt: input.dispatchedAt,
    workflow: input.workflow,
    branch: input.branch,
    inputs,
    loopKey: input.loopKey,
    taskId: input.taskId,
    attemptId: input.attemptId,
    dispatchResult: {
      ok: input.dispatch.ok,
      status: input.dispatch.status,
      stdout: input.dispatch.stdout,
      stderr: input.dispatch.stderr,
      ...(input.dispatch.error ? { error: input.dispatch.error } : {}),
    },
  };
}

export function buildLoopKey(taskId: string, attemptId: string): string {
  return `${taskId}-${attemptId}`
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/-+$/g, "");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    maxConcurrent(ctx.task, trigger),
  );

  if (trigger?.type !== "project.task.assigned") {
    const specId = directInputSpecId(ctx.task, trigger);
    if (specId) {
      return executeDirectSpecVerification({
        projectDir,
        specId,
        target: directInputTarget(ctx.task, trigger),
        mode: directInputMode(ctx.task, trigger),
        timeoutMs: directInputTimeoutMs(ctx.task, trigger),
      }) as unknown as WorkflowResult;
    }
    return ctx.done(
      `Single-spec verifier ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
    );
  }

  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!taskId || !attemptId) {
    return ctx.done("Single-spec verifier requires taskId and attemptId.");
  }

  const start = markAttemptStartedOnce(config, {
    taskId,
    taskRevision: taskRevisionFromTrigger(trigger),
    attemptId,
  });
  if (start.ok === false) return ctx.done(start.reason);
  const task = start.task;
  const specId = contextString(task, "specId");
  const workflow = pipelineNameContext(task, "ado-pipeline-467665");
  const branch = contextString(task, "branch", "dev");
  const target = contextString(task, "target", "staging");
  const agentPool = agentPoolContext(task);
  const timeoutMinutes = contextOptionalText(task, "timeoutMinutes");
  const stateRef = contextString(
    task,
    "stateRef",
    defaultSpecLoopStatePath(appDir),
  );
  const loopTaskId = contextString(
    task,
    "loopTaskId",
    "aks-spec-verification-loop",
  );
  const priorityFeatureSet = contextString(task, "priorityFeatureSet", "");
  const prioritySpecIds = priorityFeatureSet
    ? featureSetPrioritySpecIds(projectDir, priorityFeatureSet)
    : undefined;
  const statePath = stateRef.startsWith("/")
    ? stateRef
    : join(appDir, stateRef);
  loadSpecLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 5,
    statePath,
    prioritySpecIds,
  });

  if (!specId) {
    const summary = `Task ${task.id} is missing context.specId.`;
    const completion = completeStartedAttempt(config, {
      taskId,
      taskRevision: taskRevision(task),
      attemptId,
      claim: "blocked",
      summary,
    });
    if (completion.ok) {
      emitTaskCompleted(ctx, completion.task, {
        taskRevision: taskRevision(task),
        attemptId,
        result: "blocked",
        summary,
      });
    }
    return ctx.done(summary);
  }

  type SpecStatePatch = Parameters<typeof updateSpecLoopSpec>[2];
  const publishState = (
    patchOrFactory:
      | SpecStatePatch
      | ((
          latest: ReturnType<typeof loadSpecLoopState>["state"],
        ) => SpecStatePatch),
    options: { requireActiveAttempt?: boolean } = {},
  ) => {
    if (
      options.requireActiveAttempt === true &&
      !currentAttemptIsStillActive(config, taskId, attemptId)
    ) {
      return false;
    }
    let saved = false;
    withTreeLock(config, () => {
      const latest = loadSpecLoopState({
        appDir,
        projectDir,
        loopTaskId,
        windowSize: 5,
        statePath,
        prioritySpecIds,
      }).state;
      const patch =
        typeof patchOrFactory === "function"
          ? patchOrFactory(latest)
          : patchOrFactory;
      updateSpecLoopSpec(latest, specId, patch);
      saveSpecLoopState(statePath, latest);
      saved = true;
    });
    return saved;
  };

  const attemptState = loadSpecLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 5,
    statePath,
    prioritySpecIds,
  }).state;
  const previousSpecState = attemptState.specs[specId];
  const reusableWorkflowRunId =
    typeof previousSpecState?.activeWorkflowRunId === "string" &&
    previousSpecState.activeWorkflowRunId.trim()
      ? previousSpecState.activeWorkflowRunId.trim()
      : "";
  const recoveredWorkflowRunId = knownWorkflowRunId(task);
  const recoveredWorkflowRunUrl = knownWorkflowRunUrl(task);
  const startedAt = Date.now();
  const loopKey = buildLoopKey(taskId, attemptId);
  const metadataPath = dispatchMetadataPath({
    appDir,
    taskId,
    attemptId,
  });
  if (recoveredWorkflowRunId && !reusableWorkflowRunId) {
    withTreeLock(config, () => {
      const latest = loadSpecLoopState({
        appDir,
        projectDir,
        loopTaskId,
        windowSize: 5,
        statePath,
        prioritySpecIds,
      }).state;
      bindKnownWorkflowRun(latest, specId, {
        runId: recoveredWorkflowRunId,
        runUrl: recoveredWorkflowRunUrl || null,
        taskId,
        attemptId,
        taskSessionId:
          typeof task.session_id === "string" && task.session_id.trim()
            ? task.session_id.trim()
            : null,
        status: "running",
        loopKey,
        dispatchMetadataPath: metadataPath,
      });
      saveSpecLoopState(statePath, latest);
    });
  } else {
    publishState({
      status: "running",
      attempts: (attemptState.specs[specId]?.attempts ?? 0) + 1,
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
      activeAttemptId: attemptId,
      activeTaskSessionId:
        typeof task.session_id === "string" && task.session_id.trim()
          ? task.session_id.trim()
          : null,
      activeWorkflowRunId: reusableWorkflowRunId || null,
      heartbeatAt: new Date().toISOString(),
    });
  }

  const policy = checkSpecExecutionPolicy({
    projectDir,
    specId,
    enabled: shouldPreflightSpecExecutionPolicy({ projectDir, task }),
  });
  if (policy.ok === false) {
    const summary = `Local live policy failed for ${specId}; Azure DevOps pipeline dispatch skipped. ${policy.reason}`;
    publishState({
      status: "error",
      ...specFixForwardPatch({
        specId,
        target,
        pipeline: workflow,
        branch,
        status: "error",
        reason: summary,
      }),
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
      heartbeatAt: new Date().toISOString(),
    });
    const completion = completeStartedAttempt(config, {
      taskId,
      taskRevision: taskRevision(task),
      attemptId,
      claim: "partial",
      summary,
    });
    if (completion.ok) {
      emitTaskCompleted(ctx, completion.task, {
        taskRevision: taskRevision(task),
        attemptId,
        result: "partial",
        summary,
      });
    }
    return ctx.done(summary);
  }

  const pipeline = resolvePipelineClient(projectDir);
  if (!pipeline.client) {
    const summary = `Unable to access Azure DevOps pipeline for ${specId}: ${pipeline.reason || "unknown error"}`;
    publishState({
      status: "error",
      ...specFixForwardPatch({
        specId,
        target,
        pipeline: workflow,
        branch,
        status: "error",
        reason: summary,
      }),
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
      heartbeatAt: new Date().toISOString(),
    });
    const completion = completeStartedAttempt(config, {
      taskId,
      taskRevision: taskRevision(task),
      attemptId,
      claim: "blocked",
      summary,
    });
    if (completion.ok) {
      emitTaskCompleted(ctx, completion.task, {
        taskRevision: taskRevision(task),
        attemptId,
        result: "blocked",
        summary,
      });
    }
    return ctx.done(summary);
  }

  const preferredWorkflowRunId =
    reusableWorkflowRunId || recoveredWorkflowRunId;
  let run: PipelineRun | null = preferredWorkflowRunId
    ? getPipelineWorkflowRun({
        client: pipeline.client,
        projectDir,
        runId: preferredWorkflowRunId,
      })
    : null;
  let runId = preferredWorkflowRunId && run ? preferredWorkflowRunId : "";
  const reattachedRunId = runId;

  if (!runId) {
    if (recoveredWorkflowRunId) {
      const summary = `Known Azure DevOps pipeline run ${recoveredWorkflowRunId} for ${specId} was not discoverable through the ADO run API.`;
      publishState({
        status: "error",
        ...specFixForwardPatch({
          specId,
          target,
          pipeline: workflow,
          branch,
          status: "error",
          reason: summary,
        }),
        activeAttemptId: null,
        activeTaskSessionId: null,
        activeWorkflowRunId: null,
        heartbeatAt: new Date().toISOString(),
      });
      const completion = completeStartedAttempt(config, {
        taskId,
        taskRevision: taskRevision(task),
        attemptId,
        claim: "blocked",
        summary,
      });
      if (completion.ok) {
        emitTaskCompleted(ctx, completion.task, {
          taskRevision: taskRevision(task),
          attemptId,
          result: "blocked",
          summary,
        });
      }
      return ctx.done(summary);
    }
    const dispatchedAt = new Date(startedAt).toISOString();
    let includeLoopKey = true;
    const pipelineInputs = (
      includeMetadata: boolean,
    ): Record<string, string> => ({
      specs: specId,
      target,
      agent_pool: agentPool,
      ...(timeoutMinutes ? { timeout_minutes: timeoutMinutes } : {}),
      ...(includeMetadata
        ? { metadata: JSON.stringify({ loop_key: loopKey }) }
        : {}),
    });
    let dispatch = dispatchPipelineWorkflow({
      client: pipeline.client,
      projectDir,
      workflow,
      branch,
      inputs: pipelineInputs(includeLoopKey),
    });
    if (!dispatch.ok && isUnexpectedLoopKeyDispatchError(dispatch)) {
      includeLoopKey = false;
      dispatch = dispatchPipelineWorkflow({
        client: pipeline.client,
        projectDir,
        workflow,
        branch,
        inputs: pipelineInputs(includeLoopKey),
      });
    }
    writePipelineDispatchMetadata(
      metadataPath,
      dispatchMetadataPayload({
        dispatchedAt,
        workflow,
        branch,
        specId,
        target,
        agentPool,
        loopKey,
        taskId,
        attemptId,
        timeoutMinutes,
        includeLoopKey,
        dispatch,
      }),
    );
    publishState({
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
    });
    if (!dispatch.ok) {
      const summary = `Azure DevOps pipeline dispatch failed for ${specId}: ${dispatch.stderr || dispatch.stdout || dispatch.error}`;
      publishState({
        status: "error",
        ...specFixForwardPatch({
          specId,
          target,
          pipeline: workflow,
          branch,
          status: "error",
          reason: summary,
        }),
        activeAttemptId: null,
        activeTaskSessionId: null,
        activeWorkflowRunId: null,
        heartbeatAt: new Date().toISOString(),
      });
      const completion = completeStartedAttempt(config, {
        taskId,
        taskRevision: taskRevision(task),
        attemptId,
        claim: "blocked",
        summary,
      });
      if (completion.ok) {
        emitTaskCompleted(ctx, completion.task, {
          taskRevision: taskRevision(task),
          attemptId,
          result: "blocked",
          summary,
        });
      }
      return ctx.done(summary);
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      run = newestPipelineWorkflowRun({
        client: pipeline.client,
        projectDir,
        workflow,
        branch,
        sinceMs: startedAt,
        match: (candidate) =>
          workflowRunMatches({
            displayTitle: candidate.displayTitle,
            loopKey,
            specId,
          }),
      });
      if (run?.databaseId) break;
      await sleepMs(pipelineRunLookupPollIntervalMs());
    }
    if (!run?.databaseId) {
      const summary = `Dispatched Azure DevOps pipeline for ${specId}, but could not find the run id. Loop key: ${loopKey}. Dispatch metadata: ${metadataPath}.`;
      publishState({
        status: "error",
        ...specFixForwardPatch({
          specId,
          target,
          pipeline: workflow,
          branch,
          status: "error",
          reason: summary,
        }),
        lastWorkflowLoopKey: loopKey,
        lastDispatchMetadataPath: metadataPath,
        activeAttemptId: null,
        activeTaskSessionId: null,
        activeWorkflowRunId: null,
        heartbeatAt: new Date().toISOString(),
      });
      const completion = completeStartedAttempt(config, {
        taskId,
        taskRevision: taskRevision(task),
        attemptId,
        claim: "blocked",
        summary,
      });
      if (completion.ok) {
        emitTaskCompleted(ctx, completion.task, {
          taskRevision: taskRevision(task),
          attemptId,
          result: "blocked",
          summary,
        });
      }
      return ctx.done(summary);
    }

    runId = String(run.databaseId);
  }
  publishState({
    lastWorkflowLoopKey: loopKey,
    lastDispatchMetadataPath: metadataPath,
    activeWorkflowRunId: runId,
    heartbeatAt: new Date().toISOString(),
  });
  const watch = await waitForPipelineWorkflowRun({
    client: pipeline.client,
    projectDir,
    runId,
    timeoutMs: 3 * 60 * 60_000,
    onPoll: (observedRun) => {
      publishState({
        activeWorkflowRunId: runId,
        heartbeatAt: new Date().toISOString(),
        ...(observedRun?.status === "completed"
          ? {}
          : {
              ...(observedRun?.url ? { lastRunUrl: observedRun.url } : {}),
            }),
      });
    },
  });
  const finalRun =
    watch.run ??
    getPipelineWorkflowRun({
      client: pipeline.client,
      projectDir,
      runId,
    }) ??
    run;
  const artifactDir = join(appDir, ".state", "spec-loop", "artifacts", runId);
  mkdirSync(artifactDir, { recursive: true });
  const download = downloadPipelineArtifacts({
    client: pipeline.client,
    projectDir,
    runId,
    artifactDir,
  });
  const identity = readArtifactIdentity({
    artifactDir,
    expectedSpecId: specId,
    expectedLoopFamily: taskId,
  });
  const sameSpecAggregationFailure = !!identity?.sameSpecAggregationFailure;
  const identityMismatch =
    !!identity && identity.mismatches.length > 0 && !sameSpecAggregationFailure;
  const resultPath = sameSpecAggregationFailure
    ? identity?.childResultPath ||
      identity?.childStatusPath ||
      identity?.topLevelResultPath ||
      identity?.artifactLocalResultPath ||
      identity?.artifactLocalStatusPath ||
      identity?.artifactResultPath ||
      identity?.artifactIdentityPath ||
      ""
    : identityMismatch
      ? identity?.artifactLocalResultPath ||
        identity?.artifactLocalStatusPath ||
        identity?.topLevelResultPath ||
        identity?.artifactResultPath ||
        identity?.artifactIdentityPath ||
        ""
      : identity?.childResultPath ||
        identity?.childStatusPath ||
        identity?.topLevelResultPath ||
        identity?.artifactLocalResultPath ||
        identity?.artifactLocalStatusPath ||
        identity?.artifactResultPath ||
        identity?.artifactIdentityPath ||
        "";
  const projectResult = identity?.projectResult ?? null;
  const classification = sameSpecAggregationFailure
    ? {
        loopStatus: "error" as SpecLoopSpecStatus,
        claim: "blocked" as const,
        reason: [
          `aggregation/publication failure for ${specId}`,
          `run=${runId}`,
          identity?.bundlePath ? `bundle=${identity.bundlePath}` : "",
          identity?.topLevelStatus
            ? `top-level result status=${identity.topLevelStatus}`
            : "top-level result status missing",
          `top-level specResults count=${String(identity?.topLevelSpecResultsCount ?? 0)}`,
          identity?.childSpecId ? `child specId=${identity.childSpecId}` : "",
          identity?.childStatus ? `child status=${identity.childStatus}` : "",
          identity?.childPhase ? `child phase=${identity.childPhase}` : "",
          identity?.childResultPath
            ? `child result=${identity.childResultPath}`
            : "",
          identity?.childStatusPath
            ? `child status path=${identity.childStatusPath}`
            : "",
          "same-loop/same-spec child evidence exists while top-level result.json remained empty or omitted specResults[0].specId",
        ]
          .filter(Boolean)
          .join("; "),
      }
    : identity?.sameSpecChildEvidence &&
        (identity.childEvidenceStatus.toLowerCase() === "gated" ||
          identity.childFailedVerdictAssertions.length > 0)
      ? {
          loopStatus: "error" as SpecLoopSpecStatus,
          claim: "partial" as const,
          reason: [
            `same-spec artifact did not produce a live pass for ${specId}`,
            `run=${runId}`,
            identity.childEvidenceStatus
              ? `child evidence status=${identity.childEvidenceStatus}`
              : "",
            identity.childFailedVerdictAssertions.length
              ? `failed verdict assertions=${identity.childFailedVerdictAssertions.join(" | ")}`
              : "",
            identity.childResultPath
              ? `child result=${identity.childResultPath}`
              : "",
          ]
            .filter(Boolean)
            .join("; "),
        }
      : identityMismatch
        ? {
            loopStatus: "error" as SpecLoopSpecStatus,
            claim: "blocked" as const,
            reason: [
              `artifact-routing-mismatch for ${specId}`,
              `run=${runId}`,
              identity.bundlePath ? `bundle=${identity.bundlePath}` : "",
              ...identity.mismatches,
            ]
              .filter(Boolean)
              .join("; "),
          }
        : classifyProjectResult(projectResult, specId);
  const summary = [
    `Spec ${specId} workflow run ${runId} classified as ${classification.loopStatus}.`,
    `Loop key: ${loopKey}.`,
    reattachedRunId ? `Reattached existing ADO run ${reattachedRunId}.` : "",
    classification.reason,
    finalRun.url ? `Run: ${finalRun.url}` : "",
    resultPath ? `Result: ${resultPath}` : "",
    identity?.metadataPath ? `Workflow metadata: ${identity.metadataPath}` : "",
    identity?.topLevelResultPath
      ? `Top-level result: ${identity.topLevelResultPath}`
      : "",
    download.ok
      ? ""
      : `artifact download issue: ${download.stderr || download.stdout || download.error}`,
    watch.ok
      ? ""
      : `run watch issue: ${watch.detail || "workflow run did not complete successfully"}`,
  ]
    .filter(Boolean)
    .join(" ");

  const completionPatch = {
    status: classification.loopStatus,
    ...specFixForwardPatch({
      specId,
      target,
      pipeline: workflow,
      branch,
      status: classification.loopStatus,
      reason: classification.reason,
      resultPath,
    }),
    lastRunId: runId,
    lastRunUrl: finalRun.url ?? null,
    lastResultPath: resultPath || null,
    activeAttemptId: null,
    activeTaskSessionId: null,
    activeWorkflowRunId: null,
    heartbeatAt: new Date().toISOString(),
  };
  const verifierResult = pipelineSpecVerifierResult({
    specId,
    target,
    pipeline: workflow,
    branch,
    runId,
    runUrl: finalRun.url ?? null,
    resultPath,
    classification,
    download,
    watchOk: watch.ok,
    watchDetail: watch.detail,
    identity,
  });

  const completion = completeStartedAttempt(config, {
    taskId,
    taskRevision: taskRevision(task),
    attemptId,
    claim: classification.claim,
    summary,
    evidence: verifierResult.artifacts,
    workflowResult: verifierResult,
  });
  if (completion.ok === false) {
    return ctx.done(
      `Single-spec verifier ignored obsolete completion for ${task.id} attempt ${attemptId}. ${completion.reason}`,
    );
  }
  publishState(completionPatch, { requireActiveAttempt: false });
  emitTaskCompleted(ctx, completion.task, {
    taskRevision: taskRevision(task),
    attemptId,
    result: classification.claim,
    summary,
    evidence: verifierResult.artifacts,
    workflowResult: verifierResult,
  });
  return ctx.done(summary);
}
