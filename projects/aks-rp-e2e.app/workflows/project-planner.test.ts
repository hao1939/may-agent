import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assignTask, taskTreeConfig } from "./lib/task-tree-tools.ts";
import { execute } from "./project-planner.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-planner-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(projectDir, "model", "knowledge-map"), {
    recursive: true,
  });
  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify(
      {
        id: "aks-rp-e2e.app",
        owner: "aks-explorer",
        status: "active",
        type: "project-app",
        currentState: {
          summary: "stale summary",
          activeTaskId: "archived-task",
          metrics: {
            blockedLeafCount: 0,
            activeLeafCount: 99,
            reviewLeafCount: 88,
            waitingLeafCount: 77,
            runnableLeafCount: 66,
          },
        },
        currentFocus: {
          summary: "stale focus",
          nextAction: "do stale work",
          activeTaskIds: ["archived-task", "done-focus"],
          proposedTaskIds: ["archived-task", "done-focus"],
          focusPlanId: "done-focus",
          focusPlanStatus: "done",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await mkdir(join(projectDir, "evidence", "archive"), { recursive: true });
  await mkdir(join(projectDir, "specs"), { recursive: true });
  await mkdir(join(projectDir, "replays"), { recursive: true });

  await writeFile(
    join(projectDir, "model", "knowledge-map", "model.json"),
    `${JSON.stringify(
      {
        features: [{ id: "feature-a", status: "unknown" }],
        featurePaths: [
          {
            id: "path.feature-a.create",
            featureId: "feature-a",
            status: "unknown",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    join(
      projectDir,
      "evidence",
      "archive",
      "model-gap-fail-blocked-diagnosis-20260610.md",
    ),
    "# gap report\n",
    "utf8",
  );
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            children: [
              "knowledge-model-gap-reconciliation",
              "spec-runner-and-replays",
            ],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "spec-runner-and-replays": {
            id: "spec-runner-and-replays",
            parent_id: "project",
            state: "backlog",
            kind: "durable_lane",
            children: [],
            goal: "execute specs and replays",
            outputs: ["runs/executions/"],
            acceptance: ["runner work represented as child tasks"],
          },
          "knowledge-model-gap-reconciliation": {
            id: "knowledge-model-gap-reconciliation",
            parent_id: "project",
            state: "backlog",
            kind: "standing_task",
            children: ["accepted-gap-report"],
            goal: "turn gaps into work",
            outputs: ["tasks/tree.json"],
            acceptance: ["gaps represented as work"],
          },
          "accepted-gap-report": {
            id: "accepted-gap-report",
            parent_id: "knowledge-model-gap-reconciliation",
            state: "done",
            children: [],
            goal: "gap report",
            outputs: ["evidence/archive/gap.md"],
            acceptance: ["done"],
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return { appDir, projectDir };
}

function config(appDir: string, projectDir: string) {
  return taskTreeConfig({
    appDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent: 5,
  });
}

async function writeReviewTree(
  appDir: string,
  input: {
    taskId?: string;
    attemptId?: string;
    status?: string;
    context?: Record<string, unknown>;
    conflictScope?: string[];
    extraTasks?: Record<string, any>;
  } = {},
) {
  const taskId = input.taskId ?? "review-task";
  const attemptId = input.attemptId ?? "attempt-1";
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            status: "backlog",
            children: [taskId],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          [taskId]: {
            id: taskId,
            parent_id: "project",
            state: input.status ?? "review",
            status: input.status ?? "review",
            kind: "domain_leaf",
            priority: "P1",
            owner: "aks-explorer",
            children: [],
            goal: "Review me",
            outputs: ["runs/test-results/review-task.json"],
            acceptance: ["review accepted"],
            conflict_scope: input.conflictScope ?? ["scope.review-task"],
            context: input.context,
            session_id: "s_task_review_task",
            result: "worker result",
            trace: {
              current_attempt_id: attemptId,
              last_worker_result: "done",
              last_worker_summary: "worker says done",
            },
          },
          ...(input.extraTasks ?? {}),
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function writeSpecLoopState(
  appDir: string,
  specs: Record<string, Record<string, unknown>>,
) {
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await writeFile(
    join(appDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 5,
        cursor: 0,
        prioritySpecIds: [],
        specs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function readTaskTreeJson(appDir: string) {
  return JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8")) as {
    tasks: Record<string, any>;
  };
}

function reviewedTrigger(data: Record<string, unknown>) {
  return [
    "## Trigger Event",
    "```json",
    JSON.stringify({ type: "project.task.reviewed", data }, null, 2),
    "```",
  ].join("\n");
}

function plannerContext(input: {
  appDir: string;
  projectDir: string;
  trigger: string;
  prompts?: string[];
  dispatched?: Array<{ type: string; data: unknown }>;
}) {
  return {
    task: [
      `app: ${input.appDir}`,
      `project: ${input.projectDir}`,
      "agent: aks-explorer",
      "maxConcurrent: 1",
      input.trigger,
    ].join("\n"),
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, data: unknown) {
      input.dispatched?.push({ type, data });
    },
    runAgent: async (_agent: string, task: string) => {
      input.prompts?.push(task);
      return { status: "success", message: "owner should not run" };
    },
    runAgentSession: async (_agent: string, task: string) => {
      input.prompts?.push(task);
      return { status: "success", message: "owner should not run" };
    },
    summarize: () => "",
  } as any;
}

describe("project owner workflow", () => {
  test("routes ops-prefixed backlog tasks to the ops worker", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["ops-audit-overdue-waits"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops-audit-overdue-waits": {
              id: "ops-audit-overdue-waits",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Audit overdue waits.",
              outputs: ["evidence/archive/ops-audit-overdue-waits.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{ type: string; data: Record<string, unknown> }> =
      [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "worker: aks-explorer",
        "opsWorker: app-ops",
        "maxConcurrent: 1",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, data: Record<string, unknown>) {
        dispatched.push({ type, data });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toContainEqual({
      type: "project.task.assigned",
      data: expect.objectContaining({
        taskId: "ops-audit-overdue-waits",
        worker: "app-ops",
      }),
    });
  });

  test("applies accepted task reviews without owner-agent planning", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const prompts: string[] = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Evidence satisfies the task.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Applied accept review for review-task");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(tree.tasks["review-task"].trace.review_summary).toBe(
      "Evidence satisfies the task.",
    );
    expect(prompts).toHaveLength(0);
  });

  test("accepted structured single-spec review marks spec-loop item passed", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "wait-spec-virtualmachines-mixed-sku-deallocate-rerun-171344670-return-20260708",
      conflictScope: ["spec:spec.virtualmachines.mixed-sku-deallocate"],
      context: {
        terminalPipelineWaitReview: {
          runId: "171344670",
          namedSpecIds: ["spec.virtualmachines.mixed-sku-deallocate"],
        },
      },
    });
    await writeSpecLoopState(appDir, {
      "spec.virtualmachines.mixed-sku-deallocate": {
        status: "pending",
        attempts: 3,
        taskId:
          "wait-spec-virtualmachines-mixed-sku-deallocate-rerun-171344670-return-20260708",
        lastRunId: "171344670",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171344670",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-08T10:18:38.710Z",
        failureClass: "test-code-bug",
        diagnosis: "stale diagnosis",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "wait-spec-virtualmachines-mixed-sku-deallocate-rerun-171344670-return-20260708",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Returned ADO artifact proves the spec passed live.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "spec-result-review",
              status: "done",
              subject: {
                kind: "spec",
                id: "spec.virtualmachines.mixed-sku-deallocate",
              },
              details: {
                backend: "azure-devops-pipeline",
                runId: "171344670",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171344670",
                resultPath:
                  "runs/test-results/test_20260708090351646_iytx73_522561/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
                specStatus: "pass",
                liveVerified: true,
                resourceGroup: "rg-plan-001-1646-iytx73-522561",
                clusterName: "aks-plan-001-1646-iytx73-522561",
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const state = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const spec = state.specs["spec.virtualmachines.mixed-sku-deallocate"];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "recorded structured verifier result for spec.virtualmachines.mixed-sku-deallocate",
    );
    expect(
      tree.tasks[
        "wait-spec-virtualmachines-mixed-sku-deallocate-rerun-171344670-return-20260708"
      ].state,
    ).toBe("done");
    expect(spec.status).toBe("pass");
    expect(spec.lastRunId).toBe("171344670");
    expect(spec.lastResultPath).toBe(
      "runs/test-results/test_20260708090351646_iytx73_522561/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
    );
    expect(spec.failureClass).toBeNull();
    expect(spec.diagnosis).toBeNull();
  });

  test("accepted structured single-spec failure records spec-loop failure", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "wait-spec-cluster-autoscaler-mincount-recovery-rerun-171349474-return-20260708",
      conflictScope: ["spec:spec.cluster-autoscaler.mincount-recovery"],
      context: {
        terminalPipelineWaitReview: {
          runId: "171349474",
          namedSpecIds: ["spec.cluster-autoscaler.mincount-recovery"],
        },
      },
    });
    await writeSpecLoopState(appDir, {
      "spec.cluster-autoscaler.mincount-recovery": {
        status: "pending",
        attempts: 3,
        taskId:
          "wait-spec-cluster-autoscaler-mincount-recovery-rerun-171349474-return-20260708",
        lastRunId: "171349474",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171349474",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-08T10:08:18.843Z",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "wait-spec-cluster-autoscaler-mincount-recovery-rerun-171349474-return-20260708",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Returned ADO artifact proves the spec failed live.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "single-spec-verifier",
              status: "partial",
              subject: {
                kind: "spec",
                id: "spec.cluster-autoscaler.mincount-recovery",
              },
              details: {
                backend: "azure-devops-pipeline",
                runId: "171349474",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171349474",
                resultPath:
                  "runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
                specStatus: "fail",
                liveVerified: false,
                liveClusterObserved: true,
                reason: "0/3 claims passed.",
              },
            },
          },
        }),
      }),
    );

    const state = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const spec = state.specs["spec.cluster-autoscaler.mincount-recovery"];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "recorded structured verifier result for spec.cluster-autoscaler.mincount-recovery",
    );
    expect(spec.status).toBe("fail");
    expect(spec.lastRunId).toBe("171349474");
    expect(spec.lastResultPath).toBe(
      "runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
    );
    expect(spec.diagnosis).toBe("0/3 claims passed.");
    expect(spec.review.acceptedStatus).toBe("fail");
  });

  test("accepted structured grouped spec review records each spec-loop result", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "review-spec-loop-network-acns-rerun-171342018-return-20260708",
      conflictScope: ["spec-loop-followup:pending:network-acns"],
      context: {
        terminalGitHubWaitReview: {
          runId: "171342018",
          runStatus: "completed",
          runConclusion: "failed",
          namedSpecIds: [],
        },
      },
    });
    await writeSpecLoopState(appDir, {
      "spec.network-acns.cilium-observability": {
        status: "pending",
        attempts: 5,
        taskId: "reconcile-spec-loop-pending-network-acns-9",
        lastRunId: "171342018",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171342018",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-08T02:41:10.010Z",
      },
      "spec.network-acns.retina-enterprise": {
        status: "pending",
        attempts: 5,
        taskId: "reconcile-spec-loop-pending-network-acns-9",
        lastRunId: "171342018",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171342018",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-08T02:41:10.010Z",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "review-spec-loop-network-acns-rerun-171342018-return-20260708",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Returned grouped ADO artifact records two same-spec errors.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "single-spec-verifier",
              status: "partial",
              subject: {
                kind: "spec-group",
                id: "network-acns",
              },
              details: {
                backend: "azure-devops-pipeline",
                runId: "171342018",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171342018",
                resultPath:
                  "runs/test-results/test_20260708083338198_o5hx8d_500854/result.json",
                specResults: [
                  {
                    specId: "spec.network-acns.cilium-observability",
                    status: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    artifactRefs: [
                      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-cilium-observability/spec-runner/result.json",
                    ],
                  },
                  {
                    specId: "spec.network-acns.retina-enterprise",
                    status: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    artifactRefs: [
                      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
                    ],
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const state = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const cilium = state.specs["spec.network-acns.cilium-observability"];
    const retina = state.specs["spec.network-acns.retina-enterprise"];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "recorded structured verifier result for spec.network-acns.cilium-observability, spec.network-acns.retina-enterprise",
    );
    expect(
      tree.tasks[
        "review-spec-loop-network-acns-rerun-171342018-return-20260708"
      ].state,
    ).toBe("done");
    expect(cilium.status).toBe("error");
    expect(retina.status).toBe("error");
    expect(cilium.lastResultPath).toBe(
      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-cilium-observability/spec-runner/result.json",
    );
    expect(retina.lastResultPath).toBe(
      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
    );
    expect(cilium.diagnosis).toContain("hubble-ui");
    expect(retina.review.acceptedStatus).toBe("error");
  });

  test("applies redo reviews by requeuing the reviewed task with a fresh attempt", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const dispatched: Array<{ type: string; data: unknown }> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        dispatched,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "redo",
          summary: "The output is incomplete.",
          feedback: ["Add the missing live-test proof."],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Applied redo review for review-task");
    expect(tree.tasks["review-task"].state).toBe("active");
    expect(tree.tasks["review-task"].session_id).not.toBe("s_task_review_task");
    expect(tree.tasks["review-task"].trace.previous_attempt_id).toBe(
      "attempt-1",
    );
    expect(dispatched.map((event) => event.type)).toContain(
      "project.task.assigned",
    );
  });

  test("applies follow-up reviews by creating a successor task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      context: {
        featureKey: "defender-profile",
        capabilityId: "defender-profile",
        target: "staging",
        loopTaskId: "aks-feature-compact-loop",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "followup",
          summary: "The work is useful but needs one more check.",
          suggestedFollowups: ["Run the compacted feature test on GitHub."],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(tree.tasks["review-task-followup"]).toBeTruthy();
    expect(["backlog", "active"]).toContain(
      tree.tasks["review-task-followup"].state,
    );
    expect(tree.tasks["review-task-followup"].goal).toBe(
      "Run the compacted feature test on GitHub.",
    );
    expect(tree.tasks["review-task-followup"].context).toMatchObject({
      featureKey: "defender-profile",
      capabilityId: "defender-profile",
      target: "staging",
      loopTaskId: "aks-feature-compact-loop",
      reviewedTask: {
        taskId: "review-task",
        attemptId: "attempt-1",
        decision: "followup",
      },
    });
  });

  test("preserves blocked-overdue scope on reviewed audit follow-ups", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops-audit-spec-loop-overdue-self-excluded-baseline-20260708",
      context: {
        metricId: "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
        blockedOverdueAudit: true,
        selfExcludedBaselineRequired: true,
      },
      conflictScope: [],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops-audit-spec-loop-overdue-self-excluded-baseline-20260708",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "The spec-loop overdue audit is correct but needs a concrete repair successor.",
          suggestedFollowups: [
            "Apply the spec-loop overdue wait repairs and verify the metric is zero.",
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup =
      tree.tasks[
        "ops-audit-spec-loop-overdue-self-excluded-baseline-20260708-followup"
      ];
    expect(result.status).toBe("done");
    expect(followup.conflict_scope).toContain("ops:blocked-overdue:spec-loop");
  });

  test("applies blocked reviews by replacing the review leaf with an exact wait task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      context: {
        featureKey: "node-restriction",
        capabilityId: "node-restriction",
        stateRef: ".state/feature-compact-loop/state.json",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "blocked",
          summary: "Staging quota is exhausted.",
          feedback: ["westus2 cluster quota must be available."],
          suggestedFollowups: ["Resume when westus2 quota drops below limit."],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(tree.tasks["review-task"].resolution).toBe("replaced");
    expect(tree.tasks["review-task-blocked"].state).toBe("blocked");
    expect(tree.tasks["review-task-blocked"].blocker.condition).toContain(
      "westus2 cluster quota",
    );
    expect(tree.tasks["review-task-blocked"].blocker.resume_condition).toBe(
      "Resume when westus2 quota drops below limit.",
    );
    expect(tree.tasks["review-task-blocked"].blocker.waiting_for).toMatchObject(
      {
        type: "blocker.resolved",
        reviewedTaskId: "review-task",
        reviewedAttemptId: "attempt-1",
        successorTaskId: "review-task-blocked",
        source: "project.task.reviewed",
      },
    );
    expect(tree.tasks["review-task-blocked"].blocker.observed_by).toMatchObject(
      {
        workflow: "project-planner",
        trigger: "project.task.reviewed",
      },
    );
    expect(tree.tasks["review-task-blocked"].blocker.next_check_at).toEqual(
      expect.any(String),
    );
    expect(tree.tasks["review-task-blocked"].blocker.fallback_at).toEqual(
      expect.any(String),
    );
    expect(tree.tasks["review-task-blocked"].blocker.fallback_action).toContain(
      "If the reviewed blocker is still unresolved at fallback time",
    );
    expect(tree.tasks["review-task-blocked"].context).toMatchObject({
      featureKey: "node-restriction",
      capabilityId: "node-restriction",
      stateRef: ".state/feature-compact-loop/state.json",
      reviewedTask: {
        taskId: "review-task",
        attemptId: "attempt-1",
        decision: "blocked",
      },
    });
  });

  test("applies escalate reviews by replacing the review leaf with an owner-decision wait task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      context: {
        featureKey: "node-restriction",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "escalate",
          summary: "Human owner decision is required.",
          feedback: [
            "May or the owner must decide whether to keep or replace this path.",
          ],
          suggestedFollowups: ["Resume when the owner decision returns."],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(tree.tasks["review-task"].resolution).toBe("replaced");
    expect(tree.tasks["review-task-escalate"].state).toBe("blocked");
    expect(tree.tasks["review-task-escalate"].blocker.owner).toBe("human");
    expect(tree.tasks["review-task-escalate"].blocker.resume_condition).toBe(
      "Resume when the owner decision returns.",
    );
    expect(
      tree.tasks["review-task-escalate"].blocker.waiting_for,
    ).toMatchObject({
      type: "owner.decision",
      reviewedTaskId: "review-task",
      reviewedAttemptId: "attempt-1",
      successorTaskId: "review-task-escalate",
      source: "project.task.reviewed",
    });
    expect(
      tree.tasks["review-task-escalate"].blocker.observed_by,
    ).toMatchObject({
      workflow: "project-planner",
      trigger: "project.task.reviewed",
    });
  });

  test("turns accepted spec-loop follow-up reviews into successor work when represented specs remain unowned", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      context: {
        specLoopFollowup: true,
        representedSpecIds: ["spec.cost-analysis.vm-prerelease-source-seed"],
      },
      conflictScope: ["spec-loop-followup:pending:cost-analysis"],
    });
    await writeSpecLoopState(appDir, {
      "spec.cost-analysis.vm-prerelease-source-seed": {
        status: "pending",
        attempts: 4,
        taskId: "closed-cost-analysis-review",
        lastRunId: null,
        lastRunUrl: "https://github.example/runs/1",
        lastResultPath: "runs/test-results/cost-analysis.json",
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        successorDisposition: "environment-blocker-pending-followup",
        resumeCondition: "underlay kubeconfig is available",
        review: { decision: "blocked" },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Accepted because the result mentions a wait task, but no durable holder exists.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("converted accept to followup");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(tree.tasks["review-task-followup"].state).toBe("active");
    expect(tree.tasks["review-task-followup"].goal).toContain(
      "Spec-loop accept cannot close",
    );
  });

  test("allows accepted spec-loop follow-up reviews when represented specs have an open exact holder", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      context: {
        specLoopFollowup: true,
        representedSpecIds: ["spec.defender-profile.vm-prerelease-matrix"],
      },
      conflictScope: ["spec-loop-followup:pending:defender-profile"],
      extraTasks: {
        "wait-shared-github-auth-preflight-401-family-spec-defender": {
          id: "wait-shared-github-auth-preflight-401-family-spec-defender",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P1",
          owner: "aks-explorer",
          children: [],
          goal: "Wait for shared GitHub auth-preflight repair.",
          outputs: ["tasks/tree.json"],
          acceptance: ["auth-preflight repaired"],
          conflict_scope: ["spec:spec.defender-profile.vm-prerelease-matrix"],
          blocker: { category: "external-wait" },
          resumeCondition: "GitHub auth preflight succeeds.",
        },
      },
    });
    await writeSpecLoopState(appDir, {
      "spec.defender-profile.vm-prerelease-matrix": {
        status: "pending",
        attempts: 4,
        taskId: null,
        lastRunId: null,
        lastRunUrl: "https://github.example/runs/2",
        lastResultPath: "runs/test-results/defender.json",
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        successorDisposition: "workflow-auth-preflight-blocker",
        resumeCondition: "GitHub auth preflight succeeds.",
        review: { decision: "blocked" },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Exact holder owns the remaining wait.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Applied accept review for review-task");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(tree.tasks["review-task-followup"]).toBeUndefined();
  });

  test("ignores stale reviewed task attempts without owner-agent planning", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const prompts: string[] = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "old-attempt",
          decision: "accept",
          summary: "Old event.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Ignored stale reviewed event");
    expect(tree.tasks["review-task"].state).toBe("review");
    expect(prompts).toHaveLength(0);
  });

  test("passes task-tree context and domain commands to the owner session", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const prompts: string[] = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: normal refill" }
          : { status: "success", message: "planner observed status" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain("Planner Event Review Step");
    expect(prompts[1]).toContain("Planning Update Step");
    expect(prompts[1]).toContain("Current compact task-tree packet");
    expect(prompts[1]).toContain("frontier_details");
    expect(prompts[1]).toContain("EVENT_REVIEW: normal refill");
    expect(prompts[1]).toContain(
      "cd " + projectDir + " && bun run status -- --gaps",
    );
    expect(prompts[0]).toContain("Source workspace: /app/sources/aks-rp");
    expect(prompts[1]).toContain("Source workspace: /app/sources/aks-rp");
    expect(prompts[1]).toContain(
      "/app/sources/aks-rp/test/e2ev3/sigs/rp/virtualmachine/suites/prerelease.go",
    );
    expect(prompts[1]).toContain("Do not rewrite " + appDir + "/project.json");
    expect(prompts[1]).not.toContain("Current project status packet");
    expect(prompts[1]).not.toContain('"path_gap_count"');
    expect(prompts[1]).toContain(
      "Do not stop merely because one rollup or one new leaf was created.",
    );
    expect(prompts[1]).not.toContain("Stop after one small material update");
  });

  test("compacts oversized packet details before building planner prompts", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const hugePaths = Array.from({ length: 60 }, (_, index) => ({
      id: `path.synthetic-${index}`,
      status: index % 2 === 0 ? "unknown" : "blocked",
      rootCauseClass: "runtime",
    }));
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify({ featurePaths: hugePaths }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [
                "review-1",
                "review-2",
                "review-3",
                "review-4",
                "review-5",
                "review-6",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            ...Object.fromEntries(
              Array.from({ length: 6 }, (_, index) => [
                `review-${index + 1}`,
                {
                  id: `review-${index + 1}`,
                  parent_id: "project",
                  state: "review",
                  kind: "domain_leaf",
                  priority: "P1",
                  children: [],
                  goal: `Review task ${index + 1} ${"x".repeat(220)}`,
                  outputs: [`evidence/archive/review-${index + 1}.md`],
                  acceptance: ["done"],
                  trace: {
                    last_worker_summary: `Summary ${index + 1} ${"y".repeat(
                      520,
                    )}`,
                  },
                },
              ]),
            ),
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: compact please" }
          : { status: "success", message: "done" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('"omitted_non_passing_paths": 20');
    expect(prompts[1]).toContain('"review_omitted_count": 1');
    expect(prompts[1]).not.toContain('"id": "path.synthetic-59"');
    expect(prompts[1]).not.toContain(`Summary 1 ${"y".repeat(520)}`);
  });

  test("runs owner review when worker results are pending even with runnable backlog work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["review-task", "backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "review-task": {
              id: "review-task",
              parent_id: "project",
              state: "review",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Review worker result.",
              outputs: ["runs/executions/run-1/"],
              acceptance: ["terminal result exists"],
              trace: {
                last_worker_result: "blocked",
                last_worker_summary:
                  "Auth appears hung, but no result.json exists.",
              },
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Do other work.",
              outputs: ["evidence/archive/other.md"],
              acceptance: ["done"],
              conflict_scope: ["other"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        if (task.includes("Planning Update Step")) {
          assignTask(config(appDir, projectDir), { taskId: "backlog-task" });
          return { status: "success", message: "reviewed pending result" };
        }
        return {
          status: "success",
          message: "EVENT_REVIEW: review-task needs validation",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Worker output is progress");
    expect(prompts[1]).toContain('"review"');
    expect(prompts[1]).toContain("review-task");
    expect(
      dispatched.some(
        (event) =>
          event.type === "project.task.assigned" &&
          event.payload.taskId === "backlog-task",
      ),
    ).toBe(true);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"ran_agent":true');
  });

  test("runs owner refill when active work underfills capacity", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Do one known gap.",
              outputs: ["evidence/archive/one-gap.md"],
              acceptance: ["done"],
              conflict_scope: ["gap:one"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        if (task.includes("Planning Update Step")) {
          assignTask(config(appDir, projectDir), { taskId: "backlog-task" });
          return { status: "success", message: "created more frontier work" };
        }
        return {
          status: "success",
          message: "EVENT_REVIEW: runnable backlog refill",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Planning Update Step");
    expect(prompts[1]).toContain("assign runnable backlog leaves");
    expect(prompts[1]).not.toContain('"capacity_underfilled_with_gaps"');
    expect(
      dispatched.some(
        (event) =>
          event.type === "project.task.assigned" &&
          event.payload.taskId === "backlog-task",
      ),
    ).toBe(true);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"ran_agent":true');
  });

  test("quick-refills clear backlog work without owner session when capacity is filled", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Do backlog work.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("quick-refill assigned 1 task");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.assigned",
      payload: {
        taskId: "backlog-task",
        sessionId: "s_task_backlog-task",
      },
    });

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["quick-refill"]');
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("does not quick-refill no-op when overdue blocked owner action needs planning", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task", "blocked-owner-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Do unrelated backlog work.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
            "blocked-owner-wait": {
              id: "blocked-owner-wait",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Wait for pipeline result.",
              outputs: ["evidence/archive/blocked-owner-wait.md"],
              acceptance: ["done"],
              blocker: {
                condition: "Waiting for pipeline result.",
                waiting_for: { type: "pipeline.completed" },
                owner: "aks-explorer",
                resume_condition: "Resume when the pipeline result is known.",
                resume_at: "2001-01-01T00:00:00.000Z",
                fallback_at: "2001-01-02T00:00:00.000Z",
                fallback_action:
                  "Check the pipeline and create a recovery task.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            overdueOwnerActions: [
              {
                taskId: "blocked-owner-wait",
                owner: "aks-explorer",
                watchAt: "2001-01-01T00:00:00.000Z",
                recoveryRequired:
                  "Resume window passed without active/review recovery work.",
              },
            ],
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: overdue owner wait" }
          : {
              status: "success",
              message: "planner reviewed overdue owner action",
            };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.assigned",
      payload: { taskId: "backlog-task" },
    });
    expect(result.message).toContain("planner reviewed overdue owner action");

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"ran_agent":true');
    expect(plannerRuns).not.toContain('"steps":["quick-refill"]');
  });

  test("quick-refill does not assign loop-owned child tasks directly", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "aks-feature-reference-loop",
          active_task_ids: ["aks-feature-reference-loop"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-reference-loop", "ordinary-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              priority: "P1",
              workflow: "feature-reference-loop-controller",
              children: ["collect-feature-reference-a"],
              goal: "Collect feature references.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["all features terminal"],
              conflict_scope: ["feature-reference-loop"],
            },
            "collect-feature-reference-a": {
              id: "collect-feature-reference-a",
              parent_id: "aks-feature-reference-loop",
              state: "backlog",
              status: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              workflow: "feature-reference-collector",
              children: [],
              goal: "Collect feature reference for a.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["state updated"],
              conflict_scope: ["feature-reference:a"],
              context: {
                loopTaskId: "aks-feature-reference-loop",
                featureKey: "a",
              },
            },
            "ordinary-task": {
              id: "ordinary-task",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Do ordinary work.",
              outputs: ["evidence/archive/ordinary.md"],
              acceptance: ["done"],
              conflict_scope: ["ordinary"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: "owner should not run",
      }),
      summarize: () => "",
    } as any);

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("quick-refill assigned 1 task");
    expect(dispatched.map((event) => event.payload.taskId)).toEqual([
      "ordinary-task",
    ]);
    expect(tree.tasks["collect-feature-reference-a"].state).toBe("backlog");
    expect(tree.tasks["ordinary-task"].state).toBe("active");
  });

  test("quick-refill assigns loop support follow-up tasks", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "aks-spec-verification-loop",
          active_task_ids: ["aks-spec-verification-loop"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              priority: "P1",
              workflow: "spec-loop-controller",
              children: ["reconcile-spec-loop-error-fleet"],
              goal: "Verify every spec.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["all specs pass"],
              conflict_scope: ["spec-loop"],
            },
            "reconcile-spec-loop-error-fleet": {
              id: "reconcile-spec-loop-error-fleet",
              parent_id: "aks-spec-verification-loop",
              state: "backlog",
              status: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Reconcile retry-drained fleet spec-loop errors.",
              outputs: [".state/spec-loop/state.json", "evidence/archive/"],
              acceptance: ["sampled specs classified"],
              conflict_scope: ["spec-loop-followup:error:fleet"],
              context: {
                specLoopFollowup: true,
                featureFamily: "fleet",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: "owner should not run",
      }),
      summarize: () => "",
    } as any);

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("quick-refill assigned 1 task");
    expect(dispatched.map((event) => event.payload.taskId)).toEqual([
      "reconcile-spec-loop-error-fleet",
    ]);
    expect(tree.tasks["reconcile-spec-loop-error-fleet"].state).toBe("active");
  });

  test("quick-refill pulses a loop controller root", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-reference-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              workflow: "feature-reference-loop-controller",
              children: ["collect-feature-reference-a"],
              goal: "Collect feature references.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["all features terminal"],
              conflict_scope: ["feature-reference-loop"],
              context: {
                workflowProgress: {
                  completionReady: false,
                  pending: 1,
                  running: 0,
                },
              },
            },
            "collect-feature-reference-a": {
              id: "collect-feature-reference-a",
              parent_id: "aks-feature-reference-loop",
              state: "backlog",
              status: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              workflow: "feature-reference-collector",
              children: [],
              goal: "Collect feature reference for a.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["state updated"],
              conflict_scope: ["feature-reference:a"],
              context: {
                loopTaskId: "aks-feature-reference-loop",
                featureKey: "a",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: "owner should not run",
      }),
      summarize: () => "",
    } as any);

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(dispatched).toEqual([
      expect.objectContaining({
        type: "project.task.tick",
        payload: expect.objectContaining({
          action: "feature-reference-loop",
          taskId: "aks-feature-reference-loop",
          task_id: "aks-feature-reference-loop",
          target: {
            project: "aks-rp-e2e",
            taskId: "aks-feature-reference-loop",
          },
        }),
      }),
    ]);
    expect(result.message).toContain(
      "pulsed 1 loop controller(s): aks-feature-reference-loop",
    );
    expect(tree.tasks["aks-feature-reference-loop"].state).toBe("backlog");
    expect(tree.tasks["collect-feature-reference-a"].state).toBe("backlog");
  });

  test("quick-refill creates a fresh worker session when the stored session is terminal", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dbPath = join(appDir, ".state", "may.db");
    const db = new Database(dbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        agent text not null,
        task text not null,
        status text not null,
        kind text,
        source text,
        parentSessionId text,
        requestId text,
        workflowRunId text,
        projectId text,
        startedAt integer not null,
        endedAt integer,
        error text,
        outcome text,
        opCount integer default 0,
        stepLabel text,
        lastActivityAt integer
      )
    `);
    db.query(
      `insert into sessions (
        sessionId, agent, task, status, kind, source, startedAt, endedAt, outcome
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "s_task_backlog-task",
      "aks-explorer",
      "previous worker run",
      "done",
      "workflow",
      "workflow:task-worker",
      Date.now() - 10_000,
      Date.now() - 5_000,
      "done",
    );
    db.close();

    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Run after a previous terminal session.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
              session_id: "s_task_backlog-task",
              session_history: ["s_task_backlog-task"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const priorDb = process.env.MAY_DB_PATH;
    process.env.MAY_DB_PATH = dbPath;
    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          dispatched.push({ type, payload });
        },
        runAgent: async () => ({ status: "success" }),
        runAgentSession: async () => ({
          status: "success",
          message: "owner should not run",
        }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].payload.taskId).toBe("backlog-task");
      expect(String(dispatched[0].payload.sessionId)).toStartWith(
        "s_task_backlog-task_retry_",
      );
      expect(dispatched[0].payload.sessionId).not.toBe("s_task_backlog-task");

      const tree = await readTaskTreeJson(appDir);
      expect(tree.tasks["backlog-task"].trace.previous_session_id).toBe(
        "s_task_backlog-task",
      );
      expect(tree.tasks["backlog-task"].trace.stale_active_fresh_session).toBe(
        true,
      );
    } finally {
      if (priorDb === undefined) delete process.env.MAY_DB_PATH;
      else process.env.MAY_DB_PATH = priorDb;
    }
  });

  test("short-circuits task-completed wake after first bounded successor assignment", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Take the next truthful successor.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "task-completed",
            completedTaskId: "recently-finished-task",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "task-completed wake already achieved a truthful refill/assignment",
    );
    expect(result.message).toContain("backlog-task");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.assigned",
      payload: {
        taskId: "backlog-task",
        sessionId: "s_task_backlog-task",
      },
    });

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["assigned-refill-short-circuit"]');
    expect(plannerRuns).toContain('"assigned_task_ids":["backlog-task"]');
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("short-circuits watchdog-capacity-underfilled wake after first refill assignment even below maxConcurrent", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Refill underfilled capacity with one bounded task.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-capacity-underfilled",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "watchdog-capacity-underfilled wake already achieved a truthful refill/assignment",
    );
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(1);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["assigned-refill-short-circuit"]');
    expect(plannerRuns).toContain('"assigned_task_ids":["backlog-task"]');
    expect(plannerRuns).not.toContain('"steps":["quick-refill"]');
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("quick refill synchronizes project.json live readout from non-done tree leaves", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["blocked-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "blocked-wait": {
              id: "blocked-wait",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Wait for returned proof.",
              outputs: ["evidence/archive/blocked.md"],
              acceptance: ["done"],
              blocker: {
                condition: "external wait",
                resume_at: "2099-01-01T00:00:00.000Z",
              },
            },
            "done-focus": {
              id: "done-focus",
              parent_id: "project",
              state: "done",
              kind: "focus_plan",
              children: [],
              goal: "old focus",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-wait",
                resumeAt: "2099-01-01T00:00:00.000Z",
              },
            ],
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success", message: "should not run" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Blocked-frontier wake is already represented by structured future-dated external waits",
    );
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    expect(projectState.currentState.activeTaskId).toBeNull();
    expect(projectState.currentState.metrics.activeLeafCount).toBe(0);
    expect(projectState.currentState.metrics.blockedLeafCount).toBe(1);
    expect(projectState.currentState.metrics.reviewLeafCount).toBe(0);
    expect(projectState.currentState.metrics.waitingLeafCount).toBe(0);
    expect(projectState.currentState.metrics.runnableLeafCount).toBe(0);
    expect(projectState.currentFocus.activeTaskIds).toEqual(["blocked-wait"]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual(["blocked-wait"]);
    expect(projectState.currentFocus.focusPlanId).toBeUndefined();
    expect(projectState.currentFocus.focusPlanStatus).toBeUndefined();
    expect(String(projectState.currentState.summary)).toContain(
      "blocked-only exact wait stewardship",
    );
    expect(String(projectState.currentFocus.summary)).toContain(
      "blocked-only wait stewardship",
    );
    expect(String(projectState.currentFocus.nextAction)).toContain(
      "Preserve the exact blocked waits",
    );
  });

  test("aggressive-push mode does not short-circuit underfilled capacity after one refill", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(appDir, "project.json"),
      `${JSON.stringify({ policy: { mode: "aggressive-push" } }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Refill underfilled capacity with one bounded task.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-capacity-underfilled",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: underfilled" }
          : { status: "success", message: "planner kept pushing" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("aggressive-push mode");
    expect(dispatched).toHaveLength(1);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).not.toContain(
      '"steps":["assigned-refill-short-circuit"]',
    );
    expect(plannerRuns).toContain('"ran_agent":true');
  });

  test("short-circuits blocked-frontier review when all blocked leaves are future-dated exact waits", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["blocked-a", "blocked-b"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "blocked-a": {
              id: "blocked-a",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Wait for returned proof.",
              outputs: ["evidence/archive/blocked-a.md"],
              acceptance: ["done"],
              blocker:
                "Blocked only on returned authoritative proof or the first owner follow-up on or after 2099-06-26.",
            },
            "blocked-b": {
              id: "blocked-b",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Wait for approval.",
              outputs: ["evidence/archive/blocked-b.md"],
              acceptance: ["done"],
              blocker:
                "Exact external approval wait; resume on returned approval proof or on/after 2099-06-27.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 3",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker:
                  "Blocked only on returned authoritative proof or the first owner follow-up on or after 2099-06-26.",
                resumeCondition:
                  "Resume when returned proof arrives or the follow-up window opens.",
                fallbackAt: "2099-06-26T00:00:00.000Z",
                fallbackAction:
                  "Recheck returned proof and escalate if it is still missing.",
              },
              {
                taskId: "blocked-b",
                blocker:
                  "Exact external approval wait; resume on returned approval proof or on/after 2099-06-27.",
                resumeAt: "2099-06-27T00:00:00.000Z",
                resumeCondition:
                  "Resume when approval proof arrives or the follow-up window opens.",
                fallbackAt: "2099-06-28T00:00:00.000Z",
                fallbackAction:
                  "Recheck approval proof and escalate if it is still missing.",
              },
            ],
            blockedCount: 2,
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Blocked-frontier wake is already represented by structured future-dated external waits",
    );
    expect(result.message).toContain("blocked-a");
    expect(result.message).toContain("blocked-b");
    expect(result.message).toContain("2099-06-26T00:00:00.000Z");
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain(
      '"steps":["blocked-frontier-future-wait-noop"]',
    );
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("does not skip blocked-frontier owner review from prose-only dates", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["blocked-a"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "blocked-a": {
              id: "blocked-a",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Wait for returned proof.",
              outputs: ["evidence/archive/blocked-a.md"],
              acceptance: ["done"],
              blocker:
                "Blocked only on returned authoritative proof or the first owner follow-up on or after 2099-06-26.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 3",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker:
                  "Blocked only on returned authoritative proof or the first owner follow-up on or after 2099-06-26.",
              },
            ],
            blockedCount: 1,
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: review blocker" }
          : { status: "success", message: "planner reviewed blocker" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(result.message).toContain("planner reviewed blocker");
  });

  test("runs owner review instead of seeding model-gap tasks in workflow code", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(projectDir, "specs", "feature-a-create.json"),
      "{}\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "replays", "feature-a-create.ts"),
      "export {};\n",
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 2",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-open-work-reconcile",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "owner reviewed gaps" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Planner assigned no tasks");
    expect(prompts).toHaveLength(2);
    expect(dispatched).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["event-review","planning-update"]');
    expect(plannerRuns).toContain('"ran_agent":true');
    expect(plannerRuns).not.toContain('"seeded_task_ids"');
  });

  test("wakes owner for watchdog-stale active work without mutating task state", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "stale-task",
          active_task_ids: ["stale-task"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["stale-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "stale-task": {
              id: "stale-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_stale-task",
              children: [],
              goal: "Restart stale task from task-tree state.",
              outputs: ["evidence/archive/stale-task.md"],
              acceptance: ["fresh worker session completes"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-stale-active-review",
            staleActiveTasks: [
              { taskId: "stale-task", reason: "session-not-running" },
            ],
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Planner assigned no tasks");
    expect(prompts).toHaveLength(2);
    expect(prompts.join("\n")).toContain("watchdog-stale-active-review");
    expect(dispatched).toHaveLength(0);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(updated.tasks["stale-task"].state).toBe("active");
    expect(updated.tasks["stale-task"].status).toBeUndefined();
    expect(updated.tasks["stale-task"].trace).toBeUndefined();

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"ran_agent":true');
  });

  test("skips owner session for false-positive stale-active watchdog review", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "already-done-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Keep doing real work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "already-done-task": {
              id: "already-done-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Already complete.",
              outputs: ["evidence/archive/done-task.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-stale-active-review",
            staleActiveTasks: [
              { taskId: "missing-task", reason: "session-not-running" },
              { taskId: "already-done-task", reason: "session-not-running" },
            ],
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("false positive");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Watchdog stale-active review was a false positive",
    );
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for false-positive stale-active watchdog review even with unrelated blocked frontier", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "already-done-task", "blocked-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Keep doing real work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "already-done-task": {
              id: "already-done-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Already complete.",
              outputs: ["evidence/archive/done-task.md"],
              acceptance: ["done"],
            },
            "blocked-task": {
              id: "blocked-task",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Unrelated blocked work.",
              outputs: ["evidence/archive/blocked-task.md"],
              acceptance: ["done"],
              blocker: "Awaiting external unblock.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-stale-active-review",
            staleActiveTasks: [
              { taskId: "missing-task", reason: "session-not-running" },
              { taskId: "already-done-task", reason: "session-not-running" },
            ],
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("false positive");
    expect(result.message).toContain("settled/non-active");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(updated.tasks["blocked-task"].state).toBe("blocked");
    expect(updated.tasks["blocked-task"].blocker).toBe(
      "Awaiting external unblock.",
    );

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Watchdog stale-active review was a false positive",
    );
    expect(plannerRuns).toContain(
      "settled/non-active after live-tree revalidation",
    );
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for stale watchdog-runnable-backlog packets whose ids already moved active", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const treeUpdatedAt = "2026-06-17T20:30:13.409Z";
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: treeUpdatedAt,
          active_task_id: "policy-addon-audit",
          active_task_ids: ["policy-addon-audit", "policy-addon-pubsub"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["policy-addon-audit", "policy-addon-pubsub"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "policy-addon-audit": {
              id: "policy-addon-audit",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_policy-addon-audit",
              children: [],
              goal: "Continue audit spec authoring.",
              outputs: ["evidence/archive/policy-addon-audit.md"],
              acceptance: ["done"],
            },
            "policy-addon-pubsub": {
              id: "policy-addon-pubsub",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_policy-addon-pubsub",
              children: [],
              goal: "Continue pubsub spec authoring.",
              outputs: ["evidence/archive/policy-addon-pubsub.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-runnable-backlog",
            runnableBacklogTaskIds: [
              "policy-addon-audit",
              "policy-addon-pubsub",
            ],
            runnableBacklogTreeUpdatedAt: treeUpdatedAt,
            runnableBacklogSnapshotAt: "2026-06-17T20:30:13.258Z",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog runnable-backlog wake is stale");
    expect(result.message).toContain("policy-addon-audit");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["stale-runnable-backlog-noop"]');
    expect(plannerRuns).toContain('"ran_agent":false');
    expect(plannerRuns).toContain(
      '"active_task_ids":["policy-addon-audit","policy-addon-pubsub"]',
    );
    expect(plannerRuns).toContain(
      "trigger tree updated_at=2026-06-17T20:30:13.409Z",
    );
  });

  test("skips owner session for stale watchdog-review-pending packets after review is already settled", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "settled-review-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Continue active work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "settled-review-task": {
              id: "settled-review-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Already accepted review task.",
              outputs: ["evidence/archive/settled-review-task.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-review-pending",
            reviewTasks: [
              {
                taskId: "settled-review-task",
                updatedAt: "2026-06-25T12:20:51.490Z",
              },
            ],
            reviewCount: 1,
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog review-pending wake is stale");
    expect(result.message).toContain("settled-review-task");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["stale-review-pending-noop"]');
    expect(plannerRuns).toContain('"ran_agent":false');
    expect(plannerRuns).toContain('"active_task_ids":["active-task"]');
  });

  test("skips owner session for stale watchdog-review-pending packets even when unrelated live review backlog remains", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "active-task",
                "settled-review-task",
                "other-review-task",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Continue active work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "settled-review-task": {
              id: "settled-review-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Already accepted review task.",
              outputs: ["evidence/archive/settled-review-task.md"],
              acceptance: ["done"],
            },
            "other-review-task": {
              id: "other-review-task",
              parent_id: "project",
              state: "review",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Unrelated review still pending.",
              outputs: ["evidence/archive/other-review-task.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-review-pending",
            reviewTasks: [
              {
                taskId: "settled-review-task",
                updatedAt: "2026-06-25T12:20:51.490Z",
              },
            ],
            reviewCount: 2,
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog review-pending wake is stale");
    expect(result.message).toContain("settled-review-task");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["stale-review-pending-noop"]');
    expect(plannerRuns).toContain('"ran_agent":false');
    expect(plannerRuns).toContain('"active_task_ids":["active-task"]');
  });

  test("skips owner session for stale watchdog-runnable-backlog packets even when unrelated blocked leaves exist", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const treeUpdatedAt = "2026-06-18T01:52:39.649Z";
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: treeUpdatedAt,
          active_task_id:
            "managedsystem-disable-migration-staging-frontier-20260618",
          active_task_ids: [
            "managedsystem-disable-migration-staging-frontier-20260618",
            "vm-prerelease-app-routing-ownership-repair-20260618",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "managedsystem-disable-migration-staging-frontier-20260618",
                "vm-prerelease-app-routing-ownership-repair-20260618",
                "app-routing-vm-prerelease-handwritten-gap-matrix-20260618",
                "app-routing-vm-prerelease-handwritten-source-blocker-matrix-20260618",
                "aad-rbac-managed-v2-reset-stable-empty-rerun-await-aad-env-20260617",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "managedsystem-disable-migration-staging-frontier-20260618": {
              id: "managedsystem-disable-migration-staging-frontier-20260618",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id:
                "s_task_managedsystem-disable-migration-staging-frontier-20260618",
              children: [],
              goal: "Continue ManagedSystem staging frontier work.",
              outputs: [
                "evidence/archive/managedsystem-disable-migration-staging-frontier-20260618.md",
              ],
              acceptance: ["done"],
            },
            "vm-prerelease-app-routing-ownership-repair-20260618": {
              id: "vm-prerelease-app-routing-ownership-repair-20260618",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id:
                "s_task_vm-prerelease-app-routing-ownership-repair-20260618",
              children: [],
              goal: "Repair VM prerelease app-routing ownership mapping.",
              outputs: [
                "evidence/archive/vm-prerelease-app-routing-ownership-repair-20260618.md",
              ],
              acceptance: ["done"],
            },
            "app-routing-vm-prerelease-handwritten-gap-matrix-20260618": {
              id: "app-routing-vm-prerelease-handwritten-gap-matrix-20260618",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Old superseded handwritten gap matrix leaf.",
              outputs: [
                "evidence/archive/app-routing-vm-prerelease-handwritten-gap-matrix-20260618.md",
              ],
              acceptance: ["done"],
            },
            "app-routing-vm-prerelease-handwritten-source-blocker-matrix-20260618":
              {
                id: "app-routing-vm-prerelease-handwritten-source-blocker-matrix-20260618",
                parent_id: "project",
                state: "done",
                kind: "domain_leaf",
                priority: "P2",
                owner: "aks-explorer",
                children: [],
                goal: "Replacement blocker matrix leaf already accepted.",
                outputs: [
                  "evidence/archive/app-routing-vm-prerelease-handwritten-source-blocker-matrix-20260618.md",
                ],
                acceptance: ["done"],
              },
            "aad-rbac-managed-v2-reset-stable-empty-rerun-await-aad-env-20260617":
              {
                id: "aad-rbac-managed-v2-reset-stable-empty-rerun-await-aad-env-20260617",
                parent_id: "project",
                state: "blocked",
                kind: "domain_leaf",
                priority: "P2",
                owner: "aks-explorer",
                children: [],
                goal: "Unrelated blocked AAD rerun leaf.",
                outputs: [
                  "evidence/archive/aad-rbac-managed-v2-reset-stable-empty-rerun-await-aad-env-20260617.md",
                ],
                acceptance: ["done"],
                blocker: "Awaiting external AAD environment gate.",
              },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-runnable-backlog",
            runnableBacklogTaskIds: [
              "app-routing-vm-prerelease-handwritten-gap-matrix-20260618",
            ],
            runnableBacklogTreeUpdatedAt: treeUpdatedAt,
            runnableBacklogSnapshotAt: "2026-06-18T01:52:52.759Z",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog runnable-backlog wake is stale");
    expect(result.message).toContain(
      "app-routing-vm-prerelease-handwritten-gap-matrix-20260618",
    );
    expect(result.message).toContain(
      'settled/missing=["app-routing-vm-prerelease-handwritten-gap-matrix-20260618"]',
    );
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["stale-runnable-backlog-noop"]');
    expect(plannerRuns).toContain('"ran_agent":false');
    expect(plannerRuns).toContain(
      '"active_task_ids":["managedsystem-disable-migration-staging-frontier-20260618","vm-prerelease-app-routing-ownership-repair-20260618"]',
    );
  });

  test("skips owner session for already-settled task completion while active work runs", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "completed-parent"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Keep doing real work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "completed-parent": {
              id: "completed-parent",
              parent_id: "project",
              state: "done",
              kind: "work",
              children: [],
              goal: "Already rolled up.",
              outputs: ["evidence/archive/completed.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "task-completed",
            completedTaskId: "archived-review-task",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("already settled");
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain("Task-completed wake is already settled");
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for regular-learning tick when active work already covers the frontier", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "blocked-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Keep doing real work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "blocked-task": {
              id: "blocked-task",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Exact external wait.",
              outputs: ["evidence/archive/blocked-task.md"],
              acceptance: ["done"],
              blocker: "Awaiting exact external approval.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "regular-learning-tick",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Regular-learning tick is already covered by active work",
    );
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Regular-learning tick is already covered by active work",
    );
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for already-settled task completion when completedTaskId is nested under trigger data.params", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "completed-parent"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-task": {
              id: "active-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              session_id: "s_task_active-task",
              children: [],
              goal: "Keep doing real work.",
              outputs: ["evidence/archive/active-task.md"],
              acceptance: ["done"],
            },
            "completed-parent": {
              id: "completed-parent",
              parent_id: "project",
              state: "done",
              kind: "work",
              children: [],
              goal: "Already rolled up.",
              outputs: ["evidence/archive/completed.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "task-completed",
            params: {
              completedTaskId: "archived-review-task",
            },
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("already settled");
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain("Task-completed wake is already settled");
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for already-settled task completion when only blocked frontier remains", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["blocked-holder"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "blocked-holder": {
              id: "blocked-holder",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Waiting on exact external response.",
              outputs: ["evidence/archive/blocked-holder.md"],
              acceptance: ["resume only when reply arrives"],
              blocker: {
                reason: "external reply pending",
                resume_condition: "authoritative source-holder reply received",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "task-completed",
            completedTaskId:
              "serverless-virtual-nodes-missing-delegation-source-holder-outbound-send-packet-20260619",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("already settled");
    expect(result.message).toContain("completed task no longer exists");
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain('"ran_agent":false');
    expect(plannerRuns).toContain(
      "completed task no longer exists in the live tree",
    );
  });

  test("skips owner session when another planner session is already running for the same owner", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dbPath = join(appDir, ".state", "may.db");
    await mkdir(join(appDir, ".state"), { recursive: true });
    const db = new Database(dbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        agent text not null,
        task text not null,
        status text not null,
        kind text,
        source text,
        parentSessionId text,
        requestId text,
        workflowRunId text,
        projectId text,
        startedAt integer not null,
        endedAt integer,
        error text,
        outcome text,
        opCount integer default 0,
        stepLabel text,
        lastActivityAt integer
      )
    `);
    db.query(
      `insert into sessions (
        sessionId, agent, task, status, kind, source, startedAt, stepLabel
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "s_existing_planner",
      "aks-explorer",
      "existing planner wake",
      "running",
      "workflow",
      "workflow:project-planner",
      Date.now(),
      "aks-explorer",
    );
    db.close();

    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "One bounded refill leaf.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const priorDb = process.env.MAY_DB_PATH;
    process.env.MAY_DB_PATH = dbPath;
    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          dispatched.push({ type, payload });
        },
        runAgent: async () => ({ status: "success" }),
        runAgentSession: async (_agent: string, task: string) => {
          prompts.push(task);
          return { status: "success", message: "should not run" };
        },
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "another app-ops planner session is already running",
      );
      expect(prompts).toHaveLength(0);
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toMatchObject({
        type: "project.task.assigned",
        payload: {
          taskId: "backlog-task",
          sessionId: "s_task_backlog-task",
        },
      });

      const plannerRuns = await readFile(
        join(appDir, ".state", "planner-runs.jsonl"),
        "utf8",
      );
      expect(plannerRuns).toContain('"steps":["planner-session-dedupe-noop"]');
      expect(plannerRuns).toContain('"ran_agent":false');
    } finally {
      if (priorDb === undefined) delete process.env.MAY_DB_PATH;
      else process.env.MAY_DB_PATH = priorDb;
    }
  });

  test("short-circuits planner-timeout-underfilled-frontier wake after first refill assignment", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "One bounded refill leaf.",
              outputs: ["evidence/archive/backlog.md"],
              acceptance: ["done"],
              conflict_scope: ["backlog"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "planner-timeout-underfilled-frontier",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "planner-timeout-underfilled-frontier wake already achieved a truthful refill/assignment",
    );
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(1);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["assigned-refill-short-circuit"]');
    expect(plannerRuns).toContain('"assigned_task_ids":["backlog-task"]');
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("does not create model-gap tasks in workflow code when owner review times out under capacity", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(projectDir, "specs", "feature-a-create.json"),
      "{}\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "replays", "feature-a-create.ts"),
      "export {};\n",
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["spec-runner-and-replays"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-runner-and-replays": {
              id: "spec-runner-and-replays",
              parent_id: "project",
              state: "backlog",
              kind: "work",
              children: [],
              goal: "Execute specs and replays.",
              outputs: ["runs/"],
              acceptance: ["gaps verified by execution"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 2",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: underfilled" }
          : {
              status: "interrupted",
              message: 'Agent step "aks-explorer" timed out after 300000ms',
            };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Planner assigned no tasks");
    expect(dispatched).toHaveLength(0);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(Object.keys(updated.tasks).sort()).toEqual([
      "project",
      "spec-runner-and-replays",
    ]);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).not.toContain('"seeded_task_ids"');
    expect(plannerRuns).toContain('"ran_agent":true');
  });

  test("does not create source/spec backlog in workflow code when execution is full", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(projectDir, "specs", "feature-a-create.json"),
      "{}\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "replays", "feature-a-create.ts"),
      "export {};\n",
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "slow-execution",
          active_task_ids: ["slow-execution"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [
                "spec-runner-and-replays",
                "go-e2ev3-source-discovery",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-runner-and-replays": {
              id: "spec-runner-and-replays",
              parent_id: "project",
              state: "backlog",
              kind: "work",
              children: ["slow-execution"],
              goal: "Execute specs and replays.",
              outputs: ["runs/"],
              acceptance: ["gaps verified by execution"],
            },
            "go-e2ev3-source-discovery": {
              id: "go-e2ev3-source-discovery",
              parent_id: "project",
              state: "backlog",
              kind: "work",
              children: [],
              goal: "Explore source and build specs.",
              outputs: ["features/", "specs/", "replays/"],
              acceptance: ["source-grounded specs exist"],
            },
            "slow-execution": {
              id: "slow-execution",
              parent_id: "spec-runner-and-replays",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Long staging execution.",
              outputs: ["runs/executions/slow"],
              acceptance: ["done"],
              conflict_scope: ["staging:slow"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: execution full" }
          : {
              status: "interrupted",
              message: 'Agent step "aks-explorer" timed out after 300000ms',
            };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Planner assigned no tasks");
    expect(dispatched).toHaveLength(0);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(Object.keys(updated.tasks).sort()).toEqual([
      "go-e2ev3-source-discovery",
      "project",
      "slow-execution",
      "spec-runner-and-replays",
    ]);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"status":"settled"');
    expect(plannerRuns).not.toContain('"seeded_task_ids"');
  });

  test("surfaces high-priority human steering before routine planning", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const prompts: string[] = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.planning.requested",
          source: "agent:aks-explorer",
          owner: "agent:aks-explorer",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-stale-active-review",
          },
        }),
        "```",
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      query: {
        events: () => ({
          rows: [
            {
              id: 42,
              event_type: "project.planning.requested",
              source: "codex",
              owner: "agent:aks-explorer",
              urgency: "high",
              timestamp: Date.now(),
              data: JSON.stringify({
                project: "aks-rp-e2e",
                reason: "human-steering",
                action: "task-tree-correction",
                params: {
                  task_id: "project",
                  action: "root_task_tree_correction",
                  comment:
                    "The live root task is missing a direct child lane for Go e2ev3 source discovery.",
                  expected_parent: "project",
                  expected_live_root_child:
                    "go-e2ev3-source-discovery-and-specs",
                  required_planner_decision:
                    "create_root_child_or_record_explicit_refusal_reason",
                },
              }),
            },
          ],
          rowCount: 1,
          limit: 50,
          truncated: false,
        }),
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return task.includes("Planner Event Review Step")
          ? { status: "success", message: "EVENT_REVIEW: handle steering" }
          : { status: "success", message: "planner handled steering" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      expect(prompt).toContain("Pending Human Steering Overrides");
      expect(prompt).toContain("go-e2ev3-source-discovery-and-specs");
      expect(prompt).toContain(
        "create_root_child_or_record_explicit_refusal_reason",
      );
    }
    expect(prompts[1]).toContain(
      "Process\n  it before routine watchdog/refill work",
    );
  });
});
