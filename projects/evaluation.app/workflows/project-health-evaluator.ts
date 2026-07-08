import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "project-health-evaluator";
export const description =
  "Human-facing project/app health review for a watched target app.";

const EVALUATION_APP_DIR = "/app/projects/evaluation.app";
const DEFAULT_TARGET = {
  targetProject: "aks-rp-e2e.app",
  targetAppDir: "/app/projects/aks-rp-e2e.app",
  targetDomainDir: "/app/projects/aks-rp-e2e",
};
const NOTIFY_VERDICTS = new Set(["concern", "urgent", "blocked-on-human"]);
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
  requestedHumanAction: string;
  notify: boolean;
  dedupeKey: string;
  message: string;
};

type ProjectHealthState = {
  lastVerdict?: string;
  lastDedupeKey?: string;
  lastNotify?: boolean;
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function humanFactSummary(
  packet: Record<string, unknown>,
  factsRelativePath: string,
): string {
  const taskTree = objectRecord(packet.taskTree);
  const counts = objectRecord(taskTree.counts);
  const loops = objectRecord(packet.loops);
  const runtime = objectRecord(packet.runtime);
  const targetGit = objectRecord(packet.targetGit);

  return [
    `Full facts: ${factsRelativePath}`,
    "",
    "Task tree:",
    `- total=${String(counts.total ?? "unknown")}; leaves=${String(counts.leaves ?? "unknown")}`,
    `- leaf states: ${formatCountMap(counts.leafByState)}`,
    `- active: ${compactList(taskTree.active, 5)}`,
    `- review: ${compactList(taskTree.review, 5)}`,
    `- runnable: ${compactList(taskTree.runnable, 5)}`,
    `- blocked sample: ${compactList(taskTree.blockedSample, 5)}`,
    "",
    "Loops:",
    loopSummary(loops),
    "",
    "Runtime:",
    `- metrics: ${compactList(runtime.metrics, 8)}`,
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
    return { ...event, ...(data as Record<string, unknown>) };
  }
  return event;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function targetConfig(trigger: Record<string, unknown> | null): TargetConfig {
  const details = eventDetails(trigger);
  return {
    targetProject:
      stringValue(details.targetProject) ??
      stringValue(details.target) ??
      DEFAULT_TARGET.targetProject,
    targetAppDir:
      stringValue(details.targetAppDir) ?? DEFAULT_TARGET.targetAppDir,
    targetDomainDir:
      stringValue(details.targetDomainDir) ?? DEFAULT_TARGET.targetDomainDir,
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
        return JSON.parse(line);
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

function compactTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    state: task.state ?? "unknown",
    priority: task.priority ?? "P2",
    owner: task.owner,
    parent: task.parent_id ?? null,
    children: task.children?.length ?? 0,
    goal: task.goal,
    summary: task.summary,
    context: task.context,
    updated_at: task.updated_at,
  };
}

function taskTreePacket(targetAppDir: string): Record<string, unknown> {
  const path = join(targetAppDir, ".state/tasks/tree.json");
  const tree = readJson(path);
  if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
    return { path, error: "task tree is not an object" };
  }
  if ("missing" in tree || "unreadable" in tree) return { path, tree };

  const typed = tree as Record<string, unknown>;
  const taskMap =
    typed.tasks &&
    typeof typed.tasks === "object" &&
    !Array.isArray(typed.tasks)
      ? (typed.tasks as Record<string, TaskRecord>)
      : {};
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
    .slice(0, 30)
    .map(compactTask);
  const runnable = leaves
    .filter((task) =>
      ["backlog", "ready", "todo", "pending"].includes(task.state ?? ""),
    )
    .slice(0, 30)
    .map(compactTask);

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
    blockedSample: blocked,
  };
}

