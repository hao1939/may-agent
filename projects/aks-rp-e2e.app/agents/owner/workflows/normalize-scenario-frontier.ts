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
  ProjectAppConditionSpec,
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowIoContract,
  WorkflowResult,
} from "@may-agent/sdk";
import { workflowResultVersion } from "@may-agent/sdk";

export const name = "normalize-scenario-frontier";
export const description =
  "Audit strict scenario-test adapter gaps and declare bounded owner work for the normalization frontier.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "normalize-scenario-frontier-v1",
  input: {
    required: [
      "project.task.tick target.taskId=domain/normalize-scenario-tests-repo-frontier-20260715",
    ],
    optional: ["desiredRunnableLeaves", "project", "app"],
    description:
      "Reconcile the strict scenario-test missing-adapter frontier from current clean origin/dev evidence.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions", "conditions"],
    description:
      "Returns bounded domain task actions or exact wait Conditions; it never writes the task graph.",
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

type SpecRecord = {
  id?: string;
  probeRef?: string;
  implementation?: { path?: string };
};

type FrontierRow = {
  adapterPath: string;
  legacyPath: string;
  specId: string;
  probeRef: string;
  implementationPath: string;
  branchCandidates: string[];
  representedTaskIds: string[];
  usefulTaskIds: string[];
  residueTaskIds: string[];
};

type GraphNode = {
  id: string;
  state: string;
  text: string;
};

const frontierTaskId = "domain/normalize-scenario-tests-repo-frontier-20260715";
const usefulStates = new Set([
  "active",
  "running",
  "backlog",
  "waiting",
  "blocked",
]);
const residueStates = new Set(["attention", "review", "failed", "error"]);

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

