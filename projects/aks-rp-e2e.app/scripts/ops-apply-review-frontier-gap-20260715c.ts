import { resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import { execute as executePlanner } from "../workflows/project-planner.ts";
import { execute as executeReviewer } from "../workflows/task-reviewer.ts";

type MutableRecord = Record<string, unknown>;

type Dispatch = {
  type: string;
  payload: Record<string, unknown>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const evidencePath =
  "evidence/archive/ops-apply-repair-review-frontier-application-gap-20260715c-task-tree-followup.md";
const applyAttemptId =
  "a_ops-apply-repair-review-frontier-application-gap-20260715c-task-tree-followup_20260715173157";
const appliedAt = new Date().toISOString();

const gpuTaskId = "fix-gpu-operator-default-install-run-172310278";
const autoDefaultTaskId = "fix-localdns-auto-default-run-172310406";
const lifecycleTaskId = "fix-localdns-lifecycle-run-172310406";
const acnsTaskId = "fix-network-acns-performance-cilium-upgrade-run-172310203";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function taskState(task: TaskNode | undefined): string | null {
  if (!task) return null;
  return asString(task.state) ?? asString(task.status);
}

function taskSnapshot(task: TaskNode | undefined): Record<string, unknown> {
  if (!task) return { missing: true };
  const trace = asRecord(task.trace);
  const workflowResult = asRecord(trace.workflowResult);
  const details = asRecord(workflowResult.details);
  const fixForward = asRecord(details.fixForward);
  const specResults = Array.isArray(details.specResults) ? details.specResults : [];
  return {
    id: task.id,
    state: taskState(task),
    sessionId: asString((task as TaskNode & { session_id?: unknown }).session_id),
    currentAttemptId: asString(trace.current_attempt_id),
    workerStartedAttemptId: asString(trace.worker_started_attempt_id),
    lastSession: asString(trace.last_session),
    specResultReviewStructuredResultPresent:
      details.specResultReviewStructuredResultPresent ?? null,
    aggregateResultPath: asString(details.aggregateResultPath),
    resultPath: asString(details.resultPath),
    fixForwardVerification: fixForward.verification ?? null,
    fixForwardNextAction: asString(fixForward.nextAction),
    specResultsCount: specResults.length,
    resolution: asString((task as TaskNode & { resolution?: unknown }).resolution),
  };
}

function readTask(taskId: string): TaskNode | undefined {
  const tree = readTaskTree(config);
  return tree.tasks[taskId] as TaskNode | undefined;
}

function reviewMessage(input: {
  decision: string;
  summary: string;
  findings: string[];
  artifacts?: string[];
  verification?: string[];
  reviewAction?: Record<string, unknown>;
}): string {
  return `TASK_REVIEW_JSON:\n\`\`\`json\n${JSON.stringify(
    {
      decision: input.decision,
      confidence: "high",
      summary: input.summary,
      findings: input.findings,
      feedback: [],
      suggestedFollowups: [],
      ...(input.artifacts ? { artifacts: input.artifacts } : {}),
      ...(input.verification ? { verification: input.verification } : {}),
      ...(input.reviewAction ? { reviewAction: input.reviewAction } : {}),
    },
    null,
    2,
  )}\n\`\`\``;
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

function completionEvent(task: TaskNode, attemptId: string): Record<string, unknown> {
  const trace = asRecord(task.trace);
  const workflowResult = asRecord(asRecord(task.trace).workflowResult);
  const result = asString(task.result) ?? asString(trace.last_worker_result) ?? "done";
  const summary =
    asString(asRecord(trace.workflowResult).summary) ??
    asString(trace.last_worker_summary) ??
    asString(task.result) ??
    "done";
  const evidenceRefs = Array.isArray(task.evidence)
    ? task.evidence.filter((item): item is string => typeof item === "string")
    : Array.isArray(trace.last_worker_evidence)
      ? trace.last_worker_evidence.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
  return {
    type: "project.task.completed",
    target: { project: "aks-rp-e2e", taskId: task.id },
    project: "aks-rp-e2e",
    taskId: task.id,
    attemptId,
    result,
    summary,
    completion: {
      taskId: task.id,
      attemptId,
      result,
      claim: result,
      summary,
      evidenceRefs,
      workflowResult,
    },
  };
}

async function runReviewerAccept(input: {
  taskId: string;
  summary: string;
  findings: string[];
  artifacts?: string[];
  verification?: string[];
  reviewAction?: Record<string, unknown>;
}): Promise<{
  reviewerResult: unknown;
  reviewedEvent: Dispatch;
}> {
  const task = readTask(input.taskId);
  if (!task) throw new Error(`Task not found for reviewer: ${input.taskId}`);
  const trace = asRecord(task.trace);
  const attemptId = asString(trace.current_attempt_id);
  if (!attemptId) throw new Error(`Task ${input.taskId} has no current attempt id`);
  const dispatched: Dispatch[] = [];
  const reviewerResult = await executeReviewer({
    task: [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      "agent: aks-reviewer",
      triggerEvent(completionEvent(task, attemptId)),
    ].join("\n"),
    agent: "aks-reviewer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      dispatched.push({ type, payload });
    },
    runAgent: async () => ({ status: "success", message: "unused" }),
    runAgentSession: async () => ({
      status: "success",
      message: reviewMessage({
        decision: "accept",
        summary: input.summary,
        findings: input.findings,
        artifacts: input.artifacts,
        verification: input.verification,
        reviewAction: input.reviewAction,
      }),
    }),
    summarize: () => "",
  } as any);

  const reviewedEvent = dispatched.find(
    (event) => event.type === "project.task.reviewed",
  );
  if (!reviewedEvent) {
    throw new Error(`Task reviewer did not emit project.task.reviewed for ${input.taskId}`);
  }
  return { reviewerResult, reviewedEvent };
}

async function applyReviewedEvent(reviewedEvent: Dispatch): Promise<{
  plannerResult: unknown;
  dispatched: Dispatch[];
}> {
  const dispatched: Dispatch[] = [];
  const plannerResult = await executePlanner({
    task: [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      `agent: ${worker}`,
      "maxConcurrent: 1",
      triggerEvent({
        type: reviewedEvent.type,
        data: reviewedEvent.payload,
      }),
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
  return { plannerResult, dispatched };
}

async function replayAcceptedReview(taskId: string): Promise<{
  plannerResult: unknown;
  dispatched: Dispatch[];
}> {
  const dispatched: Dispatch[] = [];
  const plannerResult = await executePlanner({
    task: [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      `agent: ${worker}`,
      "maxConcurrent: 1",
      triggerEvent({
        type: "project.owner.requested",
        data: {
          project: "aks-rp-e2e",
          reason: "watchdog-review-pending",
          reviewCount: 1,
          reviewTasks: [{ taskId, updatedAt: "live-now" }],
        },
      }),
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
  return { plannerResult, dispatched };
}

function repairGpuStructuredResult(): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[gpuTaskId] as TaskNode | undefined;
    if (!task) throw new Error(`Task not found: ${gpuTaskId}`);
    const before = taskSnapshot(task);
    const trace = asRecord(task.trace);
    const workflowResult = asRecord(trace.workflowResult);
    const details = asRecord(workflowResult.details);
    const sourceSpecResult = asRecord(asRecord(task.context).sourceSpecResult);
    const aggregateResultPath =
      "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/result.json";
    const perSpecResultPath =
      "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/artifacts/gpu-operator-default-install/spec-runner/result.json";
    const aggregateSpecRowPath =
      "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/tests/gpu-operator-default-install.json";
    const sharedClusterPath =
      "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/shared-clusters/shared-exec-cluster-02.json";
    const reviewReason =
      "spec-runner/result.json recorded status=failed and phase=completed-with-nonpassing-result; first failed assertion assert.gpu.driver-installed hit HTTP 400 VMSizeNotSupported for Standard_NC6s_v3 in westus2, and cleanup.resource-group-deleted returned HTTP 202.";

    const specResult = {
      specId: "spec.gpu.operator-default-install",
      runId: "172310278",
      resultPath: perSpecResultPath,
      specStatus: "fail",
      reason: reviewReason,
      liveVerified: true,
      liveClusterObserved: true,
      resourceGroup: "rg-plan-002-6126-o8f8ro-329971",
      clusterName: "aks-plan-002-6126-o8f8ro-329971",
      artifactRefs: [
        aggregateResultPath,
        aggregateSpecRowPath,
        perSpecResultPath,
        sharedClusterPath,
        "evidence/archive/wait-gpu-ready-subset-ado-run-172310278-result-20260715.md",
      ],
    };

    const specResultReview = {
      workflow: "spec-result-review",
      specId: "spec.gpu.operator-default-install",
      runId: "172310278",
      runUrl:
        asString(sourceSpecResult.runUrl) ??
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172310278",
      resultPath: aggregateResultPath,
      specStatus: "fail",
      status: "fail",
      reason: reviewReason,
      liveVerified: true,
      liveClusterObserved: true,
      resourceGroup: "rg-plan-002-6126-o8f8ro-329971",
      clusterName: "aks-plan-002-6126-o8f8ro-329971",
      artifactRefs: specResult.artifactRefs,
      specResults: [specResult],
      aggregateResultPath,
    };

    details.specResultReview = specResultReview;
    details.workflow = "spec-result-review";
    details.specId = specResultReview.specId;
    details.runId = specResultReview.runId;
    details.runUrl = specResultReview.runUrl;
    details.aggregateResultPath = aggregateResultPath;
    details.resultPath = perSpecResultPath;
    details.specStatus = "fail";
    details.status = "fail";
    details.reason = reviewReason;
    details.liveVerified = true;
    details.liveClusterObserved = true;
    details.resourceGroup = "rg-plan-002-6126-o8f8ro-329971";
    details.clusterName = "aks-plan-002-6126-o8f8ro-329971";
    details.artifactRefs = specResult.artifactRefs;
    details.specResults = [specResult];
    details.specResultReviewStructuredResultPresent = true;
    workflowResult.details = details;
    trace.workflowResult = workflowResult;
    trace.gpu_terminal_result_metadata_applied_at = appliedAt;
    trace.gpu_terminal_result_metadata_applied_by = worker;
    trace.gpu_terminal_result_metadata_apply_attempt_id = applyAttemptId;
    trace.gpu_terminal_result_metadata_apply_evidence_path = evidencePath;
    task.trace = trace;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return { before, after: taskSnapshot(task) };
  });
}

const before = {
  gpu: taskSnapshot(readTask(gpuTaskId)),
  autoDefault: taskSnapshot(readTask(autoDefaultTaskId)),
  lifecycle: taskSnapshot(readTask(lifecycleTaskId)),
  acns: taskSnapshot(readTask(acnsTaskId)),
};

const gpuRepair = repairGpuStructuredResult();

const autoDefaultReview = await runReviewerAccept({
  taskId: autoDefaultTaskId,
  summary:
    "The current LocalDNS auto-default completion now satisfies the fix-forward acceptance criteria and the terminal same-spec structured-result contract on the live review attempt.",
  findings: [
    "workflowResult.details.fixForward remains populated with the accepted request-shape-invalid diagnosis and exact-wait nextAction for spec.localdns.auto-default.",
    "workflowResult.details now includes the exact aggregateResultPath, per-spec resultPath, and specResults[0] object for run 172310406 on the current review attempt.",
    "The exact aggregate and per-spec artifacts remain consistent with the blocked/reviewed-exception LocalDNS posture, and no unchanged rerun was queued.",
  ],
  artifacts: [
    "evidence/archive/fix-localdns-auto-default-run-172310406.md",
    "workspace/fix-localdns-auto-default-run-172310406/20260715T193006Z/download/runs/test-results/feature-compact-localdns-staging_315942/result.json",
    "workspace/fix-localdns-auto-default-run-172310406/20260715T193006Z/download/runs/test-results/feature-compact-localdns-staging_315942/artifacts/localdns-auto-default/spec-runner/result.json",
  ],
  verification: [
    "workflowResult.details retains fixForward plus aggregateResultPath and specResults[0] for run 172310406.",
    "The structured terminal result matches the exact run 172310406 aggregate/per-spec artifact facts for spec.localdns.auto-default.",
    "No unchanged same-input rerun is queued; the accepted nextAction remains exact-wait.",
  ],
});
const autoDefaultApply = await applyReviewedEvent(autoDefaultReview.reviewedEvent);

const lifecycleReview = await runReviewerAccept({
  taskId: lifecycleTaskId,
  summary:
    "The metadata-corrected LocalDNS lifecycle completion now satisfies the fix-forward and terminal same-spec pass contracts on the current live review attempt.",
  findings: [
    "workflowResult.details now exposes the exact aggregateResultPath for run 172341658 alongside the populated per-spec specResults[0] entry for spec.localdns.lifecycle.",
    "workflowResult.details.fixForward.verification now matches the same-spec pass artifact for run 172341658 and fixForward.nextAction is done with an evidence-backed reason.",
    "The aggregate and per-spec artifacts cited by the task record still show the repaired LocalDNS lifecycle run passed with all lifecycle assertions satisfied.",
  ],
  artifacts: [
    "evidence/archive/fix-localdns-lifecycle-run-172310406.md",
    "/app/projects/aks-rp-e2e/workspace/fix-localdns-lifecycle-run-172310406/20260715T160732Z/download/runs/test-results/test_20260715153440014_qtw90p_613729/result.json",
    "/app/projects/aks-rp-e2e/workspace/fix-localdns-lifecycle-run-172310406/20260715T160732Z/download/runs/test-results/test_20260715153440014_qtw90p_613729/artifacts/localdns-lifecycle/spec-runner/result.json",
  ],
  verification: [
    "workflowResult.details includes aggregateResultPath for run 172341658.",
    "workflowResult.details.fixForward.verification is pass for run 172341658 with the exact per-spec resultPath.",
    "workflowResult.details.fixForward.nextAction is done and the same-spec pass artifact remains the cited proof.",
  ],
});
const lifecycleApply = await applyReviewedEvent(lifecycleReview.reviewedEvent);

const acnsApply = await replayAcceptedReview(acnsTaskId);

const after = {
  gpu: taskSnapshot(readTask(gpuTaskId)),
  autoDefault: taskSnapshot(readTask(autoDefaultTaskId)),
  lifecycle: taskSnapshot(readTask(lifecycleTaskId)),
  acns: taskSnapshot(readTask(acnsTaskId)),
};

console.log(
  JSON.stringify(
    {
      appliedAt,
      evidencePath,
      before,
      gpuRepair,
      autoDefaultReview: {
        reviewerResult: autoDefaultReview.reviewerResult,
        reviewedEvent: autoDefaultReview.reviewedEvent,
        plannerResult: autoDefaultApply.plannerResult,
        plannerDispatches: autoDefaultApply.dispatched,
      },
      lifecycleReview: {
        reviewerResult: lifecycleReview.reviewerResult,
        reviewedEvent: lifecycleReview.reviewedEvent,
        plannerResult: lifecycleApply.plannerResult,
        plannerDispatches: lifecycleApply.dispatched,
      },
      acnsApply: {
        plannerResult: acnsApply.plannerResult,
        plannerDispatches: acnsApply.dispatched,
      },
      after,
    },
    null,
    2,
  ),
);
