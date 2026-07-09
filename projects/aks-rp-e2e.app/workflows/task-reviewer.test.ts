import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute as executePlanner } from "./project-planner.ts";
import { execute } from "./task-reviewer.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-task-reviewer-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  return { appDir, projectDir };
}

async function writeTree(
  appDir: string,
  input: {
    state?: string;
    attemptId?: string;
    context?: Record<string, unknown>;
    trace?: Record<string, unknown>;
  } = {},
) {
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
            state: "active",
            children: ["review-task"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "review-task": {
            id: "review-task",
            parent_id: "project",
            state: input.state ?? "review",
            kind: "domain_leaf",
            workflow: "single-spec-verifier",
            priority: "P1",
            children: [],
            goal: "Verify one spec on GitHub.",
            inputs: [],
            outputs: ["runs/test-results/"],
            acceptance: ["GitHub live test passes"],
            forbidden: [],
            conflict_scope: ["spec:one"],
            depends_on: [],
            context: input.context,
            trace: {
              current_attempt_id: input.attemptId ?? "attempt-1",
              last_worker_result: "done",
              last_worker_summary: "GitHub live workflow passed.",
              ...(input.trace ?? {}),
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event
\`\`\`json
${JSON.stringify(event)}
\`\`\``;
}

function completionEvent(
  input: {
    taskId?: string;
    attemptId?: string;
    result?: string;
    summary?: string;
    evidenceRefs?: string[];
    workflowResult?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  const taskId = input.taskId ?? "review-task";
  const attemptId = input.attemptId ?? "attempt-1";
  const result = input.result ?? "done";
  const summary = input.summary ?? "GitHub live workflow passed.";
  const evidenceRefs = input.evidenceRefs ?? ["runs/test-results/test-1"];
  const workflowResult = input.workflowResult;
  return {
    type: "project.task.completed",
    target: { project: "aks-rp-e2e", taskId },
    project: "aks-rp-e2e",
    taskId,
    attemptId,
    result,
    summary,
    completion: {
      taskId,
      attemptId,
      result,
      summary,
      evidenceRefs,
      ...(workflowResult ? { workflowResult } : {}),
    },
  };
}

describe("task reviewer", () => {
  test("emits structured reviewed event for a current review task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return {
          status: "success",
          message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "accept",
  "confidence": "high",
  "summary": "Live GitHub proof satisfies the task.",
  "findings": ["artifact includes passing live run"],
  "feedback": [],
  "suggestedFollowups": []
}
\`\`\``,
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Task Review Mode");
    expect(prompts[0]).toContain("Do not mutate the task tree");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        attemptId: "attempt-1",
        decision: "accept",
        confidence: "high",
        summary: "Live GitHub proof satisfies the task.",
        findings: ["artifact includes passing live run"],
      },
    });

    const runs = await readFile(
      join(appDir, ".state", "task-reviewer-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"result":"project.task.reviewed"');
  });

  test("emitted reviewed event is directly consumable by the planner", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "accept",
  "confidence": "high",
  "summary": "Live GitHub proof satisfies the task.",
  "findings": ["artifact includes passing live run"],
  "feedback": [],
  "suggestedFollowups": []
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    const prompts: string[] = [];
    const plannerResult = await executePlanner({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        triggerEvent({
          type: dispatched[0].type,
          data: dispatched[0].payload,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return { status: "success", message: "owner should not run" };
      },
      runAgentSession: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return { status: "success", message: "owner should not run" };
      },
      summarize: () => "",
    } as any);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    ) as { tasks: Record<string, any> };
    expect(plannerResult.status).toBe("done");
    expect(plannerResult.message).toContain(
      "Applied accept review for review-task",
    );
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(prompts).toHaveLength(0);
  });

  test("ignores stale completion when task is no longer in review", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, { state: "done" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("not review");
    expect(dispatched).toEqual([]);
  });

  test("emits redo without reviewer session for empty worker completion", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "blocked",
            summary: "Agent ended with an empty assistant turn",
            evidenceRefs: [],
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "redo",
        confidence: "high",
        findings: ["worker-empty-assistant-turn", "worker-no-evidence"],
      },
    });
  });

  test("emits redo when terminal pipeline wait is not actually reviewed", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: {
        terminalPipelineWaitReview: {
          runId: "171344670",
          runStatus: "completed",
          runConclusion: "success",
          namedSpecIds: ["spec.virtualmachines.mixed-sku-deallocate"],
        },
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "partial",
            summary:
              "Azure DevOps pipeline run 171344670 is terminal; review the run artifact/result and update the spec-loop state.",
            evidenceRefs: [],
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "redo",
        confidence: "high",
        findings: [
          "terminal-pipeline-wait-not-reviewed",
          "worker-returned-review-request-instead-of-result",
        ],
      },
    });
  });

  test("accepts terminal pipeline wait with structured same-spec live proof", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: {
        terminalPipelineWaitReview: {
          runId: "171344670",
          runStatus: "completed",
          runConclusion: "success",
          namedSpecIds: ["spec.virtualmachines.mixed-sku-deallocate"],
        },
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "done",
            summary:
              "Spec spec.virtualmachines.mixed-sku-deallocate live artifact passed.",
            evidenceRefs: [
              "runs/test-results/test_123/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
            ],
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "spec-result-review",
              status: "done",
              subject: {
                kind: "spec",
                id: "spec.virtualmachines.mixed-sku-deallocate",
              },
              artifacts: [
                "runs/test-results/test_123/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
              ],
              details: {
                backend: "azure-devops-pipeline",
                runId: "171344670",
                resultPath:
                  "runs/test-results/test_123/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
                specStatus: "pass",
                liveVerified: true,
                resourceGroup: "rg-plan-001-proof",
                clusterName: "aks-plan-001-proof",
              },
            },
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "accept",
        confidence: "high",
        findings: [
          "run:171344670",
          "result:runs/test-results/test_123/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
          "status:pass",
          "liveClusterObserved:true",
          "resourceGroup:rg-plan-001-proof",
          "clusterName:aks-plan-001-proof",
        ],
      },
    });
  });

  test("accepts terminal pipeline wait with structured same-spec failure proof", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: {
        terminalPipelineWaitReview: {
          runId: "171349474",
          runStatus: "completed",
          runConclusion: "failed",
          namedSpecIds: ["spec.cluster-autoscaler.mincount-recovery"],
        },
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "partial",
            summary:
              "Spec spec.cluster-autoscaler.mincount-recovery live artifact failed.",
            evidenceRefs: [
              "runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
            ],
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "single-spec-verifier",
              status: "partial",
              subject: {
                kind: "spec",
                id: "spec.cluster-autoscaler.mincount-recovery",
              },
              artifacts: [
                "runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
              ],
              details: {
                backend: "azure-devops-pipeline",
                runId: "171349474",
                resultPath:
                  "runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
                specStatus: "fail",
                liveVerified: false,
                liveClusterObserved: true,
                resourceGroup: "rg-plan-001-fail",
                clusterName: "aks-plan-001-fail",
              },
            },
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "accept",
        confidence: "high",
        summary:
          "Terminal pipeline wait review consumed the returned artifact and recorded a same-spec non-passing result.",
        findings: [
          "run:171349474",
          "result:runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
          "status:fail",
          "liveClusterObserved:true",
          "resourceGroup:rg-plan-001-fail",
          "clusterName:aks-plan-001-fail",
        ],
      },
    });
  });

  test("accepts terminal pipeline wait with structured grouped spec results", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: {
        terminalPipelineWaitReview: {
          runId: "171342018",
          runStatus: "completed",
          runConclusion: "failed",
          namedSpecIds: [],
        },
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "partial",
            summary: "Grouped network-acns run returned two error results.",
            evidenceRefs: [
              "runs/test-results/test_20260708083338198_o5hx8d_500854/result.json",
            ],
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "single-spec-verifier",
              status: "partial",
              subject: {
                kind: "spec-group",
                id: "network-acns",
              },
              artifacts: [
                "runs/test-results/test_20260708083338198_o5hx8d_500854/result.json",
              ],
              details: {
                backend: "azure-devops-pipeline",
                runId: "171342018",
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
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "accept",
        confidence: "high",
        summary:
          "Terminal pipeline wait review consumed the returned artifact and recorded same-spec non-passing result(s).",
      },
    });
    expect(dispatched[0].payload.findings).toContain(
      "spec:spec.network-acns.cilium-observability:error",
    );
    expect(dispatched[0].payload.findings).toContain(
      "spec:spec.network-acns.retina-enterprise:error",
    );
  });

  test("accepts structured spec result on ordinary artifact-review task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "partial",
            summary: "Reviewed ADO run 171341417 artifact result.",
            evidenceRefs: [
              "runs/test-results/test_20260708082648685_e95l27_817307/result.json",
            ],
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "spec-result-review",
              status: "partial",
              subject: {
                kind: "spec",
                id: "spec.network-cni.cilium-stop-start",
              },
              artifacts: [
                "runs/test-results/test_20260708082648685_e95l27_817307/result.json",
              ],
              details: {
                backend: "azure-devops-pipeline",
                runId: "171341417",
                resultPath:
                  "runs/test-results/test_20260708082648685_e95l27_817307/artifacts/network-cni-cilium-stop-start/spec-runner/result.json",
                specResults: [
                  {
                    specId: "spec.network-cni.cilium-stop-start",
                    status: "error",
                    reason:
                      "Failed to resolve DefaultVersion(): HTTP 400; version=(missing)",
                    artifactRefs: [
                      "runs/test-results/test_20260708082648685_e95l27_817307/artifacts/network-cni-cilium-stop-start/spec-runner/result.json",
                    ],
                  },
                ],
              },
            },
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "accept",
        confidence: "high",
        summary:
          "Structured artifact review consumed the returned artifact and recorded a same-spec non-passing result.",
      },
    });
  });

  test("emits redo for fix-forward completion missing structured result", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, { context: { workflow: "fix-forward" } });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "done",
            summary: "Fixed it based on evidence, but no structured result.",
            evidenceRefs: ["evidence/fix.md"],
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "redo",
        confidence: "high",
        findings: [
          "fix-forward-structured-result-missing",
          "missing:workflowResult.details.fixForward",
        ],
      },
    });
  });

  test("escalates repeated fix-forward completion missing structured result", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: { workflow: "fix-forward" },
      trace: {
        review_reject_reason:
          "Redo the task and finish with FIX_FORWARD_RESULT containing subject, classification, diagnosis, minimumDiagnosisPacket, verification, nextAction, and nextActionReason.",
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "done",
            summary: "Retried but still produced prose only.",
            evidenceRefs: ["evidence/fix.md"],
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "escalate",
        confidence: "high",
        findings: [
          "fix-forward-structured-result-missing-repeated",
          "missing:workflowResult.details.fixForward",
        ],
      },
    });
  });

  test("emits redo for compact fix-forward completion that reuses stale evidence without saying it remains exact", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      attemptId: "a_reconcile-compact-loop-live-workflow_20260709022911",
      context: {
        workflow: "fix-forward",
        featureCompactFollowup: true,
        subjectKind: "compact-feature-family",
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            attemptId: "a_reconcile-compact-loop-live-workflow_20260709022911",
            result: "done",
            summary:
              "Reconciled compact live-workflow using older evidence path.",
            evidenceRefs: [
              "evidence/archive/reconcile-compact-loop-live-workflow-task-202607080313-worker.md",
            ],
            workflowResult: {
              details: {
                fixForward: {
                  workflow: "fix-forward",
                  subject: {
                    kind: "feature-family",
                    id: "live-workflow",
                  },
                  classification: "other-known-class",
                  diagnosis: "The sampled features remain on known waits.",
                  minimumDiagnosisPacket: {
                    target: "staging",
                    branch: "dev",
                    runId: "",
                    resultPath:
                      "evidence/archive/reconcile-compact-loop-live-workflow-task-202607080313-worker.md",
                  },
                  changedFiles: [],
                  verification: {
                    runId: "",
                    resultPath:
                      "evidence/archive/reconcile-compact-loop-live-workflow-task-202607080313-worker.md",
                    status: "not-run",
                  },
                  nextAction: "done",
                  nextActionReason: "No rerun is needed.",
                },
              },
            },
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "redo",
        confidence: "high",
        findings: expect.arrayContaining([
          "compact-fix-forward-evidence-not-fresh",
        ]),
      },
    });
  });

  test("falls back to escalate review when reviewer output is malformed", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: "looks fine but missing structured JSON",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "escalate",
        confidence: "low",
        findings: ["reviewer-output-not-structured"],
      },
    });
  });
});
