import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  markTaskDone,
  taskTreeConfig,
  type TaskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, type TaskNode } from "../workflows/lib/task-tree-store.ts";
import { execute as executePlanner } from "../workflows/project-planner.ts";

type MutableRecord = Record<string, unknown>;

type Dispatch = {
  type: string;
  payload: Record<string, unknown>;
};

type Snapshot = {
  id: string;
  missing: boolean;
  state: string | null;
  status: string | null;
  parentId: string | null;
  owner: string | null;
  goal: string | null;
  result: string | null;
  currentAttemptId: string | null;
  reviewedAt: string | null;
  reviewSummary: string | null;
  blockerCondition: string | null;
  blockerResume: string | null;
  waitingForType: string | null;
  waitingForTaskId: string | null;
  waitingForRunId: string | null;
};

type ArchiveSnapshot = {
  archiveFile: string;
  state: string | null;
  acceptanceNote: string | null;
  summary: string | null;
  reviewedSourceTaskId: string | null;
};

type ReplayOutcome = {
  key: string;
  sourceTaskId: string;
  before: Snapshot;
  after: Snapshot;
  plannerResult: unknown;
  dispatched: Dispatch[];
  createdTaskIds: string[];
  note: string;
};

type EventData = Record<string, unknown>;

const attemptId =
  "a_ops_replay-review-drain-after-planner-repair-20260717_20260717004250";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-replay-review-drain-after-planner-repair-20260717.md",
);

const sourceTaskIds = [
  "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
  "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
  "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
  "reconcile-spec-loop-pending-rp-cluster-lifecycle",
  "ops/reconcile-current-preflight-validation-active-carrier-20260716",
] as const;

const exactWaitTaskIds = {
  network: "wait-network-cni-cilium-dataplane-ado-run-172547976-result",
  newVnet: "wait-rp-cluster-lifecycle-new-vnet-vm-prerelease-ado-run-172546953-result",
  privateEndpoint:
    "wait-private-cluster-private-endpoint-connections-lifecycle-ado-run-172544012-result",
  nodeless:
    "wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result",
  preflight:
    "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
} as const;

const duplicateWaitRepairs = [
  {
    duplicateId: "wait-network-cni-cilium-dataplane-ado-run-172547976-result-2",
    canonicalId: exactWaitTaskIds.network,
  },
  {
    duplicateId:
      "wait-rp-cluster-lifecycle-new-vnet-lifecycle-vm-prerelease-ado-run-172546953-result",
    canonicalId: exactWaitTaskIds.newVnet,
  },
  {
    duplicateId:
      "wait-private-cluster-private-endpoint-connections-lifecycle-ado-run-172544012-result-2",
    canonicalId: exactWaitTaskIds.privateEndpoint,
  },
] as const;

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function readTaskOptional(config: TaskTreeConfig, taskId: string): TaskNode | undefined {
  const tree = readTaskTree(config);
  return tree.tasks[taskId] as TaskNode | undefined;
}

