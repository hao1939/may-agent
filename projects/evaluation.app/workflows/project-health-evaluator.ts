import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  normalizeTaskTreeInPlace,
  type TaskTree,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "project-health-evaluator";
export const description =
  "Independent project/app audit that reports evidence-backed findings to the target owner.";

const EVALUATION_APP_DIR = "/app/projects/evaluation.app";
const WATCHED_TARGETS = [
  {
    targetProject: "aks-rp-e2e.app",
    targetAppDir: "/app/projects/aks-rp-e2e.app",
    targetDomainDir: "/app/projects/aks-rp-e2e",
  },
  {
    targetProject: "may-agent.app",
    targetAppDir: "/app/projects/may-agent.app",
    targetDomainDir: "/app/projects/may-agent",
  },
  {
    targetProject: "scout-knowledge-lib.app",
    targetAppDir: "/app/projects/scout-knowledge-lib.app",
    targetDomainDir: "/app/projects/scout-knowledge-lib",
  },
  {
    targetProject: "evaluation.app",
    targetAppDir: "/app/projects/evaluation.app",
    targetDomainDir: "/app/projects/evaluation.app",
  },
] as const;
const DEFAULT_TARGET = WATCHED_TARGETS[0];
const NOTIFY_VERDICTS = new Set(["concern", "urgent", "blocked-on-human"]);
const OWNER_FEEDBACK_RETRY_MS = 60 * 60_000;
const VERDICTS = new Set([
  "ok",
  "watch",
  "concern",
  "urgent",
  "blocked-on-human",
]);

type TaskRecord = {
  id: string;
  state?: string;
  priority?: string;
  owner?: string;
  parent_id?: string | null;
  children?: string[];
  goal?: string;
  summary?: string;
  context?: unknown;
  updated_at?: string;
};

type TargetConfig = {
  targetProject: string;
  targetAppDir: string;
  targetDomainDir?: string;
  reason: string;
};

type Judgment = {
  verdict: string;
  mainConcern: string;
  affectedArtifacts?: string[];
  recommendedChange?: string;
  verification?: string[];
  requestedHumanAction: string;
  notify: boolean;
  dedupeKey: string;
  message: string;
  evaluatorWantedNotify?: boolean;
  notificationReason?: string;
  humanActionDetail?: string;
};

type ProjectHealthState = {
  lastReviewedAt?: string;
  lastCheckedAt?: string;
  lastReportPath?: string;
  lastVerdict?: string;
  lastDedupeKey?: string;
  lastRequestedHumanAction?: string;
  lastNotify?: boolean;
  lastInputFingerprint?: string;
  lastFeedbackAt?: string;
  lastFeedbackDedupeKey?: string;
  lastFeedbackVerdict?: string;
};

type ContractCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

type ExactWait = {
  owner: string;
  requestedAction: string;
  resumeCondition: string;
  fallback?: string;
  nextCheck?: string;
  linkage: string;
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function truncate(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function compactValue(
  value: unknown,
  depth = 0,
  limits = { maxDepth: 5, maxArray: 20, maxKeys: 40, maxString: 1200 },
): unknown {
  if (typeof value === "string") return truncate(value, limits.maxString);
  if (value === null || typeof value !== "object") return value;
  if (depth >= limits.maxDepth) {
    return Array.isArray(value)
      ? `[${value.length} item(s) omitted]`
      : "[nested object omitted]";
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, limits.maxArray)
      .map((item) => compactValue(item, depth + 1, limits));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, limits.maxKeys)
      .map(([key, item]) => [key, compactValue(item, depth + 1, limits)]),
  );
}

