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

function reviewMessage(input: {
  decision: string;
  confidence?: string;
  summary: string;
  findings?: string[];
  feedback?: string[];
  suggestedFollowups?: string[];
  reviewAction?: Record<string, unknown>;
}): string {
  return `TASK_REVIEW_JSON:
\`\`\`json
${JSON.stringify(
  {
    decision: input.decision,
    confidence: input.confidence ?? "high",
    summary: input.summary,
    findings: input.findings ?? [],
    feedback: input.feedback ?? [],
    suggestedFollowups: input.suggestedFollowups ?? [],
    ...(input.reviewAction ? { reviewAction: input.reviewAction } : {}),
  },
  null,
  2,
)}
\`\`\``;
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
          message: reviewMessage({
            decision: "accept",
            summary: "Live GitHub proof satisfies the task.",
            findings: ["artifact includes passing live run"],
            reviewAction: {
              actionKind: "app-state-repair",
              goal: "Apply the app-owned repair with structured routing.",
            },
          }),
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
        reviewAction: {
          actionKind: "app-state-repair",
          goal: "Apply the app-owned repair with structured routing.",
        },
      },
    });

    const runs = await readFile(
      join(appDir, ".state", "task-reviewer-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"result":"project.task.reviewed"');
  });

  test("reviewer session ids stay unique for long task ids and attempts", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const longTaskId =
      "domain/review-virtualmachines-agentpool-compact-frontier-family-20260711";
    const longAttemptA =
      "a_domain_review-virtualmachines-agentpool-compact-frontier-family-20260711_20260711150359";
    const longAttemptB =
      "a_domain_review-virtualmachines-agentpool-compact-frontier-family-20260711_20260711150713";

    const writeLongTree = async (attemptId: string) => {
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
                children: [longTaskId],
                goal: "project",
                outputs: ["tasks/tree.json"],
                acceptance: ["done"],
              },
              [longTaskId]: {
                id: longTaskId,
                parent_id: "project",
                state: "review",
                kind: "domain_leaf",
                workflow: "default-task-worker",
                priority: "P1",
                children: [],
                goal: "Review one long-id task.",
                inputs: [],
                outputs: ["evidence/archive/test.md"],
                acceptance: ["review succeeds"],
                forbidden: [],
                conflict_scope: ["spec:one"],
                depends_on: [],
                trace: {
                  current_attempt_id: attemptId,
                  last_worker_result: "done",
                  last_worker_summary: "Reviewed the current task attempt.",
                },
              },
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    };

    await writeLongTree(longAttemptA);

    const seenSessionIds: string[] = [];
    const runReview = async (attemptId: string) => {
      await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-reviewer",
          triggerEvent(
            completionEvent({
              taskId: longTaskId,
              attemptId,
              workflowResult: {
                resultVersion: "workflow-result-v1",
                workflow: "default-task-worker",
                subject: { kind: "task", id: longTaskId },
                status: "done",
                summary: "Reviewed the current task attempt.",
                artifacts: ["evidence/archive/test.md"],
                details: { taskClaim: "done" },
              },
            }),
          ),
        ].join("\n"),
        agent: "aks-reviewer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        runAgentSession: async (
          _agent: string,
          _prompt: string,
          sessionId: string,
        ) => {
          seenSessionIds.push(sessionId);
          return {
            status: "success",
            message: reviewMessage({
              decision: "accept",
              summary: "Fresh post-window evidence satisfies the task.",
            }),
          };
        },
        summarize: () => "",
      } as any);
    };

    await runReview(longAttemptA);
    await writeLongTree(longAttemptB);
    await runReview(longAttemptB);

    expect(seenSessionIds).toHaveLength(2);
    expect(seenSessionIds[0]).not.toBe(seenSessionIds[1]);
    expect(seenSessionIds[0].length).toBeLessThanOrEqual(160);
    expect(seenSessionIds[1].length).toBeLessThanOrEqual(160);
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

  test("annotates accepted completion that cites missing durable evidence memo", async () => {
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
            evidenceRefs: ["evidence/archive/missing-review-evidence.md"],
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary: "The memo satisfies the task.",
          findings: ["memo reviewed"],
        }),
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        attemptId: "attempt-1",
        decision: "accept",
        confidence: "high",
      },
    });
    expect(dispatched[0].payload.findings).toContain(
      "validation-note:worker-cited-missing-durable-evidence",
    );
    expect(dispatched[0].payload.findings).toContain(
      "missing:evidence/archive/missing-review-evidence.md",
    );
  });

  test("keeps reviewer redo when checked-in tree snapshot looks stale without code-side correction", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const attemptId = "a_ops_row60_20260711015142";
    const repairTaskId =
      "ops-apply-review-vmprerelease-row60-mounted-source-boundary-20260711-sta";
    const targetTaskId =
      "hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706";
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
              children: [repairTaskId, targetTaskId],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            [repairTaskId]: {
              id: repairTaskId,
              parent_id: "project",
              state: "review",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Planner/app-ops task: update `hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706` to the report's exact row-60 dedicated nonlive/source-grounded wait wording, or explicitly reject the mutation with rationale.",
              inputs: [],
              outputs: ["task tree", "evidence/archive/"],
              acceptance: [
                "The app-owned task-tree or loop-state repair is applied through supported app mechanisms.",
                "The affected branch records the exact restored holder, state pointer, or refreshed wait with evidence.",
              ],
              trace: {
                current_attempt_id: attemptId,
                last_worker_result: "done",
                last_worker_summary:
                  "Verified with the supported task-tree CLI that the live app-owned holder already carries the exact row-60 dedicated nonlive/source-grounded wait wording.",
              },
            },
            [targetTaskId]: {
              id: targetTaskId,
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Keep the exact row-60 dedicated nonlive/source-grounded wait for spec.managementplane-addon.vm-prerelease-httpapplicationrouting-disable-scaling.",
              acceptance: [
                "This blocked leaf remains the single truthful holder for the exact row-60 dedicated nonlive/source-grounded carrier.",
              ],
              blocker: {
                condition:
                  "Exact row-60 dedicated nonlive/source-grounded wait with Scenario_Addon, no-addons create, CoreDNS/CPA 1 -> 2 -> 4, and deprecated httpApplicationRouting disable.",
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
    await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            taskId: repairTaskId,
            attemptId,
            summary:
              "Verified with the supported task-tree CLI: bun run task-tree show hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706. The live runtime task tree has the exact row-60 dedicated nonlive/source-grounded wait wording.",
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
      runAgentSession: async () => ({
        status: "success",
        message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "redo",
  "confidence": "high",
  "summary": "The completion memo claims the row-60 holder was refreshed, but checked-in tasks/tree.json still shows old text.",
  "findings": ["direct inspection of ../aks-rp-e2e.app/tasks/tree.json found old text"],
  "feedback": ["Retry because tasks/tree.json does not show the new holder text."],
  "suggestedFollowups": []
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload).toMatchObject({
      taskId: repairTaskId,
      attemptId,
      decision: "redo",
      confidence: "high",
    });
    expect(dispatched[0].payload.findings).not.toContain(
      "validation-note:reviewer-used-stale-task-tree-snapshot",
    );
  });

  test("keeps reviewer redo when compact state snapshot looks stale without code-side correction", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const attemptId =
      "a_ops-apply-normalize-spec-loop-blocked-frontier-family-20260711-state-rep_20260711015703";
    const repairTaskId =
      "ops-apply-normalize-spec-loop-blocked-frontier-family-20260711-state-rep";
    const holderTaskId =
      "hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710";
    const frontierTaskIds = [
      "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
      "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
      "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
      "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
      "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
    ];

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
              children: [repairTaskId, holderTaskId],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            [repairTaskId]: {
              id: repairTaskId,
              parent_id: "project",
              state: "review",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Apply or reject the recommended repair/replacement for the compact cluster-autoscaler heptet/frontier holder, preserving exact resume/fallback wording and only live downstream carriers.",
              inputs: [],
              outputs: [
                "task tree",
                ".state/feature-compact-loop/state.json",
                "evidence/archive/",
              ],
              acceptance: [
                "The app-owned task-tree or loop-state repair is applied through supported app mechanisms.",
                "The affected branch records the exact restored holder, state pointer, or refreshed wait with evidence.",
              ],
              conflict_scope: ["ops:cluster-autoscaler-http400-family"],
              trace: {
                current_attempt_id: attemptId,
                last_worker_result: "done",
                last_worker_summary:
                  "Verified via supported live reads that the cluster-autoscaler compact holder and feature-compact loop record preserve the repaired five-carrier frontier.",
              },
            },
            [holderTaskId]: {
              id: holderTaskId,
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              children: [],
              goal: "Preserve the compact cluster-autoscaler frontier with five live downstream carriers.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await mkdir(join(appDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await mkdir(join(appDir, "evidence", "archive"), { recursive: true });
    await writeFile(
      join(appDir, "evidence", "archive", `${repairTaskId}.md`),
      "Current repair memo with supported live-read proof.\n",
      "utf8",
    );
    await writeFile(
      join(appDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          features: {
            "cluster-autoscaler": {
              taskId: holderTaskId,
              frontierTaskIds,
              resumeCondition:
                "Resume only if accepted evidence materially changes one of those five live downstream carriers.",
              fallbackAction:
                "If unchanged, refresh this exact holder with evidence from ops overdue-wait triage rather than reopening the broad family.",
              summary:
                "Controller-visible compact cluster-autoscaler state now preserves only the five live downstream carrier tasks under the legacy-named compact holder.",
              nextStepClassification:
                "preserve exact five-live-downstream compact frontier",
              reviewEvidencePath: `evidence/archive/${repairTaskId}.md`,
              evidencePaths: [`evidence/archive/${repairTaskId}.md`],
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
    await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            taskId: repairTaskId,
            attemptId,
            summary:
              "Refreshed the current-attempt evidence memo and verified via supported live reads, compact-organizer show-binding, and the controller-visible compact-loop record that cluster-autoscaler has the repaired five-carrier frontier.",
            evidenceRefs: [`evidence/archive/${repairTaskId}.md`],
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
      runAgentSession: async () => ({
        status: "success",
        message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "redo",
  "confidence": "medium",
  "summary": "The repaired holder names five carriers, but .state/feature-compact-loop/state.json still contains stale seven-member wording.",
  "findings": ["The compact-loop record still has stale resumeCondition, summary, nextStepClassification, and reviewEvidencePath fields."],
  "feedback": ["Retry by applying the remaining app-owned state repair so the compact-loop record refers to five live downstream carriers and current evidence."],
  "suggestedFollowups": []
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload).toMatchObject({
      taskId: repairTaskId,
      attemptId,
      decision: "redo",
      confidence: "medium",
    });
    expect(dispatched[0].payload.findings).not.toContain(
      "validation-note:reviewer-used-stale-feature-compact-state-snapshot",
    );
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

  test("emits reviewer redo with validation notes for empty worker completion", async () => {
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "redo",
          summary: "Empty worker output is not enough to close the task.",
          findings: ["worker-empty-assistant-turn", "worker-no-evidence"],
        }),
      }),
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
          "worker-empty-assistant-turn",
          "worker-no-evidence",
        ]),
      },
    });
  });

  test("emits reviewer followup when task only recommended a task-tree mutation", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      trace: {
        last_worker_summary:
          "Reviewed the frontier and recommended exact successor leaves.",
      },
    });

    const treePath = resolveTaskTreePath(appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["review-task"].goal =
      "Review a compact frontier and recommend the exact task-tree mutation.";
    tree.tasks["review-task"].acceptance = [
      "Recommend the exact task-tree mutation needed to replace the broad holder.",
    ];
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

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
            summary:
              "Because this is Task Worker Mode, I did not mutate the task tree. The planner should replace the holder with successor leaves.",
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
      runAgentSession: async () => ({
        status: "success",
        message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "followup",
  "confidence": "high",
  "summary": "The recommendation is useful but needs a concrete app-ops successor.",
  "findings": ["worker named exact successor leaves"],
  "feedback": [],
  "suggestedFollowups": ["Create a concrete planner/app-ops successor to apply the recommended task-tree mutation, or record why no mutation is needed."]
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload.decision).toBe("followup");
    expect(dispatched[0].payload.suggestedFollowups).toContain(
      "Create a concrete planner/app-ops successor to apply the recommended task-tree mutation, or record why no mutation is needed.",
    );
  });

  test("adds validation note when terminal pipeline wait lacks structured result", async () => {
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "redo",
          summary: "The terminal run artifact was not reviewed.",
          findings: [],
        }),
      }),
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
          "terminal-pipeline-wait-structured-result-missing",
          "evidenceRefs:0",
        ]),
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary: "The structured same-spec live proof satisfies the task.",
          findings: ["same-spec-live-proof-reviewed"],
        }),
      }),
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
        findings: expect.arrayContaining([
          "validation-note:structured-spec-verification-result-present",
          "run:171344670",
          "result:runs/test-results/test_123/artifacts/virtualmachines-mixed-sku-deallocate/spec-runner/result.json",
          "status:pass",
          "liveClusterObserved:true",
          "resourceGroup:rg-plan-001-proof",
          "clusterName:aks-plan-001-proof",
        ]),
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary:
            "The structured same-spec failure proof satisfies the review task.",
          findings: ["same-spec-failure-proof-reviewed"],
        }),
      }),
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
          "The structured same-spec failure proof satisfies the review task.",
        findings: expect.arrayContaining([
          "validation-note:structured-spec-verification-result-present",
          "run:171349474",
          "result:runs/test-results/test_456/artifacts/cluster-autoscaler-mincount-recovery/spec-runner/result.json",
          "status:fail",
          "liveClusterObserved:true",
          "resourceGroup:rg-plan-001-fail",
          "clusterName:aks-plan-001-fail",
        ]),
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary: "The structured grouped spec results satisfy the task.",
          findings: ["grouped-spec-results-reviewed"],
        }),
      }),
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
        summary: "The structured grouped spec results satisfy the task.",
      },
    });
    expect(dispatched[0].payload.findings).toContain(
      "validation-note:structured-spec-verification-result-present",
    );
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary: "The structured artifact review satisfies the task.",
          findings: ["artifact-result-reviewed"],
        }),
      }),
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
        summary: "The structured artifact review satisfies the task.",
      },
    });
    expect(dispatched[0].payload.findings).toContain(
      "validation-note:structured-spec-verification-result-present",
    );
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "redo",
          summary: "Fix-forward result is missing required structured fields.",
          findings: ["fix-forward-structured-result-missing"],
        }),
      }),
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
          "fix-forward-structured-result-missing",
          "missing:workflowResult.details.fixForward",
        ]),
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "escalate",
          summary:
            "Repeated missing fix-forward structure is a workflow/process problem.",
          findings: ["fix-forward-structured-result-missing-repeated"],
        }),
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
        confidence: "high",
        findings: expect.arrayContaining([
          "fix-forward-structured-result-missing-repeated",
          "missing:workflowResult.details.fixForward",
        ]),
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "redo",
          summary: "Compact fix-forward evidence is not fresh enough.",
          findings: ["compact-fix-forward-evidence-not-fresh"],
        }),
      }),
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

  test("adds validation note when ADO fix-forward structured result names GitHub as current backend", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      attemptId: "a_reconcile-spec-loop-pending-secops-fips_20260710230154",
      context: {
        workflow: "fix-forward",
        currentBackend: "ado",
        lastRunBackend: "github",
        subjectKind: "spec-family",
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
            attemptId:
              "a_reconcile-spec-loop-pending-secops-fips_20260710230154",
            result: "done",
            summary:
              "Reconciled secops-fips and queued three meaningful same-spec GitHub reruns.",
            evidenceRefs: [
              "evidence/archive/reconcile-spec-loop-pending-secops-fips-20260708.md",
            ],
            workflowResult: {
              details: {
                fixForward: {
                  workflow: "fix-forward",
                  subject: {
                    kind: "feature-family",
                    id: "secops-fips",
                  },
                  classification: "other-known-class",
                  diagnosis:
                    "The current action dispatched run-single-spec.yaml reruns for three specs.",
                  minimumDiagnosisPacket: {
                    target: "staging",
                    branch: "dev",
                    runId: "28927074297,28927101101,28927128968",
                    resultPath:
                      "evidence/archive/reconcile-spec-loop-pending-secops-fips-20260708.md",
                  },
                  changedFiles: [
                    "evidence/archive/reconcile-spec-loop-pending-secops-fips-20260708.md",
                  ],
                  verification: {
                    backend: "github-actions",
                    runId: "28927074297,28927101101,28927128968",
                    resultPath:
                      "evidence/archive/reconcile-spec-loop-pending-secops-fips-20260708.md",
                    status: "not-run",
                  },
                  nextAction: "rerun-after-change",
                  nextActionReason:
                    "GitHub Actions run-single-spec.yaml reruns were queued after local checks.",
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
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "redo",
          summary:
            "ADO fix-forward task reused a GitHub rerun claim as current action.",
          findings: [],
        }),
      }),
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
          "fix-forward-current-backend-ado-but-structured-result-names-github-backend",
          "currentRunBackends:github-actions",
        ]),
      },
    });
  });

  test("emits followup when a passed live run still leaves an exact contract repair", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      attemptId:
        "a_domain_review-spec-rp-cluster-lifecycle-upgrade-k8s-version-run-171671159-20260710_20260710230328",
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
            attemptId:
              "a_domain_review-spec-rp-cluster-lifecycle-upgrade-k8s-version-run-171671159-20260710_20260710230328",
            result: "done",
            summary:
              "Reviewed Azure DevOps run 171671159 for spec.rp-cluster-lifecycle.upgrade-k8s-version, recovered the exact artifact bundle, and wrote a durable review concluding the run itself passed but the octet member should be replaced by a narrower repo-local contract-repair item because the live bundle proves only 3 claims while the spec still declares an unverified nodepool-upgraded claim.",
            evidenceRefs: [
              "evidence/archive/review-spec-rp-cluster-lifecycle-upgrade-k8s-version-run-171671159-20260710.md",
            ],
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
      runAgentSession: async () => ({
        status: "success",
        message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "followup",
  "confidence": "high",
  "summary": "The run passed but the worker also identified an exact contract repair that must remain live work.",
  "findings": ["live-run-passed-but-exact-followup-remains", "unresolved-contract-mismatch", "exact-successor-requested"],
  "feedback": [],
  "suggestedFollowups": ["Create the exact contract repair successor."]
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "followup",
        confidence: "high",
        findings: expect.arrayContaining([
          "live-run-passed-but-exact-followup-remains",
          "unresolved-contract-mismatch",
          "exact-successor-requested",
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
