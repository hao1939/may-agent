import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  projectRuntimePaths,
  readTaskState,
  saveProjectRuntimeState,
  withTaskStateLock,
  type TaskStateConfig,
  type TaskTree,
} from "@may-agent/sdk";
import {
  sampleFocusMetrics,
  type FocusMetricsSnapshot,
} from "./focus-metrics.ts";

type JsonObject = Record<string, any>;

export type VisibleFrontier = {
  observedTreeUpdatedAt: string;
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blocked: string[];
  allVisible: string[];
  counts: {
    active: number;
    review: number;
    waiting: number;
    runnable: number;
    blocked: number;
  };
};

export type OwnerVisibleReadoutSyncResult = {
  checkedAt: string;
  treeUpdatedAt: string;
  changed: boolean;
  projectJsonChanged: boolean;
  projectStateChanged: boolean;
  runtimeMirrorChanged: boolean;
  missingBefore: string[];
  missingAfter: string[];
  frontier: VisibleFrontier;
  liveTaskIds: string[];
};

export type SyncOwnerVisibleReadoutOptions = {
  appDir: string;
  projectDir?: string;
  worker?: string;
  maxConcurrent?: number;
  excludeTaskIds?: string[];
};

type FocusReadoutNarrative = {
  title: string | null;
  summary: string;
  ownerNext: string;
  reviewedAt: string | null;
  metrics: FocusMetricsSnapshot;
};

