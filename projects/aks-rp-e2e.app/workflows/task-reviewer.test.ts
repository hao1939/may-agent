import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute as executePlanner } from "./project-planner.ts";
import { captureRuntimeProjectSnapshotV2 } from "./lib/project-snapshot-capture-v2.ts";
import { execute, isTransientReviewerFailure } from "./task-reviewer.ts";

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
    revision?: number;
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
            ...(input.revision !== undefined
              ? { revision: input.revision }
              : {}),
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
    taskRevision?: number;
    attemptId?: string;
    result?: string;
    summary?: string;
    evidenceRefs?: string[];
    workflowResult?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  const taskId = input.taskId ?? "review-task";
  const taskRevision = input.taskRevision ?? 0;
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
    taskRevision,
    task_revision: taskRevision,
    attemptId,
    result,
    summary,
    completion: {
      taskId,
      taskRevision,
      task_revision: taskRevision,
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
  artifacts?: string[];
  verification?: string[];
  events?: Array<Record<string, unknown>>;
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
    ...(input.artifacts ? { artifacts: input.artifacts } : {}),
    ...(input.verification ? { verification: input.verification } : {}),
    ...(input.events ? { events: input.events } : {}),
    ...(input.reviewAction ? { reviewAction: input.reviewAction } : {}),
  },
  null,
  2,
)}
\`\`\``;
}

