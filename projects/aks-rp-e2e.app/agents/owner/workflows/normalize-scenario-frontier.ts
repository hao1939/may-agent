import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative } from "node:path";
import {
  workflowResultVersion,
  type ExecutionResult,
  type TaskAction,
  type TaskReconciliationContext,
  type WorkflowContext,
  type WorkflowIoContract,
} from "@may-agent/sdk";
import {
  learnedScenarioNormalizationAcceptance,
  loopFrontierAccounting,
  scenarioNormalizationTaskId,
  standingLoopDefinitions,
} from "../../../task-loops.ts";
import { withCurrentOriginDevSnapshot } from "../../app-ops/workflows/lib/origin-dev-snapshot.ts";
import {
  directCarrierQualityIssues,
  type InventoryRowRecord,
} from "./lib/scenario-quality-invariant.ts";

export const name = "normalize-scenario-frontier";
export const description =
  "Audit strict scenario-test adapter gaps and declare bounded owner work for the normalization frontier.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "normalize-scenario-frontier-v1",
  input: {
    required: ["project.task.tick target.taskId=scenario-normalization"],
    optional: [
      "desiredRunnableLeaves",
      "requiredRepositoryCheckCommand",
      "qualityInventoryRequired",
      "qualityInventoryFocus",
      "qualityAuditOriginDevCommit",
      "project",
      "app",
    ],
    description:
      "Reconcile the strict scenario-test missing-adapter frontier from current clean origin/dev evidence.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions"],
    description:
      "Returns bounded domain task actions and then converges; it never writes the task graph.",
  },
};

type InventoryReport = {
  generatedAt?: string;
  activeSpecCount?: number;
  missingAdapterFiles?: unknown;
  unreferencedPlainScenarioFiles?: unknown;
  unpairedAdapterFiles?: unknown;
  directVitestImplementationCount?: number;
  referencedPlainActiveSpecCount?: number;
  referencedPlainScenarioCount?: number;
  repoPlainScenarioFileCount?: number;
  reviewedQualityLiveCoverage?: {
    activeSpecCount?: unknown;
    reviewedSpecCount?: unknown;
    representedSpecCount?: unknown;
    incompleteSpecIds?: unknown;
  };
  rows?: Array<{ specId?: unknown }>;
  signalCounts?: {
    scenarios?: Record<string, unknown>;
    adapters?: Record<string, unknown>;
  };
};

type InventoryGuard = {
  passed?: unknown;
  remainingSpecReferencedPlainScenarioUnits?: unknown;
  remainingRepoPlainScenarioFiles?: unknown;
};

type SpecRecord = {
  id?: string;
  probeRef?: string;
  implementation?: { path?: string };
};

type ScenarioUnit = {
  scenarioTestPath?: unknown;
  adapterPath?: unknown;
  directVitestImplementation?: unknown;
  featureIds?: unknown;
  specIds?: unknown;
  activeSpecCount?: unknown;
};

type QualityFrontierRow = {
  scenarioTestPath: string;
  specIds: string[];
  featureIds: string[];
  issueCodes: string[];
  issueDetails: string[];
  branchCandidates: string[];
  branchCandidatesInspected: boolean;
  representedTaskIds: string[];
  actionableTaskIds: string[];
  waitingTaskIds: string[];
  residueTaskIds: string[];
};

type ReviewedQualityLiveCoverage = {
  activeSpecCount: number;
  reviewedSpecCount: number;
  representedSpecCount: number;
  incompleteSpecIds: string[];
  missing: boolean;
};

type FrontierRow = {
  adapterPath: string;
  legacyPath: string;
  specId: string;
  probeRef: string;
  implementationPath: string;
  branchCandidates: string[];
  branchCandidatesInspected: boolean;
  representedTaskIds: string[];
  actionableTaskIds: string[];
  waitingTaskIds: string[];
  residueTaskIds: string[];
};

type PlainCarrierRow = {
  scope: "spec-referenced" | "repository-only";
  scenarioTestPath: string;
  adapterPath: string;
  specIds: string[];
  featureIds: string[];
  activeSpecCount: number;
  branchCandidates: string[];
  branchCandidatesInspected: boolean;
  representedTaskIds: string[];
  actionableTaskIds: string[];
  waitingTaskIds: string[];
  residueTaskIds: string[];
};

type GraphNode = {
  id: string;
  generation: number;
  state: string;
  priority?: string;
  readinessState?: string;
  parentId: string;
  workflow: string;
  input: Record<string, unknown>;
  conditionIds: string[];
  latestAttemptHandler: string;
  latestFailureReason: string;
};

type ReceiptRecord = {
  parentId?: unknown;
  outcome?: unknown;
  summary?: unknown;
  evidence?: unknown;
  workspace?: unknown;
};

const frontierTaskId = scenarioNormalizationTaskId;
const maxWorkflowEvidenceEntries = 32;

function digest(value: string, length = 10): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function safeTaskIdPart(value: string): string {
  return (
    value
      .replace(/^features\//, "")
      .replace(/\.test\.ts$/, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "missing-adapter"
  );
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: env ? { ...process.env, ...env } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr || result.error?.message || "",
  };
}

function workflowInput(ctx: WorkflowContext): Record<string, unknown> {
  const input = ctx.reconciliation?.input ?? ctx.input;
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function requiredRepositoryCheckCommand(ctx: WorkflowContext): string {
  const command = workflowInput(ctx).requiredRepositoryCheckCommand;
  return typeof command === "string" ? command.trim() : "";
}

function qualityInventoryRequired(ctx: WorkflowContext): boolean {
  const value = workflowInput(ctx).qualityInventoryRequired;
  return value !== false;
}

function qualityInventoryFocus(ctx: WorkflowContext): string[] {
  return stringList(workflowInput(ctx).qualityInventoryFocus);
}

function qualityAuditOriginDevCommit(ctx: WorkflowContext): string {
  const value = workflowInput(ctx).qualityAuditOriginDevCommit;
  return typeof value === "string" ? value.trim() : "";
}

function boundedRepositoryCheckOutput(stdout: string, stderr: string): string {
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-40).join(" | ").slice(0, 8_000);
}

export function runRequiredRepositoryCheck(
  projectDir: string,
  worktreeDir: string,
  command: string,
): { status: number | null; evidence: string[] } {
  if (command !== "bun run check") {
    return {
      status: null,
      evidence: [`repository-check-command-unsupported:${command}`],
    };
  }

  const evidence = [`repository-check-command:${command}`];
  const projectNodeModules = join(projectDir, "node_modules");
  const worktreeNodeModules = join(worktreeDir, "node_modules");
  if (worktreeDir !== projectDir && !existsSync(worktreeNodeModules)) {
    if (existsSync(projectNodeModules)) {
      const setupCommand = `ln -s ${projectNodeModules} ${worktreeNodeModules}`;
      evidence.push(
        `repository-check-dependency-source:project-node_modules:${projectNodeModules}`,
      );
      try {
        symlinkSync(projectNodeModules, worktreeNodeModules, "dir");
        evidence.push(
          `repository-check-setup-command:${setupCommand}`,
          "repository-check-setup-status:passed",
          "repository-check-setup-exit:0",
        );
      } catch (error) {
        evidence.push(
          `repository-check-setup-command:${setupCommand}`,
          "repository-check-setup-status:failed",
          "repository-check-setup-exit:spawn-error",
          `repository-check-setup-output:${String(error)}`,
        );
        return { status: null, evidence };
      }
    } else {
      const setupCommand = "bun install --frozen-lockfile";
      const bunTempDir = join(tmpdir(), "aks-rp-e2e-bun-install");
      const bunCacheDir = join(bunTempDir, "cache");
      mkdirSync(bunCacheDir, { recursive: true });
      const setup = run("bun", ["install", "--frozen-lockfile"], worktreeDir, {
        TMPDIR: bunTempDir,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      });
      evidence.push(
        `repository-check-setup-command:${setupCommand}`,
        `repository-check-setup-status:${setup.status === 0 ? "passed" : "failed"}`,
        `repository-check-setup-exit:${setup.status ?? "spawn-error"}`,
      );
      if (setup.status !== 0) {
        evidence.push(
          `repository-check-setup-output:${boundedRepositoryCheckOutput(
            setup.stdout,
            setup.stderr,
          )}`,
        );
        return { status: setup.status, evidence };
      }
    }
  }

  const nodePath = [projectNodeModules, process.env.NODE_PATH]
    .filter((value): value is string => Boolean(value))
    .join(delimiter);
  const result = run("bun", ["run", "check"], worktreeDir, {
    NODE_PATH: nodePath,
  });
  return {
    status: result.status,
    evidence: [
      ...evidence,
      `repository-check-status:${result.status === 0 ? "passed" : "failed"}`,
      `repository-check-exit:${result.status ?? "spawn-error"}`,
      ...(result.status === 0
        ? []
        : [
            `repository-check-output:${boundedRepositoryCheckOutput(
              result.stdout,
              result.stderr,
            )}`,
          ]),
    ],
  };
}

function resolveProjectDir(ctx: WorkflowContext): string {
  const projectDir = ctx.workspace?.projectRoot.trim();
  if (!projectDir) {
    throw new Error(
      "normalize-scenario-frontier requires workspace.projectRoot",
    );
  }
  return projectDir;
}

function desiredRunnableMin(ctx: WorkflowContext): number {
  const fallback = 3;
  const raw = ctx.reconciliation?.trigger?.data.desiredRunnableLeaves;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const min = Number((raw as { min?: unknown }).min);
    if (Number.isFinite(min) && min >= 1) return Math.floor(min);
  }
  return fallback;
}

function withCleanOriginDev<T>(
  projectDir: string,
  fn: (worktreeDir: string, source: "origin/dev" | "project-dir") => T,
): T {
  return withCurrentOriginDevSnapshot(projectDir, ({ dir, source }) =>
    fn(dir, source),
  );
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(path));
    } else {
      result.push(path);
    }
  }
  return result;
}

function loadSpecs(worktreeDir: string): SpecRecord[] {
  return walkFiles(join(worktreeDir, "features"))
    .filter((path) => /\/specs\/[^/]+\.json$/.test(path))
    .map((path) => readJson<SpecRecord>(path, {}))
    .filter((spec) => typeof spec.id === "string" && spec.id.trim());
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .map((entry) => entry.trim())
    : [];
}

function normalizeInventoryRows(report: InventoryReport): InventoryRowRecord[] {
  if (!Array.isArray(report.rows)) return [];
  return report.rows
    .map((entry) => recordValue(entry) as InventoryRowRecord)
    .filter(
      (row) =>
        typeof row.specId === "string" &&
        row.specId.trim().length > 0 &&
        typeof row.scenarioTestPath === "string" &&
        row.scenarioTestPath.trim().length > 0,
    );
}