function readJsonObject(path: string): JsonObject {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function readTaskTreeSnapshot(
  appDir: string,
  config: TaskStateConfig,
): TaskTree {
  const treePath = join(appDir, ".state", "tasks", "tree.json");
  if (existsSync(treePath)) {
    try {
      const parsed = JSON.parse(readFileSync(treePath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as TaskTree;
      }
    } catch {
      // Fall back to the canonical runtime state when the disposable projection is
      // unavailable or malformed.
    }
  }
  return readTaskState(config);
}

function taskState(tree: TaskTree, taskId: string): string {
  const resourcePhase = (tree.resources?.[taskId] as any)?.status?.phase;
  const projectedTask = (tree.tasks?.[taskId] as any) ?? {};
  const projectedState = projectedTask.state;
  const projectedPhase = projectedTask.phase;
  return resourcePhase ?? projectedState ?? projectedPhase ?? "unknown";
}

function isLeaf(task: any): boolean {
  return !Array.isArray(task?.children) || task.children.length === 0;
}

function taskWorkflow(task: any): string {
  if (typeof task?.workflow === "string" && task.workflow.trim()) {
    return task.workflow.trim();
  }
  if (typeof task?.spec?.workflow === "string" && task.spec.workflow.trim()) {
    return task.spec.workflow.trim();
  }
  return "";
}

function isRepoRefAdvanceWaitHolder(task: any): boolean {
  return taskWorkflow(task) === "wait-for-repo-ref-advance";
}

function dependenciesOpen(tree: TaskTree, task: any): boolean {
  const dependsOn = Array.isArray(task?.depends_on)
    ? task.depends_on.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : typeof task?.depends_on === "string"
      ? [task.depends_on]
      : [];
  return dependsOn.some((taskId) => {
    if (!tree.tasks?.[taskId]) return false;
    return (
      taskState(tree, taskId) !== "done" &&
      !(tree.receipts && Object.hasOwn(tree.receipts, taskId))
    );
  });
}

function isDependencyBlockedTask(
  tree: TaskTree,
  task: any,
  state: string,
): boolean {
  if (!["backlog", "pending", "ready"].includes(state)) return false;
  const readinessState = String(task?.readiness?.state ?? "");
  return (
    readinessState === "dependency-blocked" || dependenciesOpen(tree, task)
  );
}

function preview(ids: string[], limit = 8): string {
  if (!ids.length) return "[none]";
  if (ids.length <= limit) return `[${ids.join(", ")}]`;
  return `[${ids.slice(0, limit).join(", ")} (+${ids.length - limit} more)]`;
}

function unique(ids: string[]): string[] {
  return [
    ...new Set(
      ids.filter((value) => typeof value === "string" && value.trim()),
    ),
  ];
}

function advertisedPacketIds(packet: JsonObject): string[] {
  const currentFocus = packet.currentFocus ?? {};
  const focusMission = currentFocus.focusMission ?? {};
  return unique([
    ...(Array.isArray(currentFocus.activeTaskIds)
      ? currentFocus.activeTaskIds
      : []),
    ...(Array.isArray(currentFocus.waitingTaskIds)
      ? currentFocus.waitingTaskIds
      : []),
    ...(Array.isArray(currentFocus.blockedTaskIds)
      ? currentFocus.blockedTaskIds
      : []),
    ...(Array.isArray(currentFocus.proposedTaskIds)
      ? currentFocus.proposedTaskIds
      : []),
    ...(Array.isArray(focusMission.activeTaskIds)
      ? focusMission.activeTaskIds
      : []),
    ...(Array.isArray(focusMission.reviewTaskIds)
      ? focusMission.reviewTaskIds
      : []),
    ...(Array.isArray(focusMission.waitingTaskIds)
      ? focusMission.waitingTaskIds
      : []),
    ...(Array.isArray(focusMission.runnableTaskIds)
      ? focusMission.runnableTaskIds
      : []),
    ...(Array.isArray(focusMission.blockedTaskIds)
      ? focusMission.blockedTaskIds
      : []),
    ...(Array.isArray(focusMission.linkedBlockedTaskIds)
      ? focusMission.linkedBlockedTaskIds
      : []),
    ...(Array.isArray(focusMission.liveReviewFrontierTaskIds)
      ? focusMission.liveReviewFrontierTaskIds
      : []),
  ]);
}

function successCriteria(frontier: VisibleFrontier): string[] {
  return [
    `Owner-visible currentState/currentFocus reflect live tree snapshot ${frontier.observedTreeUpdatedAt} with active=${frontier.counts.active}, review=${frontier.counts.review}, waiting=${frontier.counts.waiting}, runnable=${frontier.counts.runnable}, blocked=${frontier.counts.blocked}.`,
    "Every task id cited in active/review/waiting/runnable/blocked arrays resolves in the current live tree.",
    "Active ids are executable leaves only, and exact repo-ref wait holders are preserved outside runnable capacity.",
    "Only the current live frontier packet is published; absorbed or replaced task ids are absent from the refreshed owner-visible packet.",
  ];
}

function parseFocusReviewSummary(summary: string): {
  title: string;
  focusSummary: string;
  ownerNext: string;
} | null {
  const titleMatch = summary.match(/FOCUS_PLAN_TITLE:\s*(.+)/);
  const summaryMatch = summary.match(
    /FOCUS_PLAN_SUMMARY:\s*([\s\S]*?)\nOWNER_NEXT:/,
  );
  const ownerNextMatch = summary.match(/OWNER_NEXT:\s*([\s\S]*)$/);
  if (!titleMatch || !summaryMatch || !ownerNextMatch) return null;
  return {
    title: titleMatch[1].trim(),
    focusSummary: summaryMatch[1].trim(),
    ownerNext: ownerNextMatch[1].trim(),
  };
}

function focusReviewNarrative(
  tree: TaskTree,
  frontier: VisibleFrontier,
  metrics: FocusMetricsSnapshot,
): FocusReadoutNarrative {
  const genericSummary = `Owner-visible frontier refreshed from the live tree updated ${frontier.observedTreeUpdatedAt}: ${frontier.counts.active} active executable leaves, ${frontier.counts.review} review frontier tasks, ${frontier.counts.runnable} runnable follow-through leaves, ${frontier.counts.waiting} waiting holders (including exact repo-advance waits), and ${frontier.counts.blocked} dependency-blocked holders. Fresh focus metrics read as live-started-24h=${metrics.liveRunsStarted24h}, live-succeeded-24h=${metrics.liveRunsSucceeded24h}, spec.unverified-count=${metrics.specUnverifiedCount}, spec.failed-count=${metrics.specFailedCount}, and model.unknown-path-count=${metrics.unknownPathMetric}. This packet is derived from the current live tree and cites only task ids that still resolve in the graph.`;
  const genericNext = `Drain the current live packet first: active=${preview(frontier.active)}, review=${preview(frontier.review)}, runnable=${preview(frontier.runnable)}, waiting=${preview(frontier.waiting)}, blocked=${preview(frontier.blocked)}.`;
  const progressTask = tree.tasks?.["runtime/focus-review/progress"] as any;
  const parsed = parseFocusReviewSummary(String(progressTask?.summary ?? ""));
  if (!parsed) {
    return {
      title: null,
      summary: genericSummary,
      ownerNext: genericNext,
      reviewedAt: null,
      metrics,
    };
  }

  const baselineCommit =
    parsed.ownerNext.match(/origin\/dev advances beyond `([0-9a-f]+)`/i)?.[1] ??
    null;
  const sameRunAdoId =
    parsed.ownerNext.match(/ADO `([0-9]+)`/i)?.[1] ??
    parsed.focusSummary.match(/ADO run `([0-9]+)`/i)?.[1] ??
    null;
  const waitCovered =
    /wait-covered frontier/i.test(parsed.focusSummary) ||
    /wait-covered/i.test(parsed.ownerNext);

  const summaryParts = [
    `Focus mission "${parsed.title}" is the latest progress-review packet for the current frontier.`,
    `Current live packet at ${frontier.observedTreeUpdatedAt} keeps active=${preview(frontier.active)}, review=${preview(frontier.review)}, runnable=${preview(frontier.runnable)}, waiting=${preview(frontier.waiting)}, and blocked=${preview(frontier.blocked)} while citing only live task ids.`,
    `Fresh focus metrics now read live-started-24h=${metrics.liveRunsStarted24h}, live-succeeded-24h=${metrics.liveRunsSucceeded24h}, spec.unverified-count=${metrics.specUnverifiedCount}, spec.failed-count=${metrics.specFailedCount}, and model.unknown-path-count=${metrics.unknownPathMetric}.`,
  ];
  if (waitCovered) {
    summaryParts.push(
      "Scenario-normalization remains a truthful wait-covered frontier, so the owner-visible mission should preserve exact waits rather than widening into refill work from metadata refresh alone.",
    );
  }
  if (sameRunAdoId) {
    summaryParts.push(
      `The KMS lane stays on exact same-run artifact review for ADO ${sameRunAdoId} rather than a fresh rerun.`,
    );
  }

  const nextParts = [
    `Keep the latest progress envelope: active=${preview(frontier.active)}, review=${preview(frontier.review)}, runnable=${preview(frontier.runnable)}, waiting=${preview(frontier.waiting)}, blocked=${preview(frontier.blocked)}.`,
  ];
  if (baselineCommit) {
    nextParts.push(
      `Treat scenario-normalization as wait-covered until origin/dev advances beyond ${baselineCommit}.`,
    );
  }
  if (sameRunAdoId) {
    nextParts.push(
      `When the preserved KMS holder wakes, route it to exact same-run artifact review for ADO ${sameRunAdoId} instead of a fresh rerun.`,
    );
  }

  return {
    title: parsed.title,
    summary: summaryParts.join(" "),
    ownerNext: nextParts.join(" "),
    reviewedAt:
      typeof progressTask?.status_updated_at === "string"
        ? progressTask.status_updated_at
        : null,
    metrics,
  };
}

function currentFocusSummary(narrative: FocusReadoutNarrative): string {
  return narrative.summary;
}

function currentFocusNextAction(narrative: FocusReadoutNarrative): string {
  return narrative.ownerNext;
}

function currentStateSummary(
  frontier: VisibleFrontier,
  metrics: FocusMetricsSnapshot,
): string {
  return `Task-tree summary at ${frontier.observedTreeUpdatedAt} shows ${frontier.counts.runnable} runnable leaves, ${frontier.counts.waiting} waiting holders (including exact repo-advance waits), ${frontier.counts.active} active executable leaves, ${frontier.counts.review} review frontier tasks, and ${frontier.counts.blocked} dependency-blocked holders. Fresh focus metrics read as live-started-24h=${metrics.liveRunsStarted24h}, live-succeeded-24h=${metrics.liveRunsSucceeded24h}, spec.unverified-count=${metrics.specUnverifiedCount}, spec.failed-count=${metrics.specFailedCount}, and model.unknown-path-count=${metrics.unknownPathMetric}. Current owner-visible packet is derived from the live tree packet: ${preview(frontier.allVisible, 12)}.`;
}

function focusPlanSummary(narrative: FocusReadoutNarrative): string {
  return narrative.summary;
}

function focusAllowedRisk(narrative: FocusReadoutNarrative): string {
  return narrative.title
    ? "Allow only work already represented in the current live frontier packet plus the exact waits already named there. Do not widen into new live families, new approval lineages, or broad reruns from readout refresh alone."
    : "Allow only work already represented in the current live frontier packet plus the exact waits already named there.";
}

export function computeVisibleFrontier(
  tree: TaskTree,
  options: { excludeTaskIds?: string[] } = {},
): VisibleFrontier {
  const excluded = new Set(options.excludeTaskIds ?? []);
  const visibleTasks = Object.entries(tree.tasks ?? {})
    .filter(
      ([id]) =>
        id !== tree.root_task_id &&
        !id.startsWith("runtime/") &&
        !excluded.has(id),
    )
    .map(([id, task]) => ({
      id,
      task: task as any,
      state: taskState(tree, id),
    }));

  const visibleLeaves = visibleTasks.filter(({ task }) => isLeaf(task));
  const byState = (items: { id: string; state: string }[], states: string[]) =>
    items
      .filter(({ state }) => states.includes(state))
      .map(({ id }) => id)
      .sort();
  const exactRepoAdvanceWaitIds = visibleLeaves
    .filter(({ task }) => isRepoRefAdvanceWaitHolder(task))
    .map(({ id }) => id)
    .sort();

  const active = visibleLeaves
    .filter(
      ({ state, task }) =>
        ["active", "running"].includes(state) &&
        !isRepoRefAdvanceWaitHolder(task),
    )
    .map(({ id }) => id)
    .sort();
  const review = byState(visibleTasks, ["review", "attention"]);
  const waiting = unique([
    ...byState(visibleTasks, ["waiting", "blocked"]),
    ...exactRepoAdvanceWaitIds,
  ]).sort();
  const runnable = visibleLeaves
    .filter(
      ({ state, task }) =>
        ["backlog", "pending", "ready"].includes(state) &&
        !isDependencyBlockedTask(tree, task, state) &&
        !isRepoRefAdvanceWaitHolder(task),
    )
    .map(({ id }) => id)
    .sort();
  const blocked = visibleTasks
    .filter(({ state, task }) => isDependencyBlockedTask(tree, task, state))
    .map(({ id }) => id)
    .sort();

  return {
    observedTreeUpdatedAt: String((tree as any).updated_at ?? ""),
    active,
    review,
    waiting,
    runnable,
    blocked,
    allVisible: unique([
      ...active,
      ...review,
      ...runnable,
      ...waiting,
      ...blocked,
    ]),
    counts: {
      active: active.length,
      review: review.length,
      waiting: waiting.length,
      runnable: runnable.length,
      blocked: blocked.length,
    },
  };
}

function patchProjectState(
  projectState: JsonObject,
  frontier: VisibleFrontier,
  narrative: FocusReadoutNarrative,
  checkedAt: string,
): JsonObject {
  const currentFocus = projectState.currentFocus ?? {};
  const focusMission = currentFocus.focusMission ?? {};
  const focusReview = currentFocus.focusReview ?? {};
  const reviewedAt = narrative.reviewedAt ?? checkedAt;
  const metrics = { ...(projectState.currentState?.metrics ?? {}) };
  metrics.liveRunsStarted24h = narrative.metrics.liveRunsStarted24h;
  metrics.liveRunsSucceeded24h = narrative.metrics.liveRunsSucceeded24h;
  metrics.specUnverifiedCount = narrative.metrics.specUnverifiedCount;
  metrics.specFailedCount = narrative.metrics.specFailedCount;
  metrics.unknownPathMetric = narrative.metrics.unknownPathMetric;
  metrics.blockedLeafCount = frontier.counts.blocked;
  metrics.runnableLeafCount = frontier.counts.runnable;
  metrics.activeLeafCount = frontier.counts.active;
  metrics.reviewLeafCount = frontier.counts.review;
  metrics.waitingLeafCount = frontier.counts.waiting;

  return {
    ...projectState,
    updatedAt: checkedAt,
    currentState: {
      ...(projectState.currentState ?? {}),
      summary: currentStateSummary(frontier, narrative.metrics),
      activeTaskId: frontier.active[0] ?? null,
      metrics,
      snapshot: {
        version: "project-snapshot-v2",
        capturedAt: checkedAt,
        treeUpdatedAt: frontier.observedTreeUpdatedAt,
      },
    },
    currentFocus: {
      ...currentFocus,
      summary: currentFocusSummary(narrative),
      nextAction: currentFocusNextAction(narrative),
      activeTaskIds: frontier.active,
      waitingTaskIds: frontier.waiting,
      blockedTaskIds: frontier.blocked,
      proposedTaskIds: frontier.allVisible,
      focusMission: {
        ...focusMission,
        ...(narrative.title ? { title: narrative.title } : {}),
        activeTaskIds: frontier.active,
        reviewTaskIds: frontier.review,
        waitingTaskIds: frontier.waiting,
        runnableTaskIds: frontier.runnable,
        blockedTaskIds: frontier.blocked,
        packetCounts: {
          active: frontier.counts.active,
          review: frontier.counts.review,
          waiting: frontier.counts.waiting,
          runnable: frontier.counts.runnable,
          blocked: frontier.counts.blocked,
        },
        canonicalTreePath: ".state/tasks/tree.json",
        treeUpdatedAt: frontier.observedTreeUpdatedAt,
        linkedBlockedTaskIds: unique([
          ...frontier.waiting,
          ...frontier.blocked,
        ]),
        liveReviewFrontierTaskIds: frontier.review,
        proposedTaskIds: frontier.allVisible,
        excludedReviewTaskIds: [],
        successCriteria: successCriteria(frontier),
        allowedRisk: focusAllowedRisk(narrative),
        progressReview: {
          ...(focusMission.progressReview ?? {}),
          reviewedAt,
          last_reviewed_at: reviewedAt,
          reviewed_at: reviewedAt,
          status: "updated",
          state: "updated",
          result: "updated",
          summary: currentFocusSummary(narrative),
          note: focusPlanSummary(narrative),
        },
      },
      focusReview: {
        ...focusReview,
        status: "updated",
        reviewedAt,
        result: "updated",
        note: focusPlanSummary(narrative),
      },
      snapshot: {
        version: "project-snapshot-v2",
        capturedAt: checkedAt,
        treeUpdatedAt: frontier.observedTreeUpdatedAt,
      },
    },
    focusPlan: {
      ...(projectState.focusPlan ?? {}),
      ...(narrative.title ? { title: narrative.title } : {}),
      summary: focusPlanSummary(narrative),
      ownerNext: currentFocusNextAction(narrative),
      reviewedAt,
      updatedAt: checkedAt,
    },
    focusReview: {
      ...(projectState.focusReview ?? {}),
      ...(narrative.title ? { title: narrative.title } : {}),
      summary: currentFocusSummary(narrative),
      status: "updated",
      reviewedAt,
    },
    ownerNext: currentFocusNextAction(narrative),
    current_focus_progress_review_refreshed_at: checkedAt,
    current_focus_progress_review_refreshed_by: "project.task.reconciled",
    current_focus_proposal_progress_review_refreshed_at: checkedAt,
    current_focus_proposal_progress_review_refreshed_by:
      "project.task.reconciled",
  };
}

export function syncOwnerVisibleReadout(
  options: SyncOwnerVisibleReadoutOptions,
): OwnerVisibleReadoutSyncResult {
  const appDir = options.appDir;
  const runtimePaths = projectRuntimePaths(appDir);
  const config: TaskStateConfig = {
    appDir,
    projectDir: options.projectDir ?? appDir,
    statePath: runtimePaths.taskStatePath,
    journalPath: runtimePaths.journalPath,
    worker: options.worker ?? "app-ops",
    maxConcurrent: options.maxConcurrent ?? 80,
  };

  return withTaskStateLock(config, () => {
    const tree = readTaskTreeSnapshot(appDir, config);
    const checkedAt = new Date().toISOString();
    const frontier = computeVisibleFrontier(tree, {
      excludeTaskIds: options.excludeTaskIds,
    });
    const metrics = sampleFocusMetrics(options.projectDir ?? appDir, {
      appDir,
    });
    const narrative = focusReviewNarrative(tree, frontier, metrics);
    const liveIds = new Set(Object.keys(tree.tasks ?? {}));
    const projectJsonPath = join(appDir, "project.json");
    const projectJson = readJsonObject(projectJsonPath);
    const projectState = readJsonObject(runtimePaths.projectStatePath);

    const beforeIds = unique([
      ...advertisedPacketIds(projectJson),
      ...advertisedPacketIds(projectState),
    ]);
    const missingBefore = beforeIds.filter((id) => !liveIds.has(id)).sort();

    // project.json is static, reviewable project configuration. Live focus and
    // task-tree projections belong in ignored runtime state so reconciliation
    // does not continuously dirty the repository checkout.
    const nextProjectJson = projectJson;
    const nextProjectState = patchProjectState(
      projectState,
      frontier,
      narrative,
      checkedAt,
    );
    const projectJsonChanged = false;
    const projectStateChanged =
      JSON.stringify(projectState) !== JSON.stringify(nextProjectState);
    const runtimeMirrorChanged = false;

    if (projectStateChanged) saveProjectRuntimeState(appDir, nextProjectState);

    const afterIds = unique([
      ...advertisedPacketIds(nextProjectJson),
      ...advertisedPacketIds(nextProjectState),
    ]);
    const missingAfter = afterIds.filter((id) => !liveIds.has(id)).sort();

    return {
      checkedAt,
      treeUpdatedAt: frontier.observedTreeUpdatedAt,
      changed:
        projectJsonChanged || projectStateChanged || runtimeMirrorChanged,
      projectJsonChanged,
      projectStateChanged,
      runtimeMirrorChanged,
      missingBefore,
      missingAfter,
      frontier,
      liveTaskIds: [...liveIds].sort(),
    };
  });
}
