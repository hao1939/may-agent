import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type ArchiveBundle = {
  tasks?: Array<{
    id?: unknown;
    resolution?: unknown;
    trace?: {
      compact_holder_projection_replacement_task_ids?: unknown;
    };
  }>;
};

const attemptId =
  "a_ops_repair-virtualmachines-agentpool-frontier-represented-taskid-drift-20260714_20260714001419";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const repairedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-repair-virtualmachines-agentpool-frontier-represented-taskid-drift-20260714.md";
const featureKey = "virtualmachines-agentpool";
const compactLoopTaskId = "aks-feature-compact-loop";
const familyHolderTaskId =
  "hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b";
const cliHolderTaskId =
  "hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713";
const staleRepresentedTaskIds = [
  "hold-compact-virtualmachines-agentpool-managedsystem-combined-terminal-product-gap-frontier-20260713",
  "hold-compact-virtualmachines-agentpool-pool-delete-rest-intentional-shared-carrier-only-frontier-20260713",
  "hold-compact-virtualmachines-agentpool-vmas-to-vms-migration-slb-deprecated-surface-frontier-20260713",
] as const;
const liveRepresentedTaskIds = [
  "hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708",
  "hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708",
  "hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708",
  cliHolderTaskId,
  familyHolderTaskId,
] as const;
const archiveFiles = [
  ".state/tasks/archive/done-leaves-20260713133012225.json",
  ".state/tasks/archive/done-leaves-20260713195753938.json",
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function ensureTaskExists(tasks: Record<string, TaskNode>, taskId: string): TaskNode {
  const task = tasks[taskId];
  if (!task) throw new Error(`Missing live task ${taskId}`);
  return task;
}

function readRepresentedTaskIds(task: TaskNode): string[] {
  const blocker = asRecord(task.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  return asStringArray(waitingFor.representedTaskIds);
}

function setRepresentedTaskIds(task: TaskNode, representedTaskIds: string[]): void {
  const blocker = asRecord(task.blocker);
  if (!Object.keys(blocker).length) {
    throw new Error(`Task ${task.id} is missing blocker metadata`);
  }
  const waitingFor = asRecord(blocker.waiting_for);
  blocker.waiting_for = {
    ...waitingFor,
    representedTaskIds: [...representedTaskIds],
  };
  task.blocker = blocker;
}

function archiveReplacementProof(path: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(resolve(appDir, path), "utf8")) as ArchiveBundle;
  const proof: Record<string, unknown> = {};
  for (const staleTaskId of staleRepresentedTaskIds) {
    const match = parsed.tasks?.find((task) => task.id === staleTaskId);
    if (!match) throw new Error(`Archive ${path} missing ${staleTaskId}`);
    const replacementTaskIds = asStringArray(
      match.trace?.compact_holder_projection_replacement_task_ids,
    );
    if (match.resolution !== "replaced") {
      throw new Error(`Archive ${path} has unexpected resolution for ${staleTaskId}`);
    }
    if (!replacementTaskIds.includes(cliHolderTaskId)) {
      throw new Error(
        `Archive ${path} does not point ${staleTaskId} at ${cliHolderTaskId}`,
      );
    }
    proof[staleTaskId] = {
      resolution: match.resolution,
      replacementTaskIds,
    };
  }
  return proof;
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const archiveProof = Object.fromEntries(
  archiveFiles.map((path) => [path, archiveReplacementProof(path)]),
);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactBefore = compactState.features[featureKey];
if (!compactBefore) throw new Error(`Missing compact state for ${featureKey}`);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  for (const taskId of liveRepresentedTaskIds) ensureTaskExists(tree.tasks, taskId);
  const familyHolder = ensureTaskExists(tree.tasks, familyHolderTaskId);
  const cliHolder = ensureTaskExists(tree.tasks, cliHolderTaskId);

  for (const staleTaskId of staleRepresentedTaskIds) {
    if (tree.tasks[staleTaskId]) {
      throw new Error(`Expected stale represented task to be archived, but it is still live: ${staleTaskId}`);
    }
  }

  const before = {
    family: readRepresentedTaskIds(familyHolder),
    cli: readRepresentedTaskIds(cliHolder),
  };

  if (!staleRepresentedTaskIds.every((taskId) => before.family.includes(taskId))) {
    throw new Error(
      `Family holder no longer contains the expected stale represented ids: ${JSON.stringify(before.family)}`,
    );
  }
  if (!staleRepresentedTaskIds.every((taskId) => before.cli.includes(taskId))) {
    throw new Error(
      `CLI holder no longer contains the expected stale represented ids: ${JSON.stringify(before.cli)}`,
    );
  }

  setRepresentedTaskIds(familyHolder, [...liveRepresentedTaskIds]);
  setRepresentedTaskIds(cliHolder, [...liveRepresentedTaskIds]);

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    before,
    after: {
      family: readRepresentedTaskIds(familyHolder),
      cli: readRepresentedTaskIds(cliHolder),
    },
  };
});

