/**
 * project-stall-review — app-ops deep-dive fallback for project liveness stalls.
 *
 * Code gathers state and applies only mechanical repairs. The agent judges why
 * the project is not moving; the planner consumes that judgment and owns task
 * tree decisions.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTaskTreePath, type WorkflowContext, type WorkflowResult } from "@may-agent/sdk";
import { defaultFeatureCompactLoopStatePath } from "./lib/feature-compact-loop-store.ts";
import { defaultFeatureReferenceLoopStatePath } from "./lib/feature-reference-loop-store.ts";
import { defaultSpecLoopStatePath } from "./lib/spec-loop-store.ts";
import {
  listRunnableBacklogTaskIds,
  planningPacket,
  repairTaskTreeRollups,
  waitingBacklogTaskSnapshots,
  type TaskTreeConfig,
} from "./lib/task-tree-tools.ts";
import {
  readTaskTree,
  type TaskNode,
  type TaskTree,
} from "./lib/task-tree-store.ts";
import { exactBlockedWaitStewardshipProgress } from "./lib/durable-loop-wait-stewardship.ts";
import {
  field,
  parseTriggerEvent,
  readJson,
  resolveAppDir,
  resultText,
  triggerBlock,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";

export const name = "project-stall-review";
export const description =
  "Collect liveness state for a stalled project, ask app-ops to judge it, and emit a planner-consumable reviewed fact.";

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
    opts?: { timeoutMs?: number },
  ) => Promise<unknown>;
};

type StallReviewConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  agent: string;
  maxConcurrent: number;
  maxLoopPulses: number;
};

type StallReviewMode = "fallback" | "risk-review";
type StallReviewJudgment =
  | "repaired"
  | "needs-work"
  | "exact-external-wait"
  | "escalate"
  | "inconclusive";

type StallReviewDecision = {
  judgment: StallReviewJudgment;
  rootCause: string;
  nextProjectMove: string;
  whyNotMoving: string;
  evidence: string[];
};

const judgmentValues = new Set<StallReviewJudgment>([
  "repaired",
  "needs-work",
  "exact-external-wait",
  "escalate",
  "inconclusive",
]);

type LoopDefinition = {
  name: string;
  taskId: string;
  action: string;
  statePath: string;
  collectionKey: "specs" | "features";
  doneStatuses: string[];
};

type LoopSummary = {
  name: string;
  taskId: string;
  action: string;
  statePath: string;
  stateExists: boolean;
  taskStatus: string | null;
  completionReady: boolean | null;
  workflowProgress: Record<string, unknown> | null;
  total: number;
  nonTerminalCount: number;
  unrepresentedNonTerminalCount: number;
  statusCounts: Record<string, number>;
  sampleOpenKeys: string[];
  exactBlockedWaitStewardship: boolean;
  needsAttention: boolean;
};

type ProjectSnapshot = {
  capturedAt: string;
  taskCounts: Record<string, number>;
  runnableBacklogTaskIds: string[];
  reviewTaskIds: string[];
  blockedTaskIds: string[];
  waitingBacklogTaskIds: string[];
  activeTaskIds: string[];
  loopSummaries: LoopSummary[];
  recentJournal: string[];
  recentPlannerRuns: string[];
  planningPacket?: unknown;
  planningPacketError?: string;
};

function parseInput(raw: string, defaultAgent: string): StallReviewConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(raw, "app"));
  return {
    appDir,
    projectDir,
    treePath: resolveTaskTreePath(appDir),
    agent: field(raw, "owner") ?? field(raw, "agent") ?? defaultAgent,
    maxConcurrent: Number(field(raw, "maxConcurrent") ?? 3),
    maxLoopPulses: Number(field(raw, "maxLoopPulses") ?? 3),
  };
}

function taskTreeConfig(config: StallReviewConfig): TaskTreeConfig {
  return {
    appDir: config.appDir,
    projectDir: config.projectDir,
    treePath: config.treePath,
    journalPath: join(config.appDir, ".state", "journal.jsonl"),
    worker: config.agent,
    maxConcurrent: config.maxConcurrent,
  };
}

function loopDefinitions(appDir: string): LoopDefinition[] {
  return [
    {
      name: "spec-loop",
      taskId: "aks-spec-verification-loop",
      action: "spec-loop",
      statePath: defaultSpecLoopStatePath(appDir),
      collectionKey: "specs",
      doneStatuses: ["pass", "done"],
    },
    {
      name: "feature-reference-loop",
      taskId: "aks-feature-reference-loop",
      action: "feature-reference-loop",
      statePath: defaultFeatureReferenceLoopStatePath(appDir),
      collectionKey: "features",
      doneStatuses: ["done"],
    },
    {
      name: "feature-compact-loop",
      taskId: "aks-feature-compact-loop",
      action: "feature-compact-loop",
      statePath: defaultFeatureCompactLoopStatePath(appDir),
      collectionKey: "features",
      doneStatuses: ["done"],
    },
  ];
}

function tailLines(path: string, limit: number): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(-limit);
}

function nodeState(task: TaskNode | undefined): string | null {
  if (!task) return null;
  return String(task.status ?? task.state ?? "backlog");
}

function taskContext(task: TaskNode | undefined): Record<string, unknown> {
  const context = task?.context;
  return context && typeof context === "object" && !Array.isArray(context)
    ? (context as Record<string, unknown>)
    : {};
}

function workflowProgress(
  task: TaskNode | undefined,
): Record<string, unknown> | null {
  const progress = taskContext(task).workflowProgress;
  return progress && typeof progress === "object" && !Array.isArray(progress)
    ? (progress as Record<string, unknown>)
    : null;
}

function progressNumber(
  progress: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = progress?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function completionReady(task: TaskNode | undefined): boolean | null {
  const progress = workflowProgress(task);
  return typeof progress?.completionReady === "boolean"
    ? progress.completionReady
    : null;
}

function statusCounts(input: {
  statePath: string;
  collectionKey: "specs" | "features";
}): {
  stateExists: boolean;
  total: number;
  counts: Record<string, number>;
  sampleOpenKeys: string[];
} {
  if (!existsSync(input.statePath)) {
    return { stateExists: false, total: 0, counts: {}, sampleOpenKeys: [] };
  }
  const state = readJson<Record<string, unknown>>(input.statePath, {});
  const collection = state[input.collectionKey];
  const records =
    collection && typeof collection === "object" && !Array.isArray(collection)
      ? (collection as Record<string, Record<string, unknown>>)
      : {};
  const counts: Record<string, number> = {};
  const sampleOpenKeys: string[] = [];

  for (const [key, value] of Object.entries(records)) {
    const status =
      typeof value?.status === "string" && value.status.trim()
        ? value.status.trim()
        : "pending";
    counts[status] = (counts[status] ?? 0) + 1;
    if (sampleOpenKeys.length < 10) sampleOpenKeys.push(key);
  }

  return {
    stateExists: true,
    total: Object.keys(records).length,
    counts,
    sampleOpenKeys,
  };
}

function loopSummary(tree: TaskTree | null, def: LoopDefinition): LoopSummary {
  const task = tree?.tasks[def.taskId];
  const counts = statusCounts({
    statePath: def.statePath,
    collectionKey: def.collectionKey,
  });
  const done = new Set(def.doneStatuses);
  const nonTerminalCount = Object.entries(counts.counts).reduce(
    (sum, [status, count]) => sum + (done.has(status) ? 0 : count),
    0,
  );
  const progress = workflowProgress(task);
  const ready = completionReady(task);
  const exactBlockedWaitStewardship =
    exactBlockedWaitStewardshipProgress(progress);
  const unrepresentedNonTerminalCount =
    progressNumber(progress, "unrepresentedNonTerminalCount") ??
    (nonTerminalCount > 0 ? nonTerminalCount : 0);
  return {
    name: def.name,
    taskId: def.taskId,
    action: def.action,
    statePath: def.statePath,
    stateExists: counts.stateExists,
    taskStatus: nodeState(task),
    completionReady: ready,
    workflowProgress: progress,
    total: counts.total,
    nonTerminalCount,
    unrepresentedNonTerminalCount,
    statusCounts: counts.counts,
    sampleOpenKeys: counts.sampleOpenKeys,
    exactBlockedWaitStewardship,
    needsAttention:
      ready === false &&
      (unrepresentedNonTerminalCount > 0 || !exactBlockedWaitStewardship),
  };
}

function isLeaf(task: TaskNode): boolean {
  return (task.children ?? []).length === 0;
}

function taskCounts(tree: TaskTree | null): Record<string, number> {
  if (!tree) return {};
  const counts: Record<string, number> = {};
  for (const task of Object.values(tree.tasks)) {
    const state = nodeState(task) ?? "unknown";
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return counts;
}

function leafIdsByStatus(tree: TaskTree | null, state: string): string[] {
  if (!tree) return [];
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && nodeState(task) === state)
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
}

function readTreeOrNull(config: TaskTreeConfig): TaskTree | null {
  try {
    return readTaskTree(config);
  } catch {
    return null;
  }
}

function collectSnapshot(config: StallReviewConfig): ProjectSnapshot {
  const treeConfig = taskTreeConfig(config);
  const tree = readTreeOrNull(treeConfig);
  const snapshot: ProjectSnapshot = {
    capturedAt: new Date().toISOString(),
    taskCounts: taskCounts(tree),
    runnableBacklogTaskIds: existsSync(config.treePath)
      ? listRunnableBacklogTaskIds(treeConfig, config.maxConcurrent)
      : [],
    reviewTaskIds: leafIdsByStatus(tree, "review"),
    blockedTaskIds: leafIdsByStatus(tree, "blocked"),
    waitingBacklogTaskIds: tree
      ? waitingBacklogTaskSnapshots(tree).map((task) => task.id)
      : [],
    activeTaskIds: leafIdsByStatus(tree, "active"),
    loopSummaries: loopDefinitions(config.appDir).map((def) =>
      loopSummary(tree, def),
    ),
    recentJournal: tailLines(join(config.appDir, ".state", "journal.jsonl"), 8),
    recentPlannerRuns: tailLines(
      join(config.appDir, ".state", "planner-runs.jsonl"),
      5,
    ),
  };

  try {
    snapshot.planningPacket = existsSync(config.treePath)
      ? planningPacket(treeConfig)
      : undefined;
  } catch (err) {
    snapshot.planningPacketError =
      err instanceof Error ? err.message : String(err);
  }

  return snapshot;
}

function stallSessionId(triggerReason: string): string {
  const safeReason =
    triggerReason
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 72) || "project_stall";
  return `s_stall_review_${safeReason}`;
}

function reviewMode(input: {
  triggerReason: string;
  rawMode: string;
}): StallReviewMode {
  if (input.rawMode === "fallback" || input.rawMode === "risk-review") {
    return input.rawMode;
  }
  return input.triggerReason === "watchdog-durable-loop-stall"
    ? "fallback"
    : "risk-review";
}

function buildPrompt(input: {
  appDir: string;
  projectDir: string;
  triggerReason: string;
  mode: StallReviewMode;
  trigger: string;
  before: ProjectSnapshot;
  after: ProjectSnapshot;
  repairResult: unknown;
  dispatchedTicks: Array<{ taskId: string; action: string }>;
}): string {
  return `App-Ops Deep-Dive Fallback

You are judging why the aks-rp-e2e project is not moving.

Division of responsibility:
- Workflow code collected the packet below and applied only mechanical repair.
- You judge the process root cause and the next project move.
- Do not mutate the task tree from this diagnostic session. The planner will
  consume project.stall.reviewed and make task-tree decisions.
- Use the durable task tree, loop state, and recent journal facts. Do not treat
  lack of perfect information as a reason to block; recommend the best concrete
  next move from known data.
- Do not decide AKS product correctness. If AKS domain judgment or repair is
  needed, recommend concrete domain/* work for aks-explorer.

Return structured control data. Prose may explain, but only this JSON object is
used for workflow control:

\`\`\`json
{
  "stallReview": {
    "judgment": "repaired | needs-work | exact-external-wait | escalate | inconclusive",
    "rootCause": "short cause",
    "nextProjectMove": "planner-owned next action",
    "whyNotMoving": "why the project is not making expected progress",
    "evidence": ["specific packet fact", "specific task/loop fact"]
  }
}
\`\`\`

App: ${input.appDir}
Domain workspace: ${input.projectDir}
Trigger reason: ${input.triggerReason}
Review mode: ${input.mode}

## Mechanical Actions Already Taken
\`\`\`json
${JSON.stringify(
  {
    repairResult: input.repairResult,
    dispatchedTicks: input.dispatchedTicks,
  },
  null,
  2,
)}
\`\`\`

## Snapshot Before Repair
\`\`\`json
${JSON.stringify(input.before, null, 2)}
\`\`\`

## Snapshot After Repair
\`\`\`json
${JSON.stringify(input.after, null, 2)}
\`\`\`

${input.trigger}`.trim();
}

async function runReviewStep(input: {
  ctx: WorkflowContext;
  agent: string;
  prompt: string;
  sessionId: string;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.agent, input.prompt, input.sessionId, {
        timeoutMs: 900_000,
      })
    : input.ctx.runAgent(input.agent, input.prompt);
}

function resultTextCandidates(result: unknown): string[] {
  const candidates: string[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown, depth: number): void {
    if (value == null || depth > 4 || seen.has(value)) return;
    if (typeof value === "string") {
      if (value.trim()) candidates.push(value);
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of [
      "lastAssistantText",
      "message",
      "summary",
      "errorMessage",
      "status",
    ]) {
      visit(record[key], depth + 1);
    }
    visit(record.finishResult, depth + 1);
    visit(record.messages, depth + 1);
    visit(record.error, depth + 1);
  }

  visit(result, 0);
  return candidates;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEvidence(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item) => item.length > 0)
      .slice(0, 20);
  }
  const text = normalizeString(value);
  return text ? [text] : [];
}

function decisionFromRecord(
  record: Record<string, unknown>,
): StallReviewDecision | null {
  const raw =
    record.stallReview && typeof record.stallReview === "object"
      ? (record.stallReview as Record<string, unknown>)
      : record;
  const judgment = normalizeString(raw.judgment) as StallReviewJudgment;
  if (!judgmentValues.has(judgment)) return null;
  return {
    judgment,
    rootCause: normalizeString(raw.rootCause ?? raw.root_cause),
    nextProjectMove: normalizeString(
      raw.nextProjectMove ?? raw.next_project_move,
    ),
    whyNotMoving: normalizeString(raw.whyNotMoving ?? raw.why_not_moving),
    evidence: normalizeEvidence(raw.evidence),
  };
}

function recordsFromResult(result: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown, depth: number, allowJsonText: boolean): void {
    if (value == null || depth > 5 || seen.has(value)) return;
    if (typeof value === "string") {
      if (allowJsonText) {
        const parsed = parseJsonObject(value);
        if (parsed) records.push(parsed);
      }
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, allowJsonText);
      return;
    }
    const record = value as Record<string, unknown>;
    records.push(record);
    for (const key of [
      "stallReview",
      "data",
      "result",
      "output",
      "finishResult",
    ]) {
      visit(record[key], depth + 1, allowJsonText);
    }
    for (const key of ["message", "summary", "lastAssistantText"]) {
      visit(record[key], depth + 1, true);
    }
    visit(record.messages, depth + 1, allowJsonText);
  }

  visit(result, 0, false);
  return records;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const candidate of [
    trimmed,
    trimmed.match(/```json\s*([\s\S]*?)\s*```/)?.[1],
  ]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function decisionFromResult(
  result: unknown,
  fallbackText: string,
  fallbackDecision?: StallReviewDecision,
): StallReviewDecision {
  for (const record of recordsFromResult(result)) {
    const decision = decisionFromRecord(record);
    if (decision) return decision;
  }
  if (fallbackDecision) return fallbackDecision;
  return {
    judgment: "inconclusive",
    rootCause: "Stall review did not return structured stallReview data.",
    nextProjectMove:
      "Planner should inspect the unstructured stall-review summary and decide one bounded next step.",
    whyNotMoving: "",
    evidence: normalizeEvidence(fallbackText),
  };
}

function fallbackDecisionFromSnapshot(
  snapshot: ProjectSnapshot,
): StallReviewDecision | null {
  const attentionLoops = snapshot.loopSummaries.filter(
    (loop) =>
      loop.completionReady === false && loop.unrepresentedNonTerminalCount > 0,
  );
  if (attentionLoops.length > 0) {
    return {
      judgment: "needs-work",
      rootCause: "durable loop ledger has unrepresented non-terminal records",
      nextProjectMove:
        "planner should assign the loop controller or create grouped repair/rerun work for unrepresented residue",
      whyNotMoving:
        "task-tree frontier is not representing all pending/error loop records",
      evidence: attentionLoops.map(
        (loop) =>
          `${loop.name}: ${loop.unrepresentedNonTerminalCount}/${loop.nonTerminalCount} non-terminal record(s) unrepresented`,
      ),
    };
  }
  const exactWaitLoops = snapshot.loopSummaries.filter(
    (loop) =>
      loop.completionReady === false &&
      loop.nonTerminalCount > 0 &&
      loop.exactBlockedWaitStewardship,
  );
  if (
    exactWaitLoops.length > 0 &&
    snapshot.runnableBacklogTaskIds.length === 0 &&
    snapshot.activeTaskIds.length === 0 &&
    snapshot.reviewTaskIds.length === 0
  ) {
    return {
      judgment: "exact-external-wait",
      rootCause: "all non-terminal loop residue is represented by exact waits",
      nextProjectMove:
        "preserve exact waits until one named resume condition lands",
      whyNotMoving: "project frontier is blocked-only by represented waits",
      evidence: exactWaitLoops.map(
        (loop) =>
          `${loop.name}: ${loop.nonTerminalCount} represented wait record(s)`,
      ),
    };
  }
  return null;
}

function repairChanged(repairResult: unknown): boolean {
  if (!repairResult || typeof repairResult !== "object") return false;
  const record = repairResult as {
    changed?: unknown;
    repaired?: unknown;
    reopenedDurableLoopRoots?: unknown;
  };
  if (record.changed === true) return true;
  if (Array.isArray(record.repaired) && record.repaired.length > 0) return true;
  if (
    Array.isArray(record.reopenedDurableLoopRoots) &&
    record.reopenedDurableLoopRoots.length > 0
  ) {
    return true;
  }
  return false;
}

function loopTaskIds(): Set<string> {
  return new Set(loopDefinitions("").map((loop) => loop.taskId));
}

function shouldPulseLoopControllers(snapshot: ProjectSnapshot): boolean {
  if (snapshot.activeTaskIds.length > 0 || snapshot.reviewTaskIds.length > 0) {
    return false;
  }
  const loopIds = loopTaskIds();
  return snapshot.runnableBacklogTaskIds.every((taskId) => loopIds.has(taskId));
}

function dispatchTick(
  ctx: WorkflowContext,
  input: { taskId: string; action: string; reason: string },
): void {
  try {
    ctx.dispatchEvent("project.task.tick", {
      target: { project: "aks-rp-e2e", taskId: input.taskId },
      project: "aks-rp-e2e",
      taskId: input.taskId,
      task_id: input.taskId,
      action: input.action,
      reason: input.reason,
      requested_by: "project-stall-review",
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
}

function dispatchReviewed(
  ctx: WorkflowContext,
  input: {
    triggerReason: string;
    mode: StallReviewMode;
    decision: StallReviewDecision;
    repaired: boolean;
    summary: string;
    before: ProjectSnapshot;
    after: ProjectSnapshot;
    repairResult: unknown;
    dispatchedTicks: Array<{ taskId: string; action: string }>;
  },
): void {
  try {
    ctx.dispatchEvent("project.stall.reviewed", {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      reason: input.triggerReason,
      mode: input.mode,
      judgment: input.decision.judgment,
      stallReview: input.decision,
      repaired: input.repaired,
      repairResult: input.repairResult,
      dispatchedTicks: input.dispatchedTicks,
      loopSummaries: input.after.loopSummaries,
      before: {
        taskCounts: input.before.taskCounts,
        runnableBacklogTaskIds: input.before.runnableBacklogTaskIds,
        reviewTaskIds: input.before.reviewTaskIds,
        blockedTaskIds: input.before.blockedTaskIds.slice(0, 25),
        waitingBacklogTaskIds: input.before.waitingBacklogTaskIds.slice(0, 25),
      },
      after: {
        taskCounts: input.after.taskCounts,
        runnableBacklogTaskIds: input.after.runnableBacklogTaskIds,
        reviewTaskIds: input.after.reviewTaskIds,
        blockedTaskIds: input.after.blockedTaskIds.slice(0, 25),
        waitingBacklogTaskIds: input.after.waitingBacklogTaskIds.slice(0, 25),
      },
      summary: input.summary.slice(0, 6000),
      requested_by: "project-stall-review",
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
}

function appendRun(appDir: string, entry: Record<string, unknown>): void {
  const path = join(appDir, ".state", "stall-review-runs.jsonl");
  mkdirSync(join(appDir, ".state"), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      workflow: "project-stall-review",
      ...entry,
    })}\n`,
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const trigger = parseTriggerEvent(ctx.task);
  if (trigger && trigger.type !== "project.stall.review.requested") {
    return ctx.done(
      `Stall review ignored trigger ${String(trigger.type ?? "unknown")}; use project.stall.review.requested.`,
    );
  }

  const triggerReason =
    triggerString(trigger, "reason") ||
    triggerString(trigger, "triggerReason") ||
    String(triggerValue(trigger, "sourceReason") || "manual-stall-review");
  const mode = reviewMode({
    triggerReason,
    rawMode:
      triggerString(trigger, "mode") || triggerString(trigger, "reviewMode"),
  });

  const before = collectSnapshot(config);
  let repairResult: unknown = null;
  if (mode === "fallback") {
    try {
      repairResult = repairTaskTreeRollups(taskTreeConfig(config));
    } catch (err) {
      repairResult = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    repairResult = {
      skipped: true,
      reason:
        "risk-review mode is collect-only; planner owns follow-up decisions",
    };
  }
  const after = collectSnapshot(config);

  const pulseCandidates =
    mode === "fallback" && shouldPulseLoopControllers(after)
      ? after.loopSummaries
          .filter((loop) => loop.needsAttention)
          .slice(0, Math.max(0, config.maxLoopPulses))
      : [];
  const dispatchedTicks: Array<{ taskId: string; action: string }> = [];
  for (const loop of pulseCandidates) {
    dispatchTick(ctx, {
      taskId: loop.taskId,
      action: loop.action,
      reason: "stall-review-loop-pulse",
    });
    dispatchedTicks.push({ taskId: loop.taskId, action: loop.action });
  }

  let reviewResult: unknown;
  try {
    reviewResult = await runReviewStep({
      ctx,
      agent: config.agent,
      sessionId: stallSessionId(triggerReason),
      prompt: buildPrompt({
        appDir: config.appDir,
        projectDir: config.projectDir,
        triggerReason,
        mode,
        trigger: triggerBlock(ctx.task),
        before,
        after,
        repairResult,
        dispatchedTicks,
      }),
    });
  } catch (err) {
    reviewResult = {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const summary = resultText(reviewResult);
  const decision = decisionFromResult(
    reviewResult,
    summary,
    fallbackDecisionFromSnapshot(after) ?? undefined,
  );
  const repaired = repairChanged(repairResult);

  dispatchReviewed(ctx, {
    triggerReason,
    mode,
    decision,
    repaired,
    summary,
    before,
    after,
    repairResult,
    dispatchedTicks,
  });
  appendRun(config.appDir, {
    reason: triggerReason,
    mode,
    judgment: decision.judgment,
    stall_review: decision,
    repaired,
    dispatched_ticks: dispatchedTicks,
    loop_summaries: after.loopSummaries.map((loop) => ({
      name: loop.name,
      task_id: loop.taskId,
      non_terminal_count: loop.nonTerminalCount,
      unrepresented_non_terminal_count: loop.unrepresentedNonTerminalCount,
      status_counts: loop.statusCounts,
      completion_ready: loop.completionReady,
      exact_blocked_wait_stewardship: loop.exactBlockedWaitStewardship,
      task_status: loop.taskStatus,
    })),
    summary: summary.slice(0, 4000),
  });

  return ctx.done(
    `Stall review emitted project.stall.reviewed (${decision.judgment}, ${mode}); dispatched ${dispatchedTicks.length} loop tick(s).`,
  );
}

if (import.meta.main) {
  if (process.env.MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT !== "1") {
    console.error(
      "Direct workflow entrypoint is disabled by default. Set MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT=1 to run it.",
    );
    process.exit(0);
  }
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer",
    agent: "aks-explorer",
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}
