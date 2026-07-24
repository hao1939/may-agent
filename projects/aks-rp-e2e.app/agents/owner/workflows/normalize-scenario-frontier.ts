import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowIoContract,
  WorkflowResult,
} from "@may-agent/sdk";
import { workflowResultVersion } from "@may-agent/sdk";
import {
  learnedScenarioNormalizationAcceptance,
  loopFrontierAccounting,
  scenarioNormalizationTaskId,
  standingLoopDefinitions,
} from "../../../task-loops.ts";
import {
  parseTriggerEvent,
  triggerValue,
} from "../../app-ops/workflows/lib/workflow-input.ts";

export const name = "normalize-scenario-frontier";
export const description =
  "Audit strict scenario-test adapter gaps and declare bounded owner work for the normalization frontier.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "normalize-scenario-frontier-v1",
  input: {
    required: ["project.task.tick target.taskId=scenario-normalization"],
    optional: ["desiredRunnableLeaves", "project", "app"],
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
  missingAdapterFiles?: unknown;
  directVitestImplementationCount?: number;
  referencedPlainActiveSpecCount?: number;
  referencedPlainScenarioCount?: number;
  repoPlainScenarioFileCount?: number;
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
  state: string;
  parentId: string;
  input: Record<string, unknown>;
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
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr || result.error?.message || "",
  };
}

function parseTaskField(raw: string, name: string): string {
  return raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
}

function resolveProjectDir(ctx: WorkflowContext): string {
  return (
    ctx.projectDir ||
    parseTaskField(ctx.task, "project") ||
    "/app/projects/aks-rp-e2e"
  );
}

function resolveAppDir(ctx: WorkflowContext, projectDir: string): string {
  return (
    ctx.appDir ||
    parseTaskField(ctx.task, "app") ||
    (projectDir.endsWith(".app") ? projectDir : `${projectDir}.app`)
  );
}

function desiredRunnableMin(ctx: WorkflowContext): number {
  const fallback = 3;
  const event = parseTriggerEvent(ctx.task);
  const raw = triggerValue(event, "desiredRunnableLeaves");
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const min = Number((raw as { min?: unknown }).min);
    if (Number.isFinite(min) && min >= 1) return Math.floor(min);
  }
  return fallback;
}

function canUseOriginDev(projectDir: string): boolean {
  return (
    run("git", ["rev-parse", "--verify", "origin/dev"], projectDir).status === 0
  );
}