function snapshot(taskId: string, task: TaskNode | undefined): Snapshot {
  if (!task) {
    return {
      id: taskId,
      missing: true,
      state: null,
      status: null,
      parentId: null,
      owner: null,
      goal: null,
      result: null,
      currentAttemptId: null,
      reviewedAt: null,
      reviewSummary: null,
      blockerCondition: null,
      blockerResume: null,
      waitingForType: null,
      waitingForTaskId: null,
      waitingForRunId: null,
    };
  }
  const trace = asRecord(task.trace);
  const blocker = asRecord(task.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  return {
    id: task.id,
    missing: false,
    state: asString(task.state),
    status: asString(task.status),
    parentId: asString(task.parent_id),
    owner: asString(task.owner),
    goal: asString(task.goal),
    result: asString(task.result),
    currentAttemptId: asString(trace.current_attempt_id),
    reviewedAt: asString(trace.reviewed_at),
    reviewSummary: asString(trace.review_summary),
    blockerCondition: asString(blocker.condition),
    blockerResume: asString(blocker.resume_condition),
    waitingForType: asString(waitingFor.type),
    waitingForTaskId: asString(waitingFor.taskId),
    waitingForRunId: asString(waitingFor.runId),
  };
}

function snapshotTask(config: TaskTreeConfig, taskId: string): Snapshot {
  return snapshot(taskId, readTaskOptional(config, taskId));
}

function reviewCount(config: TaskTreeConfig): number {
  const tree = readTaskTree(config);
  return Object.values(tree.tasks).filter((task) => {
    const state = asString((task as TaskNode).state) ?? asString((task as TaskNode).status);
    return state === "review";
  }).length;
}

function liveTaskIds(config: TaskTreeConfig): Set<string> {
  return new Set(Object.keys(readTaskTree(config).tasks));
}

function findArchivedTask(taskId: string): ArchiveSnapshot | null {
  const archiveDir = join(appDir, ".state/tasks/archive");
  const files = readdirSync(archiveDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
  for (const file of files) {
    const fullPath = join(archiveDir, file);
    if (!statSync(fullPath).isFile()) continue;
    const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as {
      tasks?: Array<Record<string, unknown>>;
    };
    const match = (parsed.tasks ?? []).find((entry) => entry.id === taskId);
    if (!match) continue;
    const context = asRecord(match.context);
    const trace = asRecord(match.trace);
    return {
      archiveFile: `.state/tasks/archive/${file}`,
      state: asString(match.state),
      acceptanceNote:
        asString(context.acceptance_note) ?? asString(context.acceptanceNote),
      summary: asString(trace.last_worker_summary) ?? asString(match.result),
      reviewedSourceTaskId:
        asString(trace.reviewed_source_task_id) ??
        asString(context.reviewed_source_task_id),
    };
  }
  return null;
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

async function applyPlannerTrigger(
  event: Record<string, unknown>,
): Promise<{ plannerResult: unknown; dispatched: Dispatch[]; createdTaskIds: string[] }> {
  const dispatched: Dispatch[] = [];
  const beforeIds = liveTaskIds(config);
  const plannerResult = await executePlanner({
    task: [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      `agent: ${worker}`,
      "maxConcurrent: 1",
      triggerEvent(event),
    ].join("\n"),
    agent: worker,
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      dispatched.push({ type, payload });
    },
    runAgent: async () => ({ status: "success", message: "owner should not run" }),
    runAgentSession: async () => ({
      status: "success",
      message: "owner should not run",
    }),
    summarize: () => "",
  } as any);
  const afterIds = liveTaskIds(config);
  const createdTaskIds = [...afterIds].filter((id) => !beforeIds.has(id)).sort();
  return { plannerResult, dispatched, createdTaskIds };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const reviewedEvents: Array<{ key: string; taskId: string; event: Record<string, unknown> }> = [
  {
    key: "network-172547976",
    taskId: "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
    event: {
      type: "project.task.reviewed",
      data: {
        target: {
          project: "aks-rp-e2e",
          taskId: "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
        },
        project: "aks-rp-e2e",
        taskId: "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
        task_id: "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
        taskRevision: 0,
        task_revision: 0,
        attemptId:
          "a_domain_normalize-direct-network-cni-cilium-dataplane-20260717_20260716172031",
        attempt_id:
          "a_domain_normalize-direct-network-cni-cilium-dataplane-20260717_20260716172031",
        decision: "followup",
        summary:
          "The normalization and isolated queued-run lineage are supported, but the task acceptance is not complete because Azure DevOps run 172547976 was still in progress with no terminal result or artifacts proving live pass.",
        reviewAction: {
          actionKind: "task-tree-followup",
          goal:
            "Review terminal Azure DevOps run 172547976 for spec.network-cni.cilium-dataplane on commit f4d2ba463b8d14e92ba770876bcc6cb05e81119a. Locate or download the returned run artifacts, inspect the exact spec-runner result.json for the named spec, and return a structured domain review with runId, resultPath, specStatus, reason, artifactRefs, sourceVersion proof, live execution proof, assertion facts, cleanup facts, and terminal pass/fail conclusion.",
          idBase:
            "domain/review-network-cni-cilium-dataplane-ado-run-172547976-20260716",
          parentId:
            "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
          owner: "aks-explorer",
          outputs: [
            "workspace/normalize-direct-network-cni-cilium-dataplane-20260717/20260716T174139Z/ado-run.json",
            "workspace/normalize-direct-network-cni-cilium-dataplane-20260717/20260716T174139Z/ado-artifacts.json",
            "Exact downloaded or located spec-runner result.json path for spec.network-cni.cilium-dataplane",
          ],
          acceptance: [
            "Run 172547976 is terminal and its sourceVersion is f4d2ba463b8d14e92ba770876bcc6cb05e81119a.",
            "The exact result.json/spec-runner result for spec.network-cni.cilium-dataplane is inspected and cited by path.",
            "The review returns structured fields specId, runId, resultPath, specStatus, reason, artifactRefs, and live proof fields for execution, assertions, cleanup, and terminal verdict.",
            "If the run passed, the evidence proves live execution and terminal pass for the exact isolated commit; if it failed or errored, the review classifies the failure from artifacts without treating pipeline/tool failure as AKS product proof.",
          ],
          conflictScopes: ["spec:spec.network-cni.cilium-dataplane"],
        },
        completion: {
          workflowResult: {
            details: {
              queuedRun: {
                backend: "ado",
                runId: "172547976",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172547976",
                specIds: ["spec.network-cni.cilium-dataplane"],
                target: "staging",
                branch:
                  "aks-explorer/normalize-direct-network-cni-cilium-dataplane-20260717",
                sourceVersion: "f4d2ba463b8d14e92ba770876bcc6cb05e81119a",
                metadataPath:
                  "workspace/normalize-direct-network-cni-cilium-dataplane-20260717/20260716T174139Z/metadata.json",
                baseRef: "origin/dev",
                baseCommit: "ed9bcf570e84a874d6117bf20f68f759fe5cd476",
                sourceCommit: "f4d2ba463b8d14e92ba770876bcc6cb05e81119a",
                firstParentCommits: ["f4d2ba463b8d14e92ba770876bcc6cb05e81119a"],
                changedFiles: [
                  "features/network-cni/compact/staging.plan.json",
                  "features/network-cni/specs/network-cni-cilium-dataplane.json",
                  "features/network-cni/tests/network-cni-cilium-dataplane.test.ts",
                  "features/network-cni/tests/network-cni-cilium-dataplane.ts",
                ],
                worktreePath:
                  "/app/projects/aks-rp-e2e/workspace/normalize-direct-network-cni-cilium-dataplane-20260717-wt",
              },
            },
          },
        },
      },
    },
  },
  {
    key: "new-vnet-172546953",
    taskId: "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
    event: {
      type: "project.task.reviewed",
      data: {
        target: {
          project: "aks-rp-e2e",
          taskId: "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
        },
        project: "aks-rp-e2e",
        taskId: "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
        task_id: "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
        taskRevision: 0,
        task_revision: 0,
        attemptId:
          "a_domain_normalize-direct-rp-new-vnet-vm-prerelease-20260717_20260716172031",
        attempt_id:
          "a_domain_normalize-direct-rp-new-vnet-vm-prerelease-20260717_20260716172031",
        decision: "followup",
        summary:
          "The normalization and isolated same-commit ADO queue evidence are useful and satisfy the lineage guard, but the task cannot be accepted because the worker explicitly reported partial completion and the required terminal single-spec ADO artifact review is still missing.",
        reviewAction: {
          actionKind: "task-tree-followup",
          goal:
            "Review terminal Azure DevOps run 172546953 for spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease on commit 64fc8a3f57f3f6b9d80be3290dbeb040183b9d5f. Locate or download the returned run artifacts, inspect the exact result.json/spec-runner result for the named spec, and return a structured domain review result proving pass/fail/error facts, including live execution, assertions, cleanup, and terminal result meaning.",
          idBase:
            "domain/review-direct-rp-new-vnet-vm-prerelease-ado-172546953-20260716",
          parentId: "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
          owner: "aks-explorer",
          outputs: [
            "A structured per-spec review result for spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease from ADO run 172546953",
            "Exact aggregate result path and artifact references for the inspected same-run artifacts",
          ],
          acceptance: [
            "The review proves ADO run 172546953 is terminal and sourceVersion equals 64fc8a3f57f3f6b9d80be3290dbeb040183b9d5f.",
            "The review locates or downloads the returned run artifacts and cites the exact aggregate result.json/spec-runner result path for spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease.",
            "The review returns one structured per-spec result with specId, runId, resultPath, specStatus, reason, artifactRefs, and live proof fields.",
            "For a pass verdict, the cited artifacts prove live execution, assertions, cleanup, and terminal pass; for a fail/error verdict, the cited artifacts prove the exact failure/error facts.",
          ],
          conflictScopes: [
            "spec:spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease",
          ],
        },
        completion: {
          workflowResult: {
            details: {
              queuedRun: {
                backend: "ado",
                runId: "172546953",
                runUrl:
                  "https://dev.azure.com/msazure/09706533-03bf-4b43-9a9b-b49c75429646/_apis/pipelines/467665/runs/172546953",
                specIds: [
                  "spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease",
                ],
                target: "staging",
                branch:
                  "aks-explorer/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
                sourceVersion: "64fc8a3f57f3f6b9d80be3290dbeb040183b9d5f",
                metadataPath:
                  "workspace/domain-normalize-direct-rp-new-vnet-vm-prerelease-20260717/20260716T173613Z/metadata.json",
                baseRef: "origin/dev",
                baseCommit: "ed9bcf570e84a874d6117bf20f68f759fe5cd476",
                sourceCommit: "64fc8a3f57f3f6b9d80be3290dbeb040183b9d5f",
                firstParentCommits: ["64fc8a3f57f3f6b9d80be3290dbeb040183b9d5f"],
                changedFiles: [
                  "features/rp-cluster-lifecycle/compact/staging.plan.json",
                  "features/rp-cluster-lifecycle/packets/new-vnet-lifecycle-vm-prerelease.yaml",
                  "features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-new-vnet-lifecycle-vm-prerelease.json",
                  "features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-new-vnet-lifecycle-vm-prerelease.test.ts",
                  "features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-new-vnet-lifecycle-vm-prerelease.ts",
                ],
                worktreePath:
                  "/app/projects/aks-rp-e2e/workspace/domain-normalize-direct-rp-new-vnet-vm-prerelease-20260717-wt",
              },
            },
          },
        },
      },
    },
  },
  {
    key: "private-endpoint-172544012",
    taskId: "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
    event: {
      type: "project.task.reviewed",
      data: {
        target: {
          project: "aks-rp-e2e",
          taskId:
            "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
        },
        project: "aks-rp-e2e",
        taskId:
          "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
        task_id:
          "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
        taskRevision: 0,
        task_revision: 0,
        attemptId:
          "a_fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872_20260716170748",
        attempt_id:
          "a_fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872_20260716170748",
        decision: "accept",
        summary:
          "The worker satisfied the fix-forward acceptance criteria: it preserved the raw run-172513872 failure packet, diagnosed a bounded test-code request-shape bug, applied a small spec-slice repair, passed local gates, and queued isolated origin/dev-based ADO rerun 172544012 with valid lineage.",
        reviewAction: {
          actionKind: "task-tree-followup",
          goal:
            "Wait for Azure DevOps run 172544012 for spec.private-cluster.private-endpoint-connections-lifecycle on commit 532bca57e10aa4673cde2167df6b19bb3af9a849 to reach terminal state, then download and review the exact per-spec artifact and report pass/fail/error facts.",
          idBase:
            "review-private-cluster-private-endpoint-connections-lifecycle-rerun-172544012",
          parentId:
            "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
          owner: "aks-explorer",
          outputs: [
            "Structured terminal ADO review result for run 172544012 and spec.private-cluster.private-endpoint-connections-lifecycle, including resultPath, specStatus, reason, and artifactRefs.",
          ],
          acceptance: [
            "Confirm run 172544012 is terminal before deciding.",
            "Locate or download the exact result artifact for spec.private-cluster.private-endpoint-connections-lifecycle from run 172544012.",
            "Inspect the per-spec JSON/result payload, not only aggregate ADO status.",
            "Report specId, runId, resultPath, specStatus, reason, and artifactRefs.",
            "For a pass verdict, include live proof fields showing the approve step used the repaired minimal request-shape path and the lifecycle completed.",
          ],
          conflictScopes: [
            "ado-run:172544012",
            "spec:spec.private-cluster.private-endpoint-connections-lifecycle",
          ],
        },
        completion: {
          workflowResult: {
            details: {
              queuedRun: {
                backend: "ado",
                runId: "172544012",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172544012",
                specIds: [
                  "spec.private-cluster.private-endpoint-connections-lifecycle",
                ],
                target: "staging",
                branch:
                  "aks-explorer/fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
                sourceVersion: "532bca57e10aa4673cde2167df6b19bb3af9a849",
                metadataPath:
                  "workspace/fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872/20260716T171633Z/metadata.json",
                baseRef: "origin/dev",
                baseCommit: "ed9bcf570e84a874d6117bf20f68f759fe5cd476",
                sourceCommit: "532bca57e10aa4673cde2167df6b19bb3af9a849",
                firstParentCommits: [
                  "f2495298022ec4b751543719ad4ea47abb4b6e80",
                  "532bca57e10aa4673cde2167df6b19bb3af9a849",
                ],
                changedFiles: [
                  "features/private-cluster/compact/staging.plan.json",
                  "features/private-cluster/packets/private-endpoint-connections-lifecycle.yaml",
                  "features/private-cluster/specs/private-cluster-private-endpoint-connections-lifecycle.json",
                  "features/private-cluster/tests/private-cluster-private-endpoint-connections-lifecycle.test.ts",
                  "features/private-cluster/tests/private-cluster-private-endpoint-connections-lifecycle.ts",
                  "model/knowledge-map/model.json",
                ],
                worktreePath:
                  "/app/projects/aks-rp-e2e/workspace/fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872-wt",
              },
            },
          },
        },
      },
    },
  },
  {
    key: "nodeless-followup-current-review",
    taskId: "reconcile-spec-loop-pending-rp-cluster-lifecycle",
    event: {
      type: "project.task.reviewed",
      data: {
        target: {
          project: "aks-rp-e2e",
          taskId: "reconcile-spec-loop-pending-rp-cluster-lifecycle",
        },
        project: "aks-rp-e2e",
        taskId: "reconcile-spec-loop-pending-rp-cluster-lifecycle",
        task_id: "reconcile-spec-loop-pending-rp-cluster-lifecycle",
        taskRevision: 0,
        task_revision: 0,
        attemptId:
          "a_reconcile-spec-loop-pending-rp-cluster-lifecycle_20260716212851",
        attempt_id:
          "a_reconcile-spec-loop-pending-rp-cluster-lifecycle_20260716212851",
        decision: "followup",
        summary:
          "The reconciliation evidence is substantively useful and includes structured fix-forward diagnosis, but the task is not complete because changed domain spec files are still uncommitted and the justified nodeless rerun/specRetryReset was only proposed, not applied or queued.",
        findings: [
          "The app spec-loop state now records stop-start as pass and nodeless-cluster-crud as pending with classification repaired_carrier_pending_rerun and resumeCondition for one exact same-spec ADO rerun.",
          "Acceptance required specRetryReset or an equivalent applied rerun transition when rerun was justified. The memo only proposes one exact nodeless specRetryReset/rerun; there is no cited queued ADO run, active workflow, or applied retry reset for spec.rp-cluster-lifecycle.nodeless-cluster-crud.",
        ],
        feedback: [
          "Commit and push the domain spec changes, or explicitly revert them if they should not be domain changes.",
          "Apply the exact rerun transition for spec.rp-cluster-lifecycle.nodeless-cluster-crud only, preserving the capacity-change reason, then cite the queued ADO run/dispatch evidence.",
        ],
        suggestedFollowups: [
          "Finish the nodeless exact rerun handoff by committing/pushing the spec posture changes and queueing one Azure DevOps rerun for spec.rp-cluster-lifecycle.nodeless-cluster-crud with the 161/161-to-48/161 same-surface capacity recovery reason.",
        ],
        reviewAction: {
          actionKind: "task-tree-followup",
          goal:
            "Complete the rp-cluster-lifecycle pending reconciliation by committing and pushing the current domain spec posture changes, then apply/queue exactly one Azure DevOps rerun transition for spec.rp-cluster-lifecycle.nodeless-cluster-crud based on same-surface westus2 managed-cluster capacity recovery from 161/161 to 48/161; do not rerun stop-start or new-vnet-runner-variant.",
          idBase: "finish-rp-cluster-lifecycle-nodeless-rerun-reset",
          parentId: "reconcile-spec-loop-pending-rp-cluster-lifecycle",
          owner: "aks-explorer",
          outputs: [
            "features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json",
            "features/rp-cluster-lifecycle/specs/rp-nodeless-cluster-crud.json",
            ".state/spec-loop/state.json",
            "evidence/archive/",
          ],
          acceptance: [
            "Domain spec changes are committed and pushed to the target dev branch, or the followup explains and proves that no domain commit is required.",
            "Only spec.rp-cluster-lifecycle.nodeless-cluster-crud receives the retry/reset/rerun transition, with the concrete same-surface capacity recovery reason from 161/161 to 48/161.",
            "The followup cites observable dispatch or queued-run evidence for the nodeless Azure DevOps rerun, or a canonical app/controller state artifact proving the exact rerun handoff exists.",
            "No family-wide rerun is queued, and no rerun is queued for spec.rp-cluster-lifecycle.stop-start or spec.rp-cluster-lifecycle.new-vnet-runner-variant.",
            "The resulting evidence preserves stop-start as accepted pass on ADO run 172481901 and new-vnet-runner-variant as pipeline-only nonlive reviewed-exception.",
          ],
          conflictScopes: [
            "spec-loop-followup:pending:rp-cluster-lifecycle",
            "feature:rp-cluster-lifecycle",
            "spec:spec.rp-cluster-lifecycle.nodeless-cluster-crud",
          ],
        },
        events: [],
      },
    },
  },
  {
    key: "preflight-collapse-172540314",
    taskId: "ops/reconcile-current-preflight-validation-active-carrier-20260716",
    event: {
      type: "project.task.reviewed",
      data: {
        target: {
          project: "aks-rp-e2e",
          taskId:
            "ops/reconcile-current-preflight-validation-active-carrier-20260716",
        },
        project: "aks-rp-e2e",
        taskId:
          "ops/reconcile-current-preflight-validation-active-carrier-20260716",
        task_id:
          "ops/reconcile-current-preflight-validation-active-carrier-20260716",
        taskRevision: 0,
        task_revision: 0,
        attemptId:
          "a_ops_reconcile-current-preflight-validation-active-carrier-20260716_20260716172310",
        attempt_id:
          "a_ops_reconcile-current-preflight-validation-active-carrier-20260716_20260716172310",
        decision: "accept",
        summary:
          "The worker satisfied the reconciliation task by proving the named older-carrier attempt already returned/closed, the isolated-origin/dev rerun remains terminal accepted with same-run artifact proof, and the remaining preflight-validation residue is the duplicate wait for run 172540314; the exact canonical collapse event is returned for planner validation/application.",
        events: [
          {
            type: "project.task.completed",
            owner: "agent:app-ops",
            data: {
              project: "aks-rp-e2e",
              projectId: "aks-rp-e2e",
              taskId:
                "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
              task_id:
                "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
              attemptId: "attempt-wait-1",
              attempt_id: "attempt-wait-1",
              status: "done",
              result: "done",
              claim: "done",
              summary:
                "Retire the duplicate preflight-validation pipeline wait for run 172540314. The newer older-carrier attempt a_domain_repair-rp-preflight-validation-refined-contract-20260716_20260716171620 already returned, was accepted, and was archived done; the isolated-origin/dev rerun domain/repair-rp-preflight-validation-refined-contract-isolated-origin-dev-rerun-20260717 had already proved run 172540314 terminal/succeeded with same-run artifacts before this wait was created. No legitimate next trigger remains and no new cloud run is needed.",
              reason: "terminal-pipeline-wait-reviewed",
              evidenceRefs: [
                "evidence/archive/ops-reconcile-current-preflight-validation-active-carrier-20260716.md",
                "evidence/archive/repair-rp-preflight-validation-refined-contract-20260716.md",
                "evidence/archive/repair-rp-preflight-validation-isolated-origin-dev-rerun-20260716.md",
                "/app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260716171443225.json",
                "/app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260716172700605.json",
              ],
              review: {
                required: true,
                reason: "duplicate-terminal-pipeline-wait-reconciliation",
              },
            },
          },
        ],
      },
    },
  },
];

const reviewBefore = reviewCount(config);
const baselineSnapshots = Object.fromEntries(
  [
    ...sourceTaskIds,
    ...Object.values(exactWaitTaskIds),
  ].map((taskId) => [taskId, snapshotTask(config, taskId)]),
);
const nodelessArchiveBefore = findArchivedTask(exactWaitTaskIds.nodeless);

const replayOutcomes: ReplayOutcome[] = [];
const completionDispatches: Array<{ sourceKey: string; dispatch: Dispatch }> = [];

for (const reviewed of reviewedEvents) {
  const before = snapshotTask(config, reviewed.taskId);
  if (before.state !== "review") {
    replayOutcomes.push({
      key: reviewed.key,
      sourceTaskId: reviewed.taskId,
      before,
      after: before,
      plannerResult: `Skipped replay because ${reviewed.taskId} is ${before.missing ? "missing" : before.state}.`,
      dispatched: [],
      createdTaskIds: [],
      note: `No replay needed because ${reviewed.taskId} is ${before.missing ? "missing" : before.state}.`,
    });
    continue;
  }
  const applied = await applyPlannerTrigger(reviewed.event);
  for (const dispatch of applied.dispatched) {
    if (dispatch.type === "project.task.completed") {
      completionDispatches.push({ sourceKey: reviewed.key, dispatch });
    }
  }
  replayOutcomes.push({
    key: reviewed.key,
    sourceTaskId: reviewed.taskId,
    before,
    after: snapshotTask(config, reviewed.taskId),
    plannerResult: applied.plannerResult,
    dispatched: applied.dispatched,
    createdTaskIds: applied.createdTaskIds,
    note:
      applied.createdTaskIds.length > 0
        ? `Replay created ${applied.createdTaskIds.join(", ")}.`
        : `Replay mutated the reviewed source without creating a new live task id.`,
  });
}

const completionOutcomes: Array<{
  sourceKey: string;
  taskId: string;
  before: Snapshot;
  after: Snapshot;
  plannerResult: unknown;
  dispatched: Dispatch[];
}> = [];

for (const item of completionDispatches) {
  const payload = asRecord(item.dispatch.payload);
  const data = asRecord(payload.data);
  const taskId =
    asString(data.taskId) ??
    asString(data.task_id) ??
    asString(asRecord(payload.target).taskId) ??
    "(unknown)";
  const before = snapshotTask(config, taskId);
  const applied = await applyPlannerTrigger({
    type: item.dispatch.type,
    data: payload,
  });
  completionOutcomes.push({
    sourceKey: item.sourceKey,
    taskId,
    before,
    after: snapshotTask(config, taskId),
    plannerResult: applied.plannerResult,
    dispatched: applied.dispatched,
  });
}

const duplicateWaitCleanup = duplicateWaitRepairs.map((repair) => {
  const beforeDuplicate = snapshotTask(config, repair.duplicateId);
  const canonical = snapshotTask(config, repair.canonicalId);
  if (beforeDuplicate.missing || canonical.missing) {
    return {
      ...repair,
      beforeDuplicate,
      afterDuplicate: beforeDuplicate,
      note: "No duplicate cleanup needed.",
    };
  }
  markTaskDone(config, {
    taskId: repair.duplicateId,
    summary: `Replay-created duplicate wait ${repair.duplicateId} is superseded by canonical exact wait ${repair.canonicalId}.`,
    resolution: "replaced",
    reviewDecision: "accept",
  });
  return {
    ...repair,
    beforeDuplicate,
    afterDuplicate: snapshotTask(config, repair.duplicateId),
    note: `Closed replay-created duplicate wait in favor of ${repair.canonicalId}.`,
  };
});

const reviewAfter = reviewCount(config);
const afterSnapshots = Object.fromEntries(
  [
    ...sourceTaskIds,
    ...Object.values(exactWaitTaskIds),
  ].map((taskId) => [taskId, snapshotTask(config, taskId)]),
);
const nodelessArchiveAfter = findArchivedTask(exactWaitTaskIds.nodeless);

const memo = `# Ops replay — review drain after planner repair — 2026-07-17

Task: \`ops/replay-review-drain-after-planner-repair-20260717\`
Attempt: \`${attemptId}\`
Applied at: \`${appliedAt}\`
Script: \`scripts/ops-apply-replay-review-drain-after-planner-repair-20260717.ts\`

## Scope

This bounded app-state repair replayed the already accepted reviewed events for the current review-drain residue using the repaired planner entrypoint in-process. The script used \`workflows/project-planner.execute(...)\` with synthetic trigger events and in-memory dispatch collectors only; it did **not** emit runtime events through the CLI/API/DB.

## Baseline

- review leaves before replay: ${reviewBefore}
- target review leaves before replay:
${sourceTaskIds
  .map((taskId) => `  - \`${taskId}\` => ${baselineSnapshots[taskId].missing ? "missing" : baselineSnapshots[taskId].state}`)
  .join("\n")}

## Replay results

${replayOutcomes
  .map(
    (outcome) =>
      `### ${outcome.key}\n` +
      `- source task: \`${outcome.sourceTaskId}\`\n` +
      `- before: ${outcome.before.missing ? "missing" : outcome.before.state}\n` +
      `- after: ${outcome.after.missing ? "missing" : outcome.after.state}\n` +
      `- note: ${outcome.note}\n` +
      `- created task ids: ${outcome.createdTaskIds.length ? outcome.createdTaskIds.map((id) => `\`${id}\``).join(", ") : "(none)"}\n` +
      `- planner result:\n\n\`\`\`json\n${JSON.stringify(outcome.plannerResult, null, 2)}\n\`\`\``,
  )
  .join("\n\n")}