function loopPacket(targetAppDir: string): Record<string, unknown> {
  const loops = [
    ["spec-loop", ".state/spec-loop/state.json"],
    ["feature-reference-loop", ".state/feature-reference-loop/state.json"],
    ["feature-compact-loop", ".state/feature-compact-loop/state.json"],
  ] as const;

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

function runtimePacket(
  ctx: WorkflowContext,
  target: TargetConfig,
): Record<string, unknown> {
  const now = Date.now();
  const since = now - 6 * 60 * 60 * 1000;
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
    metrics: safeQuery("metrics", () =>
      ctx.query
        .metrics({ project: target.targetProject, limit: 40 })
        .rows.map((row) => ({
          id: row.id,
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
    events: safeQuery("events", () =>
      ctx.query
        .events({ since, limit: 80 })
        .rows.filter((row) => {
          const text = JSON.stringify(row);
          return text.includes(target.targetProject);
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
      ctx.query
        .workflowRuns({ since, projectId: target.targetProject, limit: 30 })
        .rows.map((row) => ({
          workflow: row.workflow,
          status: row.status,
          startedAt: row.startedAt ?? row.started_at,
          completedAt: row.completedAt ?? row.completed_at,
          result: row.result_summary ?? row.summary,
        })),
    ),
  };
}

function targetFactPacket(
  ctx: WorkflowContext,
  target: TargetConfig,
): Record<string, unknown> {
  return {
    target,
    sampledAt: new Date().toISOString(),
    projectState: readJson(
      join(target.targetAppDir, ".state/project-state.json"),
    ),
    taskTree: taskTreePacket(target.targetAppDir),
    loops: loopPacket(target.targetAppDir),
    recentRuns: {
      planner: tailLines(
        join(target.targetAppDir, ".state/planner-runs.jsonl"),
        8,
      ),
      taskReviewer: tailLines(
        join(target.targetAppDir, ".state/task-reviewer-runs.jsonl"),
        8,
      ),
      stallReview: tailLines(
        join(target.targetAppDir, ".state/stall-review-runs.jsonl"),
        8,
      ),
      focusPlan: tailLines(
        join(target.targetAppDir, ".state/focus-plan-runs.jsonl"),
        8,
      ),
      problem: tailLines(
        join(target.targetAppDir, ".state/problem-runs.jsonl"),
        8,
      ),
    },
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

function normalizeJudgment(
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
  if (key.includes("focus-approval")) return "focus-approval";
  if (
    key.includes("no-active-frontier") ||
    key.includes("no-executable-frontier")
  ) {
    return "no-executable-frontier";
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
  if (!judgment.notify) return false;
  if (
    dedupeFamily(previous.lastDedupeKey) !== dedupeFamily(judgment.dedupeKey)
  ) {
    return true;
  }
  return severity(judgment.verdict) > severity(previous.lastVerdict);
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
Notify: ${judgment.notify ? "yes" : "no"}
Dedupe key: ${judgment.dedupeKey}

## Human Message

${judgment.message}

## Facts

${humanFactSummary(packet, factsRelativePath)}

## Evaluator Judgment

${evaluatorText.trim()}
`;
  writeFileSync(absolutePath, content, "utf-8");
  return { absolutePath, relativePath };
}

function writeState(
  target: TargetConfig,
  judgment: Judgment,
  reportPath: string,
): void {
  const stateDir = join(EVALUATION_APP_DIR, ".state/project-health/targets");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, `${target.targetProject}.json`),
    `${JSON.stringify(
      {
        targetProject: target.targetProject,
        targetAppDir: target.targetAppDir,
        targetDomainDir: target.targetDomainDir ?? null,
        lastReviewedAt: new Date().toISOString(),
        lastReportPath: reportPath,
        lastVerdict: judgment.verdict,
        lastDedupeKey: judgment.dedupeKey,
        lastRequestedHumanAction: judgment.requestedHumanAction,
        lastNotify: judgment.notify,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = parseTrigger(String(ctx.task ?? ""));
  const target = targetConfig(trigger);
  const packet = targetFactPacket(ctx, target);
  const fallback = fallbackJudgment(packet, target);
  const previous = readState(target);

  const prompt = `You are evaluating whether a project app is moving correctly.

Target: ${target.targetProject}
Reason: ${target.reason}

Judge the target app from raw facts. Keep raw facts visible; do not hide uncertainty.
Do not mutate the target app. Do not become a second planner. Decide whether a human should be notified.

Return a markdown report, and include exactly one fenced json block with:
{
  "verdict": "ok|watch|concern|urgent|blocked-on-human",
  "mainConcern": "one sentence",
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

  const judgment = normalizeJudgment(
    extractJsonBlock(result.lastAssistantText ?? ""),
    fallback,
  );
  judgment.dedupeKey = stableDedupeKey(target, packet, judgment);
  judgment.notify = shouldNotify(judgment, previous);
  const report = writeReport(
    target,
    packet,
    judgment,
    result.lastAssistantText ?? "",
  );
  writeState(target, judgment, report.relativePath);

  const reviewedData = {
    targetProject: target.targetProject,
    verdict: judgment.verdict,
    reportPath: report.relativePath,
    summary: judgment.mainConcern,
    requestedHumanAction: judgment.requestedHumanAction,
    notify: judgment.notify,
    dedupeKey: judgment.dedupeKey,
    sessionId: result.sessionId,
  };

  ctx.emit({
    type: "evaluation.project.reviewed",
    source: "agent:evaluator",
    owner: "agent:evaluator",
    data: reviewedData,
  });

  if (judgment.notify) {
    ctx.notify(
      [
        `Project health review: ${target.targetProject}`,
        `Verdict: ${judgment.verdict}`,
        `Action: ${judgment.requestedHumanAction}`,
        judgment.message,
        `Report: ${report.relativePath}`,
      ].join("\n"),
    );
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