function normalizeScenarioUnits(value: unknown): PlainCarrierRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PlainCarrierRow | null => {
      const unit = entry as ScenarioUnit;
      const scenarioTestPath =
        typeof unit.scenarioTestPath === "string"
          ? unit.scenarioTestPath.trim()
          : "";
      if (!scenarioTestPath || scenarioTestPath.endsWith(".test.ts")) {
        return null;
      }
      const adapterPath =
        typeof unit.adapterPath === "string" ? unit.adapterPath.trim() : "";
      const specIds = Array.isArray(unit.specIds)
        ? unit.specIds.filter(
            (specId): specId is string =>
              typeof specId === "string" && specId.trim().length > 0,
          )
        : [];
      const featureIds = Array.isArray(unit.featureIds)
        ? unit.featureIds.filter(
            (featureId): featureId is string =>
              typeof featureId === "string" && featureId.trim().length > 0,
          )
        : [];
      return {
        scope: "spec-referenced" as const,
        scenarioTestPath,
        adapterPath,
        specIds: [...new Set(specIds)],
        featureIds: [...new Set(featureIds)],
        activeSpecCount: Number(unit.activeSpecCount) || specIds.length,
        branchCandidates: [],
        branchCandidatesInspected: false,
        representedTaskIds: [],
        actionableTaskIds: [],
        waitingTaskIds: [],
        residueTaskIds: [],
      } satisfies PlainCarrierRow;
    })
    .filter((row): row is PlainCarrierRow => Boolean(row));
}

function missingAdaptersFromInventory(worktreeDir: string): {
  report: InventoryReport;
  guard: InventoryGuard;
  activeSpecCount: number;
  missingAdapterFiles: string[];
  unreferencedPlainScenarioFiles: string[];
  unpairedAdapterFiles: string[];
  scenarioSignalCounts: Record<string, unknown> | null;
  reviewedQualityLiveCoverage: ReviewedQualityLiveCoverage;
  strictPassed: boolean | null;
  remainingSpecReferencedPlainScenarioUnits: PlainCarrierRow[];
  remainingRepoPlainScenarioFiles: string[];
  remainingSpecReferencedPlainScenarioUnitCount: number;
  remainingRepoPlainScenarioFileCount: number;
  error?: string;
} {
  const result = run(
    "bun",
    ["scripts/check-scenario-tests.ts", "--strict", "--json"],
    worktreeDir,
  );
  try {
    const parsed = JSON.parse(result.stdout) as {
      report?: InventoryReport;
      guard?: InventoryGuard;
    };
    const report = parsed.report ?? {};
    const guard = parsed.guard ?? {};
    const activeSpecCount = Number(report.activeSpecCount ?? 0);
    const missingAdapterFiles = Array.isArray(report.missingAdapterFiles)
      ? report.missingAdapterFiles.filter(
          (value): value is string =>
            typeof value === "string" && value.endsWith(".test.ts"),
        )
      : [];
    const unreferencedPlainScenarioFiles = Array.isArray(
      report.unreferencedPlainScenarioFiles,
    )
      ? report.unreferencedPlainScenarioFiles.filter(
          (value): value is string =>
            typeof value === "string" && value.endsWith(".ts"),
        )
      : [];
    const unpairedAdapterFiles = Array.isArray(report.unpairedAdapterFiles)
      ? report.unpairedAdapterFiles.filter(
          (value): value is string =>
            typeof value === "string" && value.endsWith(".test.ts"),
        )
      : [];
    const scenarioSignalCounts =
      report.signalCounts && typeof report.signalCounts === "object"
        ? (report.signalCounts.scenarios ?? null)
        : null;
    const reviewedQualityLiveCoverage =
      parseReviewedQualityLiveCoverage(report);
    const strictPassed =
      typeof guard.passed === "boolean" ? guard.passed : null;
    const remainingSpecReferencedPlainScenarioUnits = normalizeScenarioUnits(
      guard.remainingSpecReferencedPlainScenarioUnits,
    );
    const remainingSpecReferencedPlainScenarioUnitCount =
      remainingSpecReferencedPlainScenarioUnits.length;
    const remainingRepoPlainScenarioFiles = Array.isArray(
      guard.remainingRepoPlainScenarioFiles,
    )
      ? guard.remainingRepoPlainScenarioFiles.filter(
          (value): value is string =>
            typeof value === "string" && value.endsWith(".ts"),
        )
      : [];
    const remainingRepoPlainScenarioFileCount =
      remainingRepoPlainScenarioFiles.length;
    return {
      report,
      guard,
      activeSpecCount: Number.isFinite(activeSpecCount) ? activeSpecCount : 0,
      missingAdapterFiles,
      unreferencedPlainScenarioFiles,
      unpairedAdapterFiles,
      scenarioSignalCounts,
      reviewedQualityLiveCoverage,
      strictPassed,
      remainingSpecReferencedPlainScenarioUnits,
      remainingRepoPlainScenarioFiles,
      remainingSpecReferencedPlainScenarioUnitCount,
      remainingRepoPlainScenarioFileCount,
    };
  } catch {
    return {
      report: {},
      guard: {},
      activeSpecCount: 0,
      missingAdapterFiles: [],
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      scenarioSignalCounts: null,
      reviewedQualityLiveCoverage: {
        activeSpecCount: 0,
        reviewedSpecCount: 0,
        representedSpecCount: 0,
        incompleteSpecIds: [],
        missing: true,
      },
      strictPassed: null,
      remainingSpecReferencedPlainScenarioUnits: [],
      remainingRepoPlainScenarioFiles: [],
      remainingSpecReferencedPlainScenarioUnitCount: 0,
      remainingRepoPlainScenarioFileCount: 0,
      error:
        result.stderr.trim() ||
        `strict inventory returned unparsable JSON with status ${String(result.status)}`,
    };
  }
}

function originCommit(worktreeDir: string): string {
  return run("git", ["rev-parse", "HEAD"], worktreeDir).stdout.trim();
}

