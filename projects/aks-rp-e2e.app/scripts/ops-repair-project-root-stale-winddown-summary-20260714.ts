import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type RootRepairSnapshot = {
  checkedAt: string;
  projectGoal: string;
  stale: {
    strategyContext: string | null;
    summary: string | null;
    rollupSummary: string | null;
    progress: unknown;
    acceptanceNote: string | null;
  };
  frontier: {
    activeIncludingSelf: string[];
    activeExcludingSelf: string[];
    review: string[];
    waiting: string[];
    runnable: string[];
    blockedLeafCount: number;
    doneLeafCount: number;
    leafTotal: number;
    topLevelBlockedIds: string[];
    topLevelDoneIds: string[];
  };
  repaired: {
    strategyContext: string;
    summary: string;
    rollupSummary: string;
    progress: JsonRecord;
    acceptanceNote: string;
    currentRootReadout: JsonRecord;
  };
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const projectTaskId = "project";
const repairTaskId = "ops/repair-project-root-stale-winddown-summary-20260714";
const evidencePath =
  "evidence/archive/ops-repair-project-root-stale-winddown-summary-20260714.md";
const attemptId =
  "a_ops_repair-project-root-stale-winddown-summary-20260714_20260714233941";

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function statusOf(task: { status?: unknown; state?: unknown }): string {
  const status = typeof task.status === "string" ? task.status.trim() : "";
  if (status) return status;
  return typeof task.state === "string" ? task.state.trim() : "";
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

const beforeSummary = summarizeTaskTree(config);
const checkedAt = new Date().toISOString();

const snapshot = withTreeLock(config, (): RootRepairSnapshot => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const projectContext = asRecord(projectTask.context);
  const projectTrace = asRecord(projectTask.trace);
  const projectChildren = asStringArray(projectTask.children);

  const activeIncludingSelf = unique(beforeSummary.frontier.active);
  const activeExcludingSelf = activeIncludingSelf.filter(
    (taskId) => taskId !== repairTaskId,
  );
  const review = unique(beforeSummary.frontier.review ?? []);
  const waiting = unique(beforeSummary.frontier.waiting ?? []);
  const runnable = unique(beforeSummary.frontier.runnable ?? []);
  const blockedLeafCount = Number(beforeSummary.counts.blocked ?? 0);
  const doneLeafCount = Number(beforeSummary.counts.done ?? 0);
  const leafTotal = Number(beforeSummary.leaf_total ?? 0);

  const topLevelBlockedIds = projectChildren.filter((childId) => {
    const child = tree.tasks[childId];
    return child && statusOf(child) === "blocked";
  });
  const topLevelDoneIds = projectChildren.filter((childId) => {
    const child = tree.tasks[childId];
    return child && statusOf(child) === "done";
  });

  const repairedSummary = [
    "Project root is reopened and loop-driven, not in the 2026-06-14 wind-down posture.",
    `Excluding transient metadata repair ${repairTaskId}, the live frontier is active=[${formatList(activeExcludingSelf)}], review=[${formatList(review)}], waiting=[${formatList(waiting)}], runnable=[${formatList(runnable)}], blocked=${blockedLeafCount}.`,
    `Top-level blocked stewards preserved at the root are ${formatList(topLevelBlockedIds)}. Historical 2026-06-14 ceiling/acceptance data remains provenance only; it is not the current operating posture.`,
  ].join(" ");

  const repairedStrategyContext =
    `Planner update (${checkedAt}): historical 2026-06-14 ceiling/wind-down context is provenance only after the 2026-06-17 reopen. Current root steering excludes transient repair leaf ${repairTaskId} and reflects active=[${formatList(activeExcludingSelf)}], review=[${formatList(review)}], waiting=[${formatList(waiting)}], runnable=[${formatList(runnable)}], blocked=${blockedLeafCount}. Preserve the exact top-level blocked stewards ${formatList(topLevelBlockedIds)} until same-lineage returns or sharper replacements land; do not treat blocked-family stewardship as project completion.`;

  const repairedRollupSummary =
    `2026-07-14 root readout repair: retired stale June-14 wind-down/8-of-8 posture and rewrote project summary/strategy/progress to the current non-self frontier (${activeExcludingSelf.length} active, ${blockedLeafCount} blocked leaves; ${topLevelBlockedIds.length} blocked top-level stewards).`;

  const repairedAcceptanceNote =
    `Historical 2026-06-14 ceiling acceptance is provenance only. Current root readout at ${checkedAt} excludes transient repair leaf ${repairTaskId} and shows active=[${formatList(activeExcludingSelf)}], review=[${formatList(review)}], waiting=[${formatList(waiting)}], runnable=[${formatList(runnable)}], blocked=${blockedLeafCount}, with exact top-level stewards ${formatList(topLevelBlockedIds)} still open.`;

  const repairedProgress: JsonRecord = {
    updated_at: checkedAt,
    active_excluding_self: activeExcludingSelf.length,
    active_including_self: activeIncludingSelf.length,
    review: review.length,
    waiting: waiting.length,
    runnable: runnable.length,
    blocked: blockedLeafCount,
    done: doneLeafCount,
    leaf_total: leafTotal,
    top_level_blocked: topLevelBlockedIds.length,
  };

  const currentRootReadout: JsonRecord = {
    updated_at: checkedAt,
    excludes_task_id: repairTaskId,
    active_task_ids_excluding_self: activeExcludingSelf,
    active_task_ids_including_self: activeIncludingSelf,
    review_task_ids: review,
    waiting_task_ids: waiting,
    runnable_task_ids: runnable,
    blocked_leaf_count: blockedLeafCount,
    top_level_blocked_ids: topLevelBlockedIds,
    top_level_done_ids: topLevelDoneIds,
    stale_winddown_replaced: true,
  };

  const stale = {
    strategyContext:
      typeof projectTask.strategy_context === "string"
        ? projectTask.strategy_context
        : null,
    summary: typeof projectTask.summary === "string" ? projectTask.summary : null,
    rollupSummary:
      typeof projectContext.rollup_summary === "string"
        ? projectContext.rollup_summary
        : typeof projectTask.rollup_summary === "string"
          ? projectTask.rollup_summary
          : null,
    progress: projectTask.progress ?? null,
    acceptanceNote:
      typeof projectContext.acceptance_note === "string"
        ? projectContext.acceptance_note
        : null,
  };

  projectTask.summary = repairedSummary;
  projectTask.strategy_context = repairedStrategyContext;
  projectTask.rollup_summary = repairedRollupSummary;
  projectTask.progress = repairedProgress;
  projectTask.updated_at = checkedAt;

  projectContext.rollup_summary = repairedRollupSummary;
  projectContext.acceptance_note = repairedAcceptanceNote;
  projectContext.current_root_readout = currentRootReadout;
  projectTask.context = projectContext;

  projectTask.trace = {
    ...projectTrace,
    project_root_stale_winddown_summary_repaired_at: checkedAt,
    project_root_stale_winddown_summary_repaired_by: "app-ops-script",
    project_root_stale_winddown_summary_repair_attempt_id: attemptId,
    project_root_stale_winddown_summary_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    checkedAt,
    projectGoal: projectTask.goal,
    stale,
    frontier: {
      activeIncludingSelf,
      activeExcludingSelf,
      review,
      waiting,
      runnable,
      blockedLeafCount,
      doneLeafCount,
      leafTotal,
      topLevelBlockedIds,
      topLevelDoneIds,
    },
    repaired: {
      strategyContext: repairedStrategyContext,
      summary: repairedSummary,
      rollupSummary: repairedRollupSummary,
      progress: repairedProgress,
      acceptanceNote: repairedAcceptanceNote,
      currentRootReadout,
    },
  };
});

writeMemo(`# Project-root stale wind-down summary repair — 2026-07-14

- Checked at: ${snapshot.checkedAt}
- Attempt: ${attemptId}
- Task: ${repairTaskId}

## Baseline evidence

Before this repair, \`bun run task-tree show project\` still surfaced stale June-14 ceiling-era metadata even though \`bun run task-tree summary\` already reported a live frontier with blocked work:

- \`strategy_context\`: ${JSON.stringify(snapshot.stale.strategyContext)}
- \`progress\`: ${JSON.stringify(snapshot.stale.progress, null, 2)}
- \`summary\`: ${JSON.stringify(snapshot.stale.summary)}
- \`rollup_summary\`: ${JSON.stringify(snapshot.stale.rollupSummary)}
- \`context.acceptance_note\`: ${JSON.stringify(snapshot.stale.acceptanceNote)}

Current frontier snapshot used for the repair:

- active including this repair: ${formatList(snapshot.frontier.activeIncludingSelf)}
- active excluding this repair: ${formatList(snapshot.frontier.activeExcludingSelf)}
- review: ${formatList(snapshot.frontier.review)}
- waiting: ${formatList(snapshot.frontier.waiting)}
- runnable: ${formatList(snapshot.frontier.runnable)}
- blocked leaves: ${snapshot.frontier.blockedLeafCount}
- done leaves: ${snapshot.frontier.doneLeafCount}
- leaf total: ${snapshot.frontier.leafTotal}
- top-level blocked stewards: ${formatList(snapshot.frontier.topLevelBlockedIds)}
- top-level done children: ${formatList(snapshot.frontier.topLevelDoneIds)}

## Applied repair

Used app-owned task-tree locking and save helpers to rewrite only the project-root readout fields while preserving the root goal and existing exact waits:

- \`project.summary\`
- \`project.strategy_context\`
- \`project.progress\`
- \`project.rollup_summary\` + \`project.context.rollup_summary\`
- \`project.context.acceptance_note\`
- \`project.context.current_root_readout\`
- \`project.trace.project_root_stale_winddown_summary_repaired_*\`

Root goal preserved verbatim:

> ${snapshot.projectGoal}

## Repaired values

- \`strategy_context\`: ${JSON.stringify(snapshot.repaired.strategyContext)}
- \`progress\`: ${JSON.stringify(snapshot.repaired.progress, null, 2)}
- \`summary\`: ${JSON.stringify(snapshot.repaired.summary)}
- \`rollup_summary\`: ${JSON.stringify(snapshot.repaired.rollupSummary)}
- \`context.acceptance_note\`: ${JSON.stringify(snapshot.repaired.acceptanceNote)}
- \`context.current_root_readout\`: ${JSON.stringify(snapshot.repaired.currentRootReadout, null, 2)}

## Expected reviewer/planner readback

After this script, \`bun run task-tree show project\` should stop advertising the June-14 \"Project in wind-down\" / \`accepted: 8, blocked: 0, total: 8\` posture and instead show the repaired root summary, strategy context, progress object, and rollup summary that reference the current loop-driven blocked frontier.`);

console.log(JSON.stringify(snapshot, null, 2));