function triggerObject(raw: string): Record<string, unknown> {
  const marker = raw.indexOf("## Trigger Event");
  if (marker < 0) return {};
  const scoped = raw.slice(marker);
  const first = scoped.indexOf("{");
  const last = scoped.lastIndexOf("}");
  if (first < 0 || last <= first) return {};
  try {
    const parsed = JSON.parse(scoped.slice(first, last + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function triggerData(
  trigger: Record<string, unknown>,
): Record<string, unknown> {
  return trigger.data &&
    typeof trigger.data === "object" &&
    !Array.isArray(trigger.data)
    ? (trigger.data as Record<string, unknown>)
    : {};
}

function triggerNumber(
  trigger: Record<string, unknown>,
  key: string,
): number | undefined {
  const data = triggerData(trigger);
  const value = data[key] ?? trigger[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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

function missingAdaptersFromInventory(worktreeDir: string): {
  report: InventoryReport;
  missingAdapterFiles: string[];
  error?: string;
} {
  const result = run(
    "bun",
    ["scripts/check-scenario-tests.ts", "--strict", "--json"],
    worktreeDir,
  );
  try {
    const parsed = JSON.parse(result.stdout) as { report?: InventoryReport };
    const report = parsed.report ?? {};
    const missingAdapterFiles = Array.isArray(report.missingAdapterFiles)
      ? report.missingAdapterFiles.filter(
          (value): value is string =>
            typeof value === "string" && value.endsWith(".test.ts"),
        )
      : [];
    return { report, missingAdapterFiles };
  } catch {
    return {
      report: {},
      missingAdapterFiles: [],
      error:
        result.stderr.trim() ||
        `strict inventory returned unparsable JSON with status ${String(result.status)}`,
    };
  }
}

function originCommit(worktreeDir: string): string {
  return run("git", ["rev-parse", "HEAD"], worktreeDir).stdout.trim();
}

function branchCandidates(projectDir: string, adapterPath: string): string[] {
  const legacyPath = adapterPath.replace(/\.test\.ts$/, ".ts");
  const result = run(
    "git",
    ["log", "--all", "--format=%h %D %s", "--", adapterPath, legacyPath],
    projectDir,
  );
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
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
      text: JSON.stringify({ id, spec, status }),
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
    const state = String(task.state ?? "")
      .trim()
      .toLowerCase();
    if (["done", "closed", "converged"].includes(state)) continue;
    nodes.push({
      id,
      state,
      text: JSON.stringify({ id, task }),
    });
  }
  return nodes;
}

function rowMatchesNode(row: FrontierRow, node: GraphNode): boolean {
  return [
    row.adapterPath,
    row.legacyPath,
    row.specId,
    row.probeRef,
    row.implementationPath,
  ]
    .filter(Boolean)
    .some((needle) => node.text.includes(needle));
}

function conditionForTask(taskId: string): ProjectAppConditionSpec {
  return {
    id: `task-reconciled:${digest(taskId, 16)}`,
    type: "project.task.reconciled",
    subject: `task:${taskId}`,
    expected: { field: "disposition", equals: "converged" },
  };
}

function actionForRow(
  row: FrontierRow,
  originDevCommit: string,
  report: InventoryReport,
): ProjectAppTaskAction {
  const id = `domain/reconcile-scenario-adapter-${safeTaskIdPart(row.adapterPath)}-${digest(`${originDevCommit}:${row.adapterPath}:${row.representedTaskIds.join(",")}`)}`;
  return {
    kind: "create-task",
    id,
    parentId: frontierTaskId,
    outcome: `Reconcile current origin/dev missing scenario adapter ${row.adapterPath} for ${row.specId || "the owning spec"} into exactly one next truthful state: absorbed, publish/rebase/recheck, smallest same-spec repair, exact external wait, terminal disposition, or escalation.`,
    mode: "achieve",
    owner: "aks-explorer",
    input: {
      workflow: name,
      frontierTaskId,
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
    outputs: ["evidence/archive/", row.adapterPath, row.legacyPath],
    acceptance: [
      "Start from clean current origin/dev, not the dirty local repair branch.",
      "Read the owning spec JSON and prove the exact probeRef/implementation path for this adapter row.",
      "Inspect same-spec branch, ADO run, artifact, and task evidence before deciding the next move.",
      "Choose exactly one next state: origin/dev absorbed/equivalent, publish/rebase/recheck, smallest same-spec repair, exact external wait with observer/resume condition, terminal disposition, or escalation.",
      "Do not close from filename similarity, stale task summaries, broad plain-TS counters, or review/attention residue alone.",
    ],
    priority: "P1",
    category: "domain_leaf",
  };
}

function buildRows(
  worktreeDir: string,
  projectDir: string,
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
      branchCandidates: branchCandidates(projectDir, adapterPath),
      representedTaskIds: [],
      usefulTaskIds: [],
      residueTaskIds: [],
    };
    const matches = nodes.filter((node) => rowMatchesNode(row, node));
    row.representedTaskIds = [...new Set(matches.map((node) => node.id))];
    row.usefulTaskIds = [
      ...new Set(
        matches
          .filter((node) => usefulStates.has(node.state))
          .map((node) => node.id),
      ),
    ];
    row.residueTaskIds = [
      ...new Set(
        matches
          .filter((node) => residueStates.has(node.state))
          .map((node) => node.id),
      ),
    ];
    return row;
  });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = resolveProjectDir(ctx);
  const appDir = resolveAppDir(ctx, projectDir);
  const trigger = triggerObject(ctx.task);
  const maxLeaves = Math.max(
    1,
    Math.min(
      5,
      triggerNumber(trigger, "max") ??
        triggerNumber(trigger, "maxConcurrent") ??
        5,
    ),
  );
  const nodes = graphNodes(appDir);

  return withCleanOriginDev(projectDir, (worktreeDir, source) => {
    const { report, missingAdapterFiles, error } =
      missingAdaptersFromInventory(worktreeDir);
    const originDevCommit = originCommit(worktreeDir);
    const evidence = [
      `inventory-source:${source}`,
      `inventory-root:${relative(projectDir, worktreeDir) || "."}`,
      `origin-dev-commit:${originDevCommit}`,
      `missing-adapters:${missingAdapterFiles.length}`,
      ...(error ? [`inventory-error:${error}`] : []),
    ];

    if (error) {
      const summary = `Scenario frontier inventory could not be parsed from ${source}: ${error}`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence,
        actions: [],
      });
    }

    if (missingAdapterFiles.length === 0) {
      const summary =
        "Scenario frontier converged: clean origin/dev strict inventory reports zero missing adapter files.";
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence,
        actions: [],
      });
    }

    const rows = buildRows(worktreeDir, projectDir, missingAdapterFiles, nodes);
    const rowsNeedingWork = rows.filter(
      (row) => row.usefulTaskIds.length === 0,
    );
    const actions = rowsNeedingWork
      .slice(0, maxLeaves)
      .map((row) => actionForRow(row, originDevCommit, report));
    const usefulTaskIds = [
      ...new Set(rows.flatMap((row) => row.usefulTaskIds)),
    ].slice(0, 64);
    const conditions =
      actions.length === 0
        ? usefulTaskIds.map((taskId) => conditionForTask(taskId))
        : [];
    const residueCount = rows.filter(
      (row) => row.usefulTaskIds.length === 0 && row.residueTaskIds.length > 0,
    ).length;
    const summary = `Scenario frontier has ${missingAdapterFiles.length} current missing adapter(s) on ${source} ${originDevCommit}: declared ${actions.length} bounded owner task action(s), found ${usefulTaskIds.length} useful represented task(s), and found ${residueCount} row(s) represented only by review/attention residue.`;

    return ctx.done(summary, {
      state:
        actions.length > 0
          ? "converged"
          : conditions.length > 0
            ? "waiting"
            : "needs-owner",
      summary,
      evidence: [
        ...evidence,
        ...rows.map(
          (row) =>
            `row:${row.adapterPath};spec=${row.specId || "unknown"};useful=${row.usefulTaskIds.length};residue=${row.residueTaskIds.length};branches=${row.branchCandidates.length}`,
        ),
      ],
      actions,
      ...(conditions.length > 0 ? { conditions } : {}),
    });
  });
}
