import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  peekTaskAssignments,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";
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
    revision?: number;
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
            ...(input.revision !== undefined
              ? { revision: input.revision }
              : {}),
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

function planningTrigger(data: Record<string, unknown> = {}) {
  return [
    "## Trigger Event",
    "```json",
    JSON.stringify(
      {
        type: "project.owner.requested",
        data: { project: "aks-rp-e2e", ...data },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}

function conditionFallbackTrigger(data: Record<string, unknown>) {
  return [
    "## Trigger Event",
    "```json",
    JSON.stringify(
      {
        type: "project.condition.fallback.requested",
        data: { project: "aks-rp-e2e", ...data },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}

function plannerContext(input: {
  appDir: string;
  projectDir: string;
  trigger: string;
  prompts?: string[];
  dispatched?: Array<{ type: string; data: unknown }>;
  emitted?: Array<Record<string, unknown>>;
  extraTaskLines?: string[];
  failDispatchTypes?: string[];
  agentResult?: Record<string, unknown>;
}) {
  return {
    task: [
      `app: ${input.appDir}`,
      `project: ${input.projectDir}`,
      "agent: aks-explorer",
      ...(input.extraTaskLines ?? []),
      "maxConcurrent: 1",
      input.trigger,
    ].join("\n"),
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit(event: Record<string, unknown>) {
      input.emitted?.push(event);
    },
    dispatchEvent(type: string, data: unknown) {
      if (input.failDispatchTypes?.includes(type)) {
        throw new Error(`injected ${type} dispatch failure`);
      }
      input.dispatched?.push({ type, data });
    },
    runAgent: async (_agent: string, task: string) => {
      input.prompts?.push(task);
      return (
        input.agentResult ?? {
          status: "success",
          message: "owner should not run",
        }
      );
    },
    runAgentSession: async (_agent: string, task: string) => {
      input.prompts?.push(task);
      return (
        input.agentResult ?? {
          status: "success",
          message: "owner should not run",
        }
      );
    },
    summarize: () => "",
  } as any;
}

describe("project owner workflow", () => {
  test("keeps open V2 Condition subjects out of scheduled blocked-frontier owner work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const taskId = "wait-condition-owned";
    const conditionId = "condition:pipeline:ado:172500001:terminal";
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify({
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            children: [taskId],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          [taskId]: {
            id: taskId,
            revision: 1,
            parent_id: "project",
            state: "blocked",
            children: [],
            owner: "aks-explorer",
            goal: "Wait for exact run.",
            outputs: ["runs/test-results/"],
            acceptance: ["Inspect the terminal artifact."],
            context: { controlPlaneVersion: 2, conditionId },
            blocker: {
              condition_id: conditionId,
              condition: "Wait for run 172500001.",
              waiting_for: {
                type: "ado.pipeline_run.completed",
                runId: "172500001",
              },
              next_check_at: "2099-01-01T00:00:00.000Z",
              fallback_at: "2099-01-01T01:00:00.000Z",
            },
          },
        },
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            causeKey: "pipeline:ado:172500001:terminal",
            class: "external",
            type: "pipeline.run.terminal",
            status: "open",
            backend: "ado",
            runId: "172500001",
            runUrl: "https://dev.azure.com/example/172500001",
            subject: { kind: "task", id: taskId, revision: 1 },
            owner: "ado",
            observer: "project-execution-watchdog",
            observationMethod: "exact run",
            resumeCondition: "run is terminal",
            nextCheckAt: "2099-01-01T00:00:00.000Z",
            fallbackAt: "2099-01-01T01:00:00.000Z",
            fallbackAction: "escalate",
            createdAt: "2026-07-16T00:00:00.000Z",
            updatedAt: "2026-07-16T00:00:00.000Z",
          },
        },
      })}\n`,
      "utf8",
    );
    const prompts: string[] = [];
    await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        trigger: planningTrigger({
          reason: "scheduled-blocked-frontier-review",
        }),
      }),
    );
    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      expect(prompt).toContain('"condition_owned_task_ids": [');
      expect(prompt).toContain(`"${taskId}"`);
      expect(prompt).toContain('"blocked": []');
      expect(prompt).not.toContain('"blocked_frontier_summary":');
    }
    expect(prompts[1]).toContain(
      "condition_owned_task_ids are visible but are not blocked-frontier",
    );
  });

  test("acknowledges an exact Condition fallback only after owner planning completes", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const taskId = "wait-condition-fallback";
    const conditionId = "condition:pipeline:ado:172500002:terminal";
    const recoveryKey = `condition-fallback:${conditionId}:1`;
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify({
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            children: [taskId],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          [taskId]: {
            id: taskId,
            revision: 1,
            parent_id: "project",
            state: "blocked",
            children: [],
            owner: "aks-explorer",
            goal: "Wait for exact run.",
            outputs: ["runs/test-results/"],
            acceptance: ["Inspect the terminal artifact."],
            context: { controlPlaneVersion: 2, conditionId },
            blocker: {
              condition: "Wait for run 172500002.",
              condition_id: conditionId,
            },
          },
        },
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            causeKey: "pipeline:ado:172500002:terminal",
            class: "external",
            type: "pipeline.run.terminal",
            status: "open",
            backend: "ado",
            runId: "172500002",
            runUrl: "https://dev.azure.com/example/172500002",
            subject: { kind: "task", id: taskId, revision: 1 },
            owner: "ado",
            observer: "project-execution-watchdog",
            observationMethod: "exact run",
            resumeCondition: "run is terminal",
            nextCheckAt: "2026-07-16T06:00:00.000Z",
            fallbackAt: "2026-07-16T06:10:00.000Z",
            fallbackAction: "escalate",
            createdAt: "2026-07-16T06:00:00.000Z",
            updatedAt: "2026-07-16T06:10:00.000Z",
            fallbackExecution: {
              recoveryKey,
              claimId: `${recoveryKey}:claim`,
              status: "dispatched",
              attempts: 1,
              claimedAt: "2026-07-16T06:10:00.000Z",
              leaseExpiresAt: "2026-07-16T06:15:00.000Z",
              observation: { status: "inProgress" },
              dispatchedAt: "2026-07-16T06:10:01.000Z",
            },
          },
        },
      })}\n`,
      "utf8",
    );
    const prompts: string[] = [];

    await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        agentResult: {
          status: "error",
          message: "injected owner planning interruption",
        },
        trigger: conditionFallbackTrigger({
          reason: "condition-overdue-fallback",
          conditionId,
          recoveryKey,
          taskId,
          taskRevision: 1,
        }),
      }),
    );

    let stored = await readTaskTreeJson(appDir);
    expect(stored.conditions[conditionId].fallbackExecution).toMatchObject({
      status: "dispatched",
      attempts: 1,
    });
    expect(
      stored.conditions[conditionId].fallbackExecution.acknowledgedAt,
    ).toBeUndefined();
    expect(prompts).toHaveLength(2);

    await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        trigger: conditionFallbackTrigger({
          reason: "condition-overdue-fallback",
          conditionId,
          recoveryKey,
          taskId,
          taskRevision: 1,
        }),
      }),
    );

    stored = await readTaskTreeJson(appDir);
    expect(stored.conditions[conditionId].fallbackExecution).toMatchObject({
      status: "acknowledged",
      attempts: 1,
      acknowledgedBy: "project-planner",
    });
    expect(stored.tasks[taskId]).toMatchObject({
      state: "blocked",
      revision: 1,
    });
    expect(prompts).toHaveLength(4);

    const replay = await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        trigger: planningTrigger({
          reason: "condition-overdue-fallback",
          conditionId,
          recoveryKey,
          taskId,
          taskRevision: 1,
        }),
      }),
    );
    expect(replay.message).toContain(
      "Replayed already acknowledged Condition fallback event",
    );
    expect(prompts).toHaveLength(4);
  });

  test("does not apply a reviewed event from an older task revision", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, { revision: 1 });

    const stale = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          taskId: "review-task",
          taskRevision: 0,
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Stale acceptance.",
        }),
      }),
    );
    expect(stale.message).toContain("revision 0 is not current (1)");
    expect((await readTaskTreeJson(appDir)).tasks["review-task"].state).toBe(
      "review",
    );

    const current = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          taskId: "review-task",
          taskRevision: 1,
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Current acceptance.",
        }),
      }),
    );
    expect(current.message).toContain("Applied accept review");
    expect((await readTaskTreeJson(appDir)).tasks["review-task"].state).toBe(
      "done",
    );
  });

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

  test("routes app-ops owned backlog tasks to the ops worker even without ops prefix", async () => {
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
              children: ["apply-frontier-state"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "apply-frontier-state": {
              id: "apply-frontier-state",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "Apply app-owned task-tree state.",
              outputs: ["evidence/archive/apply-frontier-state.md"],
              acceptance: ["done"],
              conflict_scope: ["app-task-tree:feature-compact"],
              depends_on: [],
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
        taskId: "apply-frontier-state",
        worker: "app-ops",
      }),
    });
  });

  test("applies accepted task reviews without owner-agent planning when the project closes", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const prompts: string[] = [];
    const dispatched: Array<{ type: string; data: unknown }> = [];
    const emitted: Array<Record<string, unknown>> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        dispatched,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Evidence satisfies the task.",
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
    expect(emitted).toContainEqual({
      type: "escalation.resolved",
      owner: "agent:aks-explorer",
      data: {
        escalationId: "esc-review-task",
        outcome: "fixed",
        summary: "The reviewed repair is verified.",
      },
    });
    expect(result.message).toContain("Emitted 1 reviewed event transition");
    expect(prompts).toHaveLength(0);
  });

  test("requests immediate recovery when an accepted review leaves a blocked-only frontier", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      extraTasks: {
        "blocked-sibling": {
          id: "blocked-sibling",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P1",
          owner: "aks-explorer",
          children: [],
          goal: "Recover an exact external blocker.",
          outputs: ["evidence/archive/blocked-sibling.md"],
          acceptance: ["Work is restored or the gap is terminally resolved."],
          blocker: {
            condition: "External condition has not changed.",
            owner: "operator",
            resume_condition: "Resume when stronger evidence arrives.",
            next_check_at: "2026-07-15T00:00:00.000Z",
            fallback_at: "2026-07-16T00:00:00.000Z",
          },
        },
      },
    });
    const treePath = resolveTaskTreePath(appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks.project.children.push("blocked-sibling");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
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
          decision: "accept",
          summary: "Evidence satisfies the task.",
        }),
      }),
    );

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Requested immediate blocked-frontier recovery",
    );
    expect(dispatched).toContainEqual({
      type: "project.owner.requested",
      data: expect.objectContaining({
        reason: "review-settled-blocked-only-recovery",
        requested_by: "project-planner",
        reviewedTaskId: "review-task",
        blockedLeafCount: 1,
      }),
    });
  });

  test("recovers archived reviewed-task lineage into planner prompts for blocked-only recovery wakes", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await mkdir(join(appDir, "tasks", "archive"), { recursive: true });
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
              state: "blocked",
              status: "blocked",
              children: ["blocked-sibling"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
              context: {
                rollup_summary:
                  "Compact accepted done leaves; preserve durable loop controllers even when their current frontier is complete or held.",
                current_focus_proposal: {
                  id: "focus-no-live-frontier-lineage-closure-and-holder-truth-20260714",
                  reason:
                    "Current non-repair frontier is active=[none], review=[none], waiting=[none], runnable=[none], blocked=1. Current live focus is blocked-frontier recovery.",
                  evidence_path:
                    "evidence/archive/focus-no-live-frontier-lineage-closure.md",
                },
                rollup_archives: [
                  {
                    archive:
                      ".state/tasks/archive/done-leaves-20260714225642775.json",
                    at: "2026-07-14T22:56:42.776Z",
                    reason: "planner task-tree maintenance",
                    summary:
                      "Compact accepted done leaves; preserve durable loop controllers even when their current frontier is complete or held.",
                    task_ids: [
                      "ops/reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714",
                    ],
                  },
                ],
              },
            },
            "blocked-sibling": {
              id: "blocked-sibling",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Recover an exact external blocker.",
              outputs: ["evidence/archive/blocked-sibling.md"],
              acceptance: [
                "Work is restored or the gap is terminally resolved.",
              ],
              blocker: {
                condition: "External condition has not changed.",
                owner: "operator",
                resume_condition: "Resume when stronger evidence arrives.",
                next_check_at: "2026-07-15T00:00:00.000Z",
                fallback_at: "2026-07-16T00:00:00.000Z",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await mkdir(projectRuntimePaths(appDir).taskArchiveDir, {
      recursive: true,
    });
    await writeFile(
      join(
        projectRuntimePaths(appDir).taskArchiveDir,
        "done-leaves-20260714225642775.json",
      ),
      `${JSON.stringify(
        {
          version: 1,
          generated_at: "2026-07-14T22:56:42.775Z",
          reason: "planner task-tree maintenance",
          parent_id: "project",
          summary:
            "Compact accepted done leaves; preserve durable loop controllers even when their current frontier is complete or held.",
          archived: 1,
          tasks: [
            {
              id: "ops/reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714",
              parent_id: "project",
              state: "done",
              status: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "Reconcile the seven unpublished model/knowledge-map files in /app/projects/aks-rp-e2e to one truthful process outcome: either a coherent checkpoint-ready done slice or one exact holder that explains why the repo drift must remain uncommitted.",
              outputs: [
                "evidence/archive/ops-reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714.md",
              ],
              evidence: [
                "evidence/archive/ops-reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714.md",
              ],
              acceptance: [
                "Use the current git diff and checkpoint helper output to map the seven dirty model/knowledge-map files to accepted versus active lineage, explain why domain:checkpoint currently returns hold, and leave exactly one actionable next state: checkpoint-ready slice with the commit boundary spelled out, or a sharper task/wait that truthfully owns the remaining unpublished drift.",
              ],
              context: {
                acceptance_note:
                  "Accepted: the memo satisfies the reconciliation acceptance by mapping the seven dirty knowledge-map files to accepted lineage, explaining unbounded hold versus bounded candidate helper behavior, and spelling one exact checkpoint boundary; subsequent git state shows that exact seven-file checkpoint was applied.",
              },
              trace: {
                review_summary:
                  "Accepted: the memo satisfies the reconciliation acceptance by mapping the seven dirty knowledge-map files to accepted lineage, explaining unbounded hold versus bounded candidate helper behavior, and spelling one exact checkpoint boundary; subsequent git state shows that exact seven-file checkpoint was applied.",
                last_worker_summary:
                  "Refreshed `/app/projects/aks-rp-e2e.app/evidence/archive/ops-reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714.md` against current live git, task-tree, archive, and checkpoint-helper state. The memo now directly addresses the rejected review and leaves one truthful next state: checkpoint the exact seven model/knowledge-map files only.",
              },
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        trigger: planningTrigger({
          reason: "review-settled-blocked-only-recovery",
          reviewedTaskId:
            "ops/reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714",
          blockedLeafCount: 1,
        }),
      }),
    );

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      expect(prompt).toContain("Recovered reviewed-task lineage for this wake");
      expect(prompt).toContain(
        '"reviewedTaskId": "ops/reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714"',
      );
      expect(prompt).toContain('"source": "archive"');
      expect(prompt).toContain(
        "treat that accepted lineage as settled history for the blocked-only refill decision instead of as missing live work",
      );
      expect(prompt).toContain(
        '"archiveFile": ".state/tasks/archive/done-leaves-20260714225642775.json"',
      );
      expect(prompt).toContain(
        '"archivedReviewSummary": "Accepted: the memo satisfies the reconciliation acceptance by mapping the seven dirty knowledge-map files to accepted lineage, explaining unbounded hold versus bounded candidate helper behavior, and spelling one exact checkpoint boundary; subsequent git state shows that exact seven-file checkpoint was applied."',
      );
      expect(prompt).toContain(
        '"archivedAcceptanceNote": "Accepted: the memo satisfies the reconciliation acceptance by mapping the seven dirty knowledge-map files to accepted lineage, explaining unbounded hold versus bounded candidate helper behavior, and spelling one exact checkpoint boundary; subsequent git state shows that exact seven-file checkpoint was applied."',
      );
      expect(prompt).toContain(
        '"archivedLastWorkerSummary": "Refreshed `/app/projects/aks-rp-e2e.app/evidence/archive/ops-reconcile-unpublished-model-knowledge-map-checkpoint-slice-20260714.md` against current live git, task-tree, archive, and checkpoint-helper state. The memo now directly addresses the rejected review and leaves one truthful next state: checkpoint the exact seven model/knowledge-map files only."',
      );
      expect(prompt).toContain(
        '"projectCurrentFocusId": "focus-no-live-frontier-lineage-closure-and-holder-truth-20260714"',
      );
    }
  });

  test("does not apply accepted reviews with missing durable evidence validation note", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Reviewer accepted, but validation found missing evidence.",
          findings: [
            "validation-note:worker-cited-missing-durable-evidence",
            "missing:evidence/archive/missing-review-evidence.md",
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Did not apply accept review");
    expect(tree.tasks["review-task"].state).toBe("review");
  });

  test("applies accepted reviews with supported project.task.completed repair events", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const emitted: Array<Record<string, unknown>> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Reviewer proposed a bounded task-completion recovery event.",
          events: [
            {
              type: "project.task.completed",
              owner: "agent:app-ops",
              data: {
                target: { project: "aks-rp-e2e", taskId: "another-task" },
                project: "aks-rp-e2e",
                taskId: "another-task",
                task_id: "another-task",
                attemptId: "attempt-2",
                attempt_id: "attempt-2",
                result: "blocked",
                claim: "blocked",
                summary:
                  "Replay a fresh review cycle for the exact current wait.",
                review: {
                  required: true,
                  reason: "watchdog-recovered-terminal-pipeline-wait-review",
                },
              },
            },
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.message).toContain("Applied accept review for review-task");
    expect(result.message).toContain("Emitted 1 reviewed event transition");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(emitted).toContainEqual({
      type: "project.task.completed",
      owner: "agent:app-ops",
      target: { project: "aks-rp-e2e", taskId: "another-task" },
      data: expect.objectContaining({
        taskId: "another-task",
        attemptId: "attempt-2",
        result: "blocked",
        summary: "Replay a fresh review cycle for the exact current wait.",
      }),
    });
  });

  test("applies accepted reviews with bounded project.approval.requested events", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const emitted: Array<Record<string, unknown>> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Reviewer proposed the canonical approval-dispatch request.",
          events: [
            {
              type: "project.approval.requested",
              owner: "project:aks-rp-e2e",
              data: {
                project: "aks-rp-e2e",
                target: { project: "aks-rp-e2e" },
                reason: "manual-approval-packet-dispatch-request",
                params: {
                  packetPath:
                    "evidence/archive/ops-dispatch-shared-ado-467665-queue-family-approval-proof-20260715-packet.md",
                  pathId:
                    "ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715",
                  requestedAction:
                    "Review the selective Azure DevOps queue starvation affecting definition 467665.",
                  approvalId:
                    "aks-rp-e2e:approval:ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715:evidence-archive-ops-dispatch-shared-ado-467665-queue-family-approval-proof-20260715-packet.md",
                  waitId:
                    "wait:aks-rp-e2e:approval:ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715:evidence-archive-ops-dispatch-shared-ado-467665-queue-family-approval-proof-20260715-packet.md",
                },
              },
            },
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.message).toContain("Applied accept review for review-task");
    expect(result.message).toContain("Emitted 1 reviewed event transition");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(emitted).toContainEqual({
      type: "project.approval.requested",
      owner: "project:aks-rp-e2e",
      target: { project: "aks-rp-e2e" },
      data: expect.objectContaining({
        project: "aks-rp-e2e",
        target: { project: "aks-rp-e2e" },
        params: expect.objectContaining({
          packetPath:
            "evidence/archive/ops-dispatch-shared-ado-467665-queue-family-approval-proof-20260715-packet.md",
          pathId:
            "ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715",
          requestedAction:
            "Review the selective Azure DevOps queue starvation affecting definition 467665.",
        }),
      }),
    });
  });

  test("normalizes bare app-ops owners for reviewed project.approval.requested events", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const emitted: Array<Record<string, unknown>> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Reviewer used the current carrier payload shape.",
          events: [
            {
              type: "project.approval.requested",
              owner: "app-ops",
              target: { project: "aks-rp-e2e" },
              data: {
                project: "aks-rp-e2e",
                reason: "manual-approval-packet-dispatch-request",
                params: {
                  packetPath:
                    "evidence/archive/ops-dispatch-shared-ado-467665-queue-family-approval-proof-20260715-packet.md",
                  pathId:
                    "ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715",
                  requestedAction:
                    "Review the selective Azure DevOps queue starvation affecting definition 467665.",
                },
              },
            },
          ],
        }),
      }),
    );

    expect(result.message).toContain("Applied accept review for review-task");
    expect(emitted).toContainEqual({
      type: "project.approval.requested",
      owner: "agent:app-ops",
      target: { project: "aks-rp-e2e" },
      data: expect.objectContaining({
        project: "aks-rp-e2e",
        target: { project: "aks-rp-e2e" },
      }),
    });
  });

  test("rejects reviewed project.approval.requested events without a bounded approval packet", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const emitted: Array<Record<string, unknown>> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Reviewer proposed an approval event without a packet path.",
          events: [
            {
              type: "project.approval.requested",
              owner: "agent:app-ops",
              data: {
                project: "aks-rp-e2e",
                target: { project: "aks-rp-e2e" },
                reason: "manual-approval-packet-dispatch-request",
                params: {
                  pathId:
                    "ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715",
                  requestedAction:
                    "Review the selective Azure DevOps queue starvation affecting definition 467665.",
                },
              },
            },
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.message).toContain("Did not apply accept review");
    expect(result.message).toContain("invalid event transitions");
    expect(tree.tasks["review-task"].state).toBe("review");
    expect(emitted).toHaveLength(0);
  });

  test("replays accepted project.task.completed repair events when the reviewed source task was already closed", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "source-review-task",
      extraTasks: {
        "hold-task": {
          id: "hold-task",
          parent_id: "project",
          state: "review",
          status: "review",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Hold task awaiting replay.",
          outputs: ["evidence/archive/hold.md"],
          acceptance: ["replayed"],
          trace: {
            current_attempt_id: "old-hold-attempt",
          },
        },
      },
    });
    const tree = await readTaskTreeJson(appDir);
    delete tree.tasks["source-review-task"];
    tree.tasks.project.children = ["hold-task"];
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(tree, null, 2)}\n`,
      "utf8",
    );

    const emitted: Array<Record<string, unknown>> = [];
    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "source-review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Replay the current hold-review lineage even though the source repair task already closed.",
          events: [
            {
              type: "project.task.completed",
              owner: "agent:app-ops",
              data: {
                target: { project: "aks-rp-e2e", taskId: "hold-task" },
                project: "aks-rp-e2e",
                taskId: "hold-task",
                task_id: "hold-task",
                attemptId: "new-hold-attempt",
                attempt_id: "new-hold-attempt",
                result: "blocked",
                claim: "blocked",
                summary: "Replay the fresh hold review attempt.",
                review: {
                  required: true,
                  reason: "watchdog-recovered-terminal-pipeline-wait-review",
                },
              },
            },
          ],
        }),
      }),
    );

    const postTree = await readTaskTreeJson(appDir);
    expect(result.message).toContain(
      "Recovered accepted reviewed replay for missing task source-review-task",
    );
    expect(result.message).toContain("Emitted 1 reviewed event transition");
    expect(postTree.tasks["hold-task"].state).toBe("review");
    expect(postTree.tasks["hold-task"].trace.current_attempt_id).toBe(
      "old-hold-attempt",
    );
    expect(emitted).toContainEqual({
      type: "project.task.completed",
      owner: "agent:app-ops",
      target: { project: "aks-rp-e2e", taskId: "hold-task" },
      data: expect.objectContaining({
        taskId: "hold-task",
        attemptId: "new-hold-attempt",
        result: "blocked",
        summary: "Replay the fresh hold review attempt.",
      }),
    });
  });

  test("does not apply accepted reviews with unsupported event transitions", async () => {
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
          decision: "accept",
          summary: "Reviewer proposed an unsupported event.",
          events: [
            {
              type: "project.task.assigned",
              owner: "agent:aks-explorer",
              data: { taskId: "another-task" },
            },
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.message).toContain("Did not apply accept review");
    expect(result.message).toContain("invalid event transitions");
    expect(tree.tasks["review-task"].state).toBe("review");
    expect(dispatched).toHaveLength(0);
  });

  test("applies accepted canonical loop ticks with selector fields on the event envelope", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir);
    const emitted: Array<Record<string, unknown>> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        emitted,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-task",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "The compact-loop repair is ready for a bounded pulse.",
          events: [
            {
              type: "project.task.tick",
              owner: "agent:aks-explorer",
              data: {
                project: "aks-rp-e2e",
                action: "feature-compact-loop",
                taskId: "aks-feature-compact-loop",
                target: {
                  project: "aks-rp-e2e",
                  taskId: "aks-feature-compact-loop",
                },
              },
            },
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.message).toContain("Applied accept review for review-task");
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(emitted).toContainEqual({
      type: "project.task.tick",
      owner: "agent:aks-explorer",
      action: "feature-compact-loop",
      target: {
        project: "aks-rp-e2e",
        taskId: "aks-feature-compact-loop",
      },
      data: {
        project: "aks-rp-e2e",
        action: "feature-compact-loop",
        taskId: "aks-feature-compact-loop",
        target: {
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
        },
      },
    });
  });

  test("accepted task review creates structured Azure DevOps wait for queued rerun", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
      conflictScope: ["spec:kms.v2plus-enable-pmk-from-v2-public"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Worker evidence satisfies the repair and queued the verification run.",
          completion: {
            summary:
              "Cross-checked prior evidence against current source, verified local gates, and queued bounded rerun.",
            workflowResult: {
              status: "partial",
              details: {
                queuedRun: {
                  backend: "ado",
                  runId: "171529560",
                  runUrl:
                    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171529560",
                  specIds: ["spec.kms.v2plus-enable-pmk-from-v2-public"],
                },
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const wait =
      tree.tasks[
        "wait-kms-v2plus-enable-pmk-from-v2-public-ado-run-171529560-result"
      ];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "created pipeline wait wait-kms-v2plus-enable-pmk-from-v2-public-ado-run-171529560-result",
    );
    expect(wait.state).toBe("blocked");
    expect(wait.blocker.waiting_for).toMatchObject({
      type: "ado.pipeline_run.completed",
      runId: "171529560",
      specIds: ["spec.kms.v2plus-enable-pmk-from-v2-public"],
      sourceTaskId:
        "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
    });
    expect(JSON.stringify(wait)).not.toContain("171501538");
  });

  test("accepted queued rerun retargets stale review-gated publication holders to the successor wait", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "fix-egress-lockdown-windows-baseline-aks-subnet-route-table-association",
      conflictScope: [
        "feature:egress-lockdown",
        "spec:spec.egress-lockdown.windows-baseline",
      ],
      context: {
        reviewedTask: {
          taskId:
            "repair-egress-lockdown-windows-baseline-aks-subnet-route-table-association-run-172480751",
        },
      },
      extraTasks: {
        "domain/publish-egress-lockdown-windows-baseline-review-visible-20260716":
          {
            id: "domain/publish-egress-lockdown-windows-baseline-review-visible-20260716",
            parent_id: "project",
            state: "blocked",
            status: "blocked",
            kind: "domain_leaf",
            priority: "P2",
            owner: "aks-explorer",
            children: [],
            goal: "Keep the current egress-lockdown Windows-baseline repo slice unpublished until the live review lineage returns a publication-safe decision.",
            outputs: [
              "../aks-rp-e2e/evidence/archive/publish-egress-lockdown-windows-baseline-review-visible-20260716.md",
            ],
            acceptance: [
              "Consume the structured publication-safe decision produced by wait-egress-lockdown-windows-baseline-ado-run-172480751-result for spec.egress-lockdown.windows-baseline before publishing or superseding any repo slice.",
              "If that decision accepts the current slice, publish the exact accepted egress-lockdown Windows-baseline commit slice to the branch/head used by future ADO work and record the visible commit/hash proof; if it rejects or narrows the slice, create or link the exact successor repair task instead of leaving this unpublished holder open.",
            ],
            conflict_scope: [
              "feature:egress-lockdown",
              "spec:spec.egress-lockdown.windows-baseline",
            ],
            blocker: {
              condition:
                "The current publication holder truthfully waits on live review wait wait-egress-lockdown-windows-baseline-ado-run-172480751-result, which is tracking exact same-spec ADO run 172480751 for spec.egress-lockdown.windows-baseline. Keep this holder blocked until that live wait returns the structured publication-safe decision for this slice or an exact successor replaces it.",
              category: "external-wait",
              owner: "aks-explorer",
              blocked_at: "2026-07-16T07:15:51.367Z",
              waiting_for: {
                type: "blocker.resolved",
                taskId:
                  "domain/publish-egress-lockdown-windows-baseline-review-visible-20260716",
              },
              observed_by: {
                workflow: "project-planner",
                schedule: "blocked-frontier-app-ops-review",
                trigger: "project.owner.requested",
              },
              observation_method:
                "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
              resume_condition:
                "Resume only when wait-egress-lockdown-windows-baseline-ado-run-172480751-result returns the structured publication-safe decision for this slice or an exact successor repair/wait replaces it.",
              fallback_at: "2026-07-16T14:30:00Z",
              fallback_action:
                "If the repaired live review lineage still has not returned by fallback, keep one reviewer-gated publication wait or replace it with the exact successor; do not leave this holder pointing at a missing task id.",
            },
          },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "fix-egress-lockdown-windows-baseline-aks-subnet-route-table-association",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Worker evidence satisfies the repair and queued the successor same-spec verification run.",
          completion: {
            workflowResult: {
              status: "partial",
              details: {
                queuedRun: {
                  backend: "ado",
                  runId: "172493879",
                  runUrl:
                    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172493879",
                  specIds: ["spec.egress-lockdown.windows-baseline"],
                },
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const wait =
      tree.tasks[
        "wait-egress-lockdown-windows-baseline-ado-run-172493879-result"
      ];
    const holder =
      tree.tasks[
        "domain/publish-egress-lockdown-windows-baseline-review-visible-20260716"
      ];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "created pipeline wait wait-egress-lockdown-windows-baseline-ado-run-172493879-result",
    );
    expect(wait.blocker.waiting_for.runId).toBe("172493879");
    expect(holder.state).toBe("blocked");
    expect(holder.acceptance[0]).toContain(
      "wait-egress-lockdown-windows-baseline-ado-run-172493879-result",
    );
    expect(holder.acceptance[0]).not.toContain("172480751");
    expect(holder.blocker.condition).toContain(
      "wait-egress-lockdown-windows-baseline-ado-run-172493879-result",
    );
    expect(holder.blocker.waiting_for).toMatchObject({
      type: "blocker.resolved",
      taskId:
        "domain/publish-egress-lockdown-windows-baseline-review-visible-20260716",
      governingWaitTaskId:
        "wait-egress-lockdown-windows-baseline-ado-run-172493879-result",
      sourceTaskId:
        "fix-egress-lockdown-windows-baseline-aks-subnet-route-table-association",
      runId: "172493879",
      specIds: ["spec.egress-lockdown.windows-baseline"],
    });
    expect(holder.context).toMatchObject({
      publicationGateWaitTaskId:
        "wait-egress-lockdown-windows-baseline-ado-run-172493879-result",
      publicationGateRunId: "172493879",
      publicationGateSourceTaskId:
        "fix-egress-lockdown-windows-baseline-aks-subnet-route-table-association",
      publicationGateSpecIds: ["spec.egress-lockdown.windows-baseline"],
    });
  });

  test("accepted task review does not dedupe queued run from existing prose", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
      conflictScope: ["spec:kms.v2plus-enable-pmk-from-v2-public"],
      extraTasks: {
        "historical-prose-run-note": {
          id: "historical-prose-run-note",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Historical text says Azure DevOps run 171529560 was queued.",
          outputs: [],
          acceptance: ["not a structured wait"],
          conflict_scope: ["spec:kms.v2plus-enable-pmk-from-v2-public"],
          blocker: {
            condition:
              "This prose mentions run 171529560 but has no structured waiting_for.runId.",
          },
        },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
          attemptId: "attempt-1",
          decision: "accept",
          summary: "Worker queued the verification run.",
          completion: {
            workflowResult: {
              status: "partial",
              details: {
                queuedRun: {
                  backend: "ado",
                  runId: "171529560",
                  specIds: ["spec.kms.v2plus-enable-pmk-from-v2-public"],
                },
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(
      tree.tasks[
        "wait-kms-v2plus-enable-pmk-from-v2-public-ado-run-171529560-result"
      ],
    ).toBeTruthy();
  });

  test("accepted task review does not infer queued Azure DevOps run from prose", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
      conflictScope: ["spec:kms.v2plus-enable-pmk-from-v2-public"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Worker evidence says it queued bounded rerun 171529560 for spec.kms.v2plus-enable-pmk-from-v2-public, but no structured queuedRun field is present.",
          completion: {
            summary:
              "Queued bounded rerun 171529560 for spec.kms.v2plus-enable-pmk-from-v2-public.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Applied accept review for repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun.",
    );
    expect(
      tree.tasks[
        "wait-kms-v2plus-enable-pmk-from-v2-public-ado-run-171529560-result"
      ],
    ).toBeUndefined();
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
        extraTaskLines: [
          "revisionV2: fix-forward-exact-spec",
          "revisionV2SpecId: spec.cluster-autoscaler.mincount-recovery",
        ],
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

    const tree = await readTaskTreeJson(appDir);
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
    const fixTask =
      tree.tasks["fix-cluster-autoscaler-mincount-recovery-run-171349474"];
    expect(fixTask).toBeTruthy();
    expect(["backlog", "active"]).toContain(fixTask.state);
    expect(fixTask.revision).toBe(1);
    expect(fixTask.context.workflow).toBe("fix-forward");
    expect(fixTask.context.controlPlaneVersion).toBe(2);
    expect(fixTask.context.revisionCanaryV2).toEqual({
      mode: "fix-forward-exact-spec",
      specId: "spec.cluster-autoscaler.mincount-recovery",
      initialRevision: 1,
    });
    expect(fixTask.context.sourceSpecResult).toMatchObject({
      specId: "spec.cluster-autoscaler.mincount-recovery",
      status: "fail",
      runId: "171349474",
      reason: "0/3 claims passed.",
    });
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
        extraTaskLines: [
          "revisionV2: fix-forward-first-nonpass-run",
          "revisionV2RunId: 171342018",
        ],
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
    const ciliumFix =
      tree.tasks["fix-network-acns-cilium-observability-run-171342018"];
    const retinaFix =
      tree.tasks["fix-network-acns-retina-enterprise-run-171342018"];
    expect(ciliumFix).toBeTruthy();
    expect(retinaFix).toBeTruthy();
    expect(ciliumFix.revision).toBe(1);
    expect(retinaFix.revision).toBe(0);
    expect(ciliumFix.context.controlPlaneVersion).toBe(2);
    expect(retinaFix.context.controlPlaneVersion).toBe(1);
    expect(ciliumFix.context.revisionCanaryV2).toEqual({
      mode: "fix-forward-first-nonpass-run",
      specId: "spec.network-acns.cilium-observability",
      sourceRunId: "171342018",
      initialRevision: 1,
    });
    expect(["backlog", "active"]).toContain(ciliumFix.state);
    expect(["backlog", "active"]).toContain(retinaFix.state);
    expect(ciliumFix.context.workflow).toBe("fix-forward");
    expect(retinaFix.context.workflow).toBe("fix-forward");
    expect(ciliumFix.context.sourceSpecResult).toMatchObject({
      specId: "spec.network-acns.cilium-observability",
      status: "error",
      runId: "171342018",
    });
    expect(retinaFix.context.sourceSpecResult).toMatchObject({
      specId: "spec.network-acns.retina-enterprise",
      status: "error",
      runId: "171342018",
    });
  });

  test("accepted ready-subset review creates independently runnable per-spec fix-forward scopes", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "wait-network-cni-ready-subset-ado-run-172310203-result",
      conflictScope: [
        "feature:network-cni",
        "feature-compact-ready-subset:network-cni",
        "ado-run:172310203",
        "spec:spec.network-acns.basic-retina-update-retina-enterprise",
        "spec:spec.network-acns.cilium-observability",
        "spec:spec.network-acns.performance-cilium-upgrade",
      ],
      context: {
        featureKey: "network-cni",
        readySubsetPipelineRun: true,
        acceptedQueuedPipelineRun: {
          runId: "172310203",
          specIds: [
            "spec.network-acns.basic-retina-update-retina-enterprise",
            "spec.network-acns.cilium-observability",
            "spec.network-acns.performance-cilium-upgrade",
          ],
        },
        terminalPipelineWaitReview: {
          runId: "172310203",
          runStatus: "completed",
          runConclusion: "failed",
        },
      },
    });
    await writeSpecLoopState(appDir, {
      "spec.network-acns.basic-retina-update-retina-enterprise": {
        status: "pending",
        attempts: 1,
        taskId: "wait-network-cni-ready-subset-ado-run-172310203-result",
        lastRunId: "172310203",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172310203",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-15T13:36:13.361Z",
      },
      "spec.network-acns.cilium-observability": {
        status: "pending",
        attempts: 1,
        taskId: "wait-network-cni-ready-subset-ado-run-172310203-result",
        lastRunId: "172310203",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172310203",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-15T13:36:13.361Z",
      },
      "spec.network-acns.performance-cilium-upgrade": {
        status: "pending",
        attempts: 1,
        taskId: "wait-network-cni-ready-subset-ado-run-172310203-result",
        lastRunId: "172310203",
        lastRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172310203",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-15T13:36:13.361Z",
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "wait-network-cni-ready-subset-ado-run-172310203-result",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Returned ready-subset ADO artifact records two independent non-pass specs.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "single-spec-verifier",
              status: "partial",
              subject: {
                kind: "spec-group",
                id: "network-cni",
              },
              details: {
                backend: "azure-devops-pipeline",
                runId: "172310203",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172310203",
                resultPath:
                  "runs/test-results/test_20260715094829217_195n0z_313290/result.json",
                specResults: [
                  {
                    specId:
                      "spec.network-acns.basic-retina-update-retina-enterprise",
                    status: "error",
                    reason:
                      'Error from server (NotFound): deployments.apps "hubble-ui" not found',
                    artifactRefs: [
                      "runs/test-results/test_20260715094829217_195n0z_313290/artifacts/network-acns-basic-retina-update-retina-enterprise/spec-runner/result.json",
                    ],
                  },
                  {
                    specId: "spec.network-acns.performance-cilium-upgrade",
                    status: "error",
                    reason:
                      "Incorrect kubernetes.azure.com/user-iptables-rules values on 2 CiliumNode objects",
                    artifactRefs: [
                      "runs/test-results/test_20260715094829217_195n0z_313290/artifacts/network-acns-performance-cilium-upgrade/spec-runner/result.json",
                    ],
                  },
                  {
                    specId: "spec.network-acns.cilium-observability",
                    status: "pass",
                    liveVerified: true,
                    reason: "all assertions passed",
                    artifactRefs: [
                      "runs/test-results/test_20260715094829217_195n0z_313290/artifacts/network-acns-cilium-observability/spec-runner/result.json",
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
    const basic =
      tree.tasks[
        "fix-network-acns-basic-retina-update-retina-enterprise-run-172310203"
      ];
    const performance =
      tree.tasks["fix-network-acns-performance-cilium-upgrade-run-172310203"];
    expect(result.status).toBe("done");
    expect(basic.conflict_scope).toEqual([
      "spec:spec.network-acns.basic-retina-update-retina-enterprise",
      "fix-forward:spec.network-acns.basic-retina-update-retina-enterprise:172310203",
    ]);
    expect(performance.conflict_scope).toEqual([
      "spec:spec.network-acns.performance-cilium-upgrade",
      "fix-forward:spec.network-acns.performance-cilium-upgrade:172310203",
    ]);
    expect(basic.context.featureKey).toBe("network-cni");
    expect(performance.context.featureKey).toBe("network-cni");
    expect(basic.context.readySubsetPipelineRun).toBeTrue();
    expect(performance.context.readySubsetPipelineRun).toBeTrue();
    expect(basic.conflict_scope).not.toContain("feature:network-cni");
    expect(basic.conflict_scope).not.toContain(
      "feature-compact-ready-subset:network-cni",
    );
    expect(basic.conflict_scope).not.toContain("ado-run:172310203");
    expect(basic.conflict_scope).not.toContain(
      "spec:spec.network-acns.performance-cilium-upgrade",
    );
    expect(
      basic.conflict_scope.filter((scope: string) =>
        performance.conflict_scope.includes(scope),
      ),
    ).toEqual([]);
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
          findings: ["The cited result does not contain a live run id."],
          feedback: ["Add the missing live-test proof."],
          suggestedFollowups: ["Reuse the existing single-spec workflow."],
          artifacts: ["features/example/specs/example.json"],
          verification: [
            "The same spec has a live passing result with a run id.",
          ],
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
    expect(tree.tasks["review-task"].trace.review_reject).toEqual({
      taskId: "review-task",
      attemptId: "attempt-1",
      decision: "redo",
      summary: "The output is incomplete.",
      findings: ["The cited result does not contain a live run id."],
      feedback: ["Add the missing live-test proof."],
      suggestedFollowups: ["Reuse the existing single-spec workflow."],
      artifacts: ["features/example/specs/example.json"],
      verification: ["The same spec has a live passing result with a run id."],
    });
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
          artifacts: ["features/defender-profile/compact.json"],
          verification: ["The compact feature test passes live."],
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
        artifacts: ["features/defender-profile/compact.json"],
        verification: ["The compact feature test passes live."],
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
        blockedTaskIds: ["hold-spec-loop-example-wait"],
      },
      conflictScope: ["ops:blocked-overdue:spec-loop"],
      extraTasks: {
        "hold-spec-loop-example-wait": {
          id: "hold-spec-loop-example-wait",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Preserve exact spec-loop wait.",
          outputs: [],
          acceptance: ["wait represented"],
          conflict_scope: ["spec:example"],
          blocker: {
            condition: "Example wait.",
            waiting_for: { type: "product.recovery" },
            fallback_at: "2026-07-10T12:00:00Z",
          },
        },
      },
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

  test("does not apply accepted overdue-wait audits when a named wait remains stale", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops-maintain-overdue-network-acns-hubble-ui-exact-coverage",
      context: {
        metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
        blockedOverdueAudit: true,
        blockedTaskIds: [
          "hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier",
        ],
      },
      conflictScope: ["ops:blocked-overdue:spec-loop"],
      extraTasks: {
        "hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier": {
          id: "hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Preserve the exact Hubble UI runtime frontier until product recovery.",
          outputs: ["evidence/archive/hubble.md"],
          acceptance: ["wait is refreshed or replaced"],
          conflict_scope: ["feature:network-acns"],
          blocker: {
            condition: "Hubble UI runtime frontier remains unresolved.",
            category: "external-wait",
            owner: "human",
            waiting_for: { type: "product.recovery" },
            observed_by: { workflow: "project-planner" },
            observation_method:
              "Planner/app-ops should refresh, replace, unblock, or escalate.",
            next_check_at: "2026-07-09T12:00:00Z",
            fallback_at: "2026-07-10T12:00:00Z",
            fallback_action:
              "Refresh this exact wait with fresh evidence or replace it.",
          },
        },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops-maintain-overdue-network-acns-hubble-ui-exact-coverage",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Accepted evidence says hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier remains exact and covered.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup =
      tree.tasks[
        "ops-maintain-overdue-network-acns-hubble-ui-exact-coverage-followup"
      ];
    expect(result.status).toBe("done");
    expect(result.message).toContain("Did not apply accept review");
    expect(result.message).toContain("Overdue-wait accept cannot close");
    expect(
      tree.tasks["ops-maintain-overdue-network-acns-hubble-ui-exact-coverage"]
        .state,
    ).toBe("review");
    expect(followup).toBeUndefined();
  });

  test("accepted overdue-wait audits require structured blocked task ids", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops-maintain-overdue-missing-structured-blocked-ids",
      context: {
        metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
        blockedOverdueAudit: true,
      },
      conflictScope: ["ops:blocked-overdue:spec-loop"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops-maintain-overdue-missing-structured-blocked-ids",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Accepted evidence mentions hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier, but the review task did not carry structured blockedTaskIds.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Did not apply accept review");
    expect(result.message).toContain("missing-structured-blocked-task-ids");
    expect(
      tree.tasks["ops-maintain-overdue-missing-structured-blocked-ids"].state,
    ).toBe("review");
  });

  test("accepted overdue-wait audits stay open when only fallback_at moved forward", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops-maintain-overdue-fallback-only-refresh",
      context: {
        metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
        blockedOverdueAudit: true,
        blockedTaskIds: ["wait-spec-loop-overdue-family"],
      },
      conflictScope: ["ops:blocked-overdue:spec-loop"],
      extraTasks: {
        "wait-spec-loop-overdue-family": {
          id: "wait-spec-loop-overdue-family",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Preserve the exact overdue spec-loop family wait.",
          outputs: ["evidence/archive/wait-spec-loop-overdue-family.md"],
          acceptance: ["wait is refreshed or replaced"],
          blocker: {
            condition: "Spec-loop family remains blocked.",
            category: "external-wait",
            owner: "human",
            waiting_for: { type: "owner.response" },
            observed_by: { workflow: "project-planner" },
            observation_method:
              "Planner/app-ops must refresh, replace, unblock, or escalate this exact wait.",
            next_check_at: "2001-01-01T00:00:00.000Z",
            resume_at: "2001-01-01T00:00:00.000Z",
            fallback_at: "2999-01-01T00:00:00.000Z",
            fallback_action:
              "Refresh this exact wait with current evidence or replace it.",
          },
        },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops-maintain-overdue-fallback-only-refresh",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Accepted evidence says the fallback window moved forward, so the overdue spec-loop family can close.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Did not apply accept review");
    expect(result.message).toContain("Overdue-wait accept cannot close");
    expect(tree.tasks["ops-maintain-overdue-fallback-only-refresh"].state).toBe(
      "review",
    );
  });

  test("accepted overdue-wait audits treat metric offenderTaskIds as structured blocked task ids", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops-apply-overdue-project-frontier-from-metric-offenders",
      context: {
        metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
        blockedOverdueAudit: true,
        offenderTaskIds: ["wait-shared-westus2-managed-cluster-capacity"],
      },
      conflictScope: ["ops:blocked-overdue:project"],
      extraTasks: {
        "wait-shared-westus2-managed-cluster-capacity": {
          id: "wait-shared-westus2-managed-cluster-capacity",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Preserve exact westus2 capacity wait.",
          outputs: ["evidence/archive/westus2.md"],
          acceptance: ["wait is refreshed or replaced"],
          conflict_scope: ["westus2-capacity"],
          blocker: {
            condition: "Capacity wait was refreshed by an apply task.",
            category: "external-wait",
            owner: "human",
            waiting_for: { type: "azure.capacity.available" },
            observed_by: { workflow: "project-planner" },
            observation_method:
              "Planner/app-ops should refresh, replace, unblock, or escalate.",
            next_check_at: "2999-07-14T18:00:00Z",
            fallback_at: "2999-07-15T18:00:00Z",
            fallback_action:
              "Refresh this exact wait with fresh evidence or replace it.",
          },
        },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops-apply-overdue-project-frontier-from-metric-offenders",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "Accepted evidence says the metric offender wait was refreshed with future timing.",
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain("Applied accept review");
    expect(
      tree.tasks["ops-apply-overdue-project-frontier-from-metric-offenders"]
        .state,
    ).toBe("done");
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

  test("turns blocked reviews with unpublished origin/dev repairs into runnable follow-up work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "verify-bootstrap-profile-cache-direct-api-version-rerun",
      context: {
        featureKey: "bootstrap-profile",
        loopTaskId: "aks-feature-compact-loop",
      },
      conflictScope: ["feature-compact:bootstrap-profile"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "verify-bootstrap-profile-cache-direct-api-version-rerun",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "No truthful staging rerun was dispatched because commit 1fca94a3c is not on trusted origin/dev.",
          findings: [
            "git rev-list proves the repair commit is ahead of origin/dev and no remote branch contains it.",
          ],
          feedback: [
            "No retry of the same verification is useful until the repair commit or equivalent descendant is published to the staging-visible origin/dev ref.",
          ],
          reviewAction: {
            actionKind: "publish-domain-repair-and-rerun",
          },
          suggestedFollowups: [
            "After origin/dev contains the API-version repair, run the required local policy checks and queue exactly one spec.bootstrap-profile-byo-acr.cache-direct-cache-switch rerun.",
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup =
      tree.tasks[
        "verify-bootstrap-profile-cache-direct-api-version-rerun-blocked"
      ];
    expect(result.status).toBe("done");
    expect(
      tree.tasks["verify-bootstrap-profile-cache-direct-api-version-rerun"]
        .state,
    ).toBe("done");
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain(
      "origin/dev contains the API-version repair",
    );
    expect(followup.acceptance).toContain(
      "The project-side blocker is resolved with concrete evidence.",
    );
    expect(followup.context.reviewedTask).toMatchObject({
      taskId: "verify-bootstrap-profile-cache-direct-api-version-rerun",
      attemptId: "attempt-1",
      decision: "blocked",
    });
  });

  test("turns blocked reviews that need app state repair into runnable app-ops work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710",
      context: {
        workflow: "fix-forward",
        featureKey: "cluster-autoscaler",
        loopTaskId: "aks-feature-compact-loop",
      },
      conflictScope: ["feature-compact:cluster-autoscaler"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["opsWorker: app-ops"],
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "Run review is complete, but completion is blocked on planner/app-ops authority to restore a live task-tree holder for the compact-loop projection.",
          findings: [
            "The compact-loop projection points at frontierTaskIds, but the live task tree lacks the corresponding blocked holder.",
          ],
          feedback: [
            "Domain worker must not edit the app task tree directly; app-ops should apply the app-owned task-tree or loop state repair.",
          ],
          reviewAction: {
            actionKind: "app-state-repair",
          },
          suggestedFollowups: [
            "Restore one live blocked holder for the exact VM-prerelease heptet and refresh the feature-compact loop state pointers with evidence.",
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId ===
          "domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710" &&
        task?.id !==
          "domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710",
    ) as any;
    expect(result.status).toBe("done");
    expect(
      tree.tasks[
        "domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710"
      ].state,
    ).toBe("done");
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.id).toContain("ops-apply-");
    expect(followup.owner).toBe("app-ops");
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain("Restore one live blocked holder");
    expect(followup.outputs).toContain(
      ".state/feature-compact-loop/state.json",
    );
    expect(followup.acceptance).toContain(
      "The app-owned task-tree or loop-state repair is applied through supported app mechanisms.",
    );
    expect(followup.context.reviewedTask).toMatchObject({
      taskId:
        "domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710",
      attemptId: "attempt-1",
      decision: "blocked",
    });
    expect(followup.context.workflow).toBeUndefined();
  });

  test("turns app state repair follow-up reviews into runnable app-ops work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2",
      context: {
        workflow: "fix-forward",
      },
      conflictScope: ["feature-compact:rp-cluster-lifecycle"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["opsWorker: app-ops"],
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "The domain evidence is useful, but planner/app-ops metadata cleanup is still required.",
          findings: [
            "The live task-tree holder still has stale blocker text.",
            ".state/feature-compact-loop/state.json already points to the exact holder.",
          ],
          feedback: [
            "Use task-tree update-text through app-owned mechanisms instead of asking the domain worker to mutate app state.",
          ],
          reviewAction: {
            actionKind: "app-state-repair",
          },
          suggestedFollowups: [
            "Planner/app-ops metadata cleanup: refresh the live task-tree holder blocker text and verify the compact-loop projection remains exact.",
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId ===
          "domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2" &&
        task?.id !==
          "domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2",
    ) as any;
    expect(result.status).toBe("done");
    expect(
      tree.tasks[
        "domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2"
      ].state,
    ).toBe("done");
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.id).toContain("ops-apply-");
    expect(followup.owner).toBe("app-ops");
    expect(followup.parent_id).toBe("project");
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain("Planner/app-ops metadata cleanup");
    expect(followup.outputs).toContain("task tree");
    expect(followup.context.reviewedTask).toMatchObject({
      taskId:
        "domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2",
      attemptId: "attempt-1",
      decision: "followup",
    });
    expect(followup.context.workflow).toBeUndefined();
  });

  test("requeues guarded app-state-repair reviews in place instead of nesting another ops-apply successor", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const taskId =
      "ops-apply-repair-assignment-state-mismatch-open-archived-private-cluster-pair-20260715-state-repair";
    const priorAttemptId =
      "a_ops-apply-repair-assignment-state-mismatch-open-archived-private-cluster-pair-20260715-state-repair_20260715042027";
    await writeReviewTree(appDir, {
      taskId,
      attemptId: priorAttemptId,
      extraTasks: {
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
          state: "review",
          status: "review",
          kind: "domain_leaf",
          priority: "P2",
          owner: "app-ops",
          children: [],
          goal: "Manually reconcile the guarded review from the existing worker evidence and either accept it, reject it, or create one exact successor without duplicating passive waits.",
          outputs: [
            "task tree",
            ".state/feature-compact-loop/state.json",
            ".state/spec-loop/state.json",
            "evidence/archive/",
          ],
          acceptance: [
            "The app-owned task-tree or loop-state repair is applied through supported app mechanisms.",
            "The affected branch records the exact restored holder, state pointer, or refreshed wait with evidence.",
          ],
          conflict_scope: ["ops:assignment-state-mismatch"],
          context: {
            reviewedTask: {
              taskId:
                "ops/repair-assignment-state-mismatch-open-archived-private-cluster-pair-20260715",
              attemptId:
                "a_ops_repair-assignment-state-mismatch-open-archived-private-cluster-pair-20260715_20260715041634",
              decision: "escalate",
              reviewAction: {
                actionKind: "app-state-repair",
                owner: "app-ops",
                parentId: "project",
              },
            },
          },
          session_id: "s_task_review_task",
          result: "worker result",
          trace: {
            current_attempt_id: priorAttemptId,
            last_worker_result: "done",
            last_worker_summary: "worker says done",
          },
        },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["opsWorker: app-ops"],
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId,
          attemptId: priorAttemptId,
          decision: "escalate",
          summary:
            "Task reviewer was halted by the no-secret-leak guard; planner should route a bounded app-ops manual reconciliation from the existing worker evidence.",
          findings: [
            "reviewer-output-not-structured",
            "reviewer-guard-no-secret-leak",
          ],
          feedback: [
            'Workflow blocked by guard: 🚨 Secret leak detected in step "aks-reviewer": Telegram bot token found (2026...ed). Workflow halted to prevent exposure.',
          ],
          suggestedFollowups: [
            "App-ops should inspect the existing worker evidence, accept or reject the reviewed task, or create one exact successor without duplicating passive waits.",
          ],
          reviewAction: {
            actionKind: "app-state-repair",
            owner: "app-ops",
            parentId: "project",
            goal: "Manually reconcile the guarded review from the existing worker evidence and either accept it, reject it, or create one exact successor without duplicating passive waits.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task = tree.tasks[taskId] as any;
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Requeued guarded app-state-repair review for",
    );
    expect(new Set(Object.keys(tree.tasks))).toEqual(
      new Set(["project", taskId]),
    );
    expect(task.state).toBe("active");
    expect(task.owner).toBe("app-ops");
    expect(task.trace.previous_attempt_id).toBe(priorAttemptId);
    expect(task.trace.review_reject).toMatchObject({
      taskId,
      attemptId: priorAttemptId,
      decision: "escalate",
      findings: expect.arrayContaining(["reviewer-guard-no-secret-leak"]),
      reviewAction: {
        actionKind: "app-state-repair",
      },
    });
    expect(task.trace.current_attempt_id).not.toBe(priorAttemptId);
    expect(task.context.reviewedTask).toMatchObject({
      taskId:
        "ops/repair-assignment-state-mismatch-open-archived-private-cluster-pair-20260715",
      reviewAction: {
        actionKind: "app-state-repair",
      },
    });
  });

  test("routes repeated app-owned followup decisions to the project owner instead of nesting successors", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const taskId = "ops-apply-windows-gpu-vm-prerelease-task-tree-followup";
    const attemptId = "a_ops_apply_windows_gpu_20260715053105";
    await writeReviewTree(appDir, {
      taskId,
      attemptId,
      extraTasks: {
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
          state: "review",
          status: "review",
          kind: "domain_leaf",
          priority: "P2",
          owner: "app-ops",
          children: [],
          goal: "Apply the reviewed task-tree mutation.",
          outputs: ["task tree"],
          acceptance: ["The reviewed mutation is applied."],
          context: {
            reviewedTask: {
              taskId: "domain/windows-gpu-source-review",
              attemptId: "a_domain_windows_gpu_source_review",
              decision: "followup",
              reviewAction: {
                actionKind: "task-tree-followup",
              },
            },
          },
          trace: {
            current_attempt_id: attemptId,
            last_worker_result: "done",
          },
        },
      },
    });
    const dispatched: Array<{ type: string; data: unknown }> = [];

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        dispatched,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId,
          attemptId,
          decision: "followup",
          summary:
            "The current app-owned work is accepted, but the project owner must decide the remaining tree mutation.",
          reviewAction: {
            actionKind: "task-tree-followup",
            goal: "Apply or reject the exact reviewed Windows GPU tree mutation.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "routed the remaining app-owned action to the project owner",
    );
    expect(new Set(Object.keys(tree.tasks))).toEqual(
      new Set(["project", taskId]),
    );
    expect(tree.tasks[taskId].state).toBe("done");
    expect(dispatched).toContainEqual({
      type: "project.owner.requested",
      data: expect.objectContaining({
        reason: "reviewed-app-action",
        reviewedTaskId: taskId,
        decision: "followup",
        reviewAction: expect.objectContaining({
          actionKind: "task-tree-followup",
        }),
      }),
    });
  });

  test("turns task-tree-followup reviews into runnable app-ops apply work instead of memo-only domain retries", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-",
      conflictScope: ["feature-compact:storage-csi"],
      extraTasks: {
        project: {
          id: "project",
          state: "backlog",
          status: "backlog",
          children: ["aks-feature-compact-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "active",
          status: "active",
          kind: "domain_root",
          priority: "P1",
          owner: "aks-explorer",
          children: [
            "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-",
          ],
          goal: "feature compact loop",
          outputs: [".state/feature-compact-loop/state.json"],
          acceptance: ["done"],
        },
        "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-":
          {
            id: "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-",
            parent_id: "aks-feature-compact-loop",
            state: "review",
            status: "review",
            kind: "domain_leaf",
            priority: "P1",
            owner: "aks-explorer",
            children: [],
            goal: "Review me",
            outputs: ["runs/test-results/review-task.json"],
            acceptance: ["review accepted"],
            conflict_scope: ["feature-compact:storage-csi"],
            session_id: "s_task_review_task",
            result: "worker result",
            trace: {
              current_attempt_id: "attempt-1",
              last_worker_result: "done",
              last_worker_summary: "worker says done",
            },
          },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["opsWorker: app-ops"],
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "The worker refreshed useful evidence and preserved the exact planner/app-ops add command, but the reviewed task's required successor task still does not exist in the live task tree, so the follow-up is not resolved.",
          feedback: [
            "Planner/app-ops must either apply the recorded task-tree add command and verify the successor exists under `aks-feature-compact-loop`, or explicitly reject that mutation with evidence-backed reasoning.",
          ],
          suggestedFollowups: [
            "Planner/app-ops: create `domain/restore-storage-csi-file-nfs-unmount-boundary-executable-split-20260715` under `aks-feature-compact-loop` using the exact add command recorded in `evidence/archive/domain-reconcile-storage-csi-holder-vs-model-20260715.md`, then verify it with `bun run task-tree show domain/restore-storage-csi-file-nfs-unmount-boundary-executable-split-20260715`.",
          ],
          reviewAction: {
            actionKind: "task-tree-followup",
            goal: "Create `domain/restore-storage-csi-file-nfs-unmount-boundary-executable-split-20260715` under `aks-feature-compact-loop` using the exact add command recorded in `evidence/archive/domain-reconcile-storage-csi-holder-vs-model-20260715.md`, then verify the new task exists and carries the storage-csi file NFS/SMB unmount boundary split-or-replacement-carrier work.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId ===
          "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-" &&
        task?.id !==
          "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-",
    ) as any;
    expect(result.status).toBe("done");
    expect(
      tree.tasks[
        "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-"
      ].state,
    ).toBe("done");
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.id).toContain("ops-apply-");
    expect(followup.owner).toBe("app-ops");
    expect(followup.parent_id).toBe("project");
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain(
      "domain/restore-storage-csi-file-nfs-unmount-boundary-executable-split-20260715",
    );
    expect(followup.outputs).toContain("task tree");
    expect(followup.acceptance).toContain(
      "The exact planner-owned task-tree mutation is applied through supported app mechanisms, or an explicit evidence-backed rejection is recorded.",
    );
    expect(followup.context.reviewedTask).toMatchObject({
      taskId:
        "domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-",
      attemptId: "attempt-1",
      decision: "followup",
      reviewAction: {
        actionKind: "task-tree-followup",
      },
    });
  });

  test("atomically applies a fully structured task-tree followup without an ops apply hop", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "review-egress-followup",
      revision: 2,
      conflictScope: ["spec:egress-lockdown"],
      extraTasks: {
        lane: {
          id: "lane",
          parent_id: "project",
          state: "active",
          children: [],
        },
      },
    });
    const before = await readTaskTreeJson(appDir);
    before.tasks.project.children.push("lane");
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(before, null, 2)}\n`,
      "utf8",
    );

    const trigger = reviewedTrigger({
      taskId: "review-egress-followup",
      taskRevision: 2,
      attemptId: "attempt-1",
      decision: "followup",
      summary: "Create the exact egress verification successor.",
      reviewAction: {
        actionKind: "task-tree-followup",
        idBase: "domain/verify-egress-followup",
        parentId: "lane",
        owner: "aks-explorer",
        goal: "Verify the reviewed egress-lockdown behavior.",
        outputs: ["evidence/archive/verify-egress-followup.md"],
        acceptance: [
          "The exact verification evidence is independently reviewed.",
        ],
        conflictScopes: ["spec:egress-lockdown"],
      },
    });
    const first = await execute(
      plannerContext({ appDir, projectDir, trigger }),
    );

    expect(first.message).toContain("Applied V2 task-tree follow-up review");
    let updated = await readTaskTreeJson(appDir);
    expect(updated.tasks["review-egress-followup"].state).toBe("done");
    expect(updated.tasks["domain/verify-egress-followup"]).toMatchObject({
      parent_id: "lane",
      owner: "aks-explorer",
    });
    expect(["backlog", "active"]).toContain(
      updated.tasks["domain/verify-egress-followup"].state,
    );
    expect(
      Object.keys(updated.tasks).filter((id) => id.includes("ops-apply")),
    ).toEqual([]);

    const replay = await execute(
      plannerContext({ appDir, projectDir, trigger }),
    );
    expect(replay.message).toContain("Replayed V2 task-tree follow-up review");
    updated = await readTaskTreeJson(appDir);
    expect(
      updated.tasks.lane.children.filter(
        (id: string) => id === "domain/verify-egress-followup",
      ),
    ).toHaveLength(1);
  });

  test("turns create-domain-followup reviews into direct domain successor tasks", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo",
      conflictScope: ["feature-compact:traffic"],
      extraTasks: {
        project: {
          id: "project",
          state: "backlog",
          status: "backlog",
          children: ["aks-feature-compact-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "active",
          status: "active",
          kind: "domain_root",
          priority: "P1",
          owner: "aks-explorer",
          children: [
            "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo",
          ],
          goal: "feature compact loop",
          outputs: [".state/feature-compact-loop/state.json"],
          acceptance: ["done"],
        },
        "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo":
          {
            id: "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo",
            parent_id: "aks-feature-compact-loop",
            state: "review",
            status: "review",
            kind: "domain_leaf",
            priority: "P1",
            owner: "aks-explorer",
            children: [],
            goal: "Review me",
            outputs: ["runs/test-results/review-task.json"],
            acceptance: ["review accepted"],
            conflict_scope: ["feature-compact:traffic"],
            session_id: "s_task_review_task",
            result: "worker result",
            trace: {
              current_attempt_id: "attempt-1",
              last_worker_result: "done",
              last_worker_summary: "worker says done",
            },
          },
      },
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["domainWorker: aks-explorer", "opsWorker: app-ops"],
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "The worker re-verified and documented the missing ALB ready-pair child with an exact add command, but the task goal required that child to be created or explicitly rejected; live task-tree inspection still shows it does not exist.",
          suggestedFollowups: [
            "Create `domain/verify-traffic-alb-ready-datapath-pair-20260715` under `aks-feature-compact-loop` with conflict scope `feature-compact:traffic`, inputs from `evidence/archive/domain-reconcile-traffic-draft-frontier-vs-model-20260715.md`, `features/traffic-alb-controller/compact/staging.summary.md`, and `features/traffic-alb-controller/compact/staging.plan.json`, and output `evidence/archive/verify-traffic-alb-ready-datapath-pair-20260715.md`.",
          ],
          reviewAction: {
            actionKind: "create-domain-followup",
            goal: "Create `domain/verify-traffic-alb-ready-datapath-pair-20260715` under `aks-feature-compact-loop`, scoped only to `spec.traffic-alb-controller.ingress-routing` and `spec.traffic-alb-controller.upgrade-survival`, with conflict scope `feature-compact:traffic`, inputs from the reconciliation memo plus ALB compact summary and plan, output `evidence/archive/verify-traffic-alb-ready-datapath-pair-20260715.md`, and no reopening of `spec.traffic-alb-controller.enable-lifecycle`.",
            owner: "aks-explorer",
            parentId: "aks-feature-compact-loop",
            idBase: "domain/verify-traffic-alb-ready-datapath-pair-20260715",
            kind: "domain_leaf",
            outputs: [
              "evidence/archive/verify-traffic-alb-ready-datapath-pair-20260715.md",
            ],
            acceptance: [
              "The verification result is limited to `spec.traffic-alb-controller.ingress-routing` and `spec.traffic-alb-controller.upgrade-survival`.",
              "The task uses the current ALB compact summary and plan plus the reconciliation memo as inputs.",
              "The task does not reopen or require verification of `spec.traffic-alb-controller.enable-lifecycle`.",
              "The output memo records the concrete verification outcome and any next exact repair or wait.",
            ],
            conflictScopes: ["feature-compact:traffic"],
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup =
      tree.tasks["domain/verify-traffic-alb-ready-datapath-pair-20260715"];
    expect(result.status).toBe("done");
    expect(
      tree.tasks[
        "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo"
      ].state,
    ).toBe("done");
    expect(followup).toBeTruthy();
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.owner).toBe("aks-explorer");
    expect(followup.parent_id).toBe("aks-feature-compact-loop");
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain(
      "spec.traffic-alb-controller.ingress-routing",
    );
    expect(followup.outputs).toContain(
      "evidence/archive/verify-traffic-alb-ready-datapath-pair-20260715.md",
    );
    expect(followup.acceptance).toContain(
      "The task does not reopen or require verification of `spec.traffic-alb-controller.enable-lifecycle`.",
    );
    expect(followup.conflict_scope).toContain("feature-compact:traffic");
    expect(followup.context.reviewedTask).toMatchObject({
      taskId:
        "domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo",
      attemptId: "attempt-1",
      decision: "followup",
      reviewAction: {
        actionKind: "create-domain-followup",
      },
    });
  });

  test("turns accepted reviews with structured app-state repair actions into runnable app-ops work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops/classify-unpublished-repo-change-breach-20260713",
      context: {
        workflow: "app-ops",
      },
      conflictScope: ["repo:publication-visibility"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["opsWorker: app-ops"],
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops/classify-unpublished-repo-change-breach-20260713",
          attemptId: "attempt-1",
          decision: "accept",
          summary:
            "The worker produced a file-grouped evidence memo that satisfies classification and next-action criteria.",
          findings: [
            "The branch is ahead 1 and behind 1, so publication state must be reconciled before checkpointing.",
          ],
          reviewAction: {
            actionKind: "app-state-repair",
            goal: "Create the recommended bounded publish-state reconciliation successor task for the ahead-1/behind-1 publication divergence before checkpointing or cleanup.",
          },
          suggestedFollowups: [
            "Create a bounded publish-state reconciliation task to reconcile local dev with origin/dev, integrate upstream commit 363cda41f, and reassess the unpublished-change metric before any mixed checkpoint.",
          ],
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId ===
          "ops/classify-unpublished-repo-change-breach-20260713" &&
        task?.id !== "ops/classify-unpublished-repo-change-breach-20260713",
    ) as any;
    expect(result.status).toBe("done");
    expect(
      tree.tasks["ops/classify-unpublished-repo-change-breach-20260713"].state,
    ).toBe("done");
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.id).toContain("ops-apply-");
    expect(followup.owner).toBe("app-ops");
    expect(followup.parent_id).toBe("project");
    expect(followup.blocker).toBeUndefined();
    expect(followup.goal).toContain("bounded publish-state reconciliation");
    expect(followup.context.workflow).toBeUndefined();
    expect(followup.context.reviewedTask).toMatchObject({
      taskId: "ops/classify-unpublished-repo-change-breach-20260713",
      attemptId: "attempt-1",
      decision: "accept",
      reviewAction: {
        actionKind: "app-state-repair",
      },
    });
  });

  test("preserves blocked app-state-repair successors that already refreshed into exact waits", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st",
      status: "blocked",
      context: {
        reviewedTask: {
          taskId:
            "ops/repair-azure-devops-guard-halt-secret-leak-lineage-20260712",
          attemptId:
            "a_ops_repair-azure-devops-guard-halt-secret-leak-lineage-20260712_20260712095559",
          decision: "followup",
          summary:
            "The repair memo satisfies the diagnostic portion, but the live task tree was not left with an applied safe successor, sharper external wait, or explicit owner escalation state.",
          reviewAction: {
            actionKind: "app-state-repair",
          },
          suggestedFollowups: [
            "Planner/app-ops should apply the truthful next state for the Azure DevOps auth publication lineage by restoring the exact external wait keyed to pathId shared-azure-devops-auth-capable-runtime-20260709.",
          ],
        },
        repairedPublicationWait: {
          repairedAt: "2026-07-12T10:02:10.172Z",
          pathId: "shared-azure-devops-auth-capable-runtime-20260709",
        },
      },
      conflictScope: [
        "auth-capability-family:azure-devops-auth-capable-runtime",
      ],
    });
    const treeBefore = await readTaskTreeJson(appDir);
    treeBefore.tasks[
      "ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st"
    ].goal =
      "Carry the exact returned owner/runtime wait for the 2026-07-12 Azure DevOps auth publication lineage.";
    treeBefore.tasks[
      "ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st"
    ].blocker = {
      condition:
        "Blocked on returned owner/runtime decision for the exact publication/auth lineage.",
      category: "external-wait",
      owner: "human",
      blocked_at: "2026-07-12T10:02:10.172Z",
      waiting_for: {
        type: "project.approval.submitted",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.approval.submitted",
      },
      observation_method:
        "Reconcile returned approval or reviewed publication proof into this exact wait.",
      next_check_at: "2026-07-12T20:40:00Z",
      resume_condition:
        "Resume when the approval return or reviewed publication proof lands.",
      fallback_at: "2026-07-13T20:40:00Z",
      fallback_action:
        "Refresh or escalate the same lineage instead of reactivating the wait as runnable work.",
    };
    treeBefore.tasks[
      "ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st"
    ].trace = {
      current_attempt_id:
        "a_ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st_20260712095938",
      blocked_wait_refreshed_at: "2026-07-12T10:02:10.172Z",
      blocked_wait_refresh_summary:
        "Restored the unpublished ahead-5 Azure DevOps publication blocker as its own exact approval-return wait on the 2026-07-12 send lineage.",
    };
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(treeBefore, null, 2)}\n`,
      "utf8",
    );

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: planningTrigger({ reason: "test-planner-wake" }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task =
      tree.tasks[
        "ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st"
      ];
    expect(result.status).toBe("done");
    expect(task.state).toBe("blocked");
    expect(task.goal).toContain("exact returned owner/runtime wait");
    expect(task.blocker?.waiting_for?.type).toBe("project.approval.submitted");
    expect(task.trace.blocked_wait_refreshed_at).toBe(
      "2026-07-12T10:02:10.172Z",
    );
    expect(task.trace.requeued_by).toBeUndefined();
  });

  test("requeues existing reviewed-blocked successors when the blocker is project-side publication work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "verify-bootstrap-profile-cache-direct-api-version-rerun-blocked",
      status: "blocked",
      context: {
        featureKey: "bootstrap-profile",
        loopTaskId: "aks-feature-compact-loop",
        reviewedTask: {
          taskId: "verify-bootstrap-profile-cache-direct-api-version-rerun",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "No truthful staging rerun was dispatched because commit 1fca94a3c is not on trusted origin/dev.",
          findings: [
            "git rev-list proves the repair commit is ahead of origin/dev and no remote branch contains it.",
          ],
          feedback: [
            "No retry of the same verification is useful until the repair commit or equivalent descendant is published to the staging-visible origin/dev ref.",
          ],
          reviewAction: {
            actionKind: "publish-domain-repair-and-rerun",
          },
          suggestedFollowups: [
            "After origin/dev contains the API-version repair, run the required local policy checks and queue exactly one spec.bootstrap-profile-byo-acr.cache-direct-cache-switch rerun.",
          ],
        },
      },
      conflictScope: ["feature-compact:bootstrap-profile"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: planningTrigger({ reason: "test-planner-wake" }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task =
      tree.tasks[
        "verify-bootstrap-profile-cache-direct-api-version-rerun-blocked"
      ];
    expect(result.status).toBe("done");
    expect(["backlog", "active"]).toContain(task.state);
    expect(task.blocker).toBeUndefined();
    expect(task.goal).toContain("origin/dev contains the API-version repair");
    expect(task.trace.requeued_by).toBe("project-planner");
  });

  test("restores reviewed terminal pipeline waits in place when the run is still a real external wait", async () => {
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
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-feature-compact-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              kind: "standing_task",
              children: [
                "wait-net-integration-multinic-dualstack-ado-run-172275388-result",
              ],
              goal: "compact loop",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["loop represented"],
            },
            "wait-net-integration-multinic-dualstack-ado-run-172275388-result":
              {
                id: "wait-net-integration-multinic-dualstack-ado-run-172275388-result",
                parent_id: "aks-feature-compact-loop",
                state: "review",
                status: "review",
                kind: "domain_leaf",
                priority: "P2",
                owner: "aks-explorer",
                children: [],
                goal: "Inspect run 172275388 when it is terminal.",
                outputs: ["runs/test-results/"],
                acceptance: ["exact result inspected"],
                conflict_scope: [
                  "feature-compact:net-integration",
                  "feature:net-integration",
                  "spec:spec.net-integration.multinic-dualstack",
                  "spec:spec.net-integration.multinic-mixed",
                  "ado-run:172275388",
                ],
                context: {
                  acceptedQueuedPipelineRun: {
                    runId: "172275388",
                    runUrl:
                      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172275388",
                    specIds: [
                      "spec.net-integration.multinic-dualstack",
                      "spec.net-integration.multinic-mixed",
                    ],
                  },
                  terminalPipelineWaitReview: {
                    runId: "172275388",
                    runStatus: "inProgress",
                    runConclusion: null,
                    runUrl:
                      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172275388",
                    namedSpecIds: [
                      "spec.net-integration.multinic-dualstack",
                      "spec.net-integration.multinic-mixed",
                    ],
                  },
                },
                result:
                  "Azure DevOps pipeline run 172275388 is terminal; inspect the returned artifacts.",
                trace: {
                  current_attempt_id: "attempt-1",
                  last_worker_result: "blocked",
                  last_worker_summary:
                    "Run 172275388 is still inProgress with no published artifacts.",
                  previous_blocker_before_terminal_pipeline_wait_review: {
                    condition:
                      "Wait for Azure DevOps run 172275388 for spec.net-integration.multinic-dualstack, spec.net-integration.multinic-mixed queued by accepted task fix-net-integration-multinic-mixed-run-172268432.",
                    category: "external-wait",
                    owner: "aks-explorer",
                    blocked_at: "2026-07-15T01:59:32.232Z",
                    waiting_for: {
                      type: "ado.pipeline_run.completed",
                      runId: "172275388",
                      runUrl:
                        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172275388",
                      specIds: [
                        "spec.net-integration.multinic-dualstack",
                        "spec.net-integration.multinic-mixed",
                      ],
                    },
                    observed_by: {
                      workflow: "project-execution-watchdog",
                      trigger: "project.task.reviewed",
                    },
                    observation_method:
                      "Watchdog checks the named Azure DevOps run and moves this wait to review when the run is terminal; the reviewer then consumes artifacts and records the exact result.",
                    next_check_at: "2026-07-15T02:14:13Z",
                    resume_condition:
                      "Resume when Azure DevOps run 172275388 is terminal and its artifacts are available for exact result inspection.",
                    fallback_at: "2026-07-15T04:04:13Z",
                    fallback_action:
                      "If run 172275388 is still not terminal or artifacts remain unavailable at fallback, refresh this exact wait with current Azure DevOps queue evidence or escalate the queue/artifact issue without creating duplicate same-scope waits.",
                  },
                },
                session_id: "s_task_wait_run_172275388",
              },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId:
            "wait-net-integration-multinic-dualstack-ado-run-172275388-result",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "The reviewed run is still inProgress with no artifacts, so this remains a real external wait.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "spec-result-review",
              status: "blocked",
              subject: {
                kind: "task",
                id: "wait-net-integration-multinic-dualstack-ado-run-172275388-result",
              },
              details: {
                runId: "172275388",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172275388",
                reason:
                  "Azure DevOps run 172275388 is currently status=inProgress with result=null and artifact list=[], so no terminal same-spec result artifact exists yet.",
                specResults: [
                  {
                    specId: "spec.net-integration.multinic-dualstack",
                    runId: "172275388",
                    specStatus: "error",
                    reason:
                      "Run 172275388 is still inProgress and artifact list is empty.",
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task =
      tree.tasks[
        "wait-net-integration-multinic-dualstack-ado-run-172275388-result"
      ];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Restored exact blocked wait wait-net-integration-multinic-dualstack-ado-run-172275388-result in place",
    );
    expect(task.state).toBe("blocked");
    expect(task.parent_id).toBe("aks-feature-compact-loop");
    expect(task.blocker?.waiting_for?.runId).toBe("172275388");
    expect(task.blocker?.condition).toContain(
      "Preserve this same task id as the live carrier",
    );
    expect(task.conflict_scope).toContain("feature-compact:net-integration");
    expect(task.context.acceptedQueuedPipelineRun.runId).toBe("172275388");
    expect(task.context.terminalPipelineWaitReview).toBeUndefined();
    expect(
      task.trace.previous_blocker_before_terminal_pipeline_wait_review,
    ).toBeUndefined();
    expect(task.done_at).toBeUndefined();
    expect(
      tree.tasks[
        "wait-net-integration-multinic-dualstack-ado-run-172275388-result-blocked"
      ],
    ).toBeUndefined();
  });

  test("turns reviewed fix-forward exact waits into one in-place pipeline carrier", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "fix-spec-one-domain-followup",
      context: {
        workflow: "fix-forward",
        specId: "spec.one",
        reviewedTask: {
          decision: "followup",
          suggestedFollowups: ["Inspect the queued run when it finishes."],
          reviewAction: {
            actionKind: "create-domain-followup",
            goal: "Inspect the queued run when it finishes.",
          },
        },
        acceptedQueuedPipelineRun: {
          runId: "171-old",
          specIds: ["spec.one", "spec.two"],
        },
      },
      conflictScope: [
        "feature-compact:example",
        "spec:spec.one",
        "spec:spec.two",
        "ado-run:171-old",
      ],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "fix-spec-one-domain-followup",
          attemptId: "attempt-1",
          decision: "followup",
          summary: "Run 172-new is still queued with no artifacts.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "fix-forward",
              status: "partial",
              subject: { kind: "task", id: "fix-spec-one-domain-followup" },
              details: {
                specId: "spec.one",
                runId: "172-new",
                runUrl:
                  "https://dev.azure.com/example/_build/results?buildId=172-new",
                reason: "The run is notStarted and artifacts are empty.",
                fixForward: {
                  workflow: "fix-forward",
                  subject: { kind: "spec", id: "spec.one" },
                  classification: "missing-result-artifact",
                  diagnosis: "The exact rerun has not started.",
                  minimumDiagnosisPacket: { runId: "172-new" },
                  verification: { runId: "172-new", status: "not-run" },
                  nextAction: "exact-wait",
                  nextActionReason:
                    "Wait for the already queued rerun and inspect its exact artifact.",
                },
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task = tree.tasks["fix-spec-one-domain-followup"];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Restored exact blocked wait fix-spec-one-domain-followup in place for run 172-new",
    );
    expect(task.state).toBe("blocked");
    expect(task.blocker.owner).toBe("ado");
    expect(task.blocker.waiting_for).toMatchObject({
      type: "ado.pipeline_run.completed",
      runId: "172-new",
      specIds: ["spec.one"],
    });
    expect(task.context.acceptedQueuedPipelineRun.runId).toBe("172-new");
    expect(task.conflict_scope).toContain("ado-run:172-new");
    expect(task.conflict_scope).not.toContain("ado-run:171-old");
    expect(task.conflict_scope).not.toContain("spec:spec.two");
    expect(
      tree.tasks["fix-spec-one-domain-followup-domain-followup"],
    ).toBeUndefined();

    await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: planningTrigger({ reason: "verify-exact-wait-stability" }),
      }),
    );
    const stableTree = await readTaskTreeJson(appDir);
    expect(stableTree.tasks["fix-spec-one-domain-followup"].state).toBe(
      "blocked",
    );
    expect(
      stableTree.tasks["fix-spec-one-domain-followup"].blocker.waiting_for
        .runId,
    ).toBe("172-new");
  });

  test("revises fix-forward into a revision-local artifact-review contract", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "fix-spec-one-v2",
      revision: 2,
      context: {
        workflow: "fix-forward",
        specId: "spec.one",
        controlPlaneVersion: 2,
      },
      conflictScope: ["fix-forward:spec.one", "spec:spec.one"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        trigger: reviewedTrigger({
          taskId: "fix-spec-one-v2",
          taskRevision: 2,
          attemptId: "attempt-1",
          decision: "followup",
          summary: "Run 172459471 is queued and has no artifact yet.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "fix-forward",
              status: "partial",
              subject: { kind: "task", id: "fix-spec-one-v2" },
              details: {
                specId: "spec.one",
                runId: "172459471",
                runUrl:
                  "https://dev.azure.com/example/_build/results?buildId=172459471",
                fixForward: {
                  workflow: "fix-forward",
                  subject: { kind: "spec", id: "spec.one" },
                  classification: "missing-result-artifact",
                  diagnosis: "The exact rerun is queued.",
                  minimumDiagnosisPacket: { runId: "172459471" },
                  verification: { runId: "172459471", status: "not-run" },
                  nextAction: "exact-wait",
                  nextActionReason: "Wait for the queued run.",
                },
              },
            },
          },
        }),
      }),
    );

    expect(result.message).toContain(
      "from fix-forward revision 2 to spec-result-review revision 3",
    );
    const updated = await readTaskTreeJson(appDir);
    expect(updated.tasks["fix-spec-one-v2"]).toMatchObject({
      revision: 3,
      state: "blocked",
      context: {
        workflow: "spec-result-review",
        phaseContract: {
          revision: 3,
          resultSchema: "SPEC_RESULT_REVIEW",
        },
      },
      blocker: {
        waiting_for: {
          runId: "172459471",
          subjectRevision: 3,
        },
      },
    });
    expect(
      updated.tasks["fix-spec-one-v2"].trace.current_attempt_id,
    ).toBeUndefined();
    expect(updated.tasks["fix-spec-one-v2"].acceptance.join(" ")).not.toContain(
      "FIX_FORWARD_RESULT",
    );

    const completionTrigger = [
      "## Trigger Event",
      "```json",
      JSON.stringify(
        {
          type: "project.test_run.completed",
          target: {
            project: "aks-rp-e2e",
            taskId: "fix-spec-one-v2",
          },
          data: {
            project: "aks-rp-e2e",
            taskId: "fix-spec-one-v2",
            runId: "172459471",
            status: "completed",
            conclusion: "success",
            runUrl:
              "https://dev.azure.com/example/_build/results?buildId=172459471",
          },
        },
        null,
        2,
      ),
      "```",
    ].join("\n");
    const failedDispatches: Array<{ type: string; data: unknown }> = [];
    const eventResult = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        dispatched: failedDispatches,
        failDispatchTypes: ["project.task.assigned"],
        trigger: completionTrigger,
      }),
    );
    expect(eventResult.message).toContain(
      "Applied project.test_run.completed for Condition-backed task fix-spec-one-v2 run 172459471",
    );
    const eventApplied = await readTaskTreeJson(appDir);
    expect(
      eventApplied.conditions["condition:pipeline:ado:172459471:terminal"],
    ).toMatchObject({
      status: "resolved",
      resolution: { source: "project.test_run.completed" },
    });
    expect(eventApplied.tasks["fix-spec-one-v2"]).toMatchObject({
      revision: 3,
      state: "active",
      context: {
        controlPlaneVersion: 2,
        workflow: "spec-result-review",
      },
    });
    expect(failedDispatches).toHaveLength(0);
    expect(peekTaskAssignments(config(appDir, projectDir))).toHaveLength(1);

    const dispatched: Array<{ type: string; data: unknown }> = [];
    const replayPrompts: string[] = [];
    const replayResult = await execute(
      plannerContext({
        appDir,
        projectDir,
        extraTaskLines: ["conditionV2: exact-ado-revisioned"],
        dispatched,
        prompts: replayPrompts,
        trigger: completionTrigger,
      }),
    );
    expect(replayResult.message).toContain(
      "Replayed project.test_run.completed for Condition-backed task fix-spec-one-v2 run 172459471",
    );
    expect(replayPrompts).toEqual([]);
    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: "project.task.assigned",
        data: expect.objectContaining({
          taskId: "fix-spec-one-v2",
          taskRevision: 3,
        }),
      }),
    );
    expect(peekTaskAssignments(config(appDir, projectDir))).toEqual([]);
  });

  test("keeps reviewed fix-forward exact environment waits as non-pipeline blockers", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "fix-rp-regional-quota-public-create-path-run-172346097",
      context: {
        workflow: "fix-forward",
        specId: "spec.rp-regional-quota.public-create-path",
        sourceSpecResult: {
          specId: "spec.rp-regional-quota.public-create-path",
          runId: "172346097",
          runUrl:
            "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172346097",
        },
      },
      conflictScope: [
        "fix-forward:spec.rp-regional-quota.public-create-path:172346097",
        "spec:spec.rp-regional-quota.public-create-path",
      ],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "fix-rp-regional-quota-public-create-path-run-172346097",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "The repaired carrier is already landed and locally verifies in check mode.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "fix-forward",
              status: "done",
              subject: {
                kind: "task",
                id: "fix-rp-regional-quota-public-create-path-run-172346097",
              },
              details: {
                specId: "spec.rp-regional-quota.public-create-path",
                fixForward: {
                  workflow: "fix-forward",
                  subject: {
                    kind: "spec",
                    id: "spec.rp-regional-quota.public-create-path",
                  },
                  classification: "other-known-class",
                  diagnosis:
                    "The previous ADO run is consumed; the remaining gap is external quota headroom.",
                  minimumDiagnosisPacket: {
                    runId: "172346097",
                  },
                  verification: {
                    runId: "local-check-2026-07-16T02:53:10.696Z",
                    status: "pass",
                  },
                  nextAction: "exact-wait",
                  nextActionReason:
                    "No rerun until the same staging target is exhausted again or another reviewed same-surface target is accepted.",
                },
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task =
      tree.tasks["fix-rp-regional-quota-public-create-path-run-172346097"];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Restored exact blocked wait fix-rp-regional-quota-public-create-path-run-172346097 in place for external fact review",
    );
    expect(task.state).toBe("blocked");
    expect(task.blocker.owner).toBe("human");
    expect(task.blocker.waiting_for).toMatchObject({
      type: "blocker.resolved",
      taskId: "fix-rp-regional-quota-public-create-path-run-172346097",
      specIds: ["spec.rp-regional-quota.public-create-path"],
      sourceRunId: "172346097",
    });
    expect(task.blocker.condition).toContain(
      "do not convert local verification ids into fake Azure DevOps waits",
    );
    expect(task.context.acceptedQueuedPipelineRun).toBeUndefined();
    expect(task.context.exactExternalWait).toMatchObject({
      sourceRunId: "172346097",
      specIds: ["spec.rp-regional-quota.public-create-path"],
    });
    expect(task.conflict_scope).not.toContain(
      "ado-run:local-check-2026-07-16T02:53:10.696Z",
    );
  });

  test("does not let non-fix-forward app repair tasks become exact pipeline wait carriers", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops/reconcile-live-frontier-readout-focus-parity-20260716b",
      context: {
        currentRepairKind: "root-frontier-readout",
      },
      conflictScope: ["ops/root-frontier-readout"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops/reconcile-live-frontier-readout-focus-parity-20260716b",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "Parity repair landed, but run 172346097 still needs separate artifact review on its existing spec carrier.",
          completion: {
            workflowResult: {
              resultVersion: "workflow-result-v1",
              workflow: "spec-result-review",
              status: "done",
              subject: {
                kind: "task",
                id: "ops/reconcile-live-frontier-readout-focus-parity-20260716b",
              },
              details: {
                specId: "spec.rp-regional-quota.public-create-path",
                runId: "172346097",
                runUrl:
                  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172346097",
                reason:
                  "Aggregate and per-spec artifacts both show the public-create-path rerun stopped at preflight.target-usage with managedClusters=40/161.",
                fixForward: {
                  workflow: "fix-forward",
                  subject: {
                    kind: "feature-family",
                    id: "rp-regional-quota",
                  },
                  classification: "other-known-class",
                  diagnosis:
                    "The readout repair task is not the same thing as the exact rp-regional-quota run carrier.",
                  minimumDiagnosisPacket: {
                    runId: "172346097",
                  },
                  verification: {
                    runId: "172346097",
                    status: "error",
                  },
                  nextAction: "exact-wait",
                  nextActionReason:
                    "Keep the exact same-run wait on the existing fix-forward carrier instead of moving it onto the app repair task.",
                },
              },
            },
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task =
      tree.tasks["ops/reconcile-live-frontier-readout-focus-parity-20260716b"];
    expect(result.status).toBe("done");
    expect(result.message).not.toContain("Restored exact blocked wait");
    expect(task.state).toBe("done");
    expect(task.blocker).toBeUndefined();
    expect(task.context?.acceptedQueuedPipelineRun).toBeUndefined();
    expect(task.context?.terminalPipelineWaitReview).toBeUndefined();
    expect(task.conflict_scope).toEqual(["ops/root-frontier-readout"]);
  });

  test("keeps future-window reviewed blocked successors blocked until their resume window", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId:
        "ops-execute-1230-ccp-underlay-vpa-compact-placement-review-wave-app-ops--2",
      status: "blocked",
      owner: "app-ops",
      context: {
        reviewedTask: {
          taskId:
            "ops-execute-1230-ccp-underlay-vpa-compact-placement-review-wave-app-ops-",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "The worker correctly identified that the task was dispatched before the required review window.",
          suggestedFollowups: [
            "At or after 2026-07-12T12:30:00Z, rerun the CCP underlay VPA compact-placement owner review using current compact staging artifacts, accepted placement evidence, and compact eligibility policy.",
          ],
          reviewAction: {
            actionKind: "schedule-domain-rerun",
            goal: "At or after 2026-07-12T12:30:00Z, rerun the CCP underlay VPA compact-placement owner review using current compact staging artifacts, accepted placement evidence, and compact eligibility policy.",
          },
        },
      },
      conflictScope: ["ops:planner-time-gates"],
    });
    const treeBefore = await readTaskTreeJson(appDir);
    treeBefore.tasks[
      "ops-execute-1230-ccp-underlay-vpa-compact-placement-review-wave-app-ops--2"
    ].blocker = {
      condition:
        "Do not accept this attempt as the required owner review because it occurred before the task's own at-or-after-2026-07-12T12:30:00Z gate.",
      category: "external-wait",
      owner: "external",
      blocked_at: "2026-07-12T11:37:50.252Z",
      waiting_for: {
        type: "blocker.resolved",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.task.reviewed",
      },
      observation_method:
        "Project planner created this reviewed blocked successor from the review result; on the next owner/planner pass, refresh it with concrete returned evidence, replace it with runnable work, or keep the wait with updated blocker proof.",
      next_check_at: "2026-07-12T11:47:50.252Z",
      resume_condition:
        "At or after 2026-07-12T12:30:00Z, rerun the CCP underlay VPA compact-placement owner review using current compact staging artifacts, accepted placement evidence, and compact eligibility policy.",
      fallback_at: "2026-07-13T11:37:50.252Z",
      fallback_action:
        "If the reviewed blocker is still unresolved at fallback time, create or reuse a concrete recovery/escalation task, or refresh this exact wait with current evidence.",
      resume_at: "2026-07-12T12:30:00Z",
    };
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(treeBefore, null, 2)}\n`,
      "utf8",
    );

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: planningTrigger({ reason: "test-planner-wake" }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const task =
      tree.tasks[
        "ops-execute-1230-ccp-underlay-vpa-compact-placement-review-wave-app-ops--2"
      ];
    expect(result.status).toBe("done");
    expect(task.state).toBe("blocked");
    expect(task.blocker?.resume_at).toBe("2026-07-12T12:30:00Z");
    expect(task.blocker?.next_check_at).toBe("2026-07-12T11:47:50.252Z");
    expect(task.trace?.requeued_by).toBeUndefined();
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

  test("turns blocked schedule-domain-rerun reviews into future-window blocked successors", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "review-window-followup",
      context: {
        featureKey: "node-http-proxy",
      },
      conflictScope: ["owner-return-fallback:2026-07-12"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-window-followup",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "The fallback review must wait until the named future window opens.",
          feedback: ["Do not start before the exact fallback window opens."],
          suggestedFollowups: [
            "At or after 2026-07-12T16:00:00Z, re-check the exact owner-return lineage and route only the prepared same-lineage fallback packet if still unanswered.",
          ],
          reviewAction: {
            actionKind: "schedule-domain-rerun",
            goal: "At or after 2026-07-12T16:00:00Z, re-check the exact owner-return lineage and route only the prepared same-lineage fallback packet if still unanswered.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const successor = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId === "review-window-followup" &&
        task?.id !== "review-window-followup",
    ) as any;
    expect(result.status).toBe("done");
    expect(tree.tasks["review-window-followup"].state).toBe("done");
    expect(tree.tasks["review-window-followup"].resolution).toBe("replaced");
    expect(successor.state).toBe("blocked");
    expect(successor.blocker.category).toBe("external-wait");
    expect(successor.blocker.owner).toBe("human");
    expect(successor.blocker.resume_at).toBe("2026-07-12T16:00:00Z");
    expect(successor.blocker.next_check_at).toBe("2026-07-12T16:00:00Z");
    expect(successor.blocker.resume_condition).toContain(
      "2026-07-12T16:00:00Z",
    );
    expect(successor.blocker.condition).toContain(
      "do not start before its named review window opens",
    );
    expect(successor.context.reviewedTask).toMatchObject({
      taskId: "review-window-followup",
      attemptId: "attempt-1",
      decision: "blocked",
    });
  });

  test("turns followup schedule-domain-rerun reviews with a future window into blocked successors", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "review-window-followup-followup",
      context: {
        featureKey: "node-http-proxy",
      },
      conflictScope: ["owner-return-fallback:2026-07-12"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "review-window-followup-followup",
          attemptId: "attempt-1",
          decision: "followup",
          summary:
            "The reviewed work should continue only when the future fallback window opens.",
          suggestedFollowups: [
            "At or after 2026-07-12T16:00:00Z, re-check the exact owner-return lineage and route only the prepared same-lineage fallback packet if still unanswered.",
          ],
          reviewAction: {
            actionKind: "schedule-domain-rerun",
            goal: "At or after 2026-07-12T16:00:00Z, re-check the exact owner-return lineage and route only the prepared same-lineage fallback packet if still unanswered.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const successor = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId ===
          "review-window-followup-followup" &&
        task?.id !== "review-window-followup-followup",
    ) as any;
    expect(result.status).toBe("done");
    expect(tree.tasks["review-window-followup-followup"].state).toBe("done");
    expect(tree.tasks["review-window-followup-followup"].resolution).toBe(
      "completed",
    );
    expect(successor.state).toBe("blocked");
    expect(successor.blocker.category).toBe("external-wait");
    expect(successor.blocker.owner).toBe("human");
    expect(successor.blocker.resume_at).toBe("2026-07-12T16:00:00Z");
    expect(successor.blocker.next_check_at).toBe("2026-07-12T16:00:00Z");
    expect(successor.blocker.resume_condition).toContain(
      "2026-07-12T16:00:00Z",
    );
    expect(successor.blocker.condition).toContain(
      "do not start before its named review window opens",
    );
    expect(successor.context.reviewedTask).toMatchObject({
      taskId: "review-window-followup-followup",
      attemptId: "attempt-1",
      decision: "followup",
    });
  });

  test("routes ops-scoped schedule-domain-rerun reviewed successors to app-ops", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "ops/execute-owner-return-fallback-window",
      owner: "aks-explorer",
      context: {
        featureKey: "node-http-proxy",
      },
      conflictScope: ["owner-return-fallback:2026-07-12"],
    });

    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        trigger: reviewedTrigger({
          project: "aks-rp-e2e",
          taskId: "ops/execute-owner-return-fallback-window",
          attemptId: "attempt-1",
          decision: "blocked",
          summary:
            "The fallback review must wait until the named future window opens.",
          suggestedFollowups: [
            "At or after 2026-07-12T16:00:00Z, re-check the exact owner-return lineage and route only the prepared same-lineage fallback packet if still unanswered.",
          ],
          reviewAction: {
            actionKind: "schedule-domain-rerun",
            goal: "At or after 2026-07-12T16:00:00Z, re-check the exact owner-return lineage and route only the prepared same-lineage fallback packet if still unanswered.",
          },
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const successor = Object.values(tree.tasks).find(
      (task: any) =>
        task?.context?.reviewedTask?.taskId ===
          "ops/execute-owner-return-fallback-window" &&
        task?.id !== "ops/execute-owner-return-fallback-window",
    ) as any;
    expect(result.status).toBe("done");
    expect(successor.state).toBe("blocked");
    expect(successor.owner).toBe("app-ops");
    expect(successor.blocker.owner).toBe("app-ops");
    expect(successor.blocker.resume_at).toBe("2026-07-12T16:00:00Z");
    expect(successor.context.reviewedTask).toMatchObject({
      taskId: "ops/execute-owner-return-fallback-window",
      attemptId: "attempt-1",
      decision: "blocked",
    });
  });

  test("does not apply accepted spec-loop follow-up reviews when represented specs remain unowned", async () => {
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
    expect(result.message).toContain("Did not apply accept review");
    expect(result.message).toContain("Spec-loop accept cannot close");
    expect(tree.tasks["review-task"].state).toBe("review");
    expect(tree.tasks["review-task-followup"]).toBeUndefined();
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
    expect(prompts[1]).toContain(
      "do not create another same-lineage diagnosis leaf from the same",
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
    expect(prompts[1]).toContain(
      "mutate a review leaf; wait for its structured",
    );
    expect(prompts[1]).toMatch(
      /do not emit lifecycle events copied from a\s+review leaf/,
    );
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
        attemptId: expect.stringMatching(/^a_backlog-task_/),
        sessionId: expect.stringMatching(
          /^s_task_backlog-task_a_backlog-task_/,
        ),
      },
    });

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["quick-refill"]');
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("quick refill respects canonical state-only active capacity", async () => {
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
              children: ["active-task", "backlog-task"],
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
              children: [],
              goal: "Continue active work.",
              outputs: ["evidence/archive/active.md"],
              acceptance: ["done"],
              conflict_scope: ["active"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Wait for capacity.",
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

    const dispatched: Array<{ type: string; payload: unknown }> = [];
    await execute({
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
      runAgentSession: async () => ({ status: "success", message: "no-op" }),
      summarize: () => "",
    } as any);

    const tree = await readTaskTreeJson(appDir);
    expect(tree.tasks["active-task"].state).toBe("active");
    expect(tree.tasks["backlog-task"].state).toBe("backlog");
    expect(
      dispatched.filter((event) => event.type === "project.task.assigned"),
    ).toHaveLength(0);
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
          type: "project.owner.requested",
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
    expect(prompts[1]).toContain(
      "the current trigger payload does not include reviewTasks",
    );
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
        "s_task_backlog-task_a_backlog-task_",
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
          type: "project.owner.requested",
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
        attemptId: expect.stringMatching(/^a_backlog-task_/),
        sessionId: expect.stringMatching(
          /^s_task_backlog-task_a_backlog-task_/,
        ),
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker:
                  "Blocked only on returned authoritative proof or the first owner follow-up on or after 2099-06-26.",
                nextCheckAt: "2099-06-26T12:00:00.000Z",
                resumeCondition:
                  "Resume when returned proof arrives or the follow-up window opens.",
                fallbackAt: "2099-06-27T00:00:00.000Z",
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
            blockedOverdueCount: 0,
            blockedMissingWatchCount: 0,
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
    expect(result.message).toContain("2099-06-26T12:00:00.000Z");
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

  test("short-circuits blocked-frontier review when watchdog samples a future-dated blocked subset", async () => {
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
              blocker: {
                condition: "Wait for returned proof.",
                next_check_at: "2099-06-26T12:00:00.000Z",
                fallback_at: "2099-06-27T00:00:00.000Z",
              },
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
              blocker: {
                condition: "Wait for approval.",
                resume_at: "2099-06-27T00:00:00.000Z",
                fallback_at: "2099-06-28T00:00:00.000Z",
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
        "maxConcurrent: 3",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.owner.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker: "Wait for returned proof.",
                nextCheckAt: "2099-06-26T12:00:00.000Z",
                fallbackAt: "2099-06-27T00:00:00.000Z",
              },
            ],
            blockedCount: 2,
            blockedFutureWatchCount: 2,
            blockedMissingWatchCount: 0,
            blockedOverdueCount: 0,
            blockedFrontierSummary: {
              totalCount: 2,
              overdueCount: 0,
              futureWatchCount: 2,
              missingWatchCount: 0,
              sampledTaskIds: ["blocked-a"],
              sampledOverdueTaskIds: [],
              parentGroups: [
                { parentId: "project", count: 2, overdueCount: 0 },
              ],
              waitTypeGroups: [
                { waitType: "<missing>", count: 2, overdueCount: 0 },
              ],
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
    expect(result.message).toContain(
      "Blocked-frontier wake is already represented by structured future-dated external waits",
    );
    expect(result.message).toContain("blocked-a");
    expect(result.message).not.toContain("blocked-b");
    expect(result.message).toContain("2099-06-26T12:00:00.000Z");
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

  test("does not skip blocked-frontier owner review when frontier summary reports missing watch metadata", async () => {
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
              blocker: {
                condition: "Wait for returned proof.",
                resume_at: "2099-06-26T12:00:00.000Z",
                fallback_at: "2099-06-27T00:00:00.000Z",
              },
            },
            "blocked-b": {
              id: "blocked-b",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Wait for undocumented approval path.",
              outputs: ["evidence/archive/blocked-b.md"],
              acceptance: ["done"],
              blocker:
                "Waiting for approval with no structured watch metadata.",
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
          type: "project.owner.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker: "Wait for returned proof.",
                resumeAt: "2099-06-26T12:00:00.000Z",
                fallbackAt: "2099-06-27T00:00:00.000Z",
              },
            ],
            blockedCount: 2,
            blockedFutureWatchCount: 1,
            blockedMissingWatchCount: 1,
            blockedOverdueCount: 0,
            blockedFrontierSummary: {
              totalCount: 2,
              overdueCount: 0,
              futureWatchCount: 1,
              missingWatchCount: 1,
              sampledTaskIds: ["blocked-a"],
              sampledOverdueTaskIds: [],
              parentGroups: [
                { parentId: "project", count: 2, overdueCount: 0 },
              ],
              waitTypeGroups: [
                { waitType: "<missing>", count: 2, overdueCount: 0 },
              ],
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
        return task.includes("Planner Event Review Step")
          ? {
              status: "success",
              message: "EVENT_REVIEW: missing watch metadata",
            }
          : {
              status: "success",
              message: "planner reviewed missing watch metadata",
            };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(result.message).toContain("planner reviewed missing watch metadata");
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
          type: "project.owner.requested",
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
            blockedFutureWatchCount: 1,
            blockedMissingWatchCount: 0,
            blockedOverdueCount: 0,
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

  test("does not skip blocked-frontier owner review when watchdog reports overdue waits", async () => {
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
              blocker: {
                condition: "Wait for returned proof.",
                next_check_at: "2001-01-01T00:00:00.000Z",
                resume_at: "2099-06-26T00:00:00.000Z",
                fallback_at: "2099-06-27T00:00:00.000Z",
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
        "maxConcurrent: 3",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.owner.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker: "Wait for returned proof.",
                nextCheckAt: "2099-06-26T00:00:00.000Z",
                resumeAt: "2099-06-26T12:00:00.000Z",
                fallbackAt: "2099-06-27T00:00:00.000Z",
              },
            ],
            blockedCount: 1,
            blockedFutureWatchCount: 1,
            blockedMissingWatchCount: 0,
            blockedOverdueCount: 1,
            overdueOwnerActions: [
              {
                taskId: "blocked-a",
                watchAt: "2001-01-01T00:00:00.000Z",
                recoveryRequired:
                  "Next-check window passed without active/review recovery work.",
              },
            ],
            overdueOwnerActionCount: 1,
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
          ? { status: "success", message: "EVENT_REVIEW: overdue blocker" }
          : { status: "success", message: "planner reviewed overdue blocker" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(result.message).toContain("planner reviewed overdue blocker");
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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

  test("skips owner session for false-positive stale-active watchdog review even when unrelated review work remains", async () => {
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
              children: ["active-task", "review-task", "already-done-task"],
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
            "review-task": {
              id: "review-task",
              parent_id: "project",
              state: "review",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Unrelated review work.",
              outputs: ["evidence/archive/review-task.md"],
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
          type: "project.owner.requested",
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
    expect(result.message).toContain("retired ids");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(0);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(updated.tasks["review-task"].state).toBe("review");

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Watchdog stale-active review was a false positive",
    );
    expect(plannerRuns).toContain("retired ids");
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for stale watchdog blocked-frontier overdue packets after wait refresh and same-lineage recovery", async () => {
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
          active_task_id: "domain/review-overdue-runtime-container",
          active_task_ids: ["domain/review-overdue-runtime-container"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "wait-runtime-container-kscr-rotation-matrix-ado-run-172502185-result-blocked",
                "domain/review-overdue-runtime-container",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "wait-runtime-container-kscr-rotation-matrix-ado-run-172502185-result-blocked":
              {
                id: "wait-runtime-container-kscr-rotation-matrix-ado-run-172502185-result-blocked",
                parent_id: "project",
                state: "blocked",
                kind: "domain_leaf",
                priority: "P2",
                owner: "aks-explorer",
                children: [],
                goal: "Wait for same-run runtime-container kscr rotation artifact review.",
                outputs: ["evidence/archive/runtime-container-blocked.md"],
                acceptance: ["done"],
                blocker: {
                  condition: "Wait for same-run review recovery.",
                  category: "external-wait",
                  owner: "external",
                  waiting_for: {
                    type: "blocker.resolved",
                    pathId: "path.runtime-container.kscr-rotation",
                  },
                  next_check_at: "2099-06-26T00:40:00.000Z",
                  resume_at: "2099-06-26T00:40:00.000Z",
                  fallback_at: "2099-06-27T00:40:00.000Z",
                  fallback_action: "Recheck the same-run review carrier.",
                },
              },
            "domain/review-overdue-runtime-container": {
              id: "domain/review-overdue-runtime-container",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Re-poll the same ADO run and inspect the exact same-run artifact once it exists.",
              outputs: ["evidence/archive/runtime-container-review.md"],
              acceptance: ["done"],
              conflict_scope: ["path.runtime-container.kscr-rotation"],
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
          type: "project.owner.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "watchdog-blocked-frontier-review",
            blockedTasks: [
              {
                taskId:
                  "wait-runtime-container-kscr-rotation-matrix-ado-run-172502185-result-blocked",
                parentId: "project",
                nextCheckAt: "2099-06-26T00:40:00.000Z",
                resumeAt: "2099-06-26T00:40:00.000Z",
                fallbackAt: "2099-06-27T00:40:00.000Z",
              },
            ],
            blockedCount: 1,
            blockedFutureWatchCount: 1,
            blockedMissingWatchCount: 0,
            blockedOverdueCount: 1,
            overdueOwnerActions: [
              {
                taskId:
                  "wait-runtime-container-kscr-rotation-matrix-ado-run-172502185-result-blocked",
                owner: "external",
                watchAt: "2001-01-01T00:00:00.000Z",
                recoveryRequired:
                  "Next-check window passed without active/review recovery work.",
              },
            ],
            overdueOwnerActionCount: 1,
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
      "Watchdog blocked-frontier review was a false positive",
    );
    expect(result.message).toContain(
      "active/review same-lineage recovery work after live-tree revalidation",
    );
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Watchdog blocked-frontier review was a false positive",
    );
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips owner session for stale-active watchdog review when the cited task still has a running runtime session", async () => {
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
        sessionId, agent, task, status, kind, source, startedAt, outcome, opCount, stepLabel, lastActivityAt
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "s_task_active-task",
      "aks-explorer",
      "active task still running",
      "running",
      "call",
      "workflow:task-worker",
      Date.now() - 30_000,
      "running",
      4,
      "aks-explorer",
      Date.now() - 2_000,
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
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task"],
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
          "## Trigger Event",
          "```json",
          JSON.stringify({
            type: "project.owner.requested",
            data: {
              project: "aks-rp-e2e",
              reason: "watchdog-stale-active-review",
              staleActiveTasks: [
                { taskId: "active-task", reason: "session-not-running" },
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
      expect(result.message).toContain("currently running runtime session");
      expect(prompts).toHaveLength(0);
      expect(dispatched).toHaveLength(0);

      const plannerRuns = await readFile(
        join(appDir, ".state", "planner-runs.jsonl"),
        "utf8",
      );
      expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
      expect(plannerRuns).toContain(
        "currently running runtime session after live-tree revalidation",
      );
      expect(plannerRuns).toContain('"ran_agent":false');
    } finally {
      if (priorDb === undefined) delete process.env.MAY_DB_PATH;
      else process.env.MAY_DB_PATH = priorDb;
    }
  });

  test("skips owner session for no-work metric wake when the only frontier work is a running active task", async () => {
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
        sessionId, agent, task, status, kind, source, startedAt, outcome, opCount, stepLabel, lastActivityAt
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "s_task_active-task",
      "aks-explorer",
      "active task still running",
      "running",
      "call",
      "workflow:task-worker",
      Date.now() - 30_000,
      "running",
      4,
      "aks-explorer",
      Date.now() - 2_000,
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
          active_task_id: "active-task",
          active_task_ids: ["active-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-task", "future-window-task"],
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
            "future-window-task": {
              id: "future-window-task",
              parent_id: "project",
              state: "blocked",
              kind: "ops_leaf",
              priority: "P2",
              owner: "human",
              children: [],
              blocker: {
                condition:
                  "Do not start before the future review window opens.",
                category: "external-wait",
                owner: "human",
                resume_at: "2099-06-26T12:00:00.000Z",
                next_check_at: "2099-06-26T12:00:00.000Z",
                fallback_at: "2099-06-27T12:00:00.000Z",
              },
              goal: "Wait for the future review window.",
              outputs: ["evidence/archive/future-window-task.md"],
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
    const priorDb = process.env.MAY_DB_PATH;
    process.env.MAY_DB_PATH = dbPath;
    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          "## Trigger Event",
          "```json",
          JSON.stringify({
            type: "metric.breach",
            data: {
              project: "aks-rp-e2e",
              reason: "metric.breach",
              metricId: "aks-rp-e2e.task.no-work-with-gaps",
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
        "No-work metric wake is already covered by currently running active work",
      );
      expect(result.message).toContain("active-task");
      expect(prompts).toHaveLength(0);
      expect(dispatched).toHaveLength(0);

      const plannerRuns = await readFile(
        join(appDir, ".state", "planner-runs.jsonl"),
        "utf8",
      );
      expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
      expect(plannerRuns).toContain(
        "No-work metric wake is already covered by currently running active work",
      );
      expect(plannerRuns).toContain('"ran_agent":false');
    } finally {
      if (priorDb === undefined) delete process.env.MAY_DB_PATH;
      else process.env.MAY_DB_PATH = priorDb;
    }
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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

  test("replays stored reviewer output for live watchdog-review-pending tasks before owner planning", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeReviewTree(appDir, {
      taskId: "review-task",
      attemptId: "attempt-1",
    });
    await writeFile(
      join(appDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-15T12:15:51.765Z",
        workflow: "task-reviewer",
        result: "project.task.reviewed",
        task_id: "review-task",
        attempt_id: "attempt-1",
        decision: "accept",
        summary:
          "Reviewer already approved the bounded follow-up and only needs deterministic apply.",
        reviewAction: {
          actionKind: "create-domain-followup",
          goal: "Run the exact bounded next step for the reviewed task.",
          owner: "aks-explorer",
          parentId: "project",
          idBase: "review-task-domain-followup",
          kind: "domain_leaf",
          outputs: ["evidence/archive/review-task-domain-followup.md"],
          acceptance: ["The bounded next step is represented."],
          conflictScopes: ["scope.review-task"],
        },
      })}\n`,
      "utf8",
    );

    const prompts: string[] = [];
    const dispatched: Array<{ type: string; data: unknown }> = [];
    const result = await execute(
      plannerContext({
        appDir,
        projectDir,
        prompts,
        dispatched,
        extraTaskLines: ["domainWorker: aks-explorer", "opsWorker: app-ops"],
        trigger: planningTrigger({
          reason: "watchdog-review-pending",
          reviewTasks: [
            {
              taskId: "review-task",
              updatedAt: "2026-07-15T12:20:51.490Z",
            },
          ],
          reviewCount: 1,
        }),
      }),
    );

    const tree = await readTaskTreeJson(appDir);
    const followup = tree.tasks["review-task-domain-followup"];
    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Recovered review-task from watchdog-review-pending using the stored reviewer decision",
    );
    expect(prompts).toHaveLength(0);
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(followup).toBeTruthy();
    expect(["backlog", "active"]).toContain(followup.state);
    expect(followup.context.reviewedTask).toMatchObject({
      taskId: "review-task",
      attemptId: "attempt-1",
      decision: "accept",
      reviewAction: {
        actionKind: "create-domain-followup",
      },
    });
    expect(dispatched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "project.task.assigned" }),
      ]),
    );

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain(
      '"steps":["task-reviewed-apply","quick-refill"]',
    );
    expect(plannerRuns).toContain('"ran_agent":false');
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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

  test("skips owner session for blocked-overdue metric wake when active ops repair already covers the frontier", async () => {
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
          active_task_id: "ops/repair-overdue-wait-shape",
          active_task_ids: ["ops/repair-overdue-wait-shape"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["ops/repair-overdue-wait-shape"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops/repair-overdue-wait-shape": {
              id: "ops/repair-overdue-wait-shape",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "app-ops",
              session_id: "s_task_ops_repair_overdue_wait_shape",
              children: [],
              goal: "Repair the overdue blocked-wait shape.",
              outputs: ["evidence/archive/ops-repair-overdue-wait-shape.md"],
              acceptance: ["done"],
              conflict_scope: ["ops:blocked-overdue:project"],
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
        "agent: app-ops",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "metric.breach",
          data: {
            project: "aks-rp-e2e",
            reason: "open-alert-updated",
            metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
          },
        }),
        "```",
      ].join("\n"),
      agent: "app-ops",
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
      "Blocked-overdue metric wake is already under active app-ops repair",
    );
    expect(result.message).toContain("ops/repair-overdue-wait-shape");
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Blocked-overdue metric wake is already under active app-ops repair",
    );
    expect(plannerRuns).toContain('"ran_agent":false');
  });

  test("skips blocked-overdue metric wake when active ops repair shares offender wait lineage pathId", async () => {
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
          active_task_id: "ops/repair-shared-auth-family",
          active_task_ids: ["ops/repair-shared-auth-family"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["ops/repair-shared-auth-family", "shared-auth-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops/repair-shared-auth-family": {
              id: "ops/repair-shared-auth-family",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "app-ops",
              session_id: "s_task_ops_repair_shared_auth_family",
              children: [],
              goal: "Repair the shared auth family.",
              outputs: ["evidence/archive/ops-repair-shared-auth-family.md"],
              acceptance: ["done"],
              conflict_scope: [
                "shared-authenticated-artifact-result-recovery-family-20260712",
              ],
            },
            "shared-auth-wait": {
              id: "shared-auth-wait",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "Shared auth wait.",
              outputs: ["evidence/archive/shared-auth-wait.md"],
              acceptance: ["done"],
              blocker: {
                condition: "Waiting for shared auth recovery.",
                waiting_for: {
                  type: "project.approval.submitted",
                  pathId:
                    "shared-authenticated-artifact-result-recovery-family-20260712",
                },
                fallback_at: "2026-01-01T00:00:00.000Z",
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
        "agent: app-ops",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "metric.breach",
          data: {
            project: "aks-rp-e2e",
            reason: "open-alert-updated",
            metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
            offenderTaskIds: ["shared-auth-wait"],
          },
        }),
        "```",
      ].join("\n"),
      agent: "app-ops",
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
      "Blocked-overdue metric wake is already under active app-ops repair",
    );
    expect(result.message).toContain("ops/repair-shared-auth-family");
    expect(prompts).toHaveLength(0);
  });

  test("does not skip blocked-overdue metric wake when active ops repair covers different offenders", async () => {
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
          active_task_id: "ops/repair-covered-wait",
          active_task_ids: ["ops/repair-covered-wait"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "ops/repair-covered-wait",
                "covered-wait",
                "uncovered-wait",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops/repair-covered-wait": {
              id: "ops/repair-covered-wait",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "app-ops",
              session_id: "s_task_ops_repair_covered_wait",
              children: [],
              goal: "Repair one overdue wait.",
              outputs: ["evidence/archive/ops-repair-covered-wait.md"],
              acceptance: ["done"],
              context: {
                blockedTaskIds: ["covered-wait"],
              },
            },
            "covered-wait": {
              id: "covered-wait",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "Covered blocked wait.",
              outputs: ["evidence/archive/covered-wait.md"],
              acceptance: ["done"],
              blocker: {
                condition: "Covered wait.",
                fallback_at: "2026-01-01T00:00:00.000Z",
              },
            },
            "uncovered-wait": {
              id: "uncovered-wait",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "Uncovered blocked wait.",
              outputs: ["evidence/archive/uncovered-wait.md"],
              acceptance: ["done"],
              blocker: {
                condition: "Uncovered wait.",
                fallback_at: "2026-01-01T00:00:00.000Z",
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
        "agent: app-ops",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "metric.breach",
          data: {
            project: "aks-rp-e2e",
            reason: "open-alert-updated",
            metricId: "aks-rp-e2e.process.blocked.overdue-unworked-count",
            offenderTaskIds: ["uncovered-wait"],
          },
        }),
        "```",
      ].join("\n"),
      agent: "app-ops",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, task: string) => {
        prompts.push(task);
        return { status: "success", message: "owner reviewed" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Agent ran event-review");
    expect(result.message).not.toContain(
      "Blocked-overdue metric wake is already under active app-ops repair",
    );
    expect(prompts.length).toBeGreaterThan(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["event-review","planning-update"]');
    expect(plannerRuns).toContain('"ran_agent":true');
  });

  test("skips owner session for scheduled blocked-frontier future-wait review when active ops repair already covers the frontier", async () => {
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
          active_task_id:
            "ops/repair-all-blocked-frontier-planner-slow-wakes-20260711",
          active_task_ids: [
            "ops/repair-all-blocked-frontier-planner-slow-wakes-20260711",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "ops/repair-all-blocked-frontier-planner-slow-wakes-20260711",
                "blocked-a",
                "blocked-b",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops/repair-all-blocked-frontier-planner-slow-wakes-20260711": {
              id: "ops/repair-all-blocked-frontier-planner-slow-wakes-20260711",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              session_id:
                "s_task_ops_repair-all-blocked-frontier-planner-slow-wakes-20260711",
              children: [],
              goal: "Diagnose and reduce repeated planner slow wakes against an unchanged all-blocked frontier.",
              outputs: [
                "evidence/archive/ops-repair-all-blocked-frontier-planner-slow-wakes-20260711.md",
              ],
              acceptance: ["done"],
              conflict_scope: [
                "ops:planner-slow-all-blocked-frontier-20260711",
              ],
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
              blocker: {
                condition: "Wait for returned proof.",
                next_check_at: "2099-06-26T12:00:00.000Z",
                fallback_at: "2099-06-27T00:00:00.000Z",
              },
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
              blocker: {
                condition: "Wait for approval.",
                resume_at: "2099-06-27T00:00:00.000Z",
                fallback_at: "2099-06-28T00:00:00.000Z",
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
        "agent: app-ops",
        "maxConcurrent: 5",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.owner.requested",
          data: {
            project: "aks-rp-e2e",
            reason: "scheduled-blocked-frontier-review",
            blockedTasks: [
              {
                taskId: "blocked-a",
                blocker: "Wait for returned proof.",
                nextCheckAt: "2099-06-26T12:00:00.000Z",
                fallbackAt: "2099-06-27T00:00:00.000Z",
              },
              {
                taskId: "blocked-b",
                blocker: "Wait for approval.",
                resumeAt: "2099-06-27T00:00:00.000Z",
                fallbackAt: "2099-06-28T00:00:00.000Z",
              },
            ],
            blockedCount: 2,
            blockedOverdueCount: 0,
            blockedMissingWatchCount: 0,
            overdueOwnerActions: [],
          },
        }),
        "```",
      ].join("\n"),
      agent: "app-ops",
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
      "Blocked-frontier future-wait review is already under active app-ops repair",
    );
    expect(result.message).toContain(
      "ops/repair-all-blocked-frontier-planner-slow-wakes-20260711",
    );
    expect(prompts).toHaveLength(0);

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["settled-active-noop"]');
    expect(plannerRuns).toContain(
      "Blocked-frontier future-wait review is already under active app-ops repair",
    );
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
          type: "project.owner.requested",
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
          attemptId: expect.stringMatching(/^a_backlog-task_/),
          sessionId: expect.stringMatching(
            /^s_task_backlog-task_a_backlog-task_/,
          ),
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
          type: "project.owner.requested",
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
          type: "project.owner.requested",
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
              event_type: "project.owner.requested",
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