function formatCountMap(value: unknown): string {
  const record = objectRecord(value);
  const entries = Object.entries(record)
    .filter(([, count]) => typeof count === "number" && count > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0
    ? entries.map(([key, count]) => `${key}=${count}`).join(", ")
    : "none";
}

function compactList(value: unknown, limit: number): string {
  const items = asArray(value).slice(0, limit);
  if (items.length === 0) return "none";
  return items
    .map((item) => {
      const record = objectRecord(item);
      const key = String(
        record.id ??
          record.key ??
          record.workflow ??
          record.name ??
          record.type ??
          "unknown",
      );
      const state = record.state ?? record.status ?? record.verdict;
      return state ? `${key} (${String(state)})` : key;
    })
    .join(", ");
}

function loopSummary(loops: Record<string, unknown>): string {
  const lines = Object.entries(loops).map(([name, raw]) => {
    const loop = objectRecord(raw);
    const statusCounts = formatCountMap(loop.statusCounts);
    const nonTerminal = compactList(loop.sampleNonTerminal, 5);
    return `- ${name}: total=${String(loop.total ?? "unknown")}; statuses=${statusCounts}; sample=${nonTerminal}`;
  });
  return lines.length > 0 ? lines.join("\n") : "- none";
}

function projectStateMetricsSummary(
  projectState: Record<string, unknown>,
): string {
  const currentState = objectRecord(projectState.currentState);
  const metrics = objectRecord(currentState.metrics);
  const entries = Object.entries(metrics)
    .filter(([, value]) => typeof value === "number")
    .sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return "none";
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

function readText(path: string): string {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function selfRecoverySummary(selfRecovery: Record<string, unknown>): string {
  const status = String(selfRecovery.status ?? "unknown");
  const missing = asArray(selfRecovery.missing)
    .map(String)
    .slice(0, 8)
    .join(", ");
  const checks = asArray(selfRecovery.checks)
    .map((item) => {
      const check = objectRecord(item);
      const marker = check.pass === true ? "yes" : "no";
      return `${String(check.id ?? "unknown")}=${marker}`;
    })
    .join(", ");
  const patterns = asArray(
    selfRecovery.sharedOpsPattern ?? selfRecovery.aksOpsPattern,
  )
    .map((item) => {
      const check = objectRecord(item);
      const marker = check.pass === true ? "yes" : "no";
      return `${String(check.id ?? "unknown")}=${marker}`;
    })
    .join(", ");

  return [
    `- status: ${status}`,
    `- checks: ${checks || "none"}`,
    `- shared ops pattern fit: ${patterns || "none"}`,
    `- missing/weak: ${missing || "none"}`,
  ].join("\n");
}

function runArtifactSummary(recentRuns: Record<string, unknown>): string {
  const discovered = asArray(recentRuns.discovered);
  if (discovered.length === 0 && typeof recentRuns.note === "string") {
    return `- ${recentRuns.note}`;
  }
  const entries = Object.entries(recentRuns)
    .filter(([key]) => key !== "discovered" && key !== "note")
    .map(([name, value]) => `- ${name}: ${compactList(value, 5)}`);
  return entries.length > 0 ? entries.join("\n") : "- none";
}

function escalationSummary(escalations: Record<string, unknown>): string {
  const counts = objectRecord(escalations.counts);
  const usage = objectRecord(escalations.usage);
  return [
    `- created in lookback: ${String(counts.created ?? "unknown")}`,
    `- open: ${String(counts.open ?? "unknown")}; stale open: ${String(counts.staleOpen ?? "unknown")}; closed: ${String(counts.closed ?? "unknown")}`,
    `- approval dispatch: ${formatCountMap(counts.approvalDispatchByResult)}`,
    `- task linkage: blocked-with-escalation-hint=${String(usage.blockedWithEscalationHint ?? "unknown")}; blocked-with-owner-or-external-path=${String(usage.blockedWithOwnerOrExternalPath ?? "unknown")}; blocked-without-owner-or-external-path=${String(usage.blockedWithoutOwnerOrExternalPath ?? "unknown")}`,
    `- exact waits: blocked-exact-wait=${String(usage.blockedExactWaitLeaves ?? "unknown")}`,
    `- open sample: ${compactList(escalations.openSample, 5)}`,
    `- stale sample: ${compactList(escalations.staleOpenSample, 5)}`,
    `- recent approval asks: ${compactList(escalations.recentApprovalDispatches, 5)}`,
    `- warnings: ${asArray(escalations.warnings).map(String).join("; ") || "none"}`,
  ].join("\n");
}

function humanFactSummary(
  packet: Record<string, unknown>,
  factsRelativePath: string,
): string {
  const previousReview = objectRecord(packet.previousReview);
  const taskTree = objectRecord(packet.taskTree);
  const counts = objectRecord(taskTree.counts);
  const loops = objectRecord(packet.loops);
  const runtime = objectRecord(packet.runtime);
  const projectState = objectRecord(packet.projectState);
  const selfRecovery = objectRecord(packet.selfRecovery);
  const recentRuns = objectRecord(packet.recentRuns);
  const escalations = objectRecord(packet.escalations);
  const targetGit = objectRecord(packet.targetGit);

  return [
    `Full facts: ${factsRelativePath}`,
    "",
    "Previous review:",
    `- report: ${String(previousReview.reportPath ?? "none")}`,
    `- verdict: ${String(previousReview.verdict ?? "none")}`,
    `- concern: ${String(previousReview.mainConcern ?? "none")}`,
    `- action: ${String(previousReview.requestedHumanAction ?? "none")}`,
    "",
    "Task tree:",
    `- total=${String(counts.total ?? "unknown")}; leaves=${String(counts.leaves ?? "unknown")}`,
    `- leaf states: ${formatCountMap(counts.leafByState)}`,
    `- active: ${compactList(taskTree.active, 5)}`,
    `- review: ${compactList(taskTree.review, 5)}`,
    `- runnable: ${compactList(taskTree.runnable, 5)}`,
    `- design/hygiene: ${compactList(taskTree.designHygiene, 8)}`,
    `- blocked sample: ${compactList(taskTree.blockedSample, 5)}`,
    "",
    "Loops:",
    loopSummary(loops),
    "",
    "Self-recovery contract:",
    selfRecoverySummary(selfRecovery),
    "",
    "App-local run artifacts:",
    runArtifactSummary(recentRuns),
    "",
    "Escalations and approvals:",
    escalationSummary(escalations),
    "",
    "Runtime:",
    `- target readout metrics: ${projectStateMetricsSummary(projectState)}`,
    `- runtime DB metrics: ${compactList(runtime.metrics, 8)}`,
    `- recent events: ${compactList(runtime.events, 8)}`,
    `- recent workflows: ${compactList(runtime.workflows, 8)}`,
    "",
    "Target git:",
    `- branch: ${String(targetGit.branch ?? "unknown")}`,
    `- dirty files shown: ${compactList(
      asArray(targetGit.status).map((entry) => ({ id: String(entry) })),
      10,
    )}`,
  ].join("\n");
}

function parseTrigger(task: string): Record<string, unknown> | null {
  const header = "\n## Trigger Event";
  const idx = task.lastIndexOf(header);
  const start =
    idx >= 0 ? idx + 1 : task.startsWith("## Trigger Event") ? 0 : -1;
  if (start < 0) return null;
  const tail = task.slice(start);
  const fence = tail.indexOf("```json");
  if (fence < 0) return null;
  const jsonStart = fence + "```json".length;
  const jsonEnd = tail.indexOf("```", jsonStart);
  if (jsonEnd < 0) return null;
  try {
    return JSON.parse(tail.slice(jsonStart, jsonEnd).trim());
  } catch {
    return null;
  }
}

function eventDetails(
  event: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!event) return {};
  const params = event.params;
  if (params && typeof params === "object" && !Array.isArray(params)) {
    return { ...event, ...(params as Record<string, unknown>) };
  }
  const data = event.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataRecord = data as Record<string, unknown>;
    const nestedParams = dataRecord.params;
    if (
      nestedParams &&
      typeof nestedParams === "object" &&
      !Array.isArray(nestedParams)
    ) {
      return {
        ...event,
        ...dataRecord,
        ...(nestedParams as Record<string, unknown>),
      };
    }
    return { ...event, ...dataRecord };
  }
  return event;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function targetConfig(trigger: Record<string, unknown> | null): TargetConfig {
  const details = eventDetails(trigger);
  const requestedTarget =
    stringValue(details.targetProject) ??
    stringValue(details.target) ??
    DEFAULT_TARGET.targetProject;
  const watchedTarget =
    WATCHED_TARGETS.find(
      (target) =>
        target.targetProject === requestedTarget ||
        target.targetProject.replace(/\.app$/, "") === requestedTarget,
    ) ?? DEFAULT_TARGET;

  return {
    targetProject: watchedTarget.targetProject,
    targetAppDir:
      stringValue(details.targetAppDir) ?? watchedTarget.targetAppDir,
    targetDomainDir:
      stringValue(details.targetDomainDir) ?? watchedTarget.targetDomainDir,
    reason:
      stringValue(details.reason) ?? stringValue(details.lane) ?? "manual",
  };
}

function readJson(path: string): unknown {
  if (!existsSync(path)) return { missing: path };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    return {
      unreadable: path,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function tailLines(path: string, count: number): unknown {
  if (!existsSync(path)) return { missing: path };
  try {
    const lines = readFileSync(path, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(-count);
    return lines.map((line) => {
      try {
        return compactValue(JSON.parse(line), 0, {
          maxDepth: 4,
          maxArray: 12,
          maxKeys: 30,
          maxString: 600,
        });
      } catch {
        return line.slice(0, 1200);
      }
    });
  } catch (err) {
    return {
      unreadable: path,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function readJsonlTail(path: string, count: number): Record<string, unknown>[] {
  const rows = tailLines(path, count);
  return asArray(rows)
    .map(objectRecord)
    .filter((row) => Object.keys(row).length > 0);
}

function countBy<T>(
  items: T[],
  fn: (item: T) => string | undefined,
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = fn(item) ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function targetProjectIds(target: TargetConfig): string[] {
  return Array.from(
    new Set([target.targetProject, target.targetProject.replace(/\.app$/, "")]),
  );
}

function parseRowData(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringFromRecord(
  record: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function stringFromRecords(
  records: Record<string, unknown>[],
  keys: string[],
): string {
  for (const record of records) {
    const value = stringFromRecord(record, keys);
    if (value) return value;
  }
  return "";
}

function escalationKey(row: Record<string, unknown>): string {
  const data = parseRowData(row);
  return (
    stringFromRecord(data, [
      "escalationId",
      "escalation_id",
      "id",
      "dedupKey",
      "dedupeKey",
    ]) || String(row.id ?? "")
  );
}

function rowMatchesTarget(
  row: Record<string, unknown>,
  target: TargetConfig,
): boolean {
  const projectIds = targetProjectIds(target);
  const sourceProject = stringFromRecord(row, [
    "source_project_id",
    "sourceProjectId",
  ]);
  if (sourceProject && projectIds.includes(sourceProject)) return true;
  const text = JSON.stringify(row);
  return projectIds.some((project) => text.includes(project));
}

function compactTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    state: task.state ?? "unknown",
    priority: task.priority ?? "P2",
    owner: task.owner,
    parent: task.parent_id ?? null,
    children: task.children?.length ?? 0,
    goal: task.goal ? truncate(task.goal, 500) : undefined,
    summary: task.summary ? truncate(task.summary, 700) : undefined,
    context: compactValue(task.context, 0, {
      maxDepth: 4,
      maxArray: 10,
      maxKeys: 24,
      maxString: 500,
    }),
    updated_at: task.updated_at,
  };
}

function compactTaskForReport(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    state: task.state ?? "unknown",
    priority: task.priority ?? "P2",
    owner: task.owner,
    parent: task.parent_id ?? null,
    goal: task.goal,
    updated_at: task.updated_at,
  };
}

function normalizedTaskMap(
  tree: Record<string, unknown>,
): Record<string, TaskRecord> {
  const normalized = normalizeTaskTreeInPlace(tree as unknown as TaskTree);
  return normalized.tasks as Record<string, TaskRecord>;
}

function isDesignHygieneTask(task: TaskRecord): boolean {
  const text = JSON.stringify({
    id: task.id,
    goal: task.goal,
    conflict_scope: (task as any).conflict_scope,
  });
  return /legacy|design[- ]?hygiene|terminology|cleanup|obsolete|stale design|stale assumption/i.test(
    text,
  );
}

export function taskTreePacket(targetAppDir: string): Record<string, unknown> {
  const path = join(targetAppDir, ".state/tasks/tree.json");
  const tree = readJson(path);
  if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
    return { path, error: "task tree is not an object" };
  }
  if ("missing" in tree || "unreadable" in tree) return { path, tree };

  const typed = tree as Record<string, unknown>;
  const taskMap = normalizedTaskMap(typed);
  const tasks = Object.values(taskMap);
  const leaves = tasks.filter((task) => (task.children ?? []).length === 0);
  const byState = countBy(tasks, (task) => task.state);
  const leafByState = countBy(leaves, (task) => task.state);
  const active = leaves
    .filter((task) => task.state === "active")
    .map(compactTask);
  const review = leaves
    .filter((task) => task.state === "review")
    .map(compactTask);
  const blocked = leaves
    .filter((task) => task.state === "blocked")
    .slice(0, 12)
    .map(compactTask);
  const runnable = leaves
    .filter((task) =>
      ["backlog", "ready", "todo", "pending"].includes(task.state ?? ""),
    )
    .slice(0, 12)
    .map(compactTask);
  const designHygiene = leaves
    .filter(isDesignHygieneTask)
    .slice(0, 20)
    .map(compactTaskForReport);

  return {
    path,
    version: typed.version,
    project: typed.project,
    updated_at: typed.updated_at,
    project_lifecycle: typed.project_lifecycle,
    root_task_id: typed.root_task_id,
    active_task_id: typed.active_task_id,
    active_task_ids: typed.active_task_ids,
    counts: {
      total: tasks.length,
      leaves: leaves.length,
      byState,
      leafByState,
    },
    active,
    review,
    runnable,
    designHygiene,
    blockedSample: blocked,
  };
}

function contractCheck(
  id: string,
  label: string,
  pass: boolean,
  detail: string,
): ContractCheck {
  return { id, label, pass, detail };
}

function selfRecoveryContractPacket(
  target: TargetConfig,
  taskTree: Record<string, unknown>,
): Record<string, unknown> {
  const appTsPath = join(target.targetAppDir, "app.ts");
  const appSource = readText(appTsPath);
  const counts = objectRecord(taskTree.counts);
  const leafByState = objectRecord(counts.leafByState);
  const totalLeaves = numberFromRecord(counts, "leaves");
  const active = numberFromRecord(leafByState, "active");
  const review = numberFromRecord(leafByState, "review");
  const runnable =
    numberFromRecord(leafByState, "backlog") +
    numberFromRecord(leafByState, "ready") +
    numberFromRecord(leafByState, "todo") +
    numberFromRecord(leafByState, "pending");
  const blocked = numberFromRecord(leafByState, "blocked");
  const unfinished = totalLeaves - numberFromRecord(leafByState, "done");
  const hasTaskTree = totalLeaves > 0;
  const hasOwnerWake = hasAny(appSource, [
    /project\.owner\.requested/,
    /project\.planning\.requested/,
  ]);
  const hasMetricHandling = hasAny(appSource, [
    /metric\.breach/,
    /metric\.alerted/,
    /metric\.stalled/,
  ]);
  const hasScheduledObserver =
    hasAny(appSource, [/schedules\s*:/]) &&
    hasAny(appSource, [
      /watchdog/i,
      /health/i,
      /heartbeat/i,
      /patrol/i,
      /digest/i,
      /tick/i,
    ]);
  const hasFallback = hasAny(appSource, [
    /watchdog/i,
    /stall/i,
    /ops[-_]health/i,
    /library[_-]health/i,
    /project-health/i,
    /aftermath\.scan/i,
  ]);
  const hasHumanPath = hasAny(appSource, [
    /ctx\.notify/,
    /notification/i,
    /escalation/i,
    /digest/i,
    /human/i,
  ]);
  const frontierIsRepresented =
    unfinished === 0 || active + review + runnable > 0 || blocked === 0;

  const checks = [
    contractCheck(
      "task-state",
      "Task state exists",
      hasTaskTree,
      hasTaskTree
        ? `${totalLeaves} leaf task(s) found`
        : "No readable task tree leaves found",
    ),
    contractCheck(
      "owner-wake",
      "There is a path to wake the project owner/planner",
      hasOwnerWake,
      hasOwnerWake
        ? "project.owner.requested is wired"
        : "No owner/planner wake event is visible in app.ts",
    ),
    contractCheck(
      "metric-signal",
      "Project-owned metric breaches can be handled first by the app",
      hasMetricHandling,
      hasMetricHandling
        ? "metric breach/alert/stall handling is visible"
        : "No metric breach/alert/stall route is visible",
    ),
    contractCheck(
      "scheduled-observer",
      "A timer periodically observes project health or progress",
      hasScheduledObserver,
      hasScheduledObserver
        ? "scheduled observer/heartbeat/health lane is visible"
        : "No scheduled observation lane is visible",
    ),
    contractCheck(
      "fallback",
      "There is a fallback path for stuck or abnormal work",
      hasFallback,
      hasFallback
        ? "watchdog/stall/health/project-health style fallback is visible"
        : "No watchdog/stall/health fallback is visible",
    ),
    contractCheck(
      "human-path",
      "The app can surface issues to a human when it cannot finish alone",
      hasHumanPath,
      hasHumanPath
        ? "notification/escalation/digest/human wording is visible"
        : "No human notification/escalation path is visible",
    ),
    contractCheck(
      "frontier",
      "Unfinished task work has an active/review/runnable/frontier path",
      frontierIsRepresented,
      `unfinished=${unfinished}; active=${active}; review=${review}; runnable=${runnable}; blocked=${blocked}`,
    ),
  ];

  const sharedOpsPattern = [
    contractCheck(
      "owner-planner",
      "Owner/planner wake",
      hasOwnerWake,
      "Shared pattern: owner/planner handles project state changes",
    ),
    contractCheck(
      "metric-first",
      "Metric breach first handled by owning app",
      hasMetricHandling,
      "Shared pattern: app-owned metrics wake app-owned ops",
    ),
    contractCheck(
      "scheduled-observer",
      "Scheduled observer",
      hasScheduledObserver,
      "Shared pattern: timers keep loops moving without human polling",
    ),
    contractCheck(
      "watchdog-or-stall",
      "Watchdog/deep-dive fallback",
      hasFallback,
      "Shared pattern: watchdog/stall review catches work left behind",
    ),
    contractCheck(
      "human-escalation",
      "Human escalation/reporting",
      hasHumanPath,
      "Shared pattern: unresolved issues become visible to human",
    ),
  ];
  const missing = checks
    .filter((check) => !check.pass)
    .map((check) => `${check.id}: ${check.detail}`);
  const criticalMissing = checks
    .filter(
      (check) =>
        !check.pass &&
        ["task-state", "owner-wake", "scheduled-observer", "frontier"].includes(
          check.id,
        ),
    )
    .map((check) => check.id);
  const status =
    criticalMissing.length === 0 && missing.length <= 1
      ? "strong"
      : criticalMissing.length <= 1
        ? "partial"
        : "weak";

  return {
    targetProject: target.targetProject,
    appTsPath,
    status,
    checks,
    sharedOpsPattern,
    aksOpsPattern: sharedOpsPattern,
    missing,
    criticalMissing,
    recommendation:
      status === "strong"
        ? "Target already has the core self-recovery pieces; evaluate whether they are effective."
        : "Target should adopt the missing pieces from the aks-rp-e2e ops pattern before evaluation treats it as self-recovering.",
  };
}

function safeDirEntries(path: string): string[] {
  if (!existsSync(path)) return [];
  try {
    return readdirSync(path).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function loopPacket(targetAppDir: string): Record<string, unknown> {
  const stateDir = join(targetAppDir, ".state");
  const loops = safeDirEntries(stateDir)
    .filter((entry) => entry.includes("loop"))
    .map((entry) => [entry, `.state/${entry}/state.json`] as const)
    .filter(([, relPath]) => existsSync(join(targetAppDir, relPath)));

  return Object.fromEntries(
    loops.map(([name, relPath]) => {
      const path = join(targetAppDir, relPath);
      const state = readJson(path);
      if (!state || typeof state !== "object" || Array.isArray(state)) {
        return [name, { path, state }];
      }
      const typed = state as Record<string, unknown>;
      const collection =
        (typed.specs && typeof typed.specs === "object" && typed.specs) ||
        (typed.features &&
          typeof typed.features === "object" &&
          typed.features);
      const records =
        collection && !Array.isArray(collection)
          ? Object.values(collection as Record<string, Record<string, unknown>>)
          : [];
      return [
        name,
        {
          path,
          loopTaskId: typed.loopTaskId,
          windowSize: typed.windowSize,
          cursor: typed.cursor,
          statusCounts: countBy(records, (record) =>
            typeof record.status === "string" ? record.status : undefined,
          ),
          total: records.length,
          sampleNonTerminal: records
            .filter(
              (record) => !["pass", "done"].includes(String(record.status)),
            )
            .slice(0, 20)
            .map((record) => ({
              key:
                record.specId ??
                record.featureKey ??
                record.capabilityId ??
                record.packetPath,
              status: record.status,
              attempts: record.attempts,
              errorClass: record.errorClass,
              failureClass: record.failureClass,
              taskId: record.taskId,
              updatedAt: record.updatedAt,
              lastRunId: record.lastRunId,
              lastWorkflowRunId: record.lastWorkflowRunId,
              retryReason: record.retryReason,
            })),
        },
      ];
    }),
  );
}

function recentRunPacket(targetAppDir: string): Record<string, unknown> {
  const stateDir = join(targetAppDir, ".state");
  const topLevel = safeDirEntries(stateDir)
    .filter((entry) => /(?:runs|packets|digests)\.jsonl$/.test(entry))
    .map(
      (entry) => [entry.replace(/\.jsonl$/, ""), `.state/${entry}`] as const,
    );
  const nested = safeDirEntries(stateDir)
    .filter((entry) => isDirectory(join(stateDir, entry)))
    .flatMap((dir) =>
      safeDirEntries(join(stateDir, dir))
        .filter((entry) => /(?:runs|packets|digests)\.jsonl$/.test(entry))
        .map(
          (entry) =>
            [
              `${dir}/${entry.replace(/\.jsonl$/, "")}`,
              `.state/${dir}/${entry}`,
            ] as const,
        ),
    );
  const files = [...topLevel, ...nested].slice(0, 8);

  if (files.length === 0) {
    return {
      discovered: [],
      note: "No app-local .state/*runs.jsonl, *packets.jsonl, or *digests.jsonl artifacts discovered.",
    };
  }

  return Object.fromEntries(
    files.map(([name, relPath]) => [
      name,
      tailLines(join(targetAppDir, relPath), 3),
    ]),
  );
}

export function taskEscalationPacket(
  targetAppDir: string,
): Record<string, unknown> {
  const path = join(targetAppDir, ".state/tasks/tree.json");
  const tree = readJson(path);
  if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
    return { path, error: "task tree is not an object" };
  }
  const taskMap = normalizedTaskMap(objectRecord(tree));
  const tasks = Object.values(taskMap).map(objectRecord);
  const leafTasks = tasks.filter((task) => asArray(task.children).length === 0);
  const blockedLeaves = leafTasks.filter((task) => task.state === "blocked");
  const taskSearchText = (task: Record<string, unknown>): string =>
    JSON.stringify({
      id: task.id,
      owner: task.owner,
      goal: task.goal,
      summary: task.summary,
      context: task.context,
      blocker: task.blocker,
    });
  const hasEscalationHint = (task: Record<string, unknown>): boolean => {
    if (task.escalation_id || task.escalation) return true;
    const text = taskSearchText(task);
    return /escalat|approval|human:operator|owner decision|owner-response|requestedAction/i.test(
      text,
    );
  };
  const exactWaitFromTask = (
    task: Record<string, unknown>,
  ): ExactWait | null => {
    const context = objectRecord(task.context);
    const contextBlocker = objectRecord(context.blocker);
    const blocker = objectRecord(task.blocker);
    const waitingFor = objectRecord(
      context.waiting_for ??
        context.waitingFor ??
        contextBlocker.waiting_for ??
        contextBlocker.waitingFor ??
        blocker.waiting_for ??
        blocker.waitingFor,
    );
    const records = [task, context, contextBlocker, blocker, waitingFor];
    const owner = stringFromRecords(records, [
      "owner",
      "required_owner",
      "requiredOwner",
      "assignee",
    ]);
    const requestedAction = stringFromRecords(records, [
      "requested_action",
      "requestedAction",
      "required_action",
      "requiredAction",
      "action",
      "decision",
    ]);
    const resumeCondition = stringFromRecords(records, [
      "resume_condition",
      "resumeCondition",
      "unblock_condition",
      "unblockCondition",
      "success_condition",
      "successCondition",
    ]);
    const fallback = stringFromRecords(records, [
      "fallback",
      "fallback_at",
      "fallbackAt",
      "fallback_action",
      "fallbackAction",
    ]);
    const nextCheck = stringFromRecords(records, [
      "next_check_at",
      "nextCheckAt",
      "next_check",
      "nextCheck",
      "check_at",
      "checkAt",
    ]);
    const linkage = stringFromRecords(records, [
      "escalation_ref",
      "escalationRef",
      "escalation_id",
      "escalationId",
      "approval_id",
      "approvalId",
      "wait_id",
      "waitId",
      "packet_path",
      "packetPath",
      "message_id",
      "messageId",
      "event_id",
      "eventId",
    ]);

    if (
      String(task.state) !== "blocked" ||
      !owner ||
      !requestedAction ||
      !resumeCondition ||
      !(fallback || nextCheck) ||
      !linkage
    ) {
      return null;
    }

    return {
      owner,
      requestedAction,
      resumeCondition,
      ...(fallback ? { fallback } : {}),
      ...(nextCheck ? { nextCheck } : {}),
      linkage,
    };
  };
  const hasOwnerOrExternalPath = (task: Record<string, unknown>): boolean => {
    if (hasEscalationHint(task)) return true;
    return /external|owner|operator|response|return|fallback|next_check|resume|auth|credential|runtime|capacity|permission|handoff|source-authority|prereq|prerequisite|input|surface|trusted-ref|publication/i.test(
      taskSearchText(task),
    );
  };
  const escalationTasks = leafTasks.filter(hasEscalationHint);
  const blockedWithEscalation = blockedLeaves.filter(hasEscalationHint);
  const blockedWithOwnerOrExternalPath = blockedLeaves.filter(
    hasOwnerOrExternalPath,
  );
  const blockedExactWaits = blockedLeaves
    .map((task) => ({ task, wait: exactWaitFromTask(task) }))
    .filter(
      (item): item is { task: Record<string, unknown>; wait: ExactWait } =>
        item.wait !== null,
    );
  const blockedWithoutOwnerOrExternalPath = blockedLeaves.filter(
    (task) => !hasOwnerOrExternalPath(task),
  );

  return {
    path,
    counts: {
      leafTasks: leafTasks.length,
      blockedLeaves: blockedLeaves.length,
      escalationHintLeaves: escalationTasks.length,
      blockedWithEscalationHint: blockedWithEscalation.length,
      blockedWithOwnerOrExternalPath: blockedWithOwnerOrExternalPath.length,
      blockedWithoutOwnerOrExternalPath:
        blockedWithoutOwnerOrExternalPath.length,
      blockedExactWaitLeaves: blockedExactWaits.length,
    },
    escalationTaskSample: escalationTasks.slice(0, 20).map(compactTask),
    blockedWithEscalationSample: blockedWithEscalation
      .slice(0, 20)
      .map(compactTask),
    blockedWithOwnerOrExternalPathSample: blockedWithOwnerOrExternalPath
      .slice(0, 20)
      .map(compactTask),
    blockedWithoutOwnerOrExternalPathSample: blockedWithoutOwnerOrExternalPath
      .slice(0, 10)
      .map(compactTask),
    blockedExactWaitSample: blockedExactWaits
      .slice(0, 10)
      .map(({ task, wait }) => ({
        ...compactTask(task as unknown as TaskRecord),
        exactWait: wait,
      })),
  };
}

function compactEscalationRow(
  row: Record<string, unknown>,
  state: string,
): Record<string, unknown> {
  const data = parseRowData(row);
  const timestamp =
    typeof row.timestamp === "number"
      ? row.timestamp
      : Number(row.timestamp ?? 0);
  const ageHours =
    timestamp > 0
      ? Math.round(((Date.now() - timestamp) / 3_600_000) * 10) / 10
      : null;
  return {
    id: row.id,
    key: escalationKey(row),
    state,
    ageHours,
    timestamp,
    owner: row.owner,
    source: row.source,
    status: row.status,
    sourceAgent: data.sourceAgent,
    targetProject:
      data.targetProject ??
      data.project ??
      data.projectId ??
      objectRecord(data.target).project,
    reason: truncate(
      String(data.reason ?? data.summary ?? data.message ?? data.error ?? ""),
      240,
    ),
    requestedAction: truncate(
      String(data.requestedAction ?? data.requested_action ?? ""),
      240,
    ),
    resumeCondition: truncate(
      String(data.resumeCondition ?? data.resume_condition ?? ""),
      240,
    ),
    packetPath: data.packetPath ?? data.packet_path,
    dedupeKey: data.dedupeKey ?? data.dedupKey,
  };
}

export function escalationPacket(
  ctx: WorkflowContext,
  target: TargetConfig,
): Record<string, unknown> {
  const now = Date.now();
  const lookbackMs = 14 * 24 * 60 * 60_000;
  const since = now - lookbackMs;
  const staleCutoff = now - 24 * 60 * 60_000;
  const safeQuery = (label: string, fn: () => unknown): unknown => {
    try {
      return fn();
    } catch (err) {
      return {
        unavailable: true,
        label,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  const eventRowsRaw = safeQuery(
    "escalation-events",
    () =>
      ctx.query.sql(
        `SELECT e.id, e.event_type, e.source, e.owner, e.timestamp,
                e.subject_status AS status,
                e.data, s.projectId AS source_project_id
         FROM events AS e
         LEFT JOIN sessions AS s
           ON s.sessionId = json_extract(e.data, '$.sourceSessionId')
        WHERE e.timestamp >= ?
          AND e.event_type IN (
            'escalation.created',
            'escalation.resolved',
            'escalation.dismissed',
            'escalation.resume_failed',
            'project.approval.requested',
            'project.approval.submitted',
            'message.created'
          )
        ORDER BY e.timestamp DESC, e.id DESC`,
        [since],
        { limit: 1000 },
      ).rows,
  );

  const allEventRows = asArray(eventRowsRaw).map(objectRecord);
  const eventRows = allEventRows.filter((row) => rowMatchesTarget(row, target));
  const created = allEventRows.filter(
    (row) =>
      row.event_type === "escalation.created" && rowMatchesTarget(row, target),
  );
  const allClosed = allEventRows.filter((row) =>
    ["escalation.resolved", "escalation.dismissed"].includes(
      String(row.event_type),
    ),
  );
  const createdKeys = new Set(created.map(escalationKey));
  const closed = allClosed.filter((row) => createdKeys.has(escalationKey(row)));
  const closedKeys = new Set(
    closed.map((row) => {
      const data = parseRowData(row);
      return (
        stringFromRecord(data, ["escalationId", "escalation_id", "id"]) ||
        escalationKey(row)
      );
    }),
  );
  const open = created.filter((row) => !closedKeys.has(escalationKey(row)));
  const staleOpen = open.filter(
    (row) => Number(row.timestamp ?? 0) < staleCutoff,
  );
  const approvalRequests = eventRows.filter(
    (row) => row.event_type === "project.approval.requested",
  );
  const approvalSubmissions = eventRows.filter(
    (row) => row.event_type === "project.approval.submitted",
  );
  const humanMessages = eventRows.filter((row) => {
    if (row.event_type !== "message.created") return false;
    return /human|operator|approval|escalat/i.test(JSON.stringify(row));
  });
  const resumeFailures = eventRows.filter(
    (row) => row.event_type === "escalation.resume_failed",
  );

  const approvalDispatchPath = join(
    target.targetAppDir,
    ".state/approval-dispatch-runs.jsonl",
  );
  const approvalDispatches = readJsonlTail(approvalDispatchPath, 40);
  const taskPacket = taskEscalationPacket(target.targetAppDir);
  const taskCounts = objectRecord(taskPacket.counts);

  const warnings: string[] = [];
  if (created.length > 0 && open.length === created.length) {
    warnings.push(
      "no matching escalation.resolved/dismissed events in lookback",
    );
  }
  if (staleOpen.length > 0) {
    warnings.push(`${staleOpen.length} open escalation(s) older than 24h`);
  }
  if (
    approvalDispatches.some(
      (row) =>
        row.result !== "message.created" &&
        row.result !== "duplicate-suppressed",
    )
  ) {
    warnings.push("some approval-dispatch attempts were ignored or failed");
  }
  if (
    Number(taskCounts.blockedLeaves ?? 0) > 0 &&
    Number(taskCounts.blockedWithOwnerOrExternalPath ?? 0) === 0 &&
    created.length === 0 &&
    approvalDispatches.length === 0
  ) {
    warnings.push(
      "blocked work exists but no owner/external/escalation path was found",
    );
  }

  return {
    lookbackHours: Math.round(lookbackMs / 3_600_000),
    source: "runtime events plus target task tree and approval-dispatch log",
    counts: {
      created: created.length,
      open: open.length,
      staleOpen: staleOpen.length,
      closed: closed.length,
      resumeFailures: resumeFailures.length,
      approvalRequests: approvalRequests.length,
      approvalSubmissions: approvalSubmissions.length,
      humanMessages: humanMessages.length,
      approvalDispatchByResult: countBy(approvalDispatches, (row) =>
        typeof row.result === "string" ? row.result : "unknown",
      ),
    },
    usage: taskCounts,
    openSample: open
      .slice(0, 20)
      .map((row) => compactEscalationRow(row, "open")),
    staleOpenSample: staleOpen
      .slice(0, 20)
      .map((row) => compactEscalationRow(row, "stale-open")),
    closedSample: closed
      .slice(0, 20)
      .map((row) => compactEscalationRow(row, "closed")),
    recentApprovalDispatches: approvalDispatches
      .slice(-20)
      .reverse()
      .map((row) => ({
        id: row.pathId ?? row.packetPath ?? row.ts,
        state: row.result,
        ts: row.ts,
        target: row.target,
        pathId: row.pathId,
        packetPath: row.packetPath,
        requestedAction: truncate(String(row.requestedAction ?? ""), 240),
        reason: row.reason,
      })),
    taskLinkage: taskPacket,
    warnings,
    rawQueryUnavailable:
      objectRecord(eventRowsRaw).unavailable === true
        ? eventRowsRaw
        : undefined,
  };
}

function runtimePacket(
  ctx: WorkflowContext,
  target: TargetConfig,
): Record<string, unknown> {
  const now = Date.now();
  const since = now - 6 * 60 * 60 * 1000;
  const projectIds = targetProjectIds(target);
  const safeQuery = (label: string, fn: () => unknown): unknown => {
    try {
      return fn();
    } catch (err) {
      return {
        unavailable: true,
        label,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  return {
    now,
    projectIds,
    metrics: safeQuery("metrics", () =>
      projectIds.flatMap((project) =>
        ctx.query.metrics({ project, limit: 40 }).rows.map((row) => ({
          id: row.id,
          project,
          name: row.name,
          status: row.status,
          current: row.current,
          target: row.target,
          threshold: row.threshold,
          alert_op: row.alert_op,
          priority: row.priority,
          updated_at: row.updated_at,
        })),
      ),
    ),
    events: safeQuery("events", () =>
      ctx.query
        .events({ since, limit: 80 })
        .rows.filter((row) => {
          const text = JSON.stringify(row);
          return projectIds.some((project) => text.includes(project));
        })
        .slice(0, 30)
        .map((row) => ({
          id: row.id,
          type: row.event_type ?? row.type,
          source: row.source,
          owner: row.owner,
          status: row.status,
          handled_by: row.handled_by,
          timestamp: row.timestamp,
        })),
    ),
    workflows: safeQuery("workflowRuns", () =>
      projectIds.flatMap((projectId) =>
        ctx.query
          .workflowRuns({ since, projectId, limit: 30 })
          .rows.map((row) => ({
            workflow: row.workflow,
            projectId,
            status: row.status,
            startedAt: row.startedAt ?? row.started_at,
            completedAt: row.completedAt ?? row.completed_at,
            result: truncate(
              String(row.result_summary ?? row.summary ?? ""),
              700,
            ),
          })),
      ),
    ),
  };
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedValue(item)]),
  );
}

function metricHealthBucket(metric: unknown): Record<string, unknown> {
  const row = objectRecord(metric);
  const current = Number(row.current);
  const threshold = Number(row.threshold);
  const op = String(row.alert_op ?? "");
  const breached =
    Number.isFinite(current) && Number.isFinite(threshold)
      ? op === "<"
        ? current < threshold
        : op === ">"
          ? current > threshold
          : false
      : false;
  return {
    id: row.id ?? row.name,
    status: row.status,
    breached,
  };
}

export function projectHealthInputFingerprint(
  packet: Record<string, unknown>,
): string {
  const taskTree = objectRecord(packet.taskTree);
  const taskCounts = objectRecord(taskTree.counts);
  const selfRecovery = objectRecord(packet.selfRecovery);
  const escalations = objectRecord(packet.escalations);
  const escalationCounts = objectRecord(escalations.counts);
  const runtime = objectRecord(packet.runtime);
  const projectState = objectRecord(packet.projectState);
  const currentFocus = objectRecord(projectState.currentFocus);
  const focusReview = objectRecord(currentFocus.focusReview);
  const readoutMetrics = objectRecord(projectState.metrics);
  const meaningfulReadoutKeys = [
    "activeLeafCount",
    "blockedLeafCount",
    "reviewLeafCount",
    "runnableLeafCount",
    "waitingLeafCount",
    "liveRunsStarted24h",
    "liveRunsSucceeded24h",
    "specFailedCount",
    "specUnverifiedCount",
    "unknownPathMetric",
  ];
  const workflowFailures = asArray(runtime.workflows)
    .map(objectRecord)
    .filter((row) =>
      ["blocked", "error", "interrupted"].includes(String(row.status)),
    )
    .map((row) => `${String(row.workflow)}:${String(row.status)}`)
    .sort();
  const summary = {
    tasks: {
      counts: taskCounts,
      activeIds: asArray(taskTree.active).map((task) => objectRecord(task).id),
      reviewIds: asArray(taskTree.review).map((task) => objectRecord(task).id),
      runnableIds: asArray(taskTree.runnable).map(
        (task) => objectRecord(task).id,
      ),
    },
    selfRecovery: {
      status: selfRecovery.status,
      missing: selfRecovery.missing,
      criticalMissing: selfRecovery.criticalMissing,
    },
    loops: Object.fromEntries(
      Object.entries(objectRecord(packet.loops)).map(([key, value]) => {
        const loop = objectRecord(value);
        return [key, { total: loop.total, statusCounts: loop.statusCounts }];
      }),
    ),
    escalations: {
      created: escalationCounts.created,
      open: escalationCounts.open,
      staleOpen: escalationCounts.staleOpen,
      closed: escalationCounts.closed,
      approvalRequests: escalationCounts.approvalRequests,
      approvalSubmissions: escalationCounts.approvalSubmissions,
      warnings: escalations.warnings,
    },
    focus: {
      id: currentFocus.id ?? currentFocus.focusPlanId,
      status: currentFocus.focusPlanStatus ?? currentFocus.status,
      review: focusReview.result,
    },
    readout: Object.fromEntries(
      meaningfulReadoutKeys
        .filter((key) => key in readoutMetrics)
        .map((key) => [key, readoutMetrics[key]]),
    ),
    runtime: {
      metrics: asArray(runtime.metrics)
        .map(metricHealthBucket)
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
      workflowFailures,
    },
  };
  return createHash("sha256")
    .update(JSON.stringify(sortedValue(summary)))
    .digest("hex")
    .slice(0, 20);
}

export function scheduledProjectReviewDecision(
  reason: string,
  previous: ProjectHealthState,
  fingerprint: string,
  now = Date.now(),
): { run: boolean; reason: string } {
  if (reason !== "scheduled") return { run: true, reason: "explicit-request" };
  if (!previous.lastReviewedAt) return { run: true, reason: "first-review" };
  if (previous.lastInputFingerprint !== fingerprint) {
    return { run: true, reason: "meaningful-delta" };
  }
  const reviewedAt = Date.parse(previous.lastReviewedAt);
  if (!Number.isFinite(reviewedAt) || now - reviewedAt >= 24 * 60 * 60_000) {
    return { run: true, reason: "daily-baseline" };
  }
  return { run: false, reason: "unchanged-since-last-review" };
}

function targetFactPacket(
  ctx: WorkflowContext,
  target: TargetConfig,
): Record<string, unknown> {
  const taskTree = taskTreePacket(target.targetAppDir);
  return {
    target,
    sampledAt: new Date().toISOString(),
    previousReview: previousReviewPacket(target),
    projectState: compactValue(
      readJson(join(target.targetAppDir, ".state/project-state.json")),
      0,
      { maxDepth: 5, maxArray: 12, maxKeys: 30, maxString: 600 },
    ),
    taskTree,
    selfRecovery: selfRecoveryContractPacket(target, taskTree),
    loops: loopPacket(target.targetAppDir),
    recentRuns: recentRunPacket(target.targetAppDir),
    escalations: escalationPacket(ctx, target),
    targetGit: gitPacket(target.targetDomainDir),
    runtime: runtimePacket(ctx, target),
  };
}

function gitPacket(dir: string | undefined): Record<string, unknown> {
  if (!dir) return { skipped: "no targetDomainDir" };
  if (!existsSync(dir)) return { missing: dir };
  try {
    return {
      dir,
      status: execFileSync("git", ["-C", dir, "status", "--short"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      })
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(0, 80),
      branch: execFileSync("git", ["-C", dir, "branch", "--show-current"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (err) {
    return {
      dir,
      unavailable: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function extractJsonBlock(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.trim());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

type ProjectHealthJudgmentSource = {
  raw: Record<string, unknown> | null;
  text: string;
  source: string;
};

function safeEvaluationDeliverableText(
  appDir: string,
  pathValue: unknown,
): string {
  if (typeof pathValue !== "string" || !pathValue.trim()) return "";
  const absolutePath = isAbsolute(pathValue)
    ? resolve(pathValue)
    : resolve(appDir, pathValue);
  const relativePath = relative(appDir, absolutePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath) ||
    !existsSync(absolutePath)
  ) {
    return "";
  }
  try {
    return readFileSync(absolutePath, "utf-8").trim();
  } catch {
    return "";
  }
}

export function projectHealthJudgmentFromResult(
  result: unknown,
  appDir = EVALUATION_APP_DIR,
): ProjectHealthJudgmentSource {
  const record = objectRecord(result);
  const finishResult = objectRecord(record.finishResult);
  const candidates: Array<{ source: string; text: string }> = [];
  for (const [source, value] of [
    ["lastAssistantText", record.lastAssistantText],
    ["message", record.message],
    ["finishResult.summary", finishResult.summary],
  ] as const) {
    if (typeof value === "string" && value.trim()) {
      candidates.push({ source, text: value.trim() });
    }
  }
  for (const deliverable of asArray(finishResult.deliverables)) {
    const item = objectRecord(deliverable);
    const text = safeEvaluationDeliverableText(appDir, item.path);
    if (text) {
      candidates.push({ source: `deliverable:${String(item.path)}`, text });
    }
  }

  for (const candidate of candidates) {
    const raw = extractJsonBlock(candidate.text);
    if (raw) return { raw, text: candidate.text, source: candidate.source };
  }
  return {
    raw: null,
    text: candidates[0]?.text ?? "",
    source: candidates[0]?.source ?? "none",
  };
}

function fallbackJudgment(
  packet: Record<string, unknown>,
  target: TargetConfig,
): Judgment {
  const taskTree = packet.taskTree as Record<string, unknown> | undefined;
  const counts = taskTree?.counts as Record<string, unknown> | undefined;
  const leafByState = counts?.leafByState as Record<string, number> | undefined;
  const blocked = leafByState?.blocked ?? 0;
  const active = leafByState?.active ?? 0;
  const review = leafByState?.review ?? 0;
  const runnable =
    (leafByState?.backlog ?? 0) +
    (leafByState?.ready ?? 0) +
    (leafByState?.todo ?? 0) +
    (leafByState?.pending ?? 0);
  const selfRecovery = objectRecord(packet.selfRecovery);
  const selfRecoveryStatus = String(selfRecovery.status ?? "unknown");
  const criticalMissing = asArray(selfRecovery.criticalMissing).map(String);
  const escalations = objectRecord(packet.escalations);
  const escalationCounts = objectRecord(escalations.counts);
  const staleOpenEscalations = numberFromRecord(escalationCounts, "staleOpen");
  const dispatchCounts = objectRecord(
    escalationCounts.approvalDispatchByResult,
  );
  const failedApprovalDispatches = Object.entries(dispatchCounts).reduce(
    (sum, [key, value]) =>
      key !== "message.created" && typeof value === "number"
        ? sum + value
        : sum,
    0,
  );
  const totalLeaves = typeof counts?.leaves === "number" ? counts.leaves : 0;
  const unfinished = totalLeaves - (leafByState?.done ?? 0);

  if (
    unfinished > 0 &&
    selfRecoveryStatus === "weak" &&
    criticalMissing.length > 0
  ) {
    return {
      verdict: "concern",
      mainConcern:
        "The target has unfinished work but its own self-recovery contract is weak.",
      requestedHumanAction: "watch",
      notify: true,
      dedupeKey: `${target.targetProject}:weak-self-recovery-contract`,
      message: `${target.targetProject} may miss its own failures: unfinished work remains and these self-recovery pieces are missing or weak: ${criticalMissing.join(", ")}.`,
    };
  }

  if (blocked > 0 && active + review + runnable === 0) {
    return {
      verdict: "concern",
      mainConcern:
        "The target has blocked leaves but no active, review, or runnable leaf work.",
      requestedHumanAction: "watch",
      notify: true,
      dedupeKey: `${target.targetProject}:no-active-frontier-with-blocked-leaves`,
      message: `${target.targetProject} may not be moving: blocked leaves remain while no active/runnable/review work is visible.`,
    };
  }

  if (staleOpenEscalations > 0 || failedApprovalDispatches > 0) {
    return {
      verdict: "concern",
      mainConcern:
        "The target has escalation/approval signals that may not be closing cleanly.",
      requestedHumanAction: "watch",
      notify: true,
      dedupeKey: `${target.targetProject}:escalation-use-needs-review`,
      message: `${target.targetProject} has stale open escalation(s) or failed approval-dispatch records; check whether escalation is exact, watched, and useful.`,
    };
  }

  return {
    verdict: blocked > 0 ? "watch" : "ok",
    mainConcern:
      blocked > 0
        ? "Blocked work exists, but there is visible work or the evaluator did not classify it as urgent."
        : "No major process concern detected from the sampled facts.",
    requestedHumanAction: "none",
    notify: false,
    dedupeKey: `${target.targetProject}:scheduled-watch`,
    message: "No human action requested.",
  };
}

export function normalizeJudgment(
  raw: Record<string, unknown> | null,
  fallback: Judgment,
): Judgment {
  const verdict = String(raw?.verdict ?? fallback.verdict);
  const normalizedVerdict = VERDICTS.has(verdict) ? verdict : fallback.verdict;
  const notifyRaw = raw?.notify;
  const notify =
    typeof notifyRaw === "boolean"
      ? notifyRaw
      : NOTIFY_VERDICTS.has(normalizedVerdict);
  return {
    verdict: normalizedVerdict,
    mainConcern: String(
      raw?.mainConcern ?? raw?.main_concern ?? fallback.mainConcern,
    ),
    affectedArtifacts: (() => {
      const explicit = stringList(
        raw?.affectedArtifacts ?? raw?.affected_artifacts,
      );
      return explicit.length > 0
        ? explicit
        : stringList(fallback.affectedArtifacts);
    })(),
    recommendedChange: String(
      raw?.recommendedChange ??
        raw?.recommended_change ??
        fallback.recommendedChange ??
        fallback.message,
    ),
    verification: (() => {
      const explicit = stringList(raw?.verification);
      const inherited = stringList(fallback.verification);
      return explicit.length > 0
        ? explicit
        : inherited.length > 0
          ? inherited
          : [
              "The named artifact or output changes and a later review no longer observes this concern.",
            ];
    })(),
    requestedHumanAction: String(
      raw?.requestedHumanAction ??
        raw?.requested_human_action ??
        fallback.requestedHumanAction,
    ),
    notify,
    dedupeKey: String(raw?.dedupeKey ?? raw?.dedupe_key ?? fallback.dedupeKey),
    message: String(raw?.message ?? fallback.message),
  };
}

export function reconcileJudgmentWithFacts(
  target: Pick<TargetConfig, "targetProject">,
  packet: Record<string, unknown>,
  judgment: Judgment,
): Judgment {
  const requestedAction = judgment.requestedHumanAction.toLowerCase();
  if (requestedAction !== "assign-owner") return judgment;

  const escalations = objectRecord(packet.escalations);
  const counts = objectRecord(escalations.counts);
  const usage = objectRecord(escalations.usage);
  const openEscalations = numberFromRecord(counts, "open");
  const closedEscalations = numberFromRecord(counts, "closed");
  const blockedExactWaits = numberFromRecord(usage, "blockedExactWaitLeaves");
  const blockedWithoutOwnerPath = numberFromRecord(
    usage,
    "blockedWithoutOwnerOrExternalPath",
  );

  if (
    blockedExactWaits === 0 ||
    blockedWithoutOwnerPath > 0 ||
    openEscalations > blockedExactWaits
  ) {
    return judgment;
  }

  const hasMissingFormalClose = openEscalations > 0 && closedEscalations === 0;
  const mainConcern = hasMissingFormalClose
    ? "The target already records an exact owner/wait path, but the escalation lifecycle is missing a formal resolved or dismissed event."
    : "The target already records an exact owner/wait path, so the owner-assignment ask is no longer the right human action.";

  return {
    ...judgment,
    verdict:
      severity(judgment.verdict) > severity("watch")
        ? judgment.verdict
        : "watch",
    mainConcern,
    requestedHumanAction: "watch",
    notify: false,
    dedupeKey: `${target.targetProject}:formal-escalation-closure-missing`,
    message: `${target.targetProject} already has ${blockedExactWaits} blocked exact wait(s) with owner, requested action, resume condition, fallback, and escalation linkage. Do not ask the human to assign an owner again; send owner feedback to emit or repair the formal escalation closure/follow-up event if needed.`,
  };
}

function timestampId(): string {
  return new Date().toISOString().replace(/[-:.]/g, "");
}

function statePath(target: TargetConfig): string {
  return join(
    EVALUATION_APP_DIR,
    ".state/project-health/targets",
    `${target.targetProject}.json`,
  );
}

function readState(target: TargetConfig): ProjectHealthState {
  const path = statePath(target);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ProjectHealthState)
      : {};
  } catch {
    return {};
  }
}

function previousReviewPacket(target: TargetConfig): Record<string, unknown> {
  const state = readState(target);
  const reportPath = state.lastReportPath;
  const packet: Record<string, unknown> = {
    reportPath: reportPath ?? null,
    verdict: state.lastVerdict ?? null,
    dedupeKey: state.lastDedupeKey ?? null,
    requestedHumanAction: state.lastRequestedHumanAction ?? null,
    notified: state.lastNotify ?? null,
  };
  if (!reportPath) return packet;

  const absolutePath = join(EVALUATION_APP_DIR, reportPath);
  if (!existsSync(absolutePath)) {
    return { ...packet, missing: absolutePath };
  }

  const text = readText(absolutePath);
  const concern = text.match(/^Main concern:\s*(.+)$/m)?.[1];
  const message = text.match(
    /^## Human Message\s*\n+([\s\S]*?)(?:\n## |\n# |$)/m,
  )?.[1];
  return {
    ...packet,
    mainConcern: concern ?? null,
    messageExcerpt: message ? truncate(message.trim(), 800) : null,
  };
}

function severity(verdict: string | undefined): number {
  switch (verdict) {
    case "urgent":
      return 4;
    case "blocked-on-human":
      return 3;
    case "concern":
      return 2;
    case "watch":
      return 1;
    default:
      return 0;
  }
}

function numberFromRecord(record: unknown, key: string): number {
  if (!record || typeof record !== "object" || Array.isArray(record)) return 0;
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

function stableDedupeKey(
  target: TargetConfig,
  packet: Record<string, unknown>,
  judgment: Judgment,
): string {
  const projectState =
    packet.projectState &&
    typeof packet.projectState === "object" &&
    !Array.isArray(packet.projectState)
      ? (packet.projectState as Record<string, unknown>)
      : {};
  const currentFocus =
    projectState.currentFocus &&
    typeof projectState.currentFocus === "object" &&
    !Array.isArray(projectState.currentFocus)
      ? (projectState.currentFocus as Record<string, unknown>)
      : {};
  const focusReview =
    currentFocus.focusReview &&
    typeof currentFocus.focusReview === "object" &&
    !Array.isArray(currentFocus.focusReview)
      ? (currentFocus.focusReview as Record<string, unknown>)
      : {};
  const taskTree =
    packet.taskTree &&
    typeof packet.taskTree === "object" &&
    !Array.isArray(packet.taskTree)
      ? (packet.taskTree as Record<string, unknown>)
      : {};
  const counts =
    taskTree.counts &&
    typeof taskTree.counts === "object" &&
    !Array.isArray(taskTree.counts)
      ? (taskTree.counts as Record<string, unknown>)
      : {};
  const leafByState =
    counts.leafByState &&
    typeof counts.leafByState === "object" &&
    !Array.isArray(counts.leafByState)
      ? (counts.leafByState as Record<string, unknown>)
      : {};
  const active = numberFromRecord(leafByState, "active");
  const runnable =
    numberFromRecord(leafByState, "backlog") +
    numberFromRecord(leafByState, "ready") +
    numberFromRecord(leafByState, "todo") +
    numberFromRecord(leafByState, "pending");
  const blocked = numberFromRecord(leafByState, "blocked");
  const requestedAction = judgment.requestedHumanAction.toLowerCase();
  const focusPlanStatus = String(currentFocus.focusPlanStatus ?? "");
  const focusReviewResult = String(focusReview.result ?? "");

  if (
    requestedAction === "approve" &&
    (focusPlanStatus === "blocked" || focusReviewResult === "needs_approval")
  ) {
    return `${target.targetProject}:focus-approval-needed`;
  }
  if (blocked > 0 && active === 0 && runnable === 0) {
    return `${target.targetProject}:no-executable-frontier-with-blocked-work`;
  }
  return judgment.dedupeKey;
}

function dedupeFamily(key: string | undefined): string {
  if (!key) return "";
  const project = key.split(":")[0] || "";
  if (key.includes("focus-approval")) return "focus-approval";
  if (
    key.includes("no-active-frontier") ||
    key.includes("no-executable-frontier")
  ) {
    return "no-executable-frontier";
  }
  if (
    key.includes("reviewer-runtime-owner-linkage") ||
    key.includes("formal-escalation-owner-linkage") ||
    key.includes("reviewer-provider-unavailable") ||
    key.includes("escalation-linkage:reviewer-runtime")
  ) {
    return `${project}:reviewer-runtime-owner-linkage`;
  }
  if (
    /review[-_]?failed|reviewfailed|workflow[-_]?blocked|zero[-_]?op/i.test(key)
  ) {
    return `${project}:review-failed-family`;
  }
  if (key.includes("compact-loop") && key.includes("liveness")) {
    return "compact-loop-liveness";
  }
  return key;
}

function shouldNotify(
  judgment: Judgment,
  previous: ProjectHealthState,
): boolean {
  const actionableHumanRequest = [
    "approve",
    "decide",
    "assign-owner",
    "provide-input",
  ].includes(judgment.requestedHumanAction.toLowerCase());
  if (!NOTIFY_VERDICTS.has(judgment.verdict) && !actionableHumanRequest) {
    return false;
  }
  if (!judgment.notify) return false;
  if (
    dedupeFamily(previous.lastDedupeKey) !== dedupeFamily(judgment.dedupeKey)
  ) {
    return true;
  }
  return severity(judgment.verdict) > severity(previous.lastVerdict);
}

function notificationReason(
  judgment: Judgment,
  previous: ProjectHealthState,
  finalNotify: boolean,
): string {
  if (!judgment.notify) {
    return "Evaluator did not request human notification for this sample.";
  }
  const actionableHumanRequest = [
    "approve",
    "decide",
    "assign-owner",
    "provide-input",
  ].includes(judgment.requestedHumanAction.toLowerCase());
  if (!NOTIFY_VERDICTS.has(judgment.verdict) && !actionableHumanRequest) {
    return `Notification suppressed because verdict ${judgment.verdict} with action ${judgment.requestedHumanAction} is report-only. The next scheduled report is the watch mechanism.`;
  }
  const previousFamily = dedupeFamily(previous.lastDedupeKey);
  const currentFamily = dedupeFamily(judgment.dedupeKey);
  if (finalNotify && previousFamily !== currentFamily) {
    return `Notify because this is a new concern family: ${currentFamily || judgment.dedupeKey}.`;
  }
  if (finalNotify) {
    return `Notify because severity increased from ${previous.lastVerdict ?? "none"} to ${judgment.verdict}.`;
  }
  return `Notification suppressed because the same concern family was already reported and severity did not increase. Previous verdict: ${previous.lastVerdict ?? "none"}.`;
}

function humanActionDetail(
  target: TargetConfig,
  packet: Record<string, unknown>,
  judgment: Judgment,
): string {
  const action = judgment.requestedHumanAction.toLowerCase();
  const projectState = objectRecord(packet.projectState);
  const currentFocus = objectRecord(projectState.currentFocus);
  const focusReview = objectRecord(currentFocus.focusReview);
  const priorFocusPlanId =
    typeof currentFocus.priorFocusPlanId === "string"
      ? currentFocus.priorFocusPlanId
      : "the prior focus";
  const focusNote =
    typeof focusReview.note === "string" && focusReview.note.length > 0
      ? ` Current review note: ${focusReview.note}`
      : "";
  if (action === "none") {
    return "No human action requested. Continue scheduled evaluation.";
  }
  if (action === "watch") {
    return "Watch the next scheduled report. Human action is only needed if the same concern persists or worsens.";
  }
  if (action === "approve") {
    return `Approve or reject the replacement focus for ${target.targetProject}. The prior focus is ${priorFocusPlanId}. If approving, tell the target app to proceed with the proposed focus; if rejecting, provide the replacement focus explicitly.${focusNote}`;
  }
  if (action === "decide") {
    return `Make the named project decision for ${target.targetProject}; the target app should not keep retrying around this without a decision. Use the report facts to choose proceed, reject, assign owner, or wait.${focusNote}`;
  }
  if (action === "assign-owner") {
    return `Assign a concrete owner for the unresolved project concern in ${target.targetProject}, then expect the target app to create or update an exact task/wait.`;
  }
  if (action === "provide-input") {
    return `Provide the missing input named by the report, then expect ${target.targetProject} to resume or replace the blocked work.`;
  }
  return `Review the report and take the requested action for ${target.targetProject}: ${judgment.requestedHumanAction}.`;
}

function writeReport(
  target: TargetConfig,
  packet: Record<string, unknown>,
  judgment: Judgment,
  evaluatorText: string,
): { absolutePath: string; relativePath: string } {
  const reportDir = join(
    EVALUATION_APP_DIR,
    "reports/project-health",
    target.targetProject,
  );
  mkdirSync(reportDir, { recursive: true });
  const id = timestampId();
  const absoluteFactsPath = join(reportDir, `${id}.facts.json`);
  const factsRelativePath = relative(EVALUATION_APP_DIR, absoluteFactsPath);
  writeFileSync(
    absoluteFactsPath,
    `${JSON.stringify(packet, null, 2)}\n`,
    "utf-8",
  );
  const absolutePath = join(reportDir, `${id}.md`);
  const relativePath = relative(EVALUATION_APP_DIR, absolutePath);
  const content = `# Project Health Review

Project: ${target.targetProject}
Verdict: ${judgment.verdict}
Main concern: ${judgment.mainConcern}
Requested human action: ${judgment.requestedHumanAction}
Evaluator requested notification: ${judgment.evaluatorWantedNotify ? "yes" : "no"}
Final notification sent: ${judgment.notify ? "yes" : "no"}
Dedupe key: ${judgment.dedupeKey}
Notification reason: ${judgment.notificationReason ?? "not recorded"}

## What The Owner Should Do

${judgment.humanActionDetail ?? "No action detail recorded."}

Affected artifacts:
${(judgment.affectedArtifacts ?? []).map((item) => `- ${item}`).join("\n") || "- Not identified"}

Recommended change:
${judgment.recommendedChange ?? "Not identified"}

Verification:
${(judgment.verification ?? []).map((item) => `- ${item}`).join("\n") || "- Not identified"}

## Owner Message

${judgment.message}

## Facts

${humanFactSummary(packet, factsRelativePath)}

## Evaluator Judgment

${truncate(evaluatorText.trim(), 8_000)}
`;
  writeFileSync(absolutePath, content, "utf-8");
  pruneProjectHealthReports(reportDir);
  return { absolutePath, relativePath };
}

export function pruneProjectHealthReports(
  reportDir: string,
  keepReviews = 30,
): void {
  const reports = safeDirEntries(reportDir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .reverse();
  for (const report of reports.slice(keepReviews)) {
    const id = report.slice(0, -3);
    for (const entry of [report, `${id}.facts.json`]) {
      const path = join(reportDir, entry);
      if (!existsSync(path)) continue;
      try {
        unlinkSync(path);
      } catch {
        // Retention is best-effort; a report write must not fail on cleanup.
      }
    }
  }
}

function writeState(
  target: TargetConfig,
  judgment: Judgment,
  reportPath: string,
  inputFingerprint: string,
  feedbackEmitted: boolean,
): void {
  const stateDir = join(EVALUATION_APP_DIR, ".state/project-health/targets");
  const previous = readState(target);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, `${target.targetProject}.json`),
    `${JSON.stringify(
      {
        ...previous,
        targetProject: target.targetProject,
        targetAppDir: target.targetAppDir,
        targetDomainDir: target.targetDomainDir ?? null,
        lastReviewedAt: new Date().toISOString(),
        lastReportPath: reportPath,
        lastVerdict: judgment.verdict,
        lastDedupeKey: judgment.dedupeKey,
        lastRequestedHumanAction: judgment.requestedHumanAction,
        lastNotify: judgment.notify,
        lastInputFingerprint: inputFingerprint,
        lastCheckedAt: new Date().toISOString(),
        ...(feedbackEmitted
          ? {
              lastFeedbackAt: new Date().toISOString(),
              lastFeedbackDedupeKey: judgment.dedupeKey,
              lastFeedbackVerdict: judgment.verdict,
            }
          : {}),
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}

function writeCheckState(
  target: TargetConfig,
  previous: ProjectHealthState,
  inputFingerprint: string,
): void {
  const stateDir = join(EVALUATION_APP_DIR, ".state/project-health/targets");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, `${target.targetProject}.json`),
    `${JSON.stringify(
      {
        ...previous,
        targetProject: target.targetProject,
        targetAppDir: target.targetAppDir,
        targetDomainDir: target.targetDomainDir ?? null,
        lastCheckedAt: new Date().toISOString(),
        lastInputFingerprint: inputFingerprint,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}

function targetOwnerProjectId(target: TargetConfig): string {
  return target.targetProject;
}

export function shouldFeedbackTargetOwner(
  judgment: Judgment,
  previous: ProjectHealthState,
  options: {
    force?: boolean;
    now?: number;
    retryAfterMs?: number;
  } = {},
): boolean {
  if (judgment.verdict === "ok") return false;
  if (options.force) return true;
  if (!previous.lastFeedbackDedupeKey) return true;
  if (
    dedupeFamily(previous.lastFeedbackDedupeKey) !==
    dedupeFamily(judgment.dedupeKey)
  ) {
    return true;
  }
  if (severity(judgment.verdict) > severity(previous.lastFeedbackVerdict)) {
    return true;
  }
  const lastFeedbackAt = Date.parse(previous.lastFeedbackAt ?? "");
  const now = options.now ?? Date.now();
  const retryAfterMs = options.retryAfterMs ?? OWNER_FEEDBACK_RETRY_MS;
  if (Number.isFinite(lastFeedbackAt) && now - lastFeedbackAt >= retryAfterMs) {
    return true;
  }
  const actionable = [
    "approve",
    "decide",
    "assign-owner",
    "provide-input",
  ].includes(judgment.requestedHumanAction.toLowerCase());
  return (
    actionable &&
    judgment.requestedHumanAction !== previous.lastRequestedHumanAction
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = parseTrigger(String(ctx.task ?? ""));
  const target = targetConfig(trigger);
  const packet = targetFactPacket(ctx, target);
  const fallback = fallbackJudgment(packet, target);
  const previous = readState(target);
  const inputFingerprint = projectHealthInputFingerprint(packet);
  const reviewDecision = scheduledProjectReviewDecision(
    target.reason,
    previous,
    inputFingerprint,
  );
  if (!reviewDecision.run) {
    writeCheckState(target, previous, inputFingerprint);
    return ctx.done(
      `${target.targetProject} project/app review skipped: ${reviewDecision.reason}.`,
    );
  }

  const prompt = `You are independently auditing whether a project app is moving correctly.

Target: ${target.targetProject}
Reason: ${target.reason}

Judge the target app from raw facts. Keep raw facts visible; do not hide uncertainty.
Do not mutate the target app, implement a fix for it, write report files, or send messages. Do not become a second planner. Return the judgment to this workflow; workflow code persists the report, deduplicates owner feedback, and decides human notification. A later review may observe whether the condition persists, but remediation remains with the target owner.
Treat metrics, breach events, task-tree snapshots, and project readouts as timestamped observations. Before calling a breach current, compare their timestamps and prefer the newest direct state reading. A later zero metric reading means an older breach event is recovered history, not a current defect. When current sources still disagree, report the disagreement and verification needed instead of choosing the more alarming value.
Check whether the target app first tried to catch and handle its own metric breaches, failures, and stalled tasks.
Specifically judge whether the target app uses escalation correctly and efficiently: escalate only when local recovery is exhausted or human/infra action is required; include exact owner, requested action, resume condition, fallback/watch; avoid vague or duplicate escalations; close or replace escalations when resolved; and keep task state linked to the escalation.
Use the self-recovery contract facts to say whether the shared ops pattern is already present, partially present, or missing.
When one app shows a better recovery behavior, call out whether that lesson should be reused by other project apps.

Return concise reasoning followed by exactly one fenced json block with:
{
  "verdict": "ok|watch|concern|urgent|blocked-on-human",
  "mainConcern": "one sentence",
  "affectedArtifacts": ["task, workflow, file, result, or state surface responsible for the outcome"],
  "recommendedChange": "concrete correction for the target owner to judge and apply",
  "verification": ["observable output conditions proving the correction worked"],
  "requestedHumanAction": "none|watch|decide|approve|provide-input|assign-owner",
  "notify": true,
  "dedupeKey": "target:concern-family:fingerprint",
  "message": "short message for a human"
}

Raw facts:
\`\`\`json
${JSON.stringify(packet, null, 2)}
\`\`\``;

  ctx.emit({
    type: "evaluation.project.review_started",
    source: "agent:evaluator",
    owner: "agent:evaluator",
    data: {
      targetProject: target.targetProject,
      reason: target.reason,
    },
  });

  const result = await ctx.runAgent("evaluator", prompt, {
    timeoutMs: 900_000,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Project/app health evaluator session failed", {
      targetProject: target.targetProject,
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }

  const judgmentSource = projectHealthJudgmentFromResult(result);

  const judgment = reconcileJudgmentWithFacts(
    target,
    packet,
    normalizeJudgment(judgmentSource.raw, fallback),
  );
  judgment.dedupeKey = stableDedupeKey(target, packet, judgment);
  const evaluatorWantedNotify = judgment.notify;
  const finalNotify = shouldNotify(judgment, previous);
  judgment.evaluatorWantedNotify = evaluatorWantedNotify;
  judgment.notify = finalNotify;
  judgment.notificationReason = notificationReason(
    { ...judgment, notify: evaluatorWantedNotify },
    previous,
    finalNotify,
  );
  judgment.humanActionDetail = humanActionDetail(target, packet, judgment);
  const feedbackTargetOwner = shouldFeedbackTargetOwner(judgment, previous, {
    force: reviewDecision.reason === "explicit-request",
  });
  const report = writeReport(target, packet, judgment, judgmentSource.text);
  writeState(
    target,
    judgment,
    report.relativePath,
    inputFingerprint,
    feedbackTargetOwner,
  );

  const reviewedData = {
    targetProject: target.targetProject,
    verdict: judgment.verdict,
    reportPath: report.relativePath,
    summary: judgment.mainConcern,
    affectedArtifacts: judgment.affectedArtifacts ?? [],
    recommendedChange: judgment.recommendedChange ?? "",
    verification: judgment.verification ?? [],
    requestedHumanAction: judgment.requestedHumanAction,
    notify: judgment.notify,
    dedupeKey: judgment.dedupeKey,
    sessionId: result.sessionId,
    reviewReason: reviewDecision.reason,
    feedbackEmitted: feedbackTargetOwner,
  };

  ctx.emit({
    type: "evaluation.project.reviewed",
    source: "agent:evaluator",
    owner: "agent:evaluator",
    data: reviewedData,
  });

  if (feedbackTargetOwner) {
    const ownerProject = targetOwnerProjectId(target);
    ctx.emit({
      type: "project.owner.requested",
      source: "evaluation.app",
      target: { project: ownerProject },
      data: {
        project: ownerProject,
        reason: "evaluation-project-health-feedback",
        params: {
          fromProject: "evaluation.app",
          targetProject: target.targetProject,
          reportPath: report.relativePath,
          verdict: judgment.verdict,
          mainConcern: judgment.mainConcern,
          affectedArtifacts: judgment.affectedArtifacts ?? [],
          recommendedChange: judgment.recommendedChange ?? "",
          verification: judgment.verification ?? [],
          requestedHumanAction: judgment.requestedHumanAction,
          message: judgment.message,
          dedupeKey: judgment.dedupeKey,
          instruction:
            "Review this independent evaluation.app finding. You own the decision and any remediation: if valid, create or link concrete work against the named artifact and verify the resulting output; if already handled or rejected, record the evidence. Delivery alone does not resolve the finding.",
        },
      },
    } as any);
  }

  if (judgment.notify) {
    const notificationContent = [
      `${target.targetProject} needs a decision`,
      "",
      "What happened",
      judgment.mainConcern,
      "",
      "Decision needed",
      judgment.humanActionDetail ?? judgment.message,
      "",
      "You can reply with",
      "- accept the recommendation",
      "- assign an owner",
      "- provide the missing decision or input",
      "- say it is already handled and why",
      "- hold and explain what we are waiting for",
      "",
      "What happens next",
      `May will attach your reply to the tracked ${target.targetProject} review and route the result back to the target owner.`,
    ].join("\n");
    ctx.emit({
      type: "message.created",
      source: "agent:evaluator",
      owner: "human:operator",
      target: { human: true, project: targetOwnerProjectId(target) },
      data: {
        from: "evaluator",
        to: "human",
        content: notificationContent,
        priority:
          judgment.verdict === "urgent" ||
          judgment.verdict === "blocked-on-human"
            ? "P1"
            : "P2",
        intent: "project-health-review",
        subject: `Project health review: ${target.targetProject}`,
        kind: "project-health",
        severity:
          judgment.verdict === "urgent"
            ? "P0"
            : judgment.verdict === "blocked-on-human"
              ? "P1"
              : "P2",
        project: targetOwnerProjectId(target),
        projectId: target.targetProject,
        projectPath: target.targetAppDir,
        targetProject: target.targetProject,
        reportPath: report.relativePath,
        verdict: judgment.verdict,
        requestedHumanAction: judgment.requestedHumanAction,
        reason: judgment.mainConcern,
        requestedAction:
          judgment.humanActionDetail ?? judgment.requestedHumanAction,
        message: judgment.message,
        dedupKey: judgment.dedupeKey,
        conversationId: `project-health:${target.targetProject}:${judgment.dedupeKey}`,
        originalIssue: {
          eventType: "evaluation.project.reviewed",
          targetProject: target.targetProject,
          reportPath: report.relativePath,
          verdict: judgment.verdict,
          requestedHumanAction: judgment.requestedHumanAction,
          summary: judgment.mainConcern,
          dedupeKey: judgment.dedupeKey,
        },
        expectedClosure: [
          "project.owner.requested",
          "evaluation.project.reviewed",
        ],
        actionHints: [
          "accepted",
          "already handled <evidence>",
          "assign <owner>",
          "decide <decision>",
          "hold <why waiting>",
        ],
      },
    });
    ctx.emit({
      type: "evaluation.project.notification.requested",
      source: "agent:evaluator",
      owner: "agent:evaluator",
      data: {
        ...reviewedData,
        message: judgment.message,
      },
    });
  }

  return ctx.done(
    `${target.targetProject} project/app review: ${judgment.verdict}. Report: ${report.relativePath}.`,
  );
}
