import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeTaskTree } from "./task-tree-tools.ts";
import {
  readTaskTree,
  type TaskNode,
  type TaskTreeConfig,
} from "./task-tree-store.ts";

type ProjectStateRecord = Record<string, unknown>;

type SyncProjectReadoutResult = {
  changed: boolean;
  projectJsonPath: string;
  liveFocusTaskIds: string[];
  allLiveLeafTaskIds: string[];
  activeTaskId: string | null;
  counts: {
    active: number;
    blocked: number;
    review: number;
    waiting: number;
    runnable: number;
  };
  focusPlanId: string | null;
};

function readJson(path: string): ProjectStateRecord {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ProjectStateRecord;
  } catch {
    return {};
  }
}

function objectValue(value: unknown): ProjectStateRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ProjectStateRecord)
    : {};
}

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function isLeaf(task: TaskNode | undefined): boolean {
  return Array.isArray(task?.children) ? task!.children!.length === 0 : true;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function sampleIds(ids: string[], limit = 8): string {
  const picked = ids.slice(0, limit);
  if (picked.length === 0) return "none";
  return ids.length > limit
    ? `${picked.join(", ")} (+${ids.length - limit} more)`
    : picked.join(", ");
}

function liveLeafIdsByState(tree: ReturnType<typeof readTaskTree>): {
  active: string[];
  blocked: string[];
  review: string[];
  backlog: string[];
} {
  const active: string[] = [];
  const blocked: string[] = [];
  const review: string[] = [];
  const backlog: string[] = [];
  for (const task of Object.values(tree.tasks)) {
    if (!isLeaf(task)) continue;
    const state = nodeState(task);
    if (state === "done") continue;
    if (state === "active") active.push(task.id);
    else if (state === "blocked") blocked.push(task.id);
    else if (state === "review") review.push(task.id);
    else backlog.push(task.id);
  }
  return {
    active: active.sort((a, b) => a.localeCompare(b)),
    blocked: blocked.sort((a, b) => a.localeCompare(b)),
    review: review.sort((a, b) => a.localeCompare(b)),
    backlog: backlog.sort((a, b) => a.localeCompare(b)),
  };
}

function liveFocusTaskIds(input: {
  active: string[];
  blocked: string[];
  review: string[];
  runnable: string[];
  waiting: string[];
}): string[] {
  const preferred = unique([
    ...input.active,
    ...input.review,
    ...input.runnable,
    ...input.waiting,
  ]);
  return preferred.length > 0 ? preferred : unique(input.blocked);
}

function allLiveLeafTaskIds(input: {
  active: string[];
  blocked: string[];
  review: string[];
  runnable: string[];
  waiting: string[];
}): string[] {
  return unique([
    ...input.active,
    ...input.review,
    ...input.runnable,
    ...input.waiting,
    ...input.blocked,
  ]);
}

function liveFocusPlan(tree: ReturnType<typeof readTaskTree>): {
  id: string;
  status: string;
} | null {
  const live = Object.values(tree.tasks)
    .filter((task) => task.kind === "focus_plan" && nodeState(task) !== "done")
    .sort((a, b) => a.id.localeCompare(b.id));
  if (live.length === 0) return null;
  return {
    id: live[0].id,
    status: nodeState(live[0]),
  };
}

function buildCurrentStateSummary(input: {
  updatedAt: string;
  counts: SyncProjectReadoutResult["counts"];
  liveFocusTaskIds: string[];
}): string {
  const { updatedAt, counts, liveFocusTaskIds } = input;
  const blockedOnly =
    counts.active === 0 &&
    counts.review === 0 &&
    counts.runnable === 0 &&
    counts.waiting === 0 &&
    counts.blocked > 0;
  if (blockedOnly) {
    return `Task-tree summary at ${updatedAt} shows 0 runnable leaves, 0 waiting leaves, 0 active leaves, 0 review leaves, and ${counts.blocked} blocked leaves. Live frontier is blocked-only exact wait stewardship from non-done tasks/tree.json leaves; loop residue files are diagnostic-only unless backed by a live tree leaf.`;
  }
  return `Task-tree summary at ${updatedAt} shows ${counts.runnable} runnable leaves, ${counts.waiting} waiting leaves, ${counts.active} active leaves, ${counts.review} review leaves, and ${counts.blocked} blocked leaves. Current live frontier is derived from non-done tasks/tree.json leaves first: ${sampleIds(liveFocusTaskIds)}. Loop residue files are diagnostic-only unless backed by a live tree leaf.`;
}

function buildCurrentFocusSummary(input: {
  counts: SyncProjectReadoutResult["counts"];
  liveFocusTaskIds: string[];
}): string {
  const { counts, liveFocusTaskIds } = input;
  const blockedOnly =
    counts.active === 0 &&
    counts.review === 0 &&
    counts.runnable === 0 &&
    counts.waiting === 0 &&
    counts.blocked > 0;
  if (blockedOnly) {
    return `Current live focus is blocked-only wait stewardship from tasks/tree.json: ${sampleIds(liveFocusTaskIds)}. Do not reopen compact/spec execution from loop residue alone.`;
  }
  return `Current live focus is derived from non-done tasks/tree.json leaves first: ${sampleIds(liveFocusTaskIds)}.`;
}

function buildNextAction(input: {
  counts: SyncProjectReadoutResult["counts"];
  liveFocusTaskIds: string[];
}): string {
  const { counts, liveFocusTaskIds } = input;
  if (counts.active > 0) {
    return `Finish the current active live-frontier leaf/leaves first: ${sampleIds(liveFocusTaskIds)}. Keep project/app summaries grounded in tasks/tree.json live leaves rather than loop residue.`;
  }
  if (counts.review > 0 || counts.runnable > 0 || counts.waiting > 0) {
    return `Work the current non-done tasks/tree.json frontier in order: ${sampleIds(liveFocusTaskIds)}. Keep loop residue diagnostic-only unless it is represented by a live leaf.`;
  }
  return `Preserve the exact blocked waits (${sampleIds(liveFocusTaskIds)}) and reopen work only when one named resume condition lands; do not dispatch from loop residue alone.`;
}

export function syncProjectReadout(
  config: TaskTreeConfig,
  nowIso = new Date().toISOString(),
): SyncProjectReadoutResult {
  const projectJsonPath = join(config.appDir, "project.json");
  const project = readJson(projectJsonPath);
  const summary = summarizeTaskTree(config);
  const tree = readTaskTree(config);
  const currentState = objectValue(project.currentState);
  const currentFocus = objectValue(project.currentFocus);
  const liveLeaves = liveLeafIdsByState(tree);
  const liveFocusIds = liveFocusTaskIds({
    active: liveLeaves.active,
    blocked: liveLeaves.blocked,
    review: liveLeaves.review,
    runnable: summary.frontier.runnable,
    waiting: summary.frontier.waiting ?? [],
  });
  const allLiveIds = allLiveLeafTaskIds({
    active: liveLeaves.active,
    blocked: liveLeaves.blocked,
    review: liveLeaves.review,
    runnable: summary.frontier.runnable,
    waiting: summary.frontier.waiting ?? [],
  });
  const focusPlan = liveFocusPlan(tree);
  const activeTaskId = liveLeaves.active[0] ?? null;
  const counts = {
    active: liveLeaves.active.length,
    blocked: liveLeaves.blocked.length,
    review: liveLeaves.review.length,
    waiting: (summary.frontier.waiting ?? []).length,
    runnable: summary.frontier.runnable.length,
  };

  const existingMetrics = objectValue(currentState.metrics);
  currentState.summary = buildCurrentStateSummary({
    updatedAt: summary.updated_at ?? nowIso,
    counts,
    liveFocusTaskIds: liveFocusIds,
  });
  currentState.activeTaskId = activeTaskId;
  currentState.metrics = {
    ...existingMetrics,
    blockedLeafCount: counts.blocked,
    runnableLeafCount: counts.runnable,
    activeLeafCount: counts.active,
    reviewLeafCount: counts.review,
    waitingLeafCount: counts.waiting,
  };

  currentFocus.summary = buildCurrentFocusSummary({
    counts,
    liveFocusTaskIds: liveFocusIds,
  });
  currentFocus.nextAction = buildNextAction({
    counts,
    liveFocusTaskIds: liveFocusIds,
  });
  currentFocus.activeTaskIds = liveFocusIds;
  currentFocus.proposedTaskIds = allLiveIds;
  if (focusPlan) {
    currentFocus.focusPlanId = focusPlan.id;
    currentFocus.focusPlanStatus = focusPlan.status;
  } else {
    delete currentFocus.focusPlanId;
    delete currentFocus.focusPlanStatus;
  }

  project.currentState = currentState;
  project.currentFocus = currentFocus;
  project.updatedAt = nowIso;

  const next = `${JSON.stringify(project, null, 2)}\n`;
  const previous = (() => {
    try {
      return readFileSync(projectJsonPath, "utf8");
    } catch {
      return "";
    }
  })();
  const changed = previous !== next;
  if (changed) writeFileSync(projectJsonPath, next, "utf8");

  return {
    changed,
    projectJsonPath,
    liveFocusTaskIds: liveFocusIds,
    allLiveLeafTaskIds: allLiveIds,
    activeTaskId,
    counts,
    focusPlanId: focusPlan?.id ?? null,
  };
}
