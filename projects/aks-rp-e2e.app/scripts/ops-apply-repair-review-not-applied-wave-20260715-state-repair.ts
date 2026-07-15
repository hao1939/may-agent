import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createTask,
  markTaskDone,
  readTask,
  taskTreeConfig,
  type TaskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type RepairEntry = {
  eventId: number;
  taskId: string;
  attemptId: string;
};

const attemptId =
  "a_ops-apply-repair-review-not-applied-wave-20260715-state-repair_20260715084050";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();
const evidencePath =
  "evidence/archive/ops-apply-repair-review-not-applied-wave-20260715-state-repair.md";
const networkSourceTaskId = "domain/compact-network-cni-ready-subset-followup-20260715";
const networkSuccessorTaskId =
  "domain/compact-network-cni-ready-subset-followup-20260715-domain-followup";
const networkRunId = "172310203";

const repairs: RepairEntry[] = [
  {
    eventId: 3235786,
    taskId: "domain/spec-trusted-access-ready-subset-followup-20260715",
    attemptId:
      "a_domain_spec-trusted-access-ready-subset-followup-20260715_20260715074820",
  },
  {
    eventId: 3235866,
    taskId: "domain/compact-kms-etcd-encryption-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-kms-etcd-encryption-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3235877,
    taskId: "domain/compact-ccp-metricsserver-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-ccp-metricsserver-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3235956,
    taskId: "domain/compact-private-cluster-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-private-cluster-ready-subset-followup-20260715_20260715075006",
  },
  {
    eventId: 3235987,
    taskId: "domain/compact-jwt-authenticator-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-jwt-authenticator-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3236000,
    taskId: "domain/compact-aad-rbac-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-aad-rbac-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3236069,
    taskId: "domain/compact-planned-maintenance-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-planned-maintenance-ready-subset-followup-20260715_20260715075006",
  },
  {
    eventId: 3236085,
    taskId: "domain/compact-workload-autoscaler-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-workload-autoscaler-ready-subset-followup-20260715_20260715075006",
  },
  {
    eventId: 3236091,
    taskId: "domain/compact-ccp-coredns-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-ccp-coredns-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3236107,
    taskId: "domain/compact-cluster-autoscaler-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-cluster-autoscaler-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3236135,
    taskId: networkSourceTaskId,
    attemptId:
      "a_domain_compact-network-cni-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3236146,
    taskId: "domain/compact-gpu-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-gpu-ready-subset-followup-20260715_20260715075005",
  },
  {
    eventId: 3236152,
    taskId: "domain/compact-rp-cluster-lifecycle-ready-subset-followup-20260715",
    attemptId:
      "a_domain_compact-rp-cluster-lifecycle-ready-subset-followup-20260715_20260715075006",
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function nodeState(task: TaskNode | undefined): string {
  if (!task) return "missing";
  return String(task.state ?? task.status ?? "unknown");
}

function taskAsRecord(task: TaskNode | undefined): Record<string, unknown> {
  return task && typeof task === "object" ? (task as Record<string, unknown>) : {};
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function ensureAcceptedReviewClosed(
  config: TaskTreeConfig,
  entry: RepairEntry,
): { taskId: string; eventId: number; before: string; after: string } {
  const beforeTask = readTask(config, entry.taskId) as TaskNode | undefined;
  const before = nodeState(beforeTask);
  if (before === "review") {
    markTaskDone(config, {
      taskId: entry.taskId,
      summary: `Applied accepted reviewed event ${entry.eventId}.`,
      reviewDecision: "accept",
    });
  } else {
    assert(
      before === "done",
      `Task ${entry.taskId} must be review or done before repair, found ${before}.`,
    );
  }
  const afterTask = readTask(config, entry.taskId) as TaskNode | undefined;
  const after = nodeState(afterTask);
  assert(after === "done", `Task ${entry.taskId} should be done after repair, found ${after}.`);
  return { taskId: entry.taskId, eventId: entry.eventId, before, after };
}

function createOrVerifyNetworkSuccessor(config: TaskTreeConfig): {
  created: boolean;
  state: string;
  parentId: string;
} {
  const sourceTask = readTask(config, networkSourceTaskId) as TaskNode | undefined;
  assert(sourceTask, `Missing source task ${networkSourceTaskId}.`);
  assert(sourceTask.parent_id, `${networkSourceTaskId} is missing parent_id.`);

  const existing = readTask(config, networkSuccessorTaskId) as TaskNode | undefined;
  if (!existing) {
    const sourceContext = taskAsRecord(sourceTask.context);
    const sourceOutputs = arrayOfStrings(sourceTask.outputs);
    const sourceConflictScopes = arrayOfStrings(sourceTask.conflict_scope);
    createTask(config, {
      id: networkSuccessorTaskId,
      parentId: sourceTask.parent_id,
      state: "backlog",
      kind: String(sourceTask.kind ?? "domain_leaf"),
      priority:
        sourceTask.priority === "P0" ||
        sourceTask.priority === "P1" ||
        sourceTask.priority === "P2" ||
        sourceTask.priority === "P3"
          ? sourceTask.priority
          : "P2",
      owner: String(sourceTask.owner ?? "aks-explorer"),
      workflow:
        typeof sourceTask.workflow === "string" ? sourceTask.workflow : undefined,
      goal:
        `Wait for Azure DevOps run ${networkRunId} for the 53-spec network-cni rerun-ready subset to become terminal, then download/inspect the exact returned result artifacts and record pass/fail/error facts for compact package consumption.`,
      inputs: [
        `Reviewed task: ${networkSourceTaskId}`,
        `Attempt: a_domain_compact-network-cni-ready-subset-followup-20260715_20260715075005`,
      ],
      outputs: sourceOutputs.length > 0 ? sourceOutputs : ["evidence/archive/"],
      acceptance: [
        "The concrete domain successor is created with the reviewed bounded scope and verification contract.",
        "The affected branch records the next exact verification, repair, or wait step without reopening broader work.",
      ],
      conflict_scope: sourceConflictScopes,
      context: {
        ...sourceContext,
        reviewedTask: {
          taskId: networkSourceTaskId,
          attemptId: "a_domain_compact-network-cni-ready-subset-followup-20260715_20260715075005",
          decision: "accept",
          summary:
            "The worker satisfied the acceptance criteria by deriving the exact current 53-spec network-cni rerun-ready subset, running both required local policies only on that subset, checking same-lineage governance, and queuing only that bounded subset as ADO run 172310203 while preserving the blocked holder.",
          findings: [
            "The accepted review already proved the selected ready subset, local policy passes, and exact same-lineage governance for the 53-spec network-cni rerun-ready slice.",
            "Azure DevOps run 172310203 was queued from the accepted worker attempt and is the only reviewed successor run that this follow-up should watch.",
          ],
          feedback: [],
          suggestedFollowups: [
            "When ADO run 172310203 reaches a terminal state, download/inspect the returned result artifacts and update the network-cni compact package based on exact pass/fail/error facts.",
          ],
          artifacts: [
            "evidence/archive/domain-compact-network-cni-ready-subset-followup-20260715.md",
            "workspace/domain-compact-network-cni-ready-subset-followup-20260715/20260715T080151Z/metadata.json",
            "workspace/domain-compact-network-cni-ready-subset-followup-20260715/20260715T080151Z/ado-run.json",
            "workspace/domain-compact-network-cni-ready-subset-followup-20260715/20260715T080151Z/ado-run-show.json",
            "workspace/domain-compact-network-cni-ready-subset-followup-20260715/20260715T080151Z/ado-artifacts.json",
          ],
          verification: [
            "Future result consumption should verify terminal run 172310203 by inspecting downloaded ADO artifacts/result.json, not by relying only on pipeline status.",
          ],
          reviewAction: {
            actionKind: "create-domain-followup",
            goal:
              `Wait for Azure DevOps run ${networkRunId} for the 53-spec network-cni rerun-ready subset to become terminal, then download/inspect the exact returned result artifacts and record pass/fail/error facts for compact package consumption.`,
          },
          sourceReviewedEventId: 3236135,
          repairedByAttemptId: attemptId,
          repairedAt: appliedAt,
        },
        acceptedQueuedPipelineRun: {
          backend: "ado",
          runId: networkRunId,
        },
      },
    });
  }

  const createdTask = readTask(config, networkSuccessorTaskId) as TaskNode | undefined;
  assert(createdTask, `Missing created successor ${networkSuccessorTaskId}.`);
  assert(
    createdTask.parent_id === sourceTask.parent_id,
    `${networkSuccessorTaskId} parent drift: expected ${sourceTask.parent_id}, found ${createdTask.parent_id}.`,
  );
  assert(
    String(createdTask.goal ?? "").includes(networkRunId),
    `${networkSuccessorTaskId} goal does not mention run ${networkRunId}.`,
  );

  return {
    created: !existing,
    state: nodeState(createdTask),
    parentId: String(createdTask.parent_id ?? ""),
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const reviewBefore = Object.values(treeBefore.tasks).filter(
  (task) => nodeState(task as TaskNode) === "review",
).length;
const successorBefore = Boolean(treeBefore.tasks[networkSuccessorTaskId]);
assert(!successorBefore, `${networkSuccessorTaskId} already existed before repair.`);

const closed: Array<{ taskId: string; eventId: number; before: string; after: string }> = [];
for (const entry of repairs) {
  if (entry.taskId === networkSourceTaskId) continue;
  closed.push(ensureAcceptedReviewClosed(config, entry));
}

const successor = createOrVerifyNetworkSuccessor(config);
closed.push(
  ensureAcceptedReviewClosed(config, {
    eventId: 3236135,
    taskId: networkSourceTaskId,
    attemptId: "a_domain_compact-network-cni-ready-subset-followup-20260715_20260715075005",
  }),
);

const treeAfter = readTaskTree(config);
const reviewAfter = Object.values(treeAfter.tasks).filter(
  (task) => nodeState(task as TaskNode) === "review",
).length;
const successorAfter = readTask(config, networkSuccessorTaskId) as TaskNode | undefined;
assert(successorAfter, `Expected successor ${networkSuccessorTaskId} after repair.`);

const memo = `# Ops apply repair review-not-applied wave state repair — 2026-07-15

Task: \`ops-apply-repair-review-not-applied-wave-20260715-state-repair\`
Attempt: \`${attemptId}\`
Script: \`scripts/ops-apply-repair-review-not-applied-wave-20260715-state-repair.ts\`
Applied at: ${appliedAt}

## Scope

This bounded app-state repair used supported task-tree/store helpers to apply the accepted review decisions that had remained live as review leaves in the task tree. It did **not** emit new runtime events.

## Baseline

- review leaves before repair: ${reviewBefore}
- reviewed network-cni successor existed before repair: ${successorBefore}

## Applied task-tree repair

${closed
  .map(
    (entry) =>
      `- event ${entry.eventId}: \`${entry.taskId}\` ${entry.before} -> ${entry.after}`,
  )
  .join("\n")}

- created successor: \`${networkSuccessorTaskId}\` (created=${successor.created}, state=${successor.state}, parent=${successor.parentId})
- successor goal tracks Azure DevOps run ${networkRunId}

## Post-state

- review leaves after repair: ${reviewAfter}
- \`${networkSourceTaskId}\` is now \`${nodeState(readTask(config, networkSourceTaskId) as TaskNode | undefined)}\`
- \`${networkSuccessorTaskId}\` is now \`${nodeState(successorAfter)}\`

## Notes

- The live task-tree drift that kept the review-not-applied metric red is repaired.
- Because this worker session is task-worker scoped and did not use runtime event ingress, the accepted reviewed event rows remain historical runtime facts while the task tree now reflects their decisions.
`;

writeText(resolve(appDir, evidencePath), memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      reviewBefore,
      reviewAfter,
      closedTaskCount: closed.length,
      successor: {
        id: networkSuccessorTaskId,
        created: successor.created,
        state: successor.state,
        parentId: successor.parentId,
      },
    },
    null,
    2,
  ),
);
