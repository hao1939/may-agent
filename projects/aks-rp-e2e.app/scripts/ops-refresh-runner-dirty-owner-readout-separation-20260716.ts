import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import { saveTaskTreeWithKanbanSnapshot, taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const runnerOwnerTaskId = "domain/cleanup-runner-batched-ado-queue-helper-shared-checkout-20260716";
const staleRunnerOwnerTaskId = "domain/normalize-scenario-net-integration-five-spec-batch-20260716";
const egressOwnerTaskId = "verify-spec-egress-lockdown-windows-baseline";
const staleEgressOwnerTaskId = "verify-spec-egress-lockdown-windows-baseline-retry-202607160456-1";

const dirtyOwnerLines = [
  `features/egress-lockdown.yaml -> ${egressOwnerTaskId}`,
  `features/egress-lockdown/specs/egress-lockdown-windows-baseline.json -> ${egressOwnerTaskId}`,
  `features/egress-lockdown/tests/egress-lockdown-windows-baseline.test.ts -> ${egressOwnerTaskId}`,
  `features/egress-lockdown/tests/egress-lockdown-windows-baseline.ts -> ${egressOwnerTaskId}`,
  `package.json -> ${runnerOwnerTaskId}`,
  `runner/ci/queue-ado-spec-batch.ts -> ${runnerOwnerTaskId}`,
  `runner/README.md -> ${runnerOwnerTaskId}`,
];

const dirtyOwnerSentence = `Dirty domain repo ownership remains explicit: ${dirtyOwnerLines.join("; ")}.`;
const dirtyOwnerVerifiedSentence = `Dirty domain repo ownership is no longer anonymous: ${dirtyOwnerLines.join("; ")}.`;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: "app-ops",
  maxConcurrent: 1,
});

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

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function replaceDirtySentence(values: string[], replacement: string, startsWith: string): string[] {
  return values.map((value) => (value.startsWith(startsWith) ? replacement : value));
}

const beforeTaskTree = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks.project;
  if (!projectTask) throw new Error("Task not found: project");
  if (!tree.tasks[runnerOwnerTaskId]) throw new Error(`Task not found: ${runnerOwnerTaskId}`);
  if (!tree.tasks[egressOwnerTaskId]) throw new Error(`Task not found: ${egressOwnerTaskId}`);
  if (!tree.tasks["domain/publish-rp-regional-quota-review-visible-20260716"]) {
    throw new Error("Task not found: domain/publish-rp-regional-quota-review-visible-20260716");
  }

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const proposalContext = asRecord(currentFocusProposal.context);
  const laneLinks = asRecord(proposalContext.lane_links);
  const progressReview = asRecord(proposalContext.progress_review);
  const answers = asRecord(progressReview.answers);

  const before = {
    successCriteria: asStringArray(proposalContext.success_criteria),
    dirtyOwners: asStringArray(laneLinks.dirty_domain_repo_owners),
    learnedOrVerified: asStringArray(answers.learned_or_verified),
  };

  proposalContext.success_criteria = replaceDirtySentence(
    before.successCriteria,
    dirtyOwnerSentence,
    "Dirty domain repo ownership remains explicit:",
  );
  laneLinks.dirty_domain_repo_owners = [...dirtyOwnerLines];
  answers.learned_or_verified = replaceDirtySentence(
    before.learnedOrVerified,
    dirtyOwnerVerifiedSentence,
    "Dirty domain repo ownership is no longer anonymous:",
  );

  progressReview.answers = answers;
  proposalContext.progress_review = progressReview;
  proposalContext.lane_links = laneLinks;
  currentFocusProposal.context = proposalContext;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.updated_at = appliedAt;
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    runner_dirty_owner_readout_refreshed_at: appliedAt,
    runner_dirty_owner_readout_refreshed_by: "app-ops-script",
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    before,
    after: {
      successCriteria: asStringArray(proposalContext.success_criteria),
      dirtyOwners: asStringArray(laneLinks.dirty_domain_repo_owners),
      learnedOrVerified: asStringArray(answers.learned_or_verified),
    },
    runnerOwnerState: nodeState(tree.tasks[runnerOwnerTaskId]),
    egressOwnerState: nodeState(tree.tasks[egressOwnerTaskId]),
    rpRegionalQuotaState: nodeState(tree.tasks["domain/publish-rp-regional-quota-review-visible-20260716"]),
  };
});

const runtime = loadProjectReadModel(appDir);
const currentFocus = asRecord(runtime.currentFocus);
const focusMission = asRecord(currentFocus.focusMission);
const beforeRuntimeSuccessCriteria = asStringArray(focusMission.successCriteria);
focusMission.successCriteria = replaceDirtySentence(
  beforeRuntimeSuccessCriteria,
  dirtyOwnerSentence,
  "Dirty domain repo ownership remains explicit:",
);
currentFocus.focusMission = focusMission;
saveProjectRuntimeState(appDir, {
  ...runtime,
  currentFocus,
  updatedAt: appliedAt,
});

const sourceTreePath = resolve(appDir, "tasks/tree.json");
const runtimeModuleMirrorPath = resolve(
  appDir,
  ".state/runtime-modules/_app_projects_aks-rp-e2e.app/tasks/tree.json",
);
if (existsSync(sourceTreePath) && existsSync(runtimeModuleMirrorPath)) {
  writeFileSync(runtimeModuleMirrorPath, readFileSync(sourceTreePath, "utf8"));
}

const afterRuntime = JSON.parse(readFileSync(resolve(appDir, ".state/project-state.json"), "utf8")) as JsonRecord;
const afterCurrentFocus = asRecord(afterRuntime.currentFocus);
const afterFocusMission = asRecord(afterCurrentFocus.focusMission);

console.log(
  JSON.stringify(
    {
      appliedAt,
      runnerOwnerTaskId,
      staleRunnerOwnerTaskId,
      egressOwnerTaskId,
      staleEgressOwnerTaskId,
      beforeTaskTree,
      beforeRuntimeSuccessCriteria,
      afterRuntimeSuccessCriteria: asStringArray(afterFocusMission.successCriteria),
      dirtyOwnerLines,
    },
    null,
    2,
  ),
);