const attemptedFixes = unique([
  ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
  `${attemptId}: removed three archived virtualmachines-agentpool holder ids from controller-visible waitingFor/frontier metadata after proving both 2026-07-13 archive bundles intentionally replaced those stale projections with ${cliHolderTaskId}.`,
]);
const evidencePaths = unique([
  ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
  memoPath,
  ...archiveFiles,
  "evidence/archive/ops-reconcile-virtualmachines-agentpool-live-holder-mapping-20260713.md",
]);
const summary =
  "Repaired the virtualmachines-agentpool compact represented-task drift by removing three archived holder ids from the controller-visible frontier. The live represented set now contains only auto-zone, row61, row75/row76, cli-add-multi-sku, and the maintained family holder; the archived managedsystem/pool-delete/vmas holders remain documented as intentional compact_holder_projection_replaced history.";

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: cliHolderTaskId,
  frontierTaskIds: [...liveRepresentedTaskIds],
  retryReason: compactBefore.retryReason ?? compactBefore.resumeCondition ?? null,
  ownerReason:
    "The three missing 20260713 exact holders were intentionally archived as compact_holder_projection_replaced history with replacement_task_ids=[hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713]. Preserve the truthful current frontier as five live represented task ids plus the maintained family summary, without reopening unchanged compact execution.",
  attemptedFixes,
  nextStepClassification:
    "preserve the exact live five-task represented frontier plus maintained family summary and re-review at the next holder watch window unless one represented same-surface frontier changes earlier",
  blockedReason: compactBefore.blockedReason ?? null,
  waitingFor: {
    ...asRecord(compactBefore.waitingFor),
    type: "frontier.changed",
    taskId: familyHolderTaskId,
    featureKey,
    representedTaskIds: [...liveRepresentedTaskIds],
  },
  waitingCondition: compactBefore.waitingCondition ?? compactBefore.resumeCondition ?? null,
  observedBy: compactBefore.observedBy ?? null,
  observationMethod: compactBefore.observationMethod ?? null,
  nextCheckAt: compactBefore.nextCheckAt ?? null,
  blockerOwner: compactBefore.blockerOwner ?? null,
  fallbackAt: compactBefore.fallbackAt ?? null,
  fallbackAction: compactBefore.fallbackAction ?? null,
  resumeAction:
    "Keep the compact branch blocked until one live represented holder materially changes or the next blocked-frontier family review intentionally remodels the frontier.",
  blockedScope: compactBefore.blockedScope ?? null,
  blockedFingerprint: compactBefore.blockedFingerprint ?? null,
  lastCheckedAt: repairedAt,
  evidencePaths,
  reviewEvidencePath: memoPath,
  verificationBlocker:
    "Do not rerun unchanged. This repair is metadata-only: it removes stale archived-holder residue from controller-visible represented-task references while preserving the existing compact frontier meaning.",
  summary,
  lastSummary: summary,
});

saveFeatureCompactLoopState(compactStatePath, compactState);
const compactAfter = compactState.features[featureKey];