describe("task reviewer", () => {
  test("ignores old revisions and emits the current revision", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, { revision: 1 });
    let reviewerCalls = 0;
    const stale = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        triggerEvent(completionEvent({ taskRevision: 0 })),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      dispatchEvent() {},
      runAgentSession: async () => {
        reviewerCalls += 1;
        return { status: "success", message: "unused" };
      },
    } as any);

    expect(stale.message).toContain("revision 0 is not current (1)");
    expect(reviewerCalls).toBe(0);

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const current = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        triggerEvent(completionEvent({ taskRevision: 1 })),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary: "Revision one is current.",
        }),
      }),
    } as any);

    expect(current.message).toContain("emitted accept review");
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: { taskRevision: 1, task_revision: 1 },
    });
  });

  test("emits structured reviewed event for a current review task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    let decisionPersistedBeforeDispatch = false;

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
        decisionPersistedBeforeDispatch = readFileSync(
          join(appDir, ".state", "task-reviewer-runs.jsonl"),
          "utf8",
        ).includes('"delivery_status":"pending"');
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
            events: [
              {
                type: "escalation.resolved",
                owner: "agent:aks-explorer",
                data: {
                  escalationId: "esc-review-task",
                  outcome: "fixed",
                  summary: "The reviewed repair is verified.",
                },
              },
            ],
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
    expect(prompts[0]).toContain(
      "Use `escalation.dismissed` when the ask is duplicate, wrong, obsolete",
    );
    expect(prompts[0]).toContain('Use `outcome: "fixed"` or `"answered"` only');
    expect(prompts[0]).toContain("resume failure and must not be recorded");
    expect(prompts[0]).toContain(
      "planner validates and emits accepted reviewed events",
    );
    expect(dispatched).toHaveLength(1);
    expect(decisionPersistedBeforeDispatch).toBe(true);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        attemptId: "attempt-1",
        reviewId: expect.any(String),
        decision: "accept",
        confidence: "high",
        summary: "Live GitHub proof satisfies the task.",
        findings: ["artifact includes passing live run"],
        artifacts: ["runs/test-results/"],
        verification: ["GitHub live test passes"],
        events: [
          {
            type: "escalation.resolved",
            owner: "agent:aks-explorer",
            data: {
              escalationId: "esc-review-task",
              outcome: "fixed",
              summary: "The reviewed repair is verified.",
            },
          },
        ],
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
    const rows = runs
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      result: "project.task.reviewed",
      delivery_status: "pending",
      review_id: expect.any(String),
    });
    expect(rows[1]).toMatchObject({
      result: "project.task.reviewed.delivery-accepted",
      delivery_status: "accepted",
      review_id: rows[0].review_id,
    });
  });

  test("retains a reviewer decision for replay when reviewed-event delivery fails", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);

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
      dispatchEvent() {
        throw new Error("injected reviewed-event delivery failure");
      },
      runAgentSession: async () => ({
        status: "success",
        message: reviewMessage({
          decision: "accept",
          summary: "The durable reviewer decision must survive delivery loss.",
        }),
      }),
    } as any);

    expect(result.message).toContain(
      "could not dispatch project.task.reviewed",
    );
    const rows = (
      await readFile(join(appDir, ".state", "task-reviewer-runs.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      result: "project.task.reviewed",
      delivery_status: "pending",
      decision: "accept",
      review_id: expect.any(String),
    });
    expect(rows[1]).toMatchObject({
      result: "project.task.reviewed.delivery-failed",
      delivery_status: "failed",
      review_id: rows[0].review_id,
    });

    const captured = captureRuntimeProjectSnapshotV2({
      appDir,
      treePath: resolveTaskTreePath(appDir),
      stateDbPath: join(appDir, ".state", "missing.db"),
      projectId: "fixture",
      nowMs: Date.now(),
    });
    expect(captured.snapshot.reviews[0]).toMatchObject({
      taskId: "review-task",
      latestDecision: "accept",
      latestDecisionId: rows[0].review_id,
      deliveryState: "decision-pending-apply",
    });
    expect(captured.snapshot.pendingActions).toContainEqual(
      expect.objectContaining({
        kind: "review-application-delivery",
        status: "pending",
        payloadRef: expect.objectContaining({ id: rows[0].review_id }),
      }),
    );
  });

  test("uses the keyed PendingAction V2 delivery path only for revisioned cohort work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      revision: 2,
      context: { controlPlaneVersion: 2 },
    });
    let dispatches = 0;
    let reviewRuns = 0;
    const context = () =>
      ({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-reviewer",
          "pendingActionV2: review-application-revisioned",
          triggerEvent(completionEvent({ taskRevision: 2 })),
        ].join("\n"),
        agent: "aks-reviewer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {
          dispatches += 1;
        },
        runAgentSession: async () => {
          reviewRuns += 1;
          return {
            status: "success",
            message: reviewMessage({
              decision: "accept",
              summary: "The same keyed review should be delivered once.",
            }),
          };
        },
      }) as any;

    const first = await execute(context());
    const replay = await execute(context());

    expect(first.message).toContain("through PendingAction V2");
    expect(replay.message).toContain("replay found accepted review delivery");
    expect(dispatches).toBe(1);
    expect(reviewRuns).toBe(1);
    const rows = (
      await readFile(join(appDir, ".state", "task-reviewer-runs.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const receipts = rows.filter(
      (row) => row.result === "pending-action-delivery-v2",
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      version: "project-pending-action-delivery-v2",
      action_kind: "review-application-delivery",
      delivery_attempt: 1,
      delivery_status: "accepted",
    });
    expect(
      rows.some(
        (row) => row.result === "project.task.reviewed.delivery-accepted",
      ),
    ).toBe(false);
    const captured = captureRuntimeProjectSnapshotV2({
      appDir,
      treePath: resolveTaskTreePath(appDir),
      stateDbPath: join(appDir, ".state", "missing.db"),
      projectId: "fixture",
      nowMs: Date.now(),
    });
    expect(captured.snapshot.pendingActions).toContainEqual(
      expect.objectContaining({
        kind: "review-application-delivery",
        status: "accepted",
        delivery: expect.objectContaining({ attempts: 1, maxAttempts: 2 }),
      }),
    );
  });

  test("reuses the persisted V2 decision when dispatch succeeded but its receipt was lost", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      revision: 3,
      context: { controlPlaneVersion: 2 },
    });
    let dispatches = 0;
    let reviewRuns = 0;
    const context = () =>
      ({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-reviewer",
          "pendingActionV2: review-application-revisioned",
          triggerEvent(completionEvent({ taskRevision: 3 })),
        ].join("\n"),
        agent: "aks-reviewer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {
          dispatches += 1;
        },
        runAgentSession: async () => {
          reviewRuns += 1;
          return {
            status: "success",
            message: reviewMessage({
              decision: "accept",
              summary: "Persist this decision before delivery.",
            }),
          };
        },
      }) as any;

    await execute(context());
    const ledgerPath = join(appDir, ".state", "task-reviewer-runs.jsonl");
    const decisionRows = (await readFile(ledgerPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((row) => row.result === "project.task.reviewed");
    expect(decisionRows).toHaveLength(1);
    await writeFile(
      ledgerPath,
      `${decisionRows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    );

    const replay = await execute(context());

    expect(replay.message).toContain("redelivered persisted review");
    expect(reviewRuns).toBe(1);
    expect(dispatches).toBe(2);
    const rows = (await readFile(ledgerPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(
      rows.filter((row) => row.result === "project.task.reviewed"),
    ).toHaveLength(1);
    expect(
      rows.filter((row) => row.result === "pending-action-delivery-v2"),
    ).toEqual([
      expect.objectContaining({
        action_key: `review-application-delivery:review-task:3:attempt-1:${decisionRows[0].review_id}`,
        delivery_attempt: 1,
        delivery_status: "accepted",
      }),
    ]);
  });

  test("accepts completion trigger whose embedded summary contains fenced FIX_FORWARD_RESULT", async () => {
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
            summary:
              'status: success\n\nFIX_FORWARD_RESULT:\n```json\n{\n  "workflow": "fix-forward",\n  "subject": { "kind": "spec", "id": "spec.network-cni.cilium-enterprise-addon-lifecycle" },\n  "classification": "compact-plan-conflict",\n  "diagnosis": "summary carries embedded fenced json",\n  "minimumDiagnosisPacket": {\n    "target": "staging",\n    "branch": "dev",\n    "runId": "172310203",\n    "resultPath": "evidence/archive/fix-network-cni-cilium-enterprise-addon-lifecycle-run-172310203.md",\n    "failingPhase": "review",\n    "failingAssertion": "",\n    "requestOrResponseExcerpt": "",\n    "referencesChecked": ["evidence/archive/fix-network-cni-cilium-enterprise-addon-lifecycle-run-172310203.md"],\n    "inputFingerprint": "run172310203",\n    "errorFingerprint": "underlay-kubeconfig-env-present"\n  },\n  "changedFiles": ["evidence/archive/fix-network-cni-cilium-enterprise-addon-lifecycle-run-172310203.md"],\n  "verification": {\n    "runId": "",\n    "resultPath": "evidence/archive/fix-network-cni-cilium-enterprise-addon-lifecycle-run-172310203.md",\n    "status": "pass"\n  },\n  "nextAction": "rerun-after-change",\n  "nextActionReason": "changed input is ready"\n}\n```',
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
          summary: "Embedded fenced fix-forward summary is still reviewable.",
          findings: ["trigger event parsed despite fenced JSON in summary"],
        }),
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Task reviewer emitted accept review");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.type).toBe("project.task.reviewed");
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

  test("canonicalizes reviewed project.task.completed events before planner consumption", async () => {
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
        message: reviewMessage({
          decision: "accept",
          summary:
            "The bounded duplicate-wait repair is ready for planner apply.",
          events: [
            {
              type: "project.task.completed",
              owner: "agent:app-ops",
              data: {
                project: "aks-rp-e2e",
                taskId:
                  "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
                task_id:
                  "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
                attemptId: "attempt-wait-1",
                attempt_id: "attempt-wait-1",
                result: "done",
                summary:
                  "Retire the duplicate preflight wait after same-lineage success was already accepted.",
              },
            },
          ],
        }),
      }),
      summarize: () => "",
    } as any);

    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        events: [
          {
            type: "project.task.completed",
            owner: "agent:app-ops",
            target: {
              project: "aks-rp-e2e",
              taskId:
                "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
            },
            data: expect.objectContaining({
              taskId:
                "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
              target: {
                project: "aks-rp-e2e",
                taskId:
                  "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
              },
            }),
          },
        ],
      },
    });
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

  test("forces redo for wrapper .test.ts plus plain scenario carrier outputs", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);

    const treePath = resolveTaskTreePath(appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["review-task"].goal = "Author one direct feature scenario.";
    tree.tasks["review-task"].outputs = [
      "features/net-integration/tests/net-integration-row166.test.ts",
      "features/net-integration/tests/net-integration-row166.ts",
      "features/net-integration/specs/net-integration-row166.json",
      "features/net-integration/packets/net-integration-row166.yaml",
      "features/net-integration/compact/staging.plan.json",
    ];
    tree.tasks["review-task"].acceptance = [
      "One direct .test.ts scenario carrier remains.",
    ];
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, "features", "net-integration", "tests"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "net-integration", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "net-integration", "packets"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "net-integration", "compact"), {
      recursive: true,
    });

    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "tests",
        "net-integration-row166.test.ts",
      ),
      [
        'import { execFile } from "node:child_process";',
        'const replayPath = "features/net-integration/tests/net-integration-row166.ts";',
        'void execFile("bun", [replayPath]);',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "tests",
        "net-integration-row166.ts",
      ),
      [
        "#!/usr/bin/env bun",
        'const probeName = "net-integration-row166";',
        'const specId = "spec.net-integration.row166";',
        "console.log(probeName, specId);",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "specs",
        "net-integration-row166.json",
      ),
      `${JSON.stringify(
        {
          id: "spec.net-integration.row166",
          probeRef:
            "features/net-integration/tests/net-integration-row166.test.ts",
          implementation: {
            path: "features/net-integration/tests/net-integration-row166.test.ts",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "packets",
        "net-integration-row166.yaml",
      ),
      [
        "probeRef: features/net-integration/tests/net-integration-row166.ts",
        "replayRef: features/net-integration/tests/net-integration-row166.ts",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "compact",
        "staging.plan.json",
      ),
      `${JSON.stringify(
        {
          scenarioTestPath:
            "features/net-integration/tests/net-integration-row166.ts",
          replay: "features/net-integration/tests/net-integration-row166.ts",
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
        message: reviewMessage({
          decision: "accept",
          summary: "Looked fine from a quick read.",
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
          "feature-scenario-carrier-plain-output",
          "feature-scenario-carrier-maintained-surface-points-plain",
          "feature-scenario-carrier-direct-has-plain-sibling",
          "feature-scenario-carrier-wrapper-plus-plain",
          "scenario:features/net-integration/tests/net-integration-row166",
        ]),
      },
    });
  });

  test("allows ordinary support modules beside a direct scenario carrier", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);

    const treePath = resolveTaskTreePath(appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["review-task"].goal =
      "Author one direct feature scenario with helper support code.";
    tree.tasks["review-task"].outputs = [
      "features/net-integration/tests/net-integration-clean.test.ts",
      "features/net-integration/tests/support-common.ts",
      "features/net-integration/specs/net-integration-clean.json",
    ];
    tree.tasks["review-task"].acceptance = ["Direct carrier remains."];
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, "features", "net-integration", "tests"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "net-integration", "specs"), {
      recursive: true,
    });

    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "tests",
        "net-integration-clean.test.ts",
      ),
      'export const directVitestPath = "features/net-integration/tests/net-integration-clean.test.ts";\n',
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "tests",
        "support-common.ts",
      ),
      'export function supportCommon() { return "ok"; }\n',
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "net-integration",
        "specs",
        "net-integration-clean.json",
      ),
      `${JSON.stringify(
        {
          id: "spec.net-integration.clean",
          probeRef:
            "features/net-integration/tests/net-integration-clean.test.ts",
          implementation: {
            path: "features/net-integration/tests/net-integration-clean.test.ts",
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
        message: reviewMessage({
          decision: "accept",
          summary:
            "One direct scenario carrier and one support helper are present.",
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
      },
    });
    expect(dispatched[0].payload.findings).not.toEqual(
      expect.arrayContaining([
        "feature-scenario-carrier-plain-output",
        "feature-scenario-carrier-wrapper-plus-plain",
      ]),
    );
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

  const normalizationMixedFixtures = [
    {
      runId: "172532763",
      taskGoal: "Repair RP preflight validation and queue one isolated rerun.",
      specId: "spec.rp-cluster-lifecycle.preflight-validation",
      evidencePath: "evidence/archive/preflight.md",
      summary: "Queued the preflight rerun.",
      branch:
        "refs/heads/aks-explorer/normalize-private-cluster-peconn-lifecycle-20260716",
      sourceCommit: "01e6e17a7427305beb0dd7b65ce6902d93af0c63",
      changedFiles: [
        "features/net-integration/compact/staging.plan.json",
        "features/net-integration/specs/net-integration-outbound-migration-natgw-to-lb.json",
        "features/net-integration/tests/net-integration-outbound-migration-natgw-to-lb.test.ts",
      ],
      unexpectedFeature: "net-integration",
    },
    {
      runId: "172519831",
      taskGoal:
        "Normalize storage-csi Disk PVC scenario and queue one isolated rerun.",
      specId: "spec.storage-csi.disk-pvc",
      evidencePath: "evidence/archive/storage-csi-disk.md",
      summary: "Queued the mixed Disk rerun.",
      branch: "refs/heads/aks-explorer/normalize-storage-csi-disk-pvc-20260716",
      sourceCommit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
      changedFiles: [
        "features/planned-maintenance/tests/planned-maintenance-configuration-crud-lifecycle.test.ts",
      ],
      unexpectedFeature: "planned-maintenance",
    },
    {
      runId: "172519985",
      taskGoal:
        "Normalize planned-maintenance configuration CRUD lifecycle and queue one isolated rerun.",
      specId: "spec.planned-maintenance.configuration-crud-lifecycle",
      evidencePath: "evidence/archive/planned-maintenance.md",
      summary: "Queued the mixed Planned rerun.",
      branch:
        "refs/heads/aks-explorer/normalize-planned-maintenance-configuration-20260716",
      sourceCommit: "0f1e2d3c4b5a69788796a5b4c3d2e1f012345678",
      changedFiles: [
        "features/disable-ssh/tests/disable-ssh-vmss-cleanup.test.ts",
      ],
      unexpectedFeature: "disable-ssh",
    },
    {
      runId: "172519192",
      taskGoal:
        "Normalize Disable SSH VMSS cleanup scenario and queue one isolated rerun.",
      specId: "spec.disable-ssh.vmss-cleanup",
      evidencePath: "evidence/archive/disable-ssh.md",
      summary: "Queued the mixed Disable SSH rerun.",
      branch:
        "refs/heads/aks-explorer/normalize-disable-ssh-vmss-cleanup-20260716",
      sourceCommit: "1234567890abcdef1234567890abcdef12345678",
      changedFiles: ["features/storage-csi/tests/storage-csi-disk-pvc.test.ts"],
      unexpectedFeature: "storage-csi",
    },
  ];

  test.each(normalizationMixedFixtures)(
    "forces redo for mixed normalization queued runs without isolated worktree lineage: run $runId",
    async ({
      runId,
      taskGoal,
      specId,
      evidencePath,
      summary,
      branch,
      sourceCommit,
      changedFiles,
      unexpectedFeature,
    }) => {
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
                state: "active",
                children: [
                  "domain/normalize-scenario-tests-repo-frontier-20260715",
                ],
                goal: "project",
                outputs: ["tasks/tree.json"],
                acceptance: ["done"],
              },
              "domain/normalize-scenario-tests-repo-frontier-20260715": {
                id: "domain/normalize-scenario-tests-repo-frontier-20260715",
                parent_id: "project",
                state: "active",
                kind: "domain",
                priority: "P1",
                children: ["review-task"],
                goal: "Normalize scenario tests repo frontier.",
                outputs: ["evidence/archive/frontier.md"],
                acceptance: ["frontier stays visible"],
              },
              "review-task": {
                id: "review-task",
                parent_id:
                  "domain/normalize-scenario-tests-repo-frontier-20260715",
                state: "review",
                kind: "domain_leaf",
                workflow: "default-task-worker",
                priority: "P1",
                children: [],
                goal: taskGoal,
                inputs: [`spec:${specId}`],
                outputs: [evidencePath],
                acceptance: ["Queue only one isolated rerun."],
                forbidden: [],
                conflict_scope: [`spec:${specId}`],
                depends_on: [],
                trace: {
                  current_attempt_id: "attempt-1",
                  last_worker_result: "partial",
                  last_worker_summary: "Queued one rerun.",
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
      const prompts: string[] = [];
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-reviewer",
          triggerEvent(
            completionEvent({
              result: "partial",
              summary,
              workflowResult: {
                resultVersion: "workflow-result-v1",
                workflow: "default-task-worker",
                status: "partial",
                subject: { kind: "task", id: "review-task" },
                artifacts: [evidencePath],
                details: {
                  queuedRun: {
                    backend: "ado",
                    runId,
                    runUrl: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=${runId}`,
                    specIds: [specId],
                    target: "staging",
                    branch,
                    sourceVersion: sourceCommit,
                    sourceCommit,
                    changedFiles,
                    metadataPath: `workspace/${runId}/metadata.json`,
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
        runAgentSession: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "success",
            message: reviewMessage({
              decision: "accept",
              summary: "Queued rerun looks acceptable.",
            }),
          };
        },
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(prompts[0]).toContain(
        "For tasks under domain/normalize-scenario-tests-repo-frontier-20260715",
      );
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].payload.decision).toBe("redo");
      expect(dispatched[0].payload.summary).toContain(
        "missing isolated-worktree lineage proof",
      );
      expect(dispatched[0].payload.findings).toContain(
        "normalization-isolation-contract-invalid",
      );
      expect(dispatched[0].payload.findings).toContain(`run:${runId}`);
      expect(dispatched[0].payload.findings).toContain(
        "normalization-isolation-base-ref-not-origin-dev",
      );
      expect(dispatched[0].payload.findings).toContain(
        `unexpectedFeature:${unexpectedFeature}`,
      );
    },
  );

  const normalizationCleanFixtures = [
    {
      runId: "172513552",
      taskGoal:
        "Normalize network-cni Windows2022 scenario and queue one clean rerun.",
      specId: "spec.network-cni.azure-overlay-dual-stack-windows2022",
      evidencePath: "evidence/archive/network-cni.md",
      summary: "Queued the clean network-cni rerun.",
      branch:
        "refs/heads/aks-explorer/network-cni-windows2022-direct-clean-20260716",
      sourceCommit: "d0e3ef8c61e078883756e805f980778dd1921b99",
      changedFiles: [
        "features/network-cni/tests/network-cni-azure-overlay-dual-stack-windows2022.test.ts",
      ],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/network-cni-windows2022-direct-clean-20260716-wt",
    },
    {
      runId: "172513872",
      taskGoal:
        "Normalize storage-csi Disk PVC scenario and queue one clean rerun.",
      specId: "spec.storage-csi.disk-pvc",
      evidencePath: "evidence/archive/storage-csi-disk.md",
      summary: "Queued the clean storage-csi Disk rerun.",
      branch:
        "refs/heads/aks-explorer/storage-csi-disk-pvc-direct-clean-20260716",
      sourceCommit: "4c71fcb9be96ecfba4cf1ad55b8df760924e1c11",
      changedFiles: ["features/storage-csi/tests/storage-csi-disk-pvc.test.ts"],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/storage-csi-disk-pvc-direct-clean-20260716-wt",
    },
    {
      runId: "172515477",
      taskGoal:
        "Normalize planned-maintenance configuration CRUD lifecycle and queue one clean rerun.",
      specId: "spec.planned-maintenance.configuration-crud-lifecycle",
      evidencePath: "evidence/archive/planned-maintenance.md",
      summary: "Queued the clean planned-maintenance rerun.",
      branch:
        "refs/heads/aks-explorer/planned-maintenance-direct-clean-20260716",
      sourceCommit: "8f52b9ad8f1d7c6772f6ee5906f14cc7af3c5b64",
      changedFiles: [
        "features/planned-maintenance/tests/planned-maintenance-configuration-crud-lifecycle.test.ts",
      ],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/planned-maintenance-direct-clean-20260716-wt",
    },
    {
      runId: "172517379",
      taskGoal:
        "Normalize Disable SSH VMSS cleanup scenario and queue one clean rerun.",
      specId: "spec.disable-ssh.vmss-cleanup",
      evidencePath: "evidence/archive/disable-ssh.md",
      summary: "Queued the clean Disable SSH rerun.",
      branch:
        "refs/heads/aks-explorer/disable-ssh-vmss-cleanup-direct-clean-20260716",
      sourceCommit: "2c95d3f1c80e6d6248d0e7fd2bc3e2c4217490ee",
      changedFiles: [
        "features/disable-ssh/tests/disable-ssh-vmss-cleanup.test.ts",
      ],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/disable-ssh-vmss-cleanup-direct-clean-20260716-wt",
    },
    {
      runId: "172518211",
      taskGoal:
        "Repair RP preflight validation and queue one clean isolated rerun.",
      specId: "spec.rp-cluster-lifecycle.preflight-validation",
      evidencePath: "evidence/archive/preflight.md",
      summary: "Queued the clean preflight rerun.",
      branch:
        "refs/heads/aks-explorer/rp-preflight-validation-direct-clean-20260716",
      sourceCommit: "5ea4ae94e4fdad61d34fcac9cb6ee17f52de9c10",
      changedFiles: [
        "features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts",
      ],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/rp-preflight-validation-direct-clean-20260716-wt",
    },
    {
      runId: "172557989",
      taskGoal:
        "Normalize spec.virtualmachines.spot-pool-eviction under the refined direct-authoring contract.",
      specId: "spec.virtualmachines.spot-pool-eviction",
      evidencePath:
        "evidence/archive/normalize-direct-virtualmachines-spot-pool-eviction-20260717-current-validation.md",
      summary: "Queued the clean virtualmachines spot-pool rerun.",
      branch:
        "refs/heads/aks-explorer/normalize-direct-virtualmachines-spot-pool-eviction-20260717",
      sourceCommit: "cbd263dec702348ae8352ab9c39ffce3c70a18a0",
      changedFiles: [
        "features/virtualmachines-agentpool/specs/virtualmachines-spot-pool-eviction.json",
        "features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts",
      ],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/normalize-direct-virtualmachines-spot-pool-eviction-20260717-wt",
      taskOutputs: [
        "../aks-rp-e2e/features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts",
        "../aks-rp-e2e/features/virtualmachines-agentpool/specs/virtualmachines-spot-pool-eviction.json",
      ],
    },
  ];

  test.each(normalizationCleanFixtures)(
    "accepts clean normalization queued runs with isolated lineage proof: run $runId",
    async ({
      runId,
      taskGoal,
      specId,
      evidencePath,
      summary,
      branch,
      sourceCommit,
      changedFiles,
      worktreePath,
      taskOutputs,
    }) => {
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
                state: "active",
                children: [
                  "domain/normalize-scenario-tests-repo-frontier-20260715",
                ],
                goal: "project",
                outputs: ["tasks/tree.json"],
                acceptance: ["done"],
              },
              "domain/normalize-scenario-tests-repo-frontier-20260715": {
                id: "domain/normalize-scenario-tests-repo-frontier-20260715",
                parent_id: "project",
                state: "active",
                kind: "domain",
                priority: "P1",
                children: ["review-task"],
                goal: "Normalize scenario tests repo frontier.",
                outputs: ["evidence/archive/frontier.md"],
                acceptance: ["frontier stays visible"],
              },
              "review-task": {
                id: "review-task",
                parent_id:
                  "domain/normalize-scenario-tests-repo-frontier-20260715",
                state: "review",
                kind: "domain_leaf",
                workflow: "default-task-worker",
                priority: "P1",
                children: [],
                goal: taskGoal,
                inputs: [`spec:${specId}`],
                outputs: taskOutputs ?? [evidencePath],
                acceptance: ["Queue only one isolated rerun."],
                forbidden: [],
                conflict_scope: [`spec:${specId}`],
                depends_on: [],
                trace: {
                  current_attempt_id: "attempt-1",
                  last_worker_result: "partial",
                  last_worker_summary: "Queued one clean rerun.",
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
          "agent: aks-reviewer",
          triggerEvent(
            completionEvent({
              result: "partial",
              summary,
              workflowResult: {
                resultVersion: "workflow-result-v1",
                workflow: "default-task-worker",
                status: "partial",
                subject: { kind: "task", id: "review-task" },
                artifacts: [evidencePath],
                details: {
                  queuedRun: {
                    backend: "ado",
                    runId,
                    runUrl: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=${runId}`,
                    specIds: [specId],
                    target: "staging",
                    branch,
                    sourceVersion: sourceCommit,
                    sourceCommit,
                    baseRef: "origin/dev",
                    baseCommit: "8422b22c0e121f4894f08c6c39e881783f367e6f",
                    firstParentCommits: [sourceCommit],
                    changedFiles,
                    worktreePath,
                    metadataPath: `workspace/${runId}/metadata.json`,
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
        runAgentSession: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "success",
            message: reviewMessage({
              decision: "accept",
              summary: "The clean isolated rerun is reviewable.",
              findings: ["worker returned isolated lineage proof"],
            }),
          };
        },
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(prompts[0]).toContain(
        "For a terminal same-run live pass under this normalization frontier, do not",
      );
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].payload.decision).toBe("accept");
      expect(dispatched[0].payload.findings).toContain(
        "validation-note:normalization-isolated-worktree-lineage-present",
      );
      expect(dispatched[0].payload.findings).toContain(`run:${runId}`);
    },
  );

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
          namedSpecIds: [
            "spec.network-acns.cilium-observability",
            "spec.network-acns.retina-enterprise",
          ],
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
                    runId: "171342018",
                    resultPath:
                      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-cilium-observability/spec-runner/result.json",
                    specStatus: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    liveVerified: false,
                    liveClusterObserved: true,
                    artifactRefs: [
                      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-cilium-observability/spec-runner/result.json",
                    ],
                  },
                  {
                    specId: "spec.network-acns.retina-enterprise",
                    runId: "171342018",
                    resultPath:
                      "runs/test-results/test_20260708083338198_o5hx8d_500854/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
                    specStatus: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    liveVerified: false,
                    liveClusterObserved: true,
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

  test("adds validation note when grouped terminal wait omits per-spec exact result paths", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: {
        terminalPipelineWaitReview: {
          runId: "171342018",
          runStatus: "completed",
          runConclusion: "failed",
          namedSpecIds: [
            "spec.network-acns.cilium-observability",
            "spec.network-acns.retina-enterprise",
          ],
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
              workflow: "spec-result-review",
              status: "partial",
              subject: {
                kind: "spec-group",
                id: "network-acns",
              },
              artifacts: [
                "runs/test-results/test_20260708083338198_o5hx8d_500854/result.json",
              ],
              details: {
                runId: "171342018",
                resultPath:
                  "runs/test-results/test_20260708083338198_o5hx8d_500854/result.json",
                specResults: [
                  {
                    specId: "spec.network-acns.cilium-observability",
                    specStatus: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    artifactRefs: [],
                  },
                  {
                    specId: "spec.network-acns.retina-enterprise",
                    specStatus: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    artifactRefs: [],
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
          decision: "redo",
          summary:
            "Grouped terminal wait result is missing per-spec exact artifact paths.",
          findings: [],
        }),
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload.findings).toEqual(
      expect.arrayContaining([
        "validation-note:structured-spec-verification-result-incomplete",
        "terminal-pipeline-missing-result-path:spec.network-acns.cilium-observability",
        "terminal-pipeline-missing-artifact-refs:spec.network-acns.cilium-observability",
        "terminal-pipeline-missing-result-path:spec.network-acns.retina-enterprise",
        "terminal-pipeline-missing-artifact-refs:spec.network-acns.retina-enterprise",
      ]),
    );
  });

  test("accepts structured spec result on ordinary artifact-review task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      revision: 3,
      context: {
        workflow: "spec-result-review",
        phaseContract: {
          revision: 3,
          resultSchema: "SPEC_RESULT_REVIEW",
          acceptedPhaseResultRef:
            ".state/task-reviewer-runs.jsonl#review-task:2:attempt-fix",
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
            taskRevision: 3,
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
        taskRevision: 3,
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

  test("retries transient reviewer provider failures", () => {
    expect(
      isTransientReviewerFailure(
        "OpenAI API error (401): IDE token expired: unauthorized: token expired",
      ),
    ).toBe(true);
    expect(
      isTransientReviewerFailure(
        "OpenAI API error (429): No deployments available; try again in 5 seconds; cooldown",
      ),
    ).toBe(true);
    expect(
      isTransientReviewerFailure(
        "OpenAI API error (503): upstream unavailable",
      ),
    ).toBe(true);
    expect(isTransientReviewerFailure("looks fine but missing JSON")).toBe(
      false,
    );
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

  test("guarded no-secret-leak malformed review fallback emits app-state-repair and planner creates runnable reconciliation work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, {
      context: {
        workflow: "app-ops",
      },
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const reviewResult = await execute({
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
        status: "blocked",
        message:
          'Workflow blocked by guard: 🚨 Secret leak detected in step "aks-reviewer": Telegram bot token found. guard=no-secret-leak',
      }),
      summarize: () => "",
    } as any);

    expect(reviewResult.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "escalate",
        confidence: "low",
        findings: expect.arrayContaining([
          "reviewer-output-not-structured",
          "reviewer-guard-no-secret-leak",
        ]),
        reviewAction: {
          actionKind: "app-state-repair",
          owner: "app-ops",
          parentId: "project",
        },
      },
    });

    const plannerResult = await executePlanner({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: app-ops",
        "maxConcurrent: 1",
        triggerEvent({
          type: dispatched[0].type,
          data: dispatched[0].payload,
        }),
      ].join("\n"),
      agent: "app-ops",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({
        status: "success",
        message: "owner should not run",
      }),
      runAgentSession: async () => ({
        status: "success",
        message: "owner should not run",
      }),
      summarize: () => "",
    } as any);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    ) as { tasks: Record<string, any> };
    const followup = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId === "review-task" &&
        task?.id !== "review-task",
    ) as any;

    expect(plannerResult.status).toBe("done");
    expect(followup).toBeDefined();
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.owner).toBe("app-ops");
    expect(followup.parent_id).toBe("project");
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain("Manually reconcile the guarded review");
    expect(followup.context.reviewedTask.reviewAction).toMatchObject({
      actionKind: "app-state-repair",
    });
  });
});