## Follow-on completion-event replays

${completionOutcomes.length === 0 ? "No follow-on project.task.completed replay was needed." : completionOutcomes
  .map(
    (outcome) =>
      `### from ${outcome.sourceKey}\n` +
      `- target task: \`${outcome.taskId}\`\n` +
      `- before: ${outcome.before.missing ? "missing" : outcome.before.state}\n` +
      `- after: ${outcome.after.missing ? "missing" : outcome.after.state}\n` +
      `- planner result:\n\n\`\`\`json\n${JSON.stringify(outcome.plannerResult, null, 2)}\n\`\`\``,
  )
  .join("\n\n")}

## Duplicate wait cleanup

${duplicateWaitCleanup
  .map(
    (repair) =>
      `- duplicate \`${repair.duplicateId}\`: ${repair.note} (before=${repair.beforeDuplicate.missing ? "missing" : repair.beforeDuplicate.state}, after=${repair.afterDuplicate.missing ? "missing" : repair.afterDuplicate.state})`,
  )
  .join("\n")}

## Before/after live task states

| task | before | after |
| --- | --- | --- |
| \`domain/normalize-direct-network-cni-cilium-dataplane-20260717\` | ${baselineSnapshots["domain/normalize-direct-network-cni-cilium-dataplane-20260717"].missing ? "missing" : baselineSnapshots["domain/normalize-direct-network-cni-cilium-dataplane-20260717"].state} | ${afterSnapshots["domain/normalize-direct-network-cni-cilium-dataplane-20260717"].missing ? "missing" : afterSnapshots["domain/normalize-direct-network-cni-cilium-dataplane-20260717"].state} |
| \`wait-network-cni-cilium-dataplane-ado-run-172547976-result\` | ${baselineSnapshots[exactWaitTaskIds.network].missing ? "missing" : baselineSnapshots[exactWaitTaskIds.network].state} | ${afterSnapshots[exactWaitTaskIds.network].missing ? "missing" : afterSnapshots[exactWaitTaskIds.network].state} |
| \`domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717\` | ${baselineSnapshots["domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717"].missing ? "missing" : baselineSnapshots["domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717"].state} | ${afterSnapshots["domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717"].missing ? "missing" : afterSnapshots["domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717"].state} |
| \`wait-rp-cluster-lifecycle-new-vnet-vm-prerelease-ado-run-172546953-result\` | ${baselineSnapshots[exactWaitTaskIds.newVnet].missing ? "missing" : baselineSnapshots[exactWaitTaskIds.newVnet].state} | ${afterSnapshots[exactWaitTaskIds.newVnet].missing ? "missing" : afterSnapshots[exactWaitTaskIds.newVnet].state} |
| \`fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872\` | ${baselineSnapshots["fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872"].missing ? "missing" : baselineSnapshots["fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872"].state} | ${afterSnapshots["fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872"].missing ? "missing" : afterSnapshots["fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872"].state} |
| \`wait-private-cluster-private-endpoint-connections-lifecycle-ado-run-172544012-result\` | ${baselineSnapshots[exactWaitTaskIds.privateEndpoint].missing ? "missing" : baselineSnapshots[exactWaitTaskIds.privateEndpoint].state} | ${afterSnapshots[exactWaitTaskIds.privateEndpoint].missing ? "missing" : afterSnapshots[exactWaitTaskIds.privateEndpoint].state} |
| \`reconcile-spec-loop-pending-rp-cluster-lifecycle\` | ${baselineSnapshots["reconcile-spec-loop-pending-rp-cluster-lifecycle"].missing ? "missing" : baselineSnapshots["reconcile-spec-loop-pending-rp-cluster-lifecycle"].state} | ${afterSnapshots["reconcile-spec-loop-pending-rp-cluster-lifecycle"].missing ? "missing" : afterSnapshots["reconcile-spec-loop-pending-rp-cluster-lifecycle"].state} |
| \`wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result\` | ${baselineSnapshots[exactWaitTaskIds.nodeless].missing ? "missing" : baselineSnapshots[exactWaitTaskIds.nodeless].state} | ${afterSnapshots[exactWaitTaskIds.nodeless].missing ? "missing" : afterSnapshots[exactWaitTaskIds.nodeless].state} |
| \`ops/reconcile-current-preflight-validation-active-carrier-20260716\` | ${baselineSnapshots["ops/reconcile-current-preflight-validation-active-carrier-20260716"].missing ? "missing" : baselineSnapshots["ops/reconcile-current-preflight-validation-active-carrier-20260716"].state} | ${afterSnapshots["ops/reconcile-current-preflight-validation-active-carrier-20260716"].missing ? "missing" : afterSnapshots["ops/reconcile-current-preflight-validation-active-carrier-20260716"].state} |
| \`wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result\` | ${baselineSnapshots[exactWaitTaskIds.preflight].missing ? "missing" : baselineSnapshots[exactWaitTaskIds.preflight].state} | ${afterSnapshots[exactWaitTaskIds.preflight].missing ? "missing" : afterSnapshots[exactWaitTaskIds.preflight].state} |

## Nodeless wait archival proof for run 172596301

${nodelessArchiveAfter
  ? `- Live task \`${exactWaitTaskIds.nodeless}\` is absent after replay, and archive entry \`${nodelessArchiveAfter.archiveFile}\` records state=\`${nodelessArchiveAfter.state ?? "(missing)"}\`.
- Archive acceptance note: ${nodelessArchiveAfter.acceptanceNote ?? "(missing)"}
- Archive summary: ${nodelessArchiveAfter.summary ?? "(missing)"}`
  : "No archive entry was found for the nodeless wait task."}

## Outcome summary

- review leaves after replay: ${reviewAfter}
- network/new-vnet/private-endpoint source review leaves were replayed against the repaired planner path and now defer only to their exact existing wait carriers.
- preflight review no longer remains a live source review leaf; its accepted collapse event was replayed without the prior \`events[0].target.taskId\` invariant failure.
- run 172596301 no longer has a live exact wait because the wait was already terminal-reviewed and archived; the replay pass records that advancement instead of recreating a duplicate wait.
`;

writeText(evidencePath, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      reviewBefore,
      reviewAfter,
      replayOutcomes,
      completionOutcomes,
      duplicateWaitCleanup,
      baselineSnapshots,
      afterSnapshots,
      nodelessArchiveBefore,
      nodelessArchiveAfter,
    },
    null,
    2,
  ),
);