const memo = `# Ops repair — virtualmachines-agentpool frontier representedTaskId drift (2026-07-14)\n\nTask: \`ops/repair-virtualmachines-agentpool-frontier-represented-taskid-drift-20260714\`\nAttempt: \`${attemptId}\`\nChecked at: \`${repairedAt}\`\n\n## Result\n\nRepaired the two live virtualmachines-agentpool compact holders and the controller-visible compact state so their \`waiting_for.representedTaskIds\` / \`waitingFor.representedTaskIds\` now point only at live task ids.\n\nThe three missing represented ids were **not accidental disappearance**. Both archive bundles \`${archiveFiles[0]}\` and \`${archiveFiles[1]}\` record them as intentionally archived with \`resolution: "replaced"\` and \`compact_holder_projection_replacement_task_ids = [\"${cliHolderTaskId}\"]\`. The drift came from stale represented-task metadata that still named those archived holder ids after the projection replacement.\n\n## Live holders repaired\n\n- \`${familyHolderTaskId}\`\n- \`${cliHolderTaskId}\`\n\n## Pre-repair representedTaskIds drift\n\n### Family holder before\n\n\`\`\`json\n${JSON.stringify(treeMutation.before.family, null, 2)}\n\`\`\`\n\n### CLI holder before\n\n\`\`\`json\n${JSON.stringify(treeMutation.before.cli, null, 2)}\n\`\`\`\n\nBoth sets still named these archived ids:\n\n- \`${staleRepresentedTaskIds[0]}\`\n- \`${staleRepresentedTaskIds[1]}\`\n- \`${staleRepresentedTaskIds[2]}\`\n\n## Archive proof: intentional archive/replacement, not missing live work\n\n\`\`\`json\n${JSON.stringify(archiveProof, null, 2)}\n\`\`\`\n\nInterpretation: the three missing holders were intentionally moved to archive twice during 2026-07-13 planner maintenance after the feature-compact-loop controller marked them \`resolution: \"replaced\"\`. The stale residue was the represented-task metadata that was never reduced afterward.\n\n## Applied repair\n\n### Post-repair live represented task set\n\n\`\`\`json\n${JSON.stringify(liveRepresentedTaskIds, null, 2)}\n\`\`\`\n\nThis keeps only live task ids:\n\n- auto-zone exact holder\n- row61 exact holder\n- row75/row76 exact holder\n- CLI multi-SKU exact holder\n- maintained family holder\n\n### Holder metadata after\n\n#### Family holder after\n\n\`\`\`json\n${JSON.stringify(treeMutation.after.family, null, 2)}\n\`\`\`\n\n#### CLI holder after\n\n\`\`\`json\n${JSON.stringify(treeMutation.after.cli, null, 2)}\n\`\`\`\n\n### Controller-visible compact state after\n\n\`\`\`json\n${JSON.stringify(
  {
    taskId: compactAfter?.taskId ?? null,
    frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
    waitingFor: compactAfter?.waitingFor ?? null,
    reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
  },
  null,
  2,
)}\n\`\`\`\n\n## Acceptance check\n\n- Both live holders now keep only live \`representedTaskIds\`: **yes**\n- The three missing represented ids are documented as intentionally archived/replaced rather than unexplained disappearance: **yes**\n- The repair used the smallest bounded metadata/projection change and did not reopen domain execution: **yes**\n\n## Notes\n\nI intentionally left the broader family-holder narrative text unchanged. This task repaired the audit-driving represented-task references and the compact-loop projection surface without remodeling the virtualmachines-agentpool frontier semantics or reopening compact/spec execution.`;

const memoAbsolute = resolve(appDir, memoPath);
mkdirSync(dirname(memoAbsolute), { recursive: true });
writeFileSync(memoAbsolute, `${memo}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      memoPath,
      archiveFiles,
      staleRepresentedTaskIds,
      liveRepresentedTaskIds,
      treeMutation,
      compactBefore: {
        taskId: compactBefore.taskId ?? null,
        frontierTaskIds: compactBefore.frontierTaskIds ?? null,
        waitingFor: compactBefore.waitingFor ?? null,
      },
      compactAfter: {
        taskId: compactAfter?.taskId ?? null,
        frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
        waitingFor: compactAfter?.waitingFor ?? null,
      },
    },
    null,
    2,
  ),
);