function formatScenarioSignalCounts(
  signalCounts: Record<string, unknown> | null,
): string {
  if (!signalCounts) return "none";
  const entries = Object.entries(signalCounts)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(Number(value))}`);
  return entries.join(",") || "none";
}

function parseReviewedQualityLiveCoverage(
  report: InventoryReport,
): ReviewedQualityLiveCoverage {
  const raw = report.reviewedQualityLiveCoverage;
  if (!raw || typeof raw !== "object") {
    return {
      activeSpecCount: 0,
      reviewedSpecCount: 0,
      representedSpecCount: 0,
      incompleteSpecIds: [],
      missing: true,
    };
  }
  const activeSpecCount = Number(raw.activeSpecCount ?? 0);
  const reviewedSpecCount = Number(raw.reviewedSpecCount ?? 0);
  const representedSpecCount = Number(raw.representedSpecCount ?? 0);
  const incompleteSpecIds = Array.isArray(raw.incompleteSpecIds)
    ? raw.incompleteSpecIds.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];
  return {
    activeSpecCount: Number.isFinite(activeSpecCount) ? activeSpecCount : 0,
    reviewedSpecCount: Number.isFinite(reviewedSpecCount)
      ? reviewedSpecCount
      : 0,
    representedSpecCount: Number.isFinite(representedSpecCount)
      ? representedSpecCount
      : 0,
    incompleteSpecIds,
    missing: false,
  };
}

function currentSourceQualitySpecIds(report: InventoryReport): string[] {
  return [
    ...new Set(
      (Array.isArray(report.rows) ? report.rows : [])
        .map((row) =>
          typeof row?.specId === "string" ? row.specId.trim() : "",
        )
        .filter(Boolean),
    ),
  ];
}

function stateReceipts(
  reconciliation: TaskReconciliationContext | undefined,
): ReceiptRecord[] {
  return (reconciliation?.children.completed ?? []).map((child) => ({
    parentId: child.parentId,
    outcome: child.outcome,
    summary: child.summary,
    evidence: child.evidence,
  }));
}

function nodeSpecIds(node: GraphNode): string[] {
  const ids = [node.input.specId]
    .concat(Array.isArray(node.input.specIds) ? node.input.specIds : [])
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim());
  return [...new Set(ids)];
}

function currentQualityLiveCoverageNode(node: GraphNode): boolean {
  if (!canRepresentFrontierRow(node)) return false;
  if (
    node.input.loopId !== scenarioNormalizationTaskId &&
    !isScenarioFrontierParent(node.parentId)
  ) {
    return false;
  }
  const qualitySpecConsumer =
    node.input.normalizationScope === "quality" && nodeSpecIds(node).length > 0;
  if (qualitySpecConsumer && node.input.allowTerminalDisposition !== false) {
    return false;
  }
  if (
    ["active", "running", "pending", "runnable", "backlog"].includes(node.state)
  ) {
    return true;
  }
  if (["waiting", "blocked"].includes(node.state) && node.conditionIds.length) {
    return true;
  }
  return (
    hasPendingOwnerAdjudication(node) ||
    retryWorkflowAttentionAction(node) !== null
  );
}

function receiptText(receipt: ReceiptRecord): string {
  return [receipt.outcome, receipt.summary]
    .concat(Array.isArray(receipt.evidence) ? receipt.evidence : [])
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function evidenceValue(
  evidence: readonly string[],
  prefix: string,
): string | null {
  const match = evidence.find((entry) => entry.startsWith(prefix));
  if (!match) return null;
  const value = match.slice(prefix.length).trim();
  return value || null;
}

function evidenceValues(evidence: readonly string[], prefix: string): string[] {
  return evidence
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => entry.slice(prefix.length).trim())
    .filter(Boolean);
}

function commitReachableFromCurrentOrigin(
  worktreeDir: string,
  commit: string | null,
): boolean {
  if (!commit) return false;
  const normalized = commit.trim();
  if (!normalized) return false;
  return (
    run("git", ["merge-base", "--is-ancestor", normalized, "HEAD"], worktreeDir)
      .status === 0
  );
}

function blobAtRevision(
  worktreeDir: string,
  revision: string,
  path: string,
): string | null {
  const result = run("git", ["rev-parse", `${revision}:${path}`], worktreeDir);
  if (result.status !== 0) return null;
  const blob = result.stdout.trim();
  return blob || null;
}

function integratedPathsEquivalentAtHead(
  worktreeDir: string,
  integratedCommit: string,
  integratedPaths: readonly string[],
): boolean {
  if (integratedPaths.length === 0) return false;
  return integratedPaths.every((path) => {
    const integratedBlob = blobAtRevision(worktreeDir, integratedCommit, path);
    const currentBlob = blobAtRevision(worktreeDir, "HEAD", path);
    return integratedBlob === currentBlob;
  });
}

function changedPathsBetween(
  worktreeDir: string,
  baseCommit: string,
  sourceCommit: string,
): string[] {
  if (!baseCommit || !sourceCommit) return [];
  const result = run(
    "git",
    ["diff", "--name-only", baseCommit, sourceCommit, "--"],
    worktreeDir,
  );
  if (result.status !== 0) return [];
  return [
    ...new Set(
      result.stdout
        .split(/\r?\n/)
        .map((path) => path.trim())
        .filter(Boolean),
    ),
  ];
}

function receiptIntegratedPaths(
  receipt: ReceiptRecord,
  evidence: readonly string[],
  worktreeDir: string,
  sourceCommit: string | null,
  specFile: string,
  scenarioTestPath: string,
): string[] {
  const recorded = evidenceValues(evidence, "integrated-path:");
  if (recorded.length > 0) return recorded;

  const workspace =
    receipt.workspace &&
    typeof receipt.workspace === "object" &&
    !Array.isArray(receipt.workspace)
      ? (receipt.workspace as Record<string, unknown>)
      : {};
  const baseCommit =
    typeof workspace.baseCommit === "string" ? workspace.baseCommit.trim() : "";
  const changed = changedPathsBetween(
    worktreeDir,
    baseCommit,
    sourceCommit ?? "",
  );
  if (changed.length > 0) return changed;

  return [
    ...new Set(
      [specFile, scenarioTestPath].map((path) => path.trim()).filter(Boolean),
    ),
  ];
}

function receiptHasCurrentAcceptedPass(
  receipt: ReceiptRecord,
  specId: string,
  worktreeDir: string,
  originDevCommit: string,
  specFile: string,
  scenarioTestPath: string,
): boolean {
  const parentId = typeof receipt.parentId === "string" ? receipt.parentId : "";
  if (
    parentId !== scenarioNormalizationTaskId &&
    parentId !== "group/scenario-normalization"
  ) {
    return false;
  }
  if (!originDevCommit) return false;

  const evidence = Array.isArray(receipt.evidence)
    ? receipt.evidence.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];
  if (evidence.some((entry) => entry.startsWith("terminal-disposition"))) {
    return false;
  }
  const text = receiptText(receipt);
  if (!text.includes(specId)) return false;
  if (
    !evidence.some(
      (entry) =>
        entry.startsWith("pipeline-run:") || entry.startsWith("proof:"),
    )
  ) {
    return false;
  }

  const integratedCommit = evidenceValue(evidence, "integrated-commit:");
  const sourceCommit = evidenceValue(evidence, "source-commit:");
  if (
    evidence.includes(`integrated-commit:${originDevCommit}`) ||
    evidence.includes(`source-commit:${originDevCommit}`)
  ) {
    return true;
  }
  if (!integratedCommit) {
    return false;
  }
  if (!commitReachableFromCurrentOrigin(worktreeDir, integratedCommit)) {
    return false;
  }
  const integratedPaths = receiptIntegratedPaths(
    receipt,
    evidence,
    worktreeDir,
    sourceCommit,
    specFile,
    scenarioTestPath,
  );
  return integratedPathsEquivalentAtHead(
    worktreeDir,
    integratedCommit,
    integratedPaths,
  );
}

function currentSourceReviewedQualityLiveCoverage(
  reconciliation: TaskReconciliationContext | undefined,
  report: InventoryReport,
  worktreeDir: string,
  originDevCommit: string,
  nodes: GraphNode[],
): ReviewedQualityLiveCoverage {
  const specIds = currentSourceQualitySpecIds(report);
  if (
    specIds.length === 0 ||
    (Number(report.activeSpecCount) > 0 &&
      specIds.length !== Number(report.activeSpecCount))
  ) {
    return {
      activeSpecCount: specIds.length,
      reviewedSpecCount: 0,
      representedSpecCount: 0,
      incompleteSpecIds: specIds,
      missing: true,
    };
  }

  const receipts = stateReceipts(reconciliation);
  const inventoryRows = normalizeInventoryRows(report);
  const covered = new Set<string>();
  for (const specId of specIds) {
    const inventoryRow = inventoryRows.find(
      (row) => String(row.specId ?? "").trim() === specId,
    );
    const specFile = String(inventoryRow?.specFile ?? "").trim();
    const scenarioTestPath = String(
      inventoryRow?.scenarioTestPath ?? "",
    ).trim();
    const liveNodeCovered = nodes.some(
      (node) =>
        currentQualityLiveCoverageNode(node) &&
        nodeSpecIds(node).includes(specId),
    );
    const receiptCovered = receipts.some((receipt) =>
      receiptHasCurrentAcceptedPass(
        receipt,
        specId,
        worktreeDir,
        originDevCommit,
        specFile,
        scenarioTestPath,
      ),
    );
    if (liveNodeCovered || receiptCovered) {
      covered.add(specId);
    }
  }

  return {
    activeSpecCount: specIds.length,
    reviewedSpecCount: covered.size,
    representedSpecCount: covered.size,
    incompleteSpecIds: specIds.filter((specId) => !covered.has(specId)),
    missing: false,
  };
}

function currentSourceOpenQualityCoverageTaskIds(
  report: InventoryReport,
  nodes: GraphNode[],
): string[] {
  const specIds = new Set(currentSourceQualitySpecIds(report));
  if (specIds.size === 0) return [];
  return nodes
    .filter(
      (node) =>
        currentQualityLiveCoverageNode(node) &&
        nodeSpecIds(node).some((specId) => specIds.has(specId)),
    )
    .map((node) => node.id)
    .sort();
}

function reviewedQualityLiveCoverageComplete(
  coverage: ReviewedQualityLiveCoverage,
  fallbackActiveSpecCount: number,
): boolean {
  if (coverage.missing) return false;
  const total = coverage.activeSpecCount || fallbackActiveSpecCount;
  if (!Number.isFinite(total) || total <= 0) return false;
  if (
    fallbackActiveSpecCount > 0 &&
    coverage.activeSpecCount !== fallbackActiveSpecCount
  ) {
    return false;
  }
  return (
    coverage.reviewedSpecCount >= total &&
    coverage.representedSpecCount >= total &&
    coverage.incompleteSpecIds.length === 0
  );
}

function formatReviewedQualityLiveCoverage(
  coverage: ReviewedQualityLiveCoverage,
  fallbackActiveSpecCount: number,
): string {
  if (coverage.missing) return "missing";
  const total = coverage.activeSpecCount || fallbackActiveSpecCount;
  return [
    `active:${String(total)}`,
    `reviewed:${String(coverage.reviewedSpecCount)}`,
    `represented:${String(coverage.representedSpecCount)}`,
    `incomplete:${String(coverage.incompleteSpecIds.length)}`,
  ].join(",");
}

function branchCandidatesForPaths(
  projectDir: string,
  ...paths: Array<string | null | undefined>
): string[] {
  const candidatePaths = [
    ...new Set(paths.map((value) => value?.trim()).filter(Boolean)),
  ] as string[];
  if (candidatePaths.length === 0) return [];
  const result = run(
    "git",
    ["log", "--all", "--format=%h %D %s", "--", ...candidatePaths],
    projectDir,
  );
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function inspectFrontierRowBranches(
  projectDir: string,
  row: FrontierRow,
): FrontierRow {
  row.branchCandidates = branchCandidatesForPaths(
    projectDir,
    row.adapterPath,
    row.legacyPath,
  );
  row.branchCandidatesInspected = true;
  return row;
}

function inspectPlainCarrierRowBranches(
  projectDir: string,
  row: PlainCarrierRow,
): PlainCarrierRow {
  row.branchCandidates = branchCandidatesForPaths(
    projectDir,
    row.scenarioTestPath,
    row.adapterPath,
  );
  row.branchCandidatesInspected = true;
  return row;
}

function branchCandidateEvidence(
  row: Pick<FrontierRow, "branchCandidates" | "branchCandidatesInspected">,
): string {
  return row.branchCandidatesInspected
    ? String(row.branchCandidates.length)
    : "unchecked";
}

function graphNodes(
  reconciliation: TaskReconciliationContext | undefined,
): GraphNode[] {
  return (reconciliation?.children.live ?? []).map((child) => ({
    id: child.taskId,
    generation: child.generation,
    state: child.status,
    priority: child.priority ?? "",
    readinessState:
      child.readiness?.state ??
      (child.status === "waiting" ? "condition-blocked" : ""),
    parentId: child.parentId,
    workflow: child.workflow ?? "",
    input: child.input,
    conditionIds: child.conditions.map(({ id }) => id),
    latestAttemptHandler: child.latestAttempt?.handler ?? "",
    latestFailureReason: child.latestAttempt?.failureReason ?? "",
  }));
}

function frontierPhase(node: GraphNode | undefined): string {
  if (!node) return "";
  if (
    ["dependency-blocked", "child-blocked", "condition-blocked"].includes(
      node.readinessState ?? "",
    )
  ) {
    return "waiting";
  }
  return node.state;
}

export function retryWorkflowAttentionAction(
  node: GraphNode,
): TaskAction | null {
  const workflowExecutionFailed =
    node.latestAttemptHandler === "workflow:spec-live-reconciliation" &&
    node.latestFailureReason === "HandlerExecutionFailed";
  const ownerResultRejected =
    node.latestAttemptHandler.startsWith("owner:") &&
    node.latestFailureReason === "handler-blocked";
  if (
    node.state !== "attention" ||
    node.workflow !== "spec-live-reconciliation" ||
    (!workflowExecutionFailed && !ownerResultRejected) ||
    !Number.isInteger(node.generation) ||
    node.generation < 1
  ) {
    return null;
  }
  return {
    kind: "unblock-task",
    taskId: node.id,
    expectedGeneration: node.generation,
    reason: ownerResultRejected
      ? "Return the same task to spec-live-reconciliation after its accountable-owner result failed mechanical verification, preserving the retained worktree and current evidence."
      : "Retry the same spec-live-reconciliation task after a workflow execution failure, preserving its retained worktree and current evidence.",
  };
}

function workflowAttentionRetries<Row extends { residueTaskIds: string[] }>(
  rows: Row[],
  nodesById: ReadonlyMap<string, GraphNode>,
): TaskAction[] {
  const actions = new Map<string, TaskAction>();
  for (const row of rows) {
    for (const taskId of row.residueTaskIds) {
      const node = nodesById.get(taskId);
      const action = node ? retryWorkflowAttentionAction(node) : null;
      if (action) actions.set(taskId, action);
    }
  }
  return [...actions.values()];
}

function hasPipelineRunWait(node: GraphNode): boolean {
  return node.conditionIds.some(
    (conditionId) =>
      conditionId.startsWith("pipeline-run-") &&
      conditionId.endsWith("-completed"),
  );
}

function hasPendingOwnerAdjudication(node: GraphNode): boolean {
  return (
    node.state === "attention" &&
    node.workflow === "spec-live-reconciliation" &&
    node.latestAttemptHandler === "workflow:spec-live-reconciliation" &&
    node.latestFailureReason === "needs-owner"
  );
}

function liveExecutionCapacity(
  representedTaskIds: string[],
  nodesById: ReadonlyMap<string, GraphNode>,
  actionableTaskIds: string[],
  frontierLimit: number,
): {
  consumingTaskIds: string[];
  pipelineWaitTaskIds: string[];
  ownerHandoffTaskIds: string[];
  available: number;
} {
  const pipelineWaitTaskIds = [...new Set(representedTaskIds)].filter(
    (taskId) => {
      const node = nodesById.get(taskId);
      return node ? hasPipelineRunWait(node) : false;
    },
  );
  const ownerHandoffTaskIds = [...new Set(representedTaskIds)].filter(
    (taskId) => {
      const node = nodesById.get(taskId);
      return node ? hasPendingOwnerAdjudication(node) : false;
    },
  );
  const consumingTaskIds = [
    ...new Set([
      ...actionableTaskIds,
      ...pipelineWaitTaskIds,
      ...ownerHandoffTaskIds,
    ]),
  ];
  return {
    consumingTaskIds,
    pipelineWaitTaskIds,
    ownerHandoffTaskIds,
    available: Math.max(0, frontierLimit - consumingTaskIds.length),
  };
}

function plainCarrierFeatureScope(row: PlainCarrierRow): string {
  const pathScope = row.scenarioTestPath.split("/")[1]?.trim() ?? "";
  if (pathScope) return pathScope;
  const declared = row.featureIds
    .map((featureId) => featureId.trim())
    .filter(Boolean)
    .sort();
  return declared.join(",");
}

function selectPlainCarrierRows(
  rows: PlainCarrierRow[],
  limit: number,
  occupiedFeatureScopes: ReadonlySet<string>,
): PlainCarrierRow[] {
  if (limit <= 0) return [];

  const selected: PlainCarrierRow[] = [];
  const deferred: PlainCarrierRow[] = [];
  const selectedScopes = new Set(occupiedFeatureScopes);

  for (const row of rows) {
    const scope = plainCarrierFeatureScope(row);
    if (scope && selectedScopes.has(scope)) {
      deferred.push(row);
      continue;
    }
    selected.push(row);
    if (scope) selectedScopes.add(scope);
    if (selected.length === limit) return selected;
  }

  for (const row of deferred) {
    selected.push(row);
    if (selected.length === limit) break;
  }
  return selected;
}

function canRepresentFrontierRow(node: GraphNode): boolean {
  if (node.id === frontierTaskId) return false;
  if (node.id === "project") return false;
  if (node.id.startsWith("runtime/")) return false;
  if (node.id.startsWith("ops/")) return false;
  if (node.id.startsWith("aks-")) return false;
  if (node.id.includes("focus-review")) return false;
  return true;
}

function isScenarioFrontierParent(parentId: string): boolean {
  return (
    parentId === "group/scenario-normalization" ||
    parentId === scenarioNormalizationTaskId
  );
}

function scenarioNormalizationLineageTaskIds(nodes: GraphNode[]): string[] {
  const lineage = new Set<string>();

  for (const node of nodes) {
    if (
      node.id === scenarioNormalizationTaskId ||
      isScenarioFrontierParent(node.parentId) ||
      node.input.loopId === scenarioNormalizationTaskId
    ) {
      lineage.add(node.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!lineage.has(node.id) && lineage.has(node.parentId)) {
        lineage.add(node.id);
        changed = true;
      }
    }
  }

  return [...lineage].filter((taskId) => taskId !== frontierTaskId);
}

function scenarioLiveExecutionCapacity(
  nodes: GraphNode[],
  nodesById: ReadonlyMap<string, GraphNode>,
  frontierLimit: number,
): ReturnType<typeof liveExecutionCapacity> {
  const taskIds = scenarioNormalizationLineageTaskIds(nodes).filter(
    (taskId) => {
      const node = nodesById.get(taskId);
      return node ? canRepresentFrontierRow(node) : false;
    },
  );
  const accounting = loopFrontierAccounting(
    taskIds.map((taskId) => ({
      taskId,
      phase: frontierPhase(nodesById.get(taskId)),
    })),
    frontierLimit,
  );
  return liveExecutionCapacity(
    taskIds,
    nodesById,
    accounting.actionableTaskIds,
    frontierLimit,
  );
}

function rowHasSourceNormalizationOwner<
  Row extends { representedTaskIds: string[] },
>(row: Row, nodesById: ReadonlyMap<string, GraphNode>): boolean {
  return row.representedTaskIds.some((taskId) => {
    const node = nodesById.get(taskId);
    if (!node) return false;

    if (
      ["active", "running", "pending", "runnable", "backlog"].includes(
        node.state,
      )
    ) {
      return true;
    }

    return (
      hasPipelineRunWait(node) ||
      hasPendingOwnerAdjudication(node) ||
      retryWorkflowAttentionAction(node) !== null
    );
  });
}

function rowMatchesNode(row: FrontierRow, node: GraphNode): boolean {
  if (!canRepresentFrontierRow(node)) return false;
  if (node.input.loopId === scenarioNormalizationTaskId) {
    return node.input.workKey === row.adapterPath;
  }
  if (node.input.loopId) return false;
  if (node.input.adapterPath === row.adapterPath) return true;
  return (
    isScenarioFrontierParent(node.parentId) &&
    Boolean(row.specId) &&
    node.input.specId === row.specId
  );
}

function plainRowMatchesNode(row: PlainCarrierRow, node: GraphNode): boolean {
  if (!canRepresentFrontierRow(node)) return false;
  if (node.input.loopId === scenarioNormalizationTaskId) {
    return node.input.workKey === row.scenarioTestPath;
  }
  if (node.input.loopId) return false;

  const exactLegacyPathMatch = [
    node.input.scenarioTestPath,
    node.input.plainCarrierPath,
    node.input.legacyCarrierPath,
  ].includes(row.scenarioTestPath);
  const exactAdapterPathMatch = [
    node.input.adapterPath,
    node.input.normalizedCarrierPath,
  ].includes(row.adapterPath);
  if (exactLegacyPathMatch || exactAdapterPathMatch) {
    return true;
  }

  return (
    isScenarioFrontierParent(node.parentId) &&
    (row.specIds.some((specId) => node.input.specId === specId) ||
      (Array.isArray(node.input.specIds) &&
        row.specIds.some((specId) =>
          (node.input.specIds as unknown[]).includes(specId),
        )))
  );
}

function actionForRow(
  row: FrontierRow,
  originDevCommit: string,
  report: InventoryReport,
): TaskAction {
  const workRevision = digest(`${originDevCommit}:${row.adapterPath}`);
  const id = `domain/reconcile-scenario-adapter-${safeTaskIdPart(row.adapterPath)}-${workRevision.slice(0, 8)}`;
  return {
    kind: "create-task",
    id,
    parentId: scenarioNormalizationTaskId,
    outcome: `Reconcile current origin/dev missing scenario adapter ${row.adapterPath} for ${row.specId || "the owning spec"} into exactly one next truthful state: integrated directly into dev, smallest same-spec repair, exact external wait, terminal disposition, or escalation.`,
    mode: "achieve",
    owner: "aks-explorer",
    workflow: row.specId ? "spec-live-reconciliation" : "domain-task-execution",
    input: {
      workflow: name,
      frontierTaskId,
      loopId: scenarioNormalizationTaskId,
      workKey: row.adapterPath,
      workRevision,
      originDevCommit,
      target: "staging",
      adapterPath: row.adapterPath,
      legacyPath: row.legacyPath,
      specId: row.specId || null,
      probeRef: row.probeRef || null,
      implementationPath: row.implementationPath || null,
      branchCandidates: row.branchCandidates,
      representedTaskIds: row.representedTaskIds,
      residueTaskIds: row.residueTaskIds,
      strictInventory: {
        generatedAt: report.generatedAt ?? null,
        directVitestImplementationCount:
          report.directVitestImplementationCount ?? null,
        referencedPlainActiveSpecCount:
          report.referencedPlainActiveSpecCount ?? null,
        referencedPlainScenarioCount:
          report.referencedPlainScenarioCount ?? null,
        repoPlainScenarioFileCount: report.repoPlainScenarioFileCount ?? null,
      },
    },
    outputs: ["evidence/archive/", row.adapterPath],
    acceptance: [
      ...learnedScenarioNormalizationAcceptance,
      "A verified task branch must integrate directly into dev; use a repo-ref wait only when an exact external restriction prevents this workflow from performing that integration.",
    ],
    priority: standingLoopDefinitions[scenarioNormalizationTaskId].priority,
    category: "domain_leaf",
  };
}

function actionForPlainCarrierRow(
  row: PlainCarrierRow,
  originDevCommit: string,
  report: InventoryReport,
): TaskAction {
  const workRevision = digest(`${originDevCommit}:${row.scenarioTestPath}`);
  const id = `domain/normalize-plain-scenario-carrier-${safeTaskIdPart(row.scenarioTestPath)}-${workRevision.slice(0, 8)}`;
  const owningSpecs = row.specIds.join(", ") || "its current consumers";
  return {
    kind: "create-task",
    id,
    parentId: scenarioNormalizationTaskId,
    outcome: `Normalize current origin/dev plain scenario carrier ${row.scenarioTestPath} for ${owningSpecs} into exactly one next truthful state: direct .test.ts implementation integrated into dev, smallest same-scope repair, exact external wait, terminal disposition, or escalation.`,
    mode: "achieve",
    owner: "aks-explorer",
    workflow: row.specIds.length
      ? "spec-live-reconciliation"
      : "domain-task-execution",
    input: {
      workflow: name,
      frontierTaskId,
      loopId: scenarioNormalizationTaskId,
      workKey: row.scenarioTestPath,
      workRevision,
      originDevCommit,
      target: "staging",
      normalizationScope: row.scope,
      scenarioTestPath: row.scenarioTestPath,
      adapterPath: row.adapterPath || null,
      specIds: row.specIds,
      specId: row.specIds[0] ?? null,
      featureIds: row.featureIds,
      activeSpecCount: row.activeSpecCount,
      branchCandidates: row.branchCandidates,
      representedTaskIds: row.representedTaskIds,
      residueTaskIds: row.residueTaskIds,
      strictInventory: {
        generatedAt: report.generatedAt ?? null,
        directVitestImplementationCount:
          report.directVitestImplementationCount ?? null,
        referencedPlainActiveSpecCount:
          report.referencedPlainActiveSpecCount ?? null,
        referencedPlainScenarioCount:
          report.referencedPlainScenarioCount ?? null,
        repoPlainScenarioFileCount: report.repoPlainScenarioFileCount ?? null,
      },
    },
    outputs: ["evidence/archive/", row.adapterPath],
    acceptance: [
      ...learnedScenarioNormalizationAcceptance,
      "Completion requires the current strict inventory to stop listing scenarioTestPath in both remainingSpecReferencedPlainScenarioUnits and remainingRepoPlainScenarioFiles; pointing a spec at a sibling wrapper while leaving the plain .ts carrier is progress, not completion.",
      "Preserve every active spec and import path. If a sibling .test.ts imports the plain carrier, move the required behavior into the direct .test.ts implementation or a shared library outside features/*/tests/*.ts before removing the plain carrier.",
      "Normalize the plain .ts carrier to current-line direct .test.ts coverage or record the exact blocker/disposition keeping strict inventory red for that scenarioTestPath.",
      "Preserve input.target across repair, wait, escalation, and successor work. Do not guess or fall back to another subscription, region, target, or standalone build.",
      "A verified task branch must integrate directly into dev; use a repo-ref wait only when an exact external restriction prevents this workflow from performing that integration.",
    ],
    priority: standingLoopDefinitions[scenarioNormalizationTaskId].priority,
    category: "domain_leaf",
  };
}

function workflowRepairForPlainCarrierRow(
  row: PlainCarrierRow,
  nodesById: ReadonlyMap<string, GraphNode>,
): TaskAction | null {
  if (row.specIds.length === 0) return null;
  const node = [...nodesById.values()].find(
    (candidate) => plainRowMatchesNode(row, candidate) && !candidate.workflow,
  );
  if (
    !node ||
    node.state !== "pending" ||
    frontierPhase(node) !== "pending" ||
    !Number.isInteger(node.generation) ||
    node.generation < 1
  ) {
    return null;
  }
  return {
    kind: "update-task",
    taskId: node.id,
    expectedGeneration: node.generation,
    owner: "aks-explorer",
    workflow: "spec-live-reconciliation",
  };
}

function routineNormalizationPriorityRepairs(
  nodesById: ReadonlyMap<string, GraphNode>,
  limit: number,
): TaskAction[] {
  return [...nodesById.values()]
    .filter(
      (node) =>
        node.id.startsWith("domain/normalize-plain-scenario-carrier-") &&
        node.input.loopId === scenarioNormalizationTaskId &&
        node.priority === "P0" &&
        node.state !== "running" &&
        Number.isInteger(node.generation) &&
        node.generation > 0,
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, Math.max(0, limit))
    .map((node) => ({
      kind: "update-task" as const,
      taskId: node.id,
      expectedGeneration: node.generation,
      priority: "P1" as const,
    }));
}

function buildRows(
  worktreeDir: string,
  missingAdapterFiles: string[],
  nodes: GraphNode[],
): FrontierRow[] {
  const specs = loadSpecs(worktreeDir);
  return missingAdapterFiles.map((adapterPath) => {
    const legacyPath = adapterPath.replace(/\.test\.ts$/, ".ts");
    const spec =
      specs.find((entry) => entry.probeRef === legacyPath) ??
      specs.find((entry) => entry.implementation?.path === adapterPath) ??
      specs.find((entry) => JSON.stringify(entry).includes(adapterPath)) ??
      {};
    const row: FrontierRow = {
      adapterPath,
      legacyPath,
      specId: String(spec.id ?? ""),
      probeRef: String(spec.probeRef ?? ""),
      implementationPath: String(spec.implementation?.path ?? ""),
      branchCandidates: [],
      branchCandidatesInspected: false,
      representedTaskIds: [],
      actionableTaskIds: [],
      waitingTaskIds: [],
      residueTaskIds: [],
    };
    const matches = nodes.filter((node) => rowMatchesNode(row, node));
    row.representedTaskIds = [...new Set(matches.map((node) => node.id))];
    const accounting = loopFrontierAccounting(
      matches.map((node) => ({ taskId: node.id, phase: frontierPhase(node) })),
      0,
    );
    row.actionableTaskIds = accounting.actionableTaskIds;
    row.waitingTaskIds = accounting.waitingTaskIds;
    row.residueTaskIds = [
      ...accounting.attentionTaskIds,
      ...accounting.terminalTaskIds,
    ];
    return row;
  });
}

function buildPlainCarrierRows(
  units: PlainCarrierRow[],
  nodes: GraphNode[],
): PlainCarrierRow[] {
  return units.map((unit) => {
    const row: PlainCarrierRow = {
      ...unit,
      branchCandidates: [],
      branchCandidatesInspected: false,
      representedTaskIds: [],
      actionableTaskIds: [],
      waitingTaskIds: [],
      residueTaskIds: [],
    };
    const matches = nodes.filter((node) => plainRowMatchesNode(row, node));
    row.representedTaskIds = [...new Set(matches.map((node) => node.id))];
    const accounting = loopFrontierAccounting(
      matches.map((node) => ({ taskId: node.id, phase: frontierPhase(node) })),
      0,
    );
    row.actionableTaskIds = accounting.actionableTaskIds;
    row.waitingTaskIds = accounting.waitingTaskIds;
    row.residueTaskIds = [
      ...accounting.attentionTaskIds,
      ...accounting.terminalTaskIds,
    ];
    return row;
  });
}

function buildRepositoryOnlyPlainCarrierRows(
  worktreeDir: string,
  repoPlainScenarioFiles: string[],
  specReferencedRows: PlainCarrierRow[],
  nodes: GraphNode[],
): PlainCarrierRow[] {
  const referenced = new Set(
    specReferencedRows.map((row) => row.scenarioTestPath),
  );
  const specs = loadSpecs(worktreeDir);
  const rows = repoPlainScenarioFiles
    .filter((scenarioTestPath) => !referenced.has(scenarioTestPath))
    .map((scenarioTestPath) => {
      const adapterPath = scenarioTestPath.replace(/\.ts$/, ".test.ts");
      const specIds = specs
        .filter(
          (spec) =>
            spec.probeRef === adapterPath ||
            spec.implementation?.path === adapterPath,
        )
        .map((spec) => String(spec.id))
        .filter(Boolean);
      return {
        scope: "repository-only" as const,
        scenarioTestPath,
        adapterPath,
        specIds: [...new Set(specIds)],
        featureIds: [scenarioTestPath.split("/")[1] ?? ""].filter(Boolean),
        activeSpecCount: specIds.length,
        branchCandidates: [],
        branchCandidatesInspected: false,
        representedTaskIds: [],
        actionableTaskIds: [],
        waitingTaskIds: [],
        residueTaskIds: [],
      } satisfies PlainCarrierRow;
    });
  return buildPlainCarrierRows(rows, nodes);
}

function qualityRowFeatureScope(row: QualityFrontierRow): string {
  const pathScope = row.scenarioTestPath.split("/")[1]?.trim() ?? "";
  if (pathScope) return pathScope;
  return row.featureIds
    .map((featureId) => featureId.trim())
    .filter(Boolean)
    .join(",");
}

function qualityRowPriority(row: QualityFrontierRow): number {
  if (row.issueCodes.includes("current-source-staging-live-proof")) return 0;
  if (row.issueCodes.includes("hard-coded-target-fallback")) return 1;
  if (row.issueCodes.includes("missing-learn-api-grounding")) return 2;
  return 3;
}

function selectQualityRows(
  rows: QualityFrontierRow[],
  limit: number,
  occupiedFeatureScopes: ReadonlySet<string>,
): QualityFrontierRow[] {
  if (limit <= 0) return [];

  const ordered = [...rows].sort(
    (left, right) =>
      qualityRowPriority(left) - qualityRowPriority(right) ||
      left.scenarioTestPath.localeCompare(right.scenarioTestPath),
  );
  const selected: QualityFrontierRow[] = [];
  const deferred: QualityFrontierRow[] = [];
  const selectedScopes = new Set(occupiedFeatureScopes);

  for (const row of ordered) {
    const scope = qualityRowFeatureScope(row);
    if (scope && selectedScopes.has(scope)) {
      deferred.push(row);
      continue;
    }
    selected.push(row);
    if (scope) selectedScopes.add(scope);
    if (selected.length === limit) return selected;
  }

  for (const row of deferred) {
    selected.push(row);
    if (selected.length === limit) break;
  }
  return selected;
}

function qualityRowMatchesNode(
  row: QualityFrontierRow,
  node: GraphNode,
): boolean {
  if (!canRepresentFrontierRow(node)) return false;
  if (node.input.loopId === scenarioNormalizationTaskId) {
    return node.input.workKey === row.scenarioTestPath;
  }
  if (node.input.loopId) return false;

  const exactScenarioPathMatch = [
    node.input.scenarioTestPath,
    node.input.directVitestPath,
    node.input.implementationPath,
    node.input.normalizedCarrierPath,
    node.input.adapterPath,
  ].includes(row.scenarioTestPath);
  if (exactScenarioPathMatch) return true;

  return (
    isScenarioFrontierParent(node.parentId) &&
    (row.specIds.some((specId) => node.input.specId === specId) ||
      (Array.isArray(node.input.specIds) &&
        row.specIds.some((specId) =>
          (node.input.specIds as unknown[]).includes(specId),
        )))
  );
}

function buildQualityRows(
  worktreeDir: string,
  report: InventoryReport,
  nodes: GraphNode[],
): QualityFrontierRow[] {
  const grouped = new Map<string, QualityFrontierRow>();

  for (const inventoryRow of normalizeInventoryRows(report)) {
    if (inventoryRow.directVitestImplementation !== true) continue;
    const scenarioTestPath = String(inventoryRow.scenarioTestPath ?? "").trim();
    if (!scenarioTestPath.endsWith(".test.ts")) continue;

    const issues = directCarrierQualityIssues(worktreeDir, inventoryRow);
    if (issues.length === 0) continue;

    const key = scenarioTestPath;
    const existing = grouped.get(key);
    const specId = String(inventoryRow.specId ?? "").trim();
    const featureId = String(inventoryRow.featureId ?? "").trim();
    const issueCodes = [...new Set(issues.map((issue) => issue.code))];
    const issueDetails = [...new Set(issues.map((issue) => issue.detail))];

    if (existing) {
      if (specId && !existing.specIds.includes(specId))
        existing.specIds.push(specId);
      if (featureId && !existing.featureIds.includes(featureId)) {
        existing.featureIds.push(featureId);
      }
      existing.issueCodes = [
        ...new Set([...existing.issueCodes, ...issueCodes]),
      ].sort();
      existing.issueDetails = [
        ...new Set([...existing.issueDetails, ...issueDetails]),
      ];
      continue;
    }

    grouped.set(key, {
      scenarioTestPath,
      specIds: specId ? [specId] : [],
      featureIds: featureId ? [featureId] : [],
      issueCodes: issueCodes.sort(),
      issueDetails,
      branchCandidates: [],
      branchCandidatesInspected: false,
      representedTaskIds: [],
      actionableTaskIds: [],
      waitingTaskIds: [],
      residueTaskIds: [],
    });
  }

  return [...grouped.values()].map((row) => {
    const matches = nodes.filter((node) => qualityRowMatchesNode(row, node));
    row.representedTaskIds = [...new Set(matches.map((node) => node.id))];
    const accounting = loopFrontierAccounting(
      matches.map((node) => ({ taskId: node.id, phase: frontierPhase(node) })),
      0,
    );
    row.actionableTaskIds = accounting.actionableTaskIds;
    row.waitingTaskIds = accounting.waitingTaskIds;
    row.residueTaskIds = [
      ...accounting.attentionTaskIds,
      ...accounting.terminalTaskIds,
    ];
    return row;
  });
}

function buildQualityLiveProofGapRows(
  report: InventoryReport,
  incompleteSpecIds: readonly string[],
  nodes: GraphNode[],
): QualityFrontierRow[] {
  const missingSpecIds = new Set(
    incompleteSpecIds.map((specId) => specId.trim()).filter(Boolean),
  );
  if (missingSpecIds.size === 0) return [];

  const grouped = new Map<string, QualityFrontierRow>();
  for (const inventoryRow of normalizeInventoryRows(report)) {
    if (inventoryRow.directVitestImplementation !== true) continue;
    const specId = String(inventoryRow.specId ?? "").trim();
    const scenarioTestPath = String(inventoryRow.scenarioTestPath ?? "").trim();
    if (!specId || !missingSpecIds.has(specId)) continue;
    if (!scenarioTestPath.endsWith(".test.ts")) continue;
    const featureId = String(inventoryRow.featureId ?? "").trim();
    const detail =
      "Current source still lacks accepted staging live proof or an active no-terminal quality holder for this spec.";
    const existing = grouped.get(scenarioTestPath);
    if (existing) {
      if (!existing.specIds.includes(specId)) existing.specIds.push(specId);
      if (featureId && !existing.featureIds.includes(featureId)) {
        existing.featureIds.push(featureId);
      }
      existing.issueCodes = [
        ...new Set([
          ...existing.issueCodes,
          "current-source-staging-live-proof",
        ]),
      ].sort();
      existing.issueDetails = [...new Set([...existing.issueDetails, detail])];
      continue;
    }
    grouped.set(scenarioTestPath, {
      scenarioTestPath,
      specIds: [specId],
      featureIds: featureId ? [featureId] : [],
      issueCodes: ["current-source-staging-live-proof"],
      issueDetails: [detail],
      branchCandidates: [],
      branchCandidatesInspected: false,
      representedTaskIds: [],
      actionableTaskIds: [],
      waitingTaskIds: [],
      residueTaskIds: [],
    });
  }

  return [...grouped.values()].map((row) => {
    const matches = nodes.filter((node) => qualityRowMatchesNode(row, node));
    row.representedTaskIds = [...new Set(matches.map((node) => node.id))];
    const accounting = loopFrontierAccounting(
      matches.map((node) => ({ taskId: node.id, phase: frontierPhase(node) })),
      0,
    );
    row.actionableTaskIds = accounting.actionableTaskIds;
    row.waitingTaskIds = accounting.waitingTaskIds;
    row.residueTaskIds = [
      ...accounting.attentionTaskIds,
      ...accounting.terminalTaskIds,
    ];
    return row;
  });
}

function mergeQualityRows(
  ...rowSets: QualityFrontierRow[][]
): QualityFrontierRow[] {
  const merged = new Map<string, QualityFrontierRow>();
  for (const rowSet of rowSets) {
    for (const row of rowSet) {
      const existing = merged.get(row.scenarioTestPath);
      if (!existing) {
        merged.set(row.scenarioTestPath, {
          ...row,
          specIds: [...row.specIds],
          featureIds: [...row.featureIds],
          issueCodes: [...row.issueCodes],
          issueDetails: [...row.issueDetails],
          branchCandidates: [...row.branchCandidates],
          representedTaskIds: [...row.representedTaskIds],
          actionableTaskIds: [...row.actionableTaskIds],
          waitingTaskIds: [...row.waitingTaskIds],
          residueTaskIds: [...row.residueTaskIds],
        });
        continue;
      }
      existing.specIds = [...new Set([...existing.specIds, ...row.specIds])];
      existing.featureIds = [
        ...new Set([...existing.featureIds, ...row.featureIds]),
      ];
      existing.issueCodes = [
        ...new Set([...existing.issueCodes, ...row.issueCodes]),
      ].sort();
      existing.issueDetails = [
        ...new Set([...existing.issueDetails, ...row.issueDetails]),
      ];
      existing.branchCandidates = [
        ...new Set([...existing.branchCandidates, ...row.branchCandidates]),
      ];
      existing.branchCandidatesInspected ||= row.branchCandidatesInspected;
      existing.representedTaskIds = [
        ...new Set([...existing.representedTaskIds, ...row.representedTaskIds]),
      ];
      existing.actionableTaskIds = [
        ...new Set([...existing.actionableTaskIds, ...row.actionableTaskIds]),
      ];
      existing.waitingTaskIds = [
        ...new Set([...existing.waitingTaskIds, ...row.waitingTaskIds]),
      ];
      existing.residueTaskIds = [
        ...new Set([...existing.residueTaskIds, ...row.residueTaskIds]),
      ];
    }
  }
  return [...merged.values()];
}

function inspectQualityRowBranches(
  projectDir: string,
  row: QualityFrontierRow,
): QualityFrontierRow {
  row.branchCandidates = branchCandidatesForPaths(
    projectDir,
    row.scenarioTestPath,
  );
  row.branchCandidatesInspected = true;
  return row;
}

function qualityRowWorkRevision(
  row: QualityFrontierRow,
  originDevCommit: string,
): string {
  return digest(`${originDevCommit}:${row.scenarioTestPath}:quality`);
}

function qualityRowOutcome(row: QualityFrontierRow): string {
  const owningSpecs = row.specIds.join(", ") || "its current consumers";
  return `Normalize current origin/dev direct scenario carrier quality for ${row.scenarioTestPath} (${owningSpecs}) so the standalone .test.ts implementation matches the learned direct-carrier contract without ${row.issueCodes.join(", ")}.`;
}

function qualityRowInput(
  row: QualityFrontierRow,
  originDevCommit: string,
  report: InventoryReport,
): Record<string, unknown> {
  const workRevision = qualityRowWorkRevision(row, originDevCommit);
  return {
    workflow: name,
    frontierTaskId,
    loopId: scenarioNormalizationTaskId,
    workKey: row.scenarioTestPath,
    workRevision,
    originDevCommit,
    target: "staging",
    normalizationScope: "quality",
    scenarioTestPath: row.scenarioTestPath,
    specIds: row.specIds,
    specId: row.specIds[0] ?? null,
    allowTerminalDisposition: false,
    featureIds: row.featureIds,
    qualityIssueCodes: row.issueCodes,
    qualityIssueDetails: row.issueDetails,
    branchCandidates: row.branchCandidates,
    representedTaskIds: row.representedTaskIds,
    residueTaskIds: row.residueTaskIds,
    strictInventory: {
      generatedAt: report.generatedAt ?? null,
      directVitestImplementationCount:
        report.directVitestImplementationCount ?? null,
      referencedPlainActiveSpecCount:
        report.referencedPlainActiveSpecCount ?? null,
      referencedPlainScenarioCount: report.referencedPlainScenarioCount ?? null,
      repoPlainScenarioFileCount: report.repoPlainScenarioFileCount ?? null,
    },
  };
}

function qualityRowAcceptance(): string[] {
  return [
    ...learnedScenarioNormalizationAcceptance,
    "Completion requires the current quality-normalization inventory to stop listing scenarioTestPath with the cited issue codes; a passing repository check alone is progress, not completion.",
    "Preserve active behavior while making the direct .test.ts carrier standalone and current-line: remove wrapper-only scaffolding, keep explicit check/execute/mutation-gate semantics, and preserve or declare fixture ownership, cleanup, and Learn/API grounding.",
    "Because this executable quality row names live spec consumers, terminal disposition is forbidden: complete only after an exact staging ADO pass from the tested current-source commit plus cleanup evidence and direct origin/dev integration.",
    "A real unavailable external capability may yield one exact observable wait or escalation for this same spec, but not a blocked/reviewed-exception terminal substitute for pass.",
    "A verified task branch must integrate directly into dev; use a repo-ref wait only when an exact external restriction prevents this workflow from performing that integration.",
  ];
}

function actionForQualityRow(
  row: QualityFrontierRow,
  originDevCommit: string,
  report: InventoryReport,
): TaskAction {
  const workRevision = qualityRowWorkRevision(row, originDevCommit);
  const id = `domain/reconcile-direct-scenario-quality-${safeTaskIdPart(row.scenarioTestPath)}-${workRevision.slice(0, 8)}`;
  return {
    kind: "create-task",
    id,
    parentId: scenarioNormalizationTaskId,
    outcome: qualityRowOutcome(row),
    mode: "achieve",
    owner: "aks-explorer",
    workflow: row.specIds.length
      ? "spec-live-reconciliation"
      : "domain-task-execution",
    input: qualityRowInput(row, originDevCommit, report),
    outputs: ["evidence/archive/", row.scenarioTestPath],
    acceptance: qualityRowAcceptance(),
    priority: standingLoopDefinitions[scenarioNormalizationTaskId].priority,
    category: "domain_leaf",
  };
}

function workflowRepairForQualityRow(
  row: QualityFrontierRow,
  nodesById: ReadonlyMap<string, GraphNode>,
): TaskAction | null {
  if (row.specIds.length === 0) return null;
  const node = [...nodesById.values()].find(
    (candidate) => qualityRowMatchesNode(row, candidate) && !candidate.workflow,
  );
  if (
    !node ||
    node.state !== "pending" ||
    !Number.isInteger(node.generation) ||
    node.generation < 1
  ) {
    return null;
  }
  return {
    kind: "update-task",
    taskId: node.id,
    expectedGeneration: node.generation,
    owner: "aks-explorer",
    workflow: "spec-live-reconciliation",
  };
}

function qualityRowContractRepairs(
  row: QualityFrontierRow,
  originDevCommit: string,
  report: InventoryReport,
  nodesById: ReadonlyMap<string, GraphNode>,
): TaskAction[] {
  return row.representedTaskIds
    .map((taskId) => nodesById.get(taskId))
    .filter((node): node is GraphNode => Boolean(node))
    .filter((node) => {
      if (!Number.isInteger(node.generation) || node.generation < 1) {
        return false;
      }
      if (
        ![
          "active",
          "running",
          "pending",
          "runnable",
          "backlog",
        ].includes(node.state)
      ) {
        return false;
      }
      const inputIssueCodes = stringList(node.input.qualityIssueCodes);
      return (
        node.input.allowTerminalDisposition !== false ||
        row.issueCodes.some((code) => !inputIssueCodes.includes(code))
      );
    })
    .map((node) => ({
      kind: "update-task" as const,
      taskId: node.id,
      expectedGeneration: node.generation,
      owner: "aks-explorer",
      workflow: row.specIds.length
        ? "spec-live-reconciliation"
        : "domain-task-execution",
      outcome: qualityRowOutcome(row),
      input: {
        ...node.input,
        ...qualityRowInput(row, originDevCommit, report),
      },
      acceptance: qualityRowAcceptance(),
    }));
}

function capEvidence<Row>(
  baseEvidence: string[],
  rows: Row[],
  render: (row: Row) => string,
): string[] {
  if (baseEvidence.length >= maxWorkflowEvidenceEntries) {
    return baseEvidence.slice(0, maxWorkflowEvidenceEntries);
  }

  const remaining = maxWorkflowEvidenceEntries - baseEvidence.length;
  if (rows.length <= remaining) {
    return [...baseEvidence, ...rows.map(render)];
  }

  const detailBudget = Math.max(0, remaining - 1);
  const bounded = rows.slice(0, detailBudget).map(render);
  const omitted = rows.length - detailBudget;
  return [
    ...baseEvidence,
    ...bounded,
    `evidence-truncated:${omitted}-row(s)-omitted-to-stay-within-${maxWorkflowEvidenceEntries}`,
  ];
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const projectDir = resolveProjectDir(ctx);
  const maxLeaves =
    standingLoopDefinitions[scenarioNormalizationTaskId].frontierLimit;
  const minRunnableLeaves = desiredRunnableMin(ctx);
  const nodes = graphNodes(ctx.reconciliation);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return withCleanOriginDev(projectDir, (worktreeDir, source) => {
    const {
      report,
      activeSpecCount,
      missingAdapterFiles,
      unreferencedPlainScenarioFiles,
      unpairedAdapterFiles,
      scenarioSignalCounts,
      reviewedQualityLiveCoverage: inventoryReviewedQualityLiveCoverage,
      strictPassed,
      remainingSpecReferencedPlainScenarioUnits,
      remainingRepoPlainScenarioFiles,
      remainingSpecReferencedPlainScenarioUnitCount,
      remainingRepoPlainScenarioFileCount,
      error,
    } = missingAdaptersFromInventory(worktreeDir);
    const originDevCommit = originCommit(worktreeDir);
    const reviewedQualityLiveCoverage =
      inventoryReviewedQualityLiveCoverage.missing
        ? currentSourceReviewedQualityLiveCoverage(
            ctx.reconciliation,
            report,
            worktreeDir,
            originDevCommit,
            nodes,
          )
        : inventoryReviewedQualityLiveCoverage;
    const inventoryRequired = qualityInventoryRequired(ctx);
    const inventoryFocus = qualityInventoryFocus(ctx);
    const auditBaselineCommit = qualityAuditOriginDevCommit(ctx);
    const evidence = [
      `inventory-source:${source}`,
      `inventory-root:${relative(projectDir, worktreeDir) || "."}`,
      `origin-dev-commit:${originDevCommit}`,
      `active-specs:${activeSpecCount}`,
      `strict-passed:${strictPassed === null ? "unknown" : String(strictPassed)}`,
      `missing-adapters:${missingAdapterFiles.length}`,
      `remaining-spec-referenced-plain-scenario-units:${remainingSpecReferencedPlainScenarioUnitCount}`,
      `remaining-repo-plain-scenario-files:${remainingRepoPlainScenarioFileCount}`,
      `unreferenced-plain-scenario-files:${unreferencedPlainScenarioFiles.length}`,
      `unpaired-adapter-files:${unpairedAdapterFiles.length}`,
      `scenario-signal-counts:${formatScenarioSignalCounts(scenarioSignalCounts)}`,
      `reviewed-quality-live-coverage:${formatReviewedQualityLiveCoverage(reviewedQualityLiveCoverage, activeSpecCount)}`,
      `inventory-reviewed-quality-live-coverage:${formatReviewedQualityLiveCoverage(inventoryReviewedQualityLiveCoverage, activeSpecCount)}`,
      `desired-runnable-min:${minRunnableLeaves}`,
      `quality-inventory-required:${String(inventoryRequired)}`,
      ...(inventoryFocus.length > 0
        ? [`quality-inventory-focus:${inventoryFocus.join(",")}`]
        : []),
      ...(auditBaselineCommit
        ? [`quality-audit-origin-dev-commit:${auditBaselineCommit}`]
        : []),
      ...(error ? [`inventory-error:${error}`] : []),
    ];

    if (error) {
      const summary = `Scenario frontier inventory could not be parsed from ${source}: ${error}`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence,
      });
    }

    if (missingAdapterFiles.length === 0) {
      const fileLayoutOnlyComplete =
        strictPassed === true &&
        remainingSpecReferencedPlainScenarioUnitCount === 0 &&
        remainingRepoPlainScenarioFileCount === 0;
      const broaderContractIncomplete =
        fileLayoutOnlyComplete &&
        (unreferencedPlainScenarioFiles.length > 0 ||
          unpairedAdapterFiles.length > 0);
      if (broaderContractIncomplete) {
        const summary = `Scenario frontier completed file-layout normalization on ${source} ${originDevCommit}, but broader direct-carrier normalization remains incomplete: ${unreferencedPlainScenarioFiles.length} unreferenced plain carrier file(s) and ${unpairedAdapterFiles.length} unpaired adapter file(s) remain across ${activeSpecCount} active spec(s). Preserve raw scenario signal counts as review evidence and return the same stable task to aks-explorer owner judgment for feature-sized follow-through instead of reconverging the retired strict-inventory-only workflow contract.`;
        const broaderEvidence = capEvidence(
          evidence,
          [
            ...unreferencedPlainScenarioFiles.map(
              (path) => `unreferenced-plain:${path}`,
            ),
            ...unpairedAdapterFiles.map((path) => `unpaired-adapter:${path}`),
          ],
          (entry) => entry,
        );
        return ctx.done(summary, {
          state: "needs-owner",
          summary,
          evidence: broaderEvidence,
        });
      }
      const repositoryCheckCommand = requiredRepositoryCheckCommand(ctx);
      if (fileLayoutOnlyComplete && repositoryCheckCommand) {
        const repositoryCheck = runRequiredRepositoryCheck(
          projectDir,
          worktreeDir,
          repositoryCheckCommand,
        );
        if (repositoryCheck.status !== 0) {
          const summary = `Scenario frontier is structurally complete on ${source} ${originDevCommit}, but the required full repository check failed. Return the exact current check evidence to aks-explorer for an in-scope repair; do not converge from strict inventory alone.`;
          return ctx.done(summary, {
            state: "needs-owner",
            summary,
            evidence: [...evidence, ...repositoryCheck.evidence],
          });
        }
        evidence.push(...repositoryCheck.evidence);
      }
      const structuralQualityRows = fileLayoutOnlyComplete
        ? buildQualityRows(worktreeDir, report, nodes)
        : [];
      const liveProofGapRows = fileLayoutOnlyComplete
        ? buildQualityLiveProofGapRows(
            report,
            reviewedQualityLiveCoverage.incompleteSpecIds,
            nodes,
          )
        : [];
      const qualityRows = fileLayoutOnlyComplete
        ? mergeQualityRows(structuralQualityRows, liveProofGapRows)
        : [];
      const openQualityCoverageTaskIds = fileLayoutOnlyComplete
        ? currentSourceOpenQualityCoverageTaskIds(report, nodes)
        : [];
      if (fileLayoutOnlyComplete) {
        evidence.push(`quality-normalization-rows:${qualityRows.length}`);
        evidence.push(
          `quality-structural-rows:${structuralQualityRows.length}`,
        );
        evidence.push(`quality-live-proof-gap-rows:${liveProofGapRows.length}`);
        evidence.push(
          `open-quality-coverage-tasks:${openQualityCoverageTaskIds.length}`,
        );
      }
      if (fileLayoutOnlyComplete && qualityRows.length > 0) {
        const rowsNeedingWork = qualityRows.filter(
          (row) => !rowHasSourceNormalizationOwner(row, nodesById),
        );
        const accounting = loopFrontierAccounting(
          qualityRows.flatMap((row) =>
            row.representedTaskIds.map((taskId) => ({
              taskId,
              phase: frontierPhase(nodesById.get(taskId)),
            })),
          ),
          maxLeaves,
        );
        const capacity = scenarioLiveExecutionCapacity(
          nodes,
          nodesById,
          maxLeaves,
        );
        const priorityRepairs = routineNormalizationPriorityRepairs(
          nodesById,
          maxLeaves,
        );
        const contractRepairs = qualityRows.flatMap((row) =>
          qualityRowContractRepairs(row, originDevCommit, report, nodesById),
        );
        const workflowRepairs = qualityRows
          .map((row) => workflowRepairForQualityRow(row, nodesById))
          .filter((action): action is TaskAction => Boolean(action))
          .slice(0, Math.max(0, maxLeaves - priorityRepairs.length));
        const attentionRetries = workflowAttentionRetries(
          qualityRows,
          nodesById,
        ).slice(
          0,
          Math.min(
            capacity.available,
            Math.max(
              0,
              maxLeaves - priorityRepairs.length - workflowRepairs.length,
            ),
          ),
        );
        const actionBudget = Math.min(
          Math.max(0, capacity.available - attentionRetries.length),
          Math.max(
            0,
            maxLeaves -
              priorityRepairs.length -
              workflowRepairs.length -
              attentionRetries.length,
          ),
        );
        const occupiedFeatureScopes = new Set(
          qualityRows
            .filter((row) => rowHasSourceNormalizationOwner(row, nodesById))
            .map(qualityRowFeatureScope)
            .filter(Boolean),
        );
        const selectedRows = selectQualityRows(
          rowsNeedingWork,
          actionBudget,
          occupiedFeatureScopes,
        ).map((row) => inspectQualityRowBranches(projectDir, row));
        const actions = priorityRepairs.concat(
          contractRepairs,
          workflowRepairs,
          attentionRetries,
          selectedRows.map((row) =>
            actionForQualityRow(row, originDevCommit, report),
          ),
        );
        const residueCount = qualityRows.filter(
          (row) =>
            row.actionableTaskIds.length === 0 &&
            row.waitingTaskIds.length === 0 &&
            row.residueTaskIds.length > 0,
        ).length;
        const summary = `Scenario frontier completed file-layout normalization, reviewed/live coverage, and the required repository check on ${source} ${originDevCommit}, but current direct-carrier quality-normalization inventory still has ${qualityRows.length} row(s): ${structuralQualityRows.length} structural row(s) plus ${liveProofGapRows.length} current-source live-proof gap row(s); declared ${actions.length} bounded quality-normalization task action(s), observed ${accounting.actionableTaskIds.length} actionable and ${accounting.waitingTaskIds.length} waiting quality row task(s), counted ${capacity.pipelineWaitTaskIds.length} exact pipeline-backed wait(s) and ${capacity.ownerHandoffTaskIds.length} pending owner-adjudication handoff(s) against live execution capacity for ${capacity.consumingTaskIds.length}/${maxLeaves} occupied slot(s), and found ${residueCount} row(s) represented only by attention or stale terminal residue.`;
        const qualityEvidence = capEvidence(
          [
            ...evidence,
            `live-execution-capacity:${capacity.consumingTaskIds.length}/${maxLeaves};pipeline-waits=${capacity.pipelineWaitTaskIds.length};owner-handoffs=${capacity.ownerHandoffTaskIds.length}`,
            `declared-quality-actions:${actions.length}`,
            `actionable-quality-rows:${accounting.actionableTaskIds.length}`,
            `waiting-quality-rows:${accounting.waitingTaskIds.length}`,
            `unrepresented-quality-rows:${rowsNeedingWork.length}`,
          ],
          qualityRows,
          (row) =>
            `quality-row:${row.scenarioTestPath};specs=${row.specIds.join(",") || "unknown"};issues=${row.issueCodes.join(",")};actionable=${row.actionableTaskIds.length};waiting=${row.waitingTaskIds.length};residue=${row.residueTaskIds.length};branches=${branchCandidateEvidence(row)}`,
        );
        if (openQualityCoverageTaskIds.length > 0) {
          const liveCoverageSummary =
            actions.length === 0
              ? `Scenario frontier completed file-layout normalization and the required repository check on ${source} ${originDevCommit}, but ${openQualityCoverageTaskIds.length} current scenario-normalization quality task(s) still represent active same-spec work or exact waits under group/scenario-normalization and no new bounded repair was declared from this pass. Keep the stable frontier task waiting until those represented current-source quality rows settle instead of converging merely because direct children are empty.`
              : `Scenario frontier completed file-layout normalization and the required repository check on ${source} ${originDevCommit}, and declared ${actions.length} bounded quality-normalization task action(s), but ${openQualityCoverageTaskIds.length} current scenario-normalization quality task(s) still represent active same-spec work or exact waits under group/scenario-normalization. Keep the stable frontier task waiting until both the newly declared repairs and the already represented current-source quality rows settle instead of converging while live frontier work remains.`;
          return ctx.done(liveCoverageSummary, {
            state: "waiting",
            summary: liveCoverageSummary,
            evidence: capEvidence(
              capEvidence(
                qualityEvidence,
                reviewedQualityLiveCoverage.incompleteSpecIds,
                (specId) => `quality-live-incomplete-spec:${specId}`,
              ),
              openQualityCoverageTaskIds,
              (taskId) => `open-quality-coverage-task:${taskId}`,
            ),
            ...(actions.length > 0 ? { actions } : {}),
          });
        }
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: capEvidence(
            qualityEvidence,
            reviewedQualityLiveCoverage.incompleteSpecIds,
            (specId) => `quality-live-incomplete-spec:${specId}`,
          ),
          actions,
        });
      }
      if (
        fileLayoutOnlyComplete &&
        !reviewedQualityLiveCoverageComplete(
          reviewedQualityLiveCoverage,
          activeSpecCount,
        )
      ) {
        const summary = `Scenario frontier completed structural normalization on ${source} ${originDevCommit}, but current per-spec reviewed-quality/live-proof coverage is ${formatReviewedQualityLiveCoverage(reviewedQualityLiveCoverage, activeSpecCount)}. Keep the same stable task with aks-explorer owner judgment until every active spec is reviewed and represented by current live proof or an exact blocker/escalation.`;
        return ctx.done(summary, {
          state: "needs-owner",
          summary,
          evidence: capEvidence(
            evidence,
            reviewedQualityLiveCoverage.incompleteSpecIds,
            (specId) => `quality-live-incomplete-spec:${specId}`,
          ),
        });
      }
      if (fileLayoutOnlyComplete && openQualityCoverageTaskIds.length > 0) {
        const summary = `Scenario frontier completed file-layout normalization and current reviewed/live coverage on ${source} ${originDevCommit}, but ${openQualityCoverageTaskIds.length} current scenario-normalization quality task(s) still represent active same-spec work or exact waits under group/scenario-normalization. Keep the stable frontier task waiting until those represented current-source quality rows settle instead of converging merely because direct children are empty.`;
        return ctx.done(summary, {
          state: "waiting",
          summary,
          evidence: capEvidence(
            evidence,
            openQualityCoverageTaskIds,
            (taskId) => `open-quality-coverage-task:${taskId}`,
          ),
        });
      }
      if (strictPassed === false) {
        const specReferencedRows = buildPlainCarrierRows(
          remainingSpecReferencedPlainScenarioUnits,
          nodes,
        );
        const rows = specReferencedRows.length
          ? specReferencedRows
          : buildRepositoryOnlyPlainCarrierRows(
              worktreeDir,
              remainingRepoPlainScenarioFiles,
              specReferencedRows,
              nodes,
            );
        const rowsNeedingWork = rows.filter(
          (row) => !rowHasSourceNormalizationOwner(row, nodesById),
        );
        const accounting = loopFrontierAccounting(
          rows.flatMap((row) =>
            row.representedTaskIds.map((taskId) => ({
              taskId,
              phase: frontierPhase(nodesById.get(taskId)),
            })),
          ),
          maxLeaves,
        );
        const capacity = scenarioLiveExecutionCapacity(
          nodes,
          nodesById,
          maxLeaves,
        );
        const priorityRepairs = routineNormalizationPriorityRepairs(
          nodesById,
          maxLeaves,
        );
        const workflowRepairs = rows
          .map((row) => workflowRepairForPlainCarrierRow(row, nodesById))
          .filter((action): action is TaskAction => Boolean(action))
          .slice(0, Math.max(0, maxLeaves - priorityRepairs.length));
        const attentionRetries = workflowAttentionRetries(
          rows,
          nodesById,
        ).slice(
          0,
          Math.min(
            capacity.available,
            Math.max(
              0,
              maxLeaves - priorityRepairs.length - workflowRepairs.length,
            ),
          ),
        );
        const actionBudget = Math.min(
          Math.max(0, capacity.available - attentionRetries.length),
          Math.max(
            0,
            maxLeaves -
              priorityRepairs.length -
              workflowRepairs.length -
              attentionRetries.length,
          ),
        );
        const occupiedFeatureScopes = new Set(
          rows
            .filter((row) => rowHasSourceNormalizationOwner(row, nodesById))
            .map(plainCarrierFeatureScope)
            .filter(Boolean),
        );
        const selectedRows = selectPlainCarrierRows(
          rowsNeedingWork,
          actionBudget,
          occupiedFeatureScopes,
        ).map((row) => inspectPlainCarrierRowBranches(projectDir, row));
        const actions = priorityRepairs.concat(
          workflowRepairs,
          attentionRetries,
          selectedRows.map((row) =>
            actionForPlainCarrierRow(row, originDevCommit, report),
          ),
        );
        const residueCount = rows.filter(
          (row) =>
            row.actionableTaskIds.length === 0 &&
            row.waitingTaskIds.length === 0 &&
            row.residueTaskIds.length > 0,
        ).length;
        const rowScope = specReferencedRows.length
          ? "current spec-referenced plain scenario unit"
          : "repository-only plain scenario file";
        const summary = rows.length
          ? `Scenario frontier remains strict-red on ${source} ${originDevCommit} with zero missing adapter files: declared ${actions.length} bounded plain-carrier normalization task action(s), observed ${accounting.actionableTaskIds.length} actionable and ${accounting.waitingTaskIds.length} waiting plain-carrier task(s), counted ${capacity.pipelineWaitTaskIds.length} exact pipeline-backed wait(s) and ${capacity.ownerHandoffTaskIds.length} pending owner-adjudication handoff(s) against live execution capacity for ${capacity.consumingTaskIds.length}/${maxLeaves} occupied slot(s), found ${rows.length} ${rowScope}(s), ${remainingRepoPlainScenarioFileCount} remaining repo plain scenario file(s), and ${residueCount} row(s) represented only by attention or stale terminal residue.`
          : `Scenario frontier remains strict-red on ${source} ${originDevCommit} with zero missing adapter files and ${remainingRepoPlainScenarioFileCount} remaining repo plain scenario file(s), but the inventory did not provide an exact plain-carrier row to reconcile.`;
        const plainCarrierEvidence = capEvidence(
          [
            ...evidence,
            `live-execution-capacity:${capacity.consumingTaskIds.length}/${maxLeaves};pipeline-waits=${capacity.pipelineWaitTaskIds.length};owner-handoffs=${capacity.ownerHandoffTaskIds.length}`,
            `declared-normalization-actions:${actions.length}`,
            `actionable-plain-rows:${accounting.actionableTaskIds.length}`,
            `waiting-plain-rows:${accounting.waitingTaskIds.length}`,
            `unrepresented-plain-rows:${rowsNeedingWork.length}`,
          ],
          rows,
          (row) =>
            `${row.scope === "repository-only" ? "repo-plain-row" : "plain-row"}:${row.scenarioTestPath};specs=${row.specIds.join(",") || "unknown"};actionable=${row.actionableTaskIds.length};waiting=${row.waitingTaskIds.length};residue=${row.residueTaskIds.length};branches=${branchCandidateEvidence(row)}`,
        );
        if (rows.length === 0) {
          return ctx.done(summary, {
            state: "needs-owner",
            summary,
            evidence: plainCarrierEvidence,
          });
        }
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: plainCarrierEvidence,
          actions,
        });
      }
      const summary =
        "Scenario frontier converged: clean origin/dev strict inventory reports zero missing adapter files.";
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence,
        actions: [],
      });
    }

    const rows = buildRows(worktreeDir, missingAdapterFiles, nodes);
    const rowsNeedingWork = rows.filter(
      (row) => row.representedTaskIds.length === 0,
    );
    const accounting = loopFrontierAccounting(
      rows.flatMap((row) =>
        row.representedTaskIds.map((taskId) => ({
          taskId,
          phase: frontierPhase(nodesById.get(taskId)),
        })),
      ),
      maxLeaves,
    );
    const capacity = scenarioLiveExecutionCapacity(nodes, nodesById, maxLeaves);
    const priorityRepairs = routineNormalizationPriorityRepairs(
      nodesById,
      maxLeaves,
    );
    const actionBudget = Math.min(
      capacity.available,
      Math.max(0, maxLeaves - priorityRepairs.length),
    );
    const actions = priorityRepairs.concat(
      rowsNeedingWork
        .slice(0, actionBudget)
        .map((row) => inspectFrontierRowBranches(projectDir, row))
        .map((row) => actionForRow(row, originDevCommit, report)),
    );
    const residueCount = rows.filter(
      (row) =>
        row.actionableTaskIds.length === 0 &&
        row.waitingTaskIds.length === 0 &&
        row.residueTaskIds.length > 0,
    ).length;
    const summaryBase = `Scenario frontier has ${missingAdapterFiles.length} current missing adapter(s) on ${source} ${originDevCommit}: declared ${actions.length} bounded owner task action(s), observed ${accounting.actionableTaskIds.length} actionable and ${accounting.waitingTaskIds.length} waiting task(s), counted ${capacity.pipelineWaitTaskIds.length} exact pipeline-backed wait(s) and ${capacity.ownerHandoffTaskIds.length} pending owner-adjudication handoff(s) against live execution capacity for ${capacity.consumingTaskIds.length}/${maxLeaves} occupied slot(s), and found ${residueCount} row(s) represented only by attention or stale terminal residue.`;
    const summary = summaryBase;

    const resultState =
      actions.length > 0 ||
      accounting.actionableTaskIds.length > 0 ||
      accounting.waitingTaskIds.length > 0
        ? "converged"
        : "needs-owner";
    const resultEvidence = capEvidence(
      [
        ...evidence,
        `live-execution-capacity:${capacity.consumingTaskIds.length}/${maxLeaves};pipeline-waits=${capacity.pipelineWaitTaskIds.length};owner-handoffs=${capacity.ownerHandoffTaskIds.length}`,
      ],
      rows,
      (row) =>
        `row:${row.adapterPath};spec=${row.specId || "unknown"};actionable=${row.actionableTaskIds.length};waiting=${row.waitingTaskIds.length};residue=${row.residueTaskIds.length};branches=${branchCandidateEvidence(row)}`,
    );
    if (resultState === "needs-owner") {
      return ctx.done(summary, {
        state: resultState,
        summary,
        evidence: resultEvidence,
      });
    }
    return ctx.done(summary, {
      state: resultState,
      summary,
      evidence: resultEvidence,
      actions,
    });
  });
}