function withCleanOriginDev<T>(
  projectDir: string,
  fn: (worktreeDir: string, source: "origin/dev" | "project-dir") => T,
): T {
  if (!canUseOriginDev(projectDir)) return fn(projectDir, "project-dir");
  const dir = mkdtempSync(join(tmpdir(), "aks-scenario-frontier-"));
  const add = run(
    "git",
    ["worktree", "add", "--detach", dir, "origin/dev"],
    projectDir,
  );
  if (add.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return fn(projectDir, "project-dir");
  }
  try {
    return fn(dir, "origin/dev");
  } finally {
    run("git", ["worktree", "remove", "--force", dir], projectDir);
    rmSync(dir, { recursive: true, force: true });
  }
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
  missingAdapterFiles: string[];
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
    const missingAdapterFiles = Array.isArray(report.missingAdapterFiles)
      ? report.missingAdapterFiles.filter(
          (value): value is string =>
            typeof value === "string" && value.endsWith(".test.ts"),
        )
      : [];
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
      missingAdapterFiles,
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
      missingAdapterFiles: [],
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

function graphNodes(appDir: string): GraphNode[] {
  const nodes: GraphNode[] = [];
  const state = readJson<Record<string, unknown>>(
    join(appDir, ".state", "tasks", "state.json"),
    {},
  );
  const resources =
    state.resources && typeof state.resources === "object"
      ? (state.resources as Record<string, Record<string, unknown>>)
      : {};
  for (const [id, resource] of Object.entries(resources)) {
    const status =
      resource.status &&
      typeof resource.status === "object" &&
      !Array.isArray(resource.status)
        ? (resource.status as Record<string, unknown>)
        : {};
    const spec =
      resource.spec &&
      typeof resource.spec === "object" &&
      !Array.isArray(resource.spec)
        ? (resource.spec as Record<string, unknown>)
        : {};
    const state = String(status.phase ?? "")
      .trim()
      .toLowerCase();
    nodes.push({
      id,
      state,
      parentId: String(spec.parentId ?? ""),
      input:
        spec.input &&
        typeof spec.input === "object" &&
        !Array.isArray(spec.input)
          ? (spec.input as Record<string, unknown>)
          : {},
    });
  }

  const tree = readJson<Record<string, unknown>>(
    join(appDir, ".state", "tasks", "tree.json"),
    {},
  );
  const tasks =
    tree.tasks && typeof tree.tasks === "object"
      ? (tree.tasks as Record<string, Record<string, unknown>>)
      : {};
  for (const [id, task] of Object.entries(tasks)) {
    const state = String(task.phase ?? "")
      .trim()
      .toLowerCase();
    if (["done", "closed", "converged"].includes(state)) continue;
    nodes.push({
      id,
      state,
      parentId: String(task.parent_id ?? task.parentId ?? ""),
      input:
        task.input &&
        typeof task.input === "object" &&
        !Array.isArray(task.input)
          ? (task.input as Record<string, unknown>)
          : {},
    });
  }
  return nodes;
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

function rowMatchesNode(row: FrontierRow, node: GraphNode): boolean {
  if (!canRepresentFrontierRow(node)) return false;
  if (node.input.loopId === scenarioNormalizationTaskId) {
    return node.input.workKey === row.adapterPath;
  }
  if (node.input.loopId) return false;
  return (
    isScenarioFrontierParent(node.parentId) &&
    (node.input.adapterPath === row.adapterPath ||
      (Boolean(row.specId) && node.input.specId === row.specId))
  );
}

function plainRowMatchesNode(row: PlainCarrierRow, node: GraphNode): boolean {
  if (!canRepresentFrontierRow(node)) return false;
  if (node.input.loopId === scenarioNormalizationTaskId) {
    return node.input.workKey === row.scenarioTestPath;
  }
  if (node.input.loopId) return false;
  return (
    isScenarioFrontierParent(node.parentId) &&
    (node.input.scenarioTestPath === row.scenarioTestPath ||
      row.specIds.some((specId) => node.input.specId === specId) ||
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
): ProjectAppTaskAction {
  const id = `domain/reconcile-scenario-adapter-${safeTaskIdPart(row.adapterPath)}`;
  return {
    kind: "create-task",
    id,
    parentId: "group/scenario-normalization",
    outcome: `Reconcile current origin/dev missing scenario adapter ${row.adapterPath} for ${row.specId || "the owning spec"} into exactly one next truthful state: integrated directly into dev, smallest same-spec repair, exact external wait, terminal disposition, or escalation.`,
    mode: "achieve",
    owner: "aks-explorer",
    workflow: row.specId ? "spec-live-reconciliation" : "domain-task-execution",
    input: {
      workflow: name,
      frontierTaskId,
      loopId: scenarioNormalizationTaskId,
      workKey: row.adapterPath,
      workRevision: digest(`${originDevCommit}:${row.adapterPath}`),
      originDevCommit,
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
): ProjectAppTaskAction {
  const id = `domain/normalize-plain-scenario-carrier-${safeTaskIdPart(row.scenarioTestPath)}`;
  const owningSpecs = row.specIds.join(", ") || "its current consumers";
  return {
    kind: "create-task",
    id,
    parentId: "group/scenario-normalization",
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
      workRevision: digest(`${originDevCommit}:${row.scenarioTestPath}`),
      originDevCommit,
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
      "A verified task branch must integrate directly into dev; use a repo-ref wait only when an exact external restriction prevents this workflow from performing that integration.",
    ],
    priority: standingLoopDefinitions[scenarioNormalizationTaskId].priority,
    category: "domain_leaf",
  };
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
      matches.map((node) => ({ taskId: node.id, phase: node.state })),
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
      matches.map((node) => ({ taskId: node.id, phase: node.state })),
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

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = resolveProjectDir(ctx);
  const appDir = resolveAppDir(ctx, projectDir);
  const maxLeaves =
    standingLoopDefinitions[scenarioNormalizationTaskId].frontierLimit;
  const minRunnableLeaves = desiredRunnableMin(ctx);
  const nodes = graphNodes(appDir);

  return withCleanOriginDev(projectDir, (worktreeDir, source) => {
    const {
      report,
      missingAdapterFiles,
      strictPassed,
      remainingSpecReferencedPlainScenarioUnits,
      remainingRepoPlainScenarioFiles,
      remainingSpecReferencedPlainScenarioUnitCount,
      remainingRepoPlainScenarioFileCount,
      error,
    } = missingAdaptersFromInventory(worktreeDir);
    const originDevCommit = originCommit(worktreeDir);
    const evidence = [
      `inventory-source:${source}`,
      `inventory-root:${relative(projectDir, worktreeDir) || "."}`,
      `origin-dev-commit:${originDevCommit}`,
      `strict-passed:${strictPassed === null ? "unknown" : String(strictPassed)}`,
      `missing-adapters:${missingAdapterFiles.length}`,
      `remaining-spec-referenced-plain-scenario-units:${remainingSpecReferencedPlainScenarioUnitCount}`,
      `remaining-repo-plain-scenario-files:${remainingRepoPlainScenarioFileCount}`,
      `desired-runnable-min:${minRunnableLeaves}`,
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
          (row) => row.representedTaskIds.length === 0,
        );
        const accounting = loopFrontierAccounting(
          rows.flatMap((row) =>
            row.representedTaskIds.map((taskId) => ({
              taskId,
              phase: nodes.find((node) => node.id === taskId)?.state,
            })),
          ),
          maxLeaves,
        );
        const actions = rowsNeedingWork
          .slice(0, accounting.available)
          .map((row) => inspectPlainCarrierRowBranches(projectDir, row))
          .map((row) => actionForPlainCarrierRow(row, originDevCommit, report));
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
          ? `Scenario frontier remains strict-red on ${source} ${originDevCommit} with zero missing adapter files: declared ${actions.length} bounded plain-carrier normalization task action(s), observed ${accounting.actionableTaskIds.length} actionable and ${accounting.waitingTaskIds.length} waiting plain-carrier task(s), found ${rows.length} ${rowScope}(s), ${remainingRepoPlainScenarioFileCount} remaining repo plain scenario file(s), and ${residueCount} row(s) represented only by attention or stale terminal residue.`
          : `Scenario frontier remains strict-red on ${source} ${originDevCommit} with zero missing adapter files and ${remainingRepoPlainScenarioFileCount} remaining repo plain scenario file(s), but the inventory did not provide an exact plain-carrier row to reconcile.`;
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: capEvidence(
            evidence,
            rows,
            (row) =>
              `${row.scope === "repository-only" ? "repo-plain-row" : "plain-row"}:${row.scenarioTestPath};specs=${row.specIds.join(",") || "unknown"};actionable=${row.actionableTaskIds.length};waiting=${row.waitingTaskIds.length};residue=${row.residueTaskIds.length};branches=${branchCandidateEvidence(row)}`,
          ),
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
          phase: nodes.find((node) => node.id === taskId)?.state,
        })),
      ),
      maxLeaves,
    );
    const actionBudget = accounting.available;
    const actions = rowsNeedingWork
      .slice(0, actionBudget)
      .map((row) => inspectFrontierRowBranches(projectDir, row))
      .map((row) => actionForRow(row, originDevCommit, report));
    const residueCount = rows.filter(
      (row) =>
        row.actionableTaskIds.length === 0 &&
        row.waitingTaskIds.length === 0 &&
        row.residueTaskIds.length > 0,
    ).length;
    const summaryBase = `Scenario frontier has ${missingAdapterFiles.length} current missing adapter(s) on ${source} ${originDevCommit}: declared ${actions.length} bounded owner task action(s), observed ${accounting.actionableTaskIds.length} actionable and ${accounting.waitingTaskIds.length} waiting task(s), and found ${residueCount} row(s) represented only by attention or stale terminal residue.`;
    const summary = summaryBase;

    const resultState =
      actions.length > 0 ||
      accounting.actionableTaskIds.length > 0 ||
      accounting.waitingTaskIds.length > 0
        ? "converged"
        : "needs-owner";
    const resultEvidence = capEvidence(
      evidence,
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
