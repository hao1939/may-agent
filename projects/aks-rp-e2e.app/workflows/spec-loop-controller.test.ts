import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  completeTask,
  peekTaskAssignments,
  planningPacket,
  summarizeTaskTree,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";
import {
  loadSpecLoopState,
  orderedPendingSpecIds,
  type SpecLoopState,
} from "./lib/spec-loop-store.ts";
import { specStateSelfRepresentsExactFrontier } from "./lib/spec-loop-frontier.ts";
import { execute, harvestTerminalGitHubWaits } from "./spec-loop-controller.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-spec-loop-"));
  await mkdir(join(dir, ".github", "workflows", "feature-sets"), {
    recursive: true,
  });
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "specs"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

function eventBlock(event: Record<string, unknown>): string {
  return `## Trigger Event
\`\`\`json
${JSON.stringify(event)}
\`\`\``;
}

function config(projectDir: string, maxConcurrent = 5) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent,
  });
}

describe("spec-loop-controller", () => {
  test("moves blocked pipeline wait children to review when the referenced run is terminal", async () => {
    const projectDir = await makeProject();
    const now = new Date().toISOString();
    const state: SpecLoopState = {
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 1,
      cursor: 0,
      prioritySpecIds: [],
      specs: {
        "spec.a": {
          status: "pending",
          taskId: "wait-spec-a-run",
          attempts: 3,
          lastRunId: null,
          lastRunUrl: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: now,
        },
      },
    };
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: now,
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-a-run"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {},
            },
            "wait-spec-a-run": {
              id: "wait-spec-a-run",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              priority: "P1",
              children: [],
              goal: "Wait for spec.a workflow run 123456789 to finish.",
              inputs: [],
              outputs: [],
              acceptance: ["Review terminal workflow result."],
              forbidden: [],
              conflict_scope: ["spec:spec.a"],
              depends_on: [],
              blocker: {
                category: "external-wait",
                condition: "Waiting for GitHub workflow run.",
                waiting_for: {
                  type: "github.workflow_run.completed",
                  runId: "123456789",
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = harvestTerminalGitHubWaits({
      config: config(projectDir),
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      state,
      client: { kind: "gh" },
      limit: 10,
      getRun: (runId) => ({
        databaseId: Number(runId),
        status: "completed",
        conclusion: "failure",
        url: "https://github.example/runs/123456789",
        displayTitle: "Run specs: spec.a",
      }),
    });

    expect(result.harvestedTaskIds).toEqual(["wait-spec-a-run"]);
    expect(result.terminalRunIds).toEqual(["123456789"]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["wait-spec-a-run"]).toMatchObject({
      state: "review",
      context: {
        terminalPipelineWaitReview: {
          runId: "123456789",
          runStatus: "completed",
          runConclusion: "failure",
          namedSpecIds: ["spec.a"],
        },
      },
    });
    expect(tree.tasks["wait-spec-a-run"].blocker).toBeUndefined();
    expect(state.specs["spec.a"]).toMatchObject({
      taskId: "wait-spec-a-run",
      lastRunId: "123456789",
      lastRunUrl: "https://github.example/runs/123456789",
      review: {
        pendingReviewReason:
          "terminal Azure DevOps pipeline wait observed by spec-loop controller",
        pendingReviewTaskId: "wait-spec-a-run",
        pendingReviewRunId: "123456789",
      },
    });
  });

  test("does not harvest terminal waits from prose-only run ids", async () => {
    const projectDir = await makeProject();
    const now = new Date().toISOString();
    const state: SpecLoopState = {
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 1,
      cursor: 0,
      prioritySpecIds: [],
      specs: {
        "spec.a": {
          status: "pending",
          taskId: "wait-spec-a-run",
          attempts: 3,
          lastRunId: null,
          lastRunUrl: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: now,
        },
      },
    };
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: now,
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-a-run"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {},
            },
            "wait-spec-a-run": {
              id: "wait-spec-a-run",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              priority: "P1",
              children: [],
              goal: "Wait for spec.a workflow run 123456789 to finish.",
              inputs: ["Historical note says run 123456789 was queued."],
              outputs: [],
              acceptance: ["Review terminal workflow result."],
              forbidden: [],
              conflict_scope: ["spec:spec.a"],
              depends_on: [],
              blocker: {
                category: "external-wait",
                condition:
                  "Waiting for a pipeline run, but no structured run id was recorded.",
                waiting_for: {
                  type: "github.workflow_run.completed",
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = harvestTerminalGitHubWaits({
      config: config(projectDir),
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      state,
      client: { kind: "gh" },
      limit: 10,
      getRun: () => {
        throw new Error("prose-only run id should not be queried");
      },
    });

    expect(result.harvestedTaskIds).toEqual([]);
    expect(result.checkedRunIds).toEqual([]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["wait-spec-a-run"]).toMatchObject({
      state: "blocked",
      status: "blocked",
    });
    expect(state.specs["spec.a"].lastRunId).toBeNull();
  });

  test("leaves GitHub wait children blocked while the referenced run is still active", async () => {
    const projectDir = await makeProject();
    const now = new Date().toISOString();
    const state: SpecLoopState = {
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 1,
      cursor: 0,
      prioritySpecIds: [],
      specs: {
        "spec.a": {
          status: "pending",
          taskId: "wait-spec-a-run",
          attempts: 3,
          lastRunId: null,
          lastRunUrl: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: now,
        },
      },
    };
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: now,
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-a-run"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {},
            },
            "wait-spec-a-run": {
              id: "wait-spec-a-run",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              priority: "P1",
              children: [],
              goal: "Wait for spec.a workflow run 123456789 to finish.",
              inputs: [],
              outputs: [],
              acceptance: ["Review terminal workflow result."],
              forbidden: [],
              conflict_scope: ["spec:spec.a"],
              depends_on: [],
              blocker: {
                category: "external-wait",
                condition: "Waiting for GitHub workflow run.",
                waiting_for: {
                  type: "github.workflow_run.completed",
                  runId: "123456789",
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = harvestTerminalGitHubWaits({
      config: config(projectDir),
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      state,
      client: { kind: "gh" },
      limit: 10,
      getRun: (runId) => ({
        databaseId: Number(runId),
        status: "in_progress",
        conclusion: null,
      }),
    });

    expect(result.harvestedTaskIds).toEqual([]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["wait-spec-a-run"]).toMatchObject({
      state: "blocked",
      status: "blocked",
    });
    expect(state.specs["spec.a"].lastRunId).toBeNull();
  });

  test("keeps terminal-disposition specs visible without making them ordinary runnable work", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["deprecated.json", "live.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "deprecated.json"),
      JSON.stringify({
        id: "spec.deprecated",
        status: "deprecated",
      }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "live.json"),
      JSON.stringify({ id: "spec.live" }),
      "utf8",
    );

    const initial = loadSpecLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 2,
    });
    expect(initial.state.specs["spec.deprecated"].status).toBe("pending");
    expect(initial.state.specs["spec.deprecated"]).toMatchObject({
      terminalDisposition: true,
      successorDisposition: "catalog-deprecated",
      review: {
        classification: "catalog_terminal_disposition",
      },
    });
    expect(initial.state.specs["spec.live"].status).toBe("pending");

    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 2,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.deprecated": {
              status: "done",
              taskId: "old-task",
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.live": {
              status: "pass",
              taskId: "passed-task",
              attempts: 1,
              lastRunId: "123",
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const migrated = loadSpecLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 2,
    });
    expect(migrated.state.specs["spec.deprecated"]).toMatchObject({
      status: "pending",
      taskId: "old-task",
      terminalDisposition: true,
      successorDisposition: "catalog-deprecated",
      review: {
        classification: "catalog_terminal_disposition",
      },
    });
    expect(migrated.state.specs["spec.live"].status).toBe("pass");
    expect(orderedPendingSpecIds(migrated.state)).toContain("spec.deprecated");
    expect(orderedPendingSpecIds(migrated.state)).not.toContain("spec.live");
  });

  test("fills a bounded window prioritizing dev-infra-core specs", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "path.priority\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: ["later.json", "priority.json", "other.json"],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "later.json"),
      JSON.stringify({
        id: "spec.later",
        featurePathIds: ["path.later"],
      }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "priority.json"),
      JSON.stringify({
        id: "spec.priority",
        featurePathIds: ["path.priority"],
      }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "other.json"),
      JSON.stringify({
        id: "spec.other",
        featurePathIds: ["path.other"],
      }),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 2,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                adoPipelineAccessPreflight: false,
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), {
      taskId: "aks-spec-verification-loop",
    });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
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
    expect(result.message).toContain("Created 2 child task(s)");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toHaveLength(2);
    expect(loop.trace.current_attempt_id).toBeUndefined();
    expect(loop.context.workflowProgress).toMatchObject({
      completionReady: false,
      pending: 1,
      running: 2,
      lastPulseCreated: 2,
    });
    expect(tree.active_task_ids).not.toContain("aks-spec-verification-loop");
    expect(new Set(tree.active_task_ids)).toEqual(new Set(loop.children));
    const childSpecs = loop.children.map(
      (taskId: string) => tree.tasks[taskId].context.specId,
    );
    expect(childSpecs[0]).toBe("spec.priority");
    expect(childSpecs).toContain("spec.later");
    expect(
      loop.children.map(
        (taskId: string) => tree.tasks[taskId].context.timeoutMinutes,
      ),
    ).toEqual(["60", "60"]);
    expect(dispatched.map((entry) => entry.type)).toEqual([
      "project.task.assigned",
      "project.task.assigned",
    ]);
    const childIds = new Set(loop.children);
    expect(
      peekTaskAssignments(config(projectDir)).some((queued) =>
        childIds.has(queued.taskId),
      ),
    ).toBe(false);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.prioritySpecIds).toEqual(["spec.priority"]);
  });

  test("keeps three verifier workflows running within a larger open window", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: [
            "app-routing-default-internal.json",
            "app-routing-default-external.json",
            "aad-rbac-managed-v2.json",
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "app-routing-default-internal.json"),
      JSON.stringify({ id: "spec.app-routing.default-internal" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "app-routing-default-external.json"),
      JSON.stringify({ id: "spec.app-routing.default-external" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "aad-rbac-managed-v2.json"),
      JSON.stringify({ id: "spec.aad-rbac.managed-v2" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: ["a.json", "b.json", "c.json", "d.json", "e.json"],
        },
        null,
        2,
      ),
      "utf8",
    );
    for (const id of ["a", "b", "c", "d", "e"]) {
      await writeFile(
        join(projectDir, "specs", `${id}.json`),
        JSON.stringify({
          id: `spec.${id}`,
          featurePathIds: [`path.${id}`],
        }),
        "utf8",
      );
    }
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 5,
                targetRunning: 3,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                adoPipelineAccessPreflight: false,
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir, 8), {
      taskId: "aks-spec-verification-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 8",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 5 child task(s)");
    expect(result.message).toContain("Assigned 3 child task(s)");
    expect(result.message).toContain("Target running spec workflows: 3");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toHaveLength(5);
    expect(dispatched.map((entry) => entry.taskId)).toEqual(
      loop.children.slice(0, 3),
    );
    expect(new Set(tree.active_task_ids)).toEqual(
      new Set(loop.children.slice(0, 3)),
    );
    expect(
      loop.children.map((taskId: string) => tree.tasks[taskId].state),
    ).toEqual(["active", "active", "active", "backlog", "backlog"]);
    expect(loop.context.workflowProgress).toMatchObject({
      pending: 2,
      running: 3,
      targetRunning: 3,
      surplusRunning: 0,
      openChildren: 5,
      lastPulseCreated: 5,
      lastPulseAssigned: 3,
    });
  });

  test("skips local policy failures and keeps filling verifier window", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "runner"), { recursive: true });
    await writeFile(
      join(projectDir, "runner", "check-private-source-policy.ts"),
      [
        "const index = process.argv.indexOf('--spec');",
        "const specId = index >= 0 ? process.argv[index + 1] : '';",
        "console.log(`dependency policy passed for ${specId}`);",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(projectDir, "runner", "check-live-admission.ts"),
      [
        "const index = process.argv.indexOf('--spec');",
        "const specId = index >= 0 ? process.argv[index + 1] : '';",
        "if (specId === 'spec.bad') {",
        "  console.error('Live admission policy failed:');",
        "  console.error('- spec.bad: runner-exclusion-needing-replay-gate-repair: replaySupportsLiveExecution()=false');",
        "  process.exit(1);",
        "}",
        "console.log(`live admission passed for ${specId}`);",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: ["bad.json", "good-a.json", "good-b.json"],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "bad.json"),
      JSON.stringify({ id: "spec.bad", featurePathIds: ["path.bad"] }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "good-a.json"),
      JSON.stringify({ id: "spec.good-a", featurePathIds: ["path.good"] }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "good-b.json"),
      JSON.stringify({ id: "spec.good-b", featurePathIds: ["path.good"] }),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 2,
                targetRunning: 2,
                maxDirectAttemptsPerSpec: 3,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir, 5), {
      taskId: "aks-spec-verification-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 2 child task");
    expect(result.message).toContain("Created 1 policy repair follow-up");
    expect(result.message).toContain("Policy-preflighted 1 spec");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toEqual([
      "repair-spec-loop-policy-bad",
      "verify-spec-good-a",
      "verify-spec-good-b",
    ]);
    expect(dispatched.map((entry) => entry.taskId)).toEqual([
      "verify-spec-good-a",
      "verify-spec-good-b",
    ]);
    expect(tree.tasks["repair-spec-loop-policy-bad"]).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        policyFollowup: true,
        sampledSpecIds: ["spec.bad"],
      },
    });
    expect(
      tree.tasks["repair-spec-loop-policy-bad"].acceptance.join("\n"),
    ).toContain("committed and pushed in the aks-rp-e2e domain repo");
    expect(loop.context.workflowProgress).toMatchObject({
      completionReady: false,
      pending: 0,
      running: 2,
      error: 1,
      openChildren: 2,
      openFollowups: 1,
      lastPulseCreated: 2,
      lastPulseCreatedFollowups: 1,
    });
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.specs["spec.bad"]).toMatchObject({
      status: "error",
      taskId: "repair-spec-loop-policy-bad",
      attempts: 3,
    });
    expect(state.specs["spec.good-a"]).toMatchObject({
      status: "running",
      taskId: "verify-spec-good-a",
    });
    expect(state.specs["spec.good-b"]).toMatchObject({
      status: "running",
      taskId: "verify-spec-good-b",
    });
  });

  test("reports surplus running verifiers when active work exceeds targetRunning", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: [
            "a.json",
            "b.json",
            "c.json",
            "d.json",
            "e.json",
            "f.json",
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      await writeFile(
        join(projectDir, "specs", `${id}.json`),
        JSON.stringify({
          id: `spec.${id}`,
          featurePathIds: [`path.${id}`],
        }),
        "utf8",
      );
    }
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 5,
                targetRunning: 3,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const firstAssignment = assignTask(config(projectDir, 8), {
      taskId: "aks-spec-verification-loop",
    });
    await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 8",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...firstAssignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    let tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    const backlogChildIds = loop.children.filter(
      (taskId: string) => tree.tasks[taskId].state === "backlog",
    );
    expect(backlogChildIds).toHaveLength(2);

    for (const taskId of backlogChildIds) {
      assignTask(config(projectDir, 8), { taskId });
    }

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 8",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    tree = JSON.parse(await readFile(resolveTaskTreePath(projectDir), "utf8"));
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      pending: 1,
      running: 5,
      targetRunning: 3,
      surplusRunning: 2,
      openChildren: 5,
      lastPulseCreated: 0,
      lastPulseAssigned: 0,
    });
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress.reason,
    ).toContain("above targetRunning=3");
  });

  test("reassigns existing backlog children before newer children", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: ["a.json", "b.json", "c.json"],
        },
        null,
        2,
      ),
      "utf8",
    );
    for (const id of ["a", "b", "c"]) {
      await writeFile(
        join(projectDir, "specs", `${id}.json`),
        JSON.stringify({
          id: `spec.${id}`,
          featurePathIds: [`path.${id}`],
        }),
        "utf8",
      );
    }
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 2,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir, 1), {
      taskId: "aks-spec-verification-loop",
    });
    const firstDispatches: Array<Record<string, unknown>> = [];
    await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        firstDispatches.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    let tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    const firstChild = loop.children[0];
    const secondChild = loop.children[1];
    expect(firstDispatches.map((entry) => entry.taskId)).toEqual([firstChild]);
    expect(tree.tasks[firstChild].state).toBe("active");
    expect(tree.tasks[secondChild].state).toBe("backlog");

    completeTask(config(projectDir, 1), {
      taskId: firstChild,
      claim: "done",
      summary: "first spec completed",
    });

    const secondDispatches: Array<Record<string, unknown>> = [];
    await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
          sourceTaskId: firstChild,
          result: "done",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        secondDispatches.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    tree = JSON.parse(await readFile(resolveTaskTreePath(projectDir), "utf8"));
    expect(tree.tasks["aks-spec-verification-loop"].children).toHaveLength(3);
    expect(secondDispatches.map((entry) => entry.taskId)).toEqual([
      secondChild,
    ]);
    expect(tree.tasks[secondChild].state).toBe("active");
  });

  test("treats exact nonlive pending residue as self-represented so false family followups do not regenerate", async () => {
    const selfRepresented: SpecLoopState["specs"][string] = {
      status: "pending",
      attempts: 3,
      taskId: null,
      lastRunId: "171461207",
      lastRunUrl: "https://dev.azure.example/runs/171461207",
      lastResultPath: "evidence/archive/spec.json",
      lastPrUrl: null,
      updatedAt: new Date().toISOString(),
      successorDisposition: "repaired-ready-residue-no-new-leaf",
      resumeCondition:
        "Resume only if the owner explicitly selects one bounded same-spec live rerun from the repaired carrier or a metadata decision materially changes this spec's posture.",
      review: {
        classification: "repaired_ready",
        lastAction:
          "Keep pending; treat as exact ready-rerun residue. Owner may either preserve draft/source-grounded metadata or queue one bounded same-spec live rerun on the repaired carrier.",
        reviewedAt: new Date().toISOString(),
      },
    };

    expect(specStateSelfRepresentsExactFrontier(selfRepresented)).toBe(true);
    expect(
      specStateSelfRepresentsExactFrontier({
        ...selfRepresented,
        successorDisposition:
          "same-run-review-wait-after-bounded-rerun-dispatch",
      }),
    ).toBe(false);
    expect(
      specStateSelfRepresentsExactFrontier({
        ...selfRepresented,
        successorDisposition: "reviewed_nonlive_source_grounded_wait",
      }),
    ).toBe(true);
    expect(
      specStateSelfRepresentsExactFrontier({
        ...selfRepresented,
        successorDisposition:
          "environment_setup_blocker_node_subnet_http409_before_product_assertion",
      }),
    ).toBe(true);
    expect(
      specStateSelfRepresentsExactFrontier({
        ...selfRepresented,
        successorDisposition:
          "repo_local_witness_repair_landed_future_rerun_if_focus_reopens",
        review: {
          classification:
            "repo_local_witness_repair_landed_future_rerun_if_focus_reopens",
          lastAction:
            "Keep pending under the active no-new-live focus. If live focus reopens, queue exactly one bounded same-spec rerun.",
          reviewedAt: new Date().toISOString(),
        },
      }),
    ).toBe(true);
    expect(
      specStateSelfRepresentsExactFrontier({
        ...selfRepresented,
        successorDisposition: "environment_blocker",
        review: {
          acceptedRunId: "171341286",
          acceptedStatus: "error",
          acceptedByTaskId: "archived-review-task",
        },
      }),
    ).toBe(false);
    expect(
      specStateSelfRepresentsExactFrontier({
        ...selfRepresented,
        successorDisposition:
          "same-run-review-wait-after-bounded-rerun-dispatch",
        review: {
          pendingReviewTaskId: "archived-wait-task",
          pendingReviewRunId: "171389443",
        },
      }),
    ).toBe(false);

    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: ["localdns-multi.json", "localdns-win.json"],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "localdns-multi.json"),
      JSON.stringify({ id: "spec.localdns.multipool-consistency" }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "localdns-win.json"),
      JSON.stringify({ id: "spec.localdns.windows-nodepool" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.localdns.multipool-consistency": {
              status: "error",
              taskId: "repair-spec-loop-policy-localdns",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath:
                "evidence/archive/reconcile-spec-loop-error-localdns-2-20260706.md",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
              normalizedFromStatus: "error",
              normalizedAt: new Date().toISOString(),
              successorDisposition:
                "reviewed-exception-owner-followup-existing-wait",
              resumeCondition:
                "resume only after authoritative localdns return",
              review: {
                classification: "reviewed_exception_claim_narrowing",
                lastAction: "Keep pending under the exact existing wait.",
                reviewedAt: new Date().toISOString(),
              },
            },
            "spec.localdns.windows-nodepool": {
              status: "error",
              taskId: "repair-spec-loop-policy-localdns",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath:
                "evidence/archive/reconcile-spec-loop-error-localdns-2-20260706.md",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
              normalizedFromStatus: "error",
              normalizedAt: new Date().toISOString(),
              successorDisposition:
                "reviewed-exception-owner-followup-existing-wait",
              resumeCondition:
                "resume only after authoritative localdns return",
              review: {
                classification:
                  "reviewed_exception_unsupported_product_boundary",
                lastAction: "Keep pending under the exact existing wait.",
                reviewedAt: new Date().toISOString(),
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [
                "hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c",
                "reconcile-spec-loop-error-localdns",
              ],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c":
              {
                id: "hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c",
                parent_id: "aks-spec-verification-loop",
                state: "blocked",
                status: "blocked",
                goal: "Wait for exact authoritative LocalDNS return.",
                outputs: ["evidence/archive/localdns-wait.md"],
                acceptance: ["Signal returned"],
                conflict_scope: [
                  "feature:localdns",
                  "spec:spec.localdns.multipool-consistency",
                  "spec:spec.localdns.windows-nodepool",
                ],
                blocker: {
                  condition: "authoritative return required",
                  category: "external-wait",
                },
              },
            "reconcile-spec-loop-error-localdns": {
              id: "reconcile-spec-loop-error-localdns",
              parent_id: "aks-spec-verification-loop",
              state: "done",
              status: "done",
              goal: "Archived LocalDNS repair leaf.",
              outputs: [
                "evidence/archive/reconcile-spec-loop-error-localdns.md",
              ],
              acceptance: ["review accepted"],
              conflict_scope: [
                "spec-loop-followup:error:localdns",
                "feature:localdns",
              ],
              context: {
                specLoopFollowup: true,
                status: "error",
                featureFamily: "localdns",
                representedSpecIds: [
                  "spec.localdns.multipool-consistency",
                  "spec.localdns.windows-nodepool",
                ],
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["reconcile-spec-loop-error-localdns-2"]).toBeUndefined();
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      dispatchablePending: 0,
      openFollowups: 0,
      blockedWaitChildren: 1,
      noRefillNow: true,
      unrepresentedNonTerminalCount: 0,
    });
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("blocked");
    expect(
      tree.tasks["aks-spec-verification-loop"].blocker,
    ).toBeUndefined();
  });

  test("does not policy-preflight reviewed pending specs that are already represented by an exact wait", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "runner"), { recursive: true });
    await writeFile(
      join(projectDir, "runner", "check-live-admission.ts"),
      "console.error('source-check-only'); process.exit(1);\n",
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["localdns-win.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "localdns-win.json"),
      JSON.stringify({ id: "spec.localdns.windows-nodepool" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.localdns.windows-nodepool": {
              status: "pending",
              taskId:
                "hold-spec-loop-pending-localdns-reviewed-exception-owner-source-family",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath:
                "evidence/archive/reconcile-spec-loop-error-localdns.md",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
              successorDisposition:
                "reviewed-exception-owner-source-family-wait",
              resumeCondition:
                "resume only after authoritative localdns source changes",
              review: {
                classification:
                  "reviewed_exception_unsupported_product_boundary",
                lastAction:
                  "Keep pending under the exact LocalDNS holder. Do not rerun unchanged.",
                reviewedAt: new Date().toISOString(),
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [
                "hold-spec-loop-pending-localdns-reviewed-exception-owner-source-family",
              ],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: true,
              },
            },
            "hold-spec-loop-pending-localdns-reviewed-exception-owner-source-family":
              {
                id: "hold-spec-loop-pending-localdns-reviewed-exception-owner-source-family",
                parent_id: "aks-spec-verification-loop",
                state: "blocked",
                status: "blocked",
                goal: "Wait for exact authoritative LocalDNS return.",
                outputs: ["evidence/archive/localdns-wait.md"],
                acceptance: ["Signal returned"],
                conflict_scope: [
                  "feature:localdns",
                  "spec:spec.localdns.windows-nodepool",
                ],
                blocker: {
                  condition: "authoritative return required",
                  category: "external-wait",
                },
              },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["repair-spec-loop-policy-localdns"]).toBeUndefined();
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      dispatchablePending: 0,
      openFollowups: 0,
      unrepresentedNonTerminalCount: 0,
    });
  });

  test("accepts terminal verifier reviews and keeps the window moving", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["a.json", "b.json"] }, null, 2),
      "utf8",
    );
    for (const id of ["a", "b"]) {
      await writeFile(
        join(projectDir, "specs", `${id}.json`),
        JSON.stringify({
          id: `spec.${id}`,
          featurePathIds: [`path.${id}`],
        }),
        "utf8",
      );
    }
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "fail",
              taskId: "verify-spec-a",
              attempts: 0,
              lastRunId: "123",
              lastRunUrl: null,
              lastResultPath: "runs/test-results/spec-a/result.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.b": {
              status: "pending",
              taskId: null,
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["verify-spec-a"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "verify-spec-a": {
              id: "verify-spec-a",
              parent_id: "aks-spec-verification-loop",
              state: "review",
              status: "review",
              workflow: "single-spec-verifier",
              priority: "P1",
              goal: "Run spec.a",
              inputs: ["spec:spec.a"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              conflict_scope: ["spec:spec.a"],
              context: {
                specId: "spec.a",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                stateRef: ".state/spec-loop/state.json",
                loopTaskId: "aks-spec-verification-loop",
              },
              trace: {
                last_worker_result: "blocked",
                last_worker_summary:
                  "Spec spec.a workflow run 123 classified as fail.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Accepted 1 terminal verifier review");
    expect(dispatched.map((entry) => entry.taskId)).toEqual(["verify-spec-b"]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["verify-spec-a"]).toMatchObject({
      state: "done",
      resolution: "terminal",
    });
    expect(tree.tasks["verify-spec-b"]).toMatchObject({
      state: "active",
    });
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.specs["spec.a"].status).toBe("fail");
    expect(state.specs["spec.b"]).toMatchObject({
      status: "running",
      taskId: "verify-spec-b",
    });
  });

  test("syncs only valid spec-loop children into progress", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["a.json", "b.json"] }, null, 2),
      "utf8",
    );
    for (const id of ["a", "b"]) {
      await writeFile(
        join(projectDir, "specs", `${id}.json`),
        JSON.stringify({
          id: `spec.${id}`,
          featurePathIds: [`path.${id}`],
        }),
        "utf8",
      );
    }
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 2,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "pending",
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.b": {
              status: "pending",
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "legacy-retry",
          active_task_ids: ["legacy-retry"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["legacy-retry", "verify-spec-a"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 2,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "legacy-retry": {
              id: "legacy-retry",
              parent_id: "aks-spec-verification-loop",
              state: "active",
              status: "active",
              priority: "P2",
              goal: "Legacy retry task without spec-loop workflow context.",
              inputs: [],
              outputs: [],
              acceptance: ["done"],
              conflict_scope: ["manual"],
            },
            "verify-spec-a": {
              id: "verify-spec-a",
              parent_id: "aks-spec-verification-loop",
              state: "active",
              status: "active",
              workflow: "single-spec-verifier",
              priority: "P1",
              goal: "Run spec.a",
              inputs: ["spec:spec.a"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              conflict_scope: ["spec:spec.a"],
              context: {
                specId: "spec.a",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                stateRef: ".state/spec-loop/state.json",
                loopTaskId: "aks-spec-verification-loop",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toContain("legacy-retry");
    expect(loop.context.workflowProgress).toMatchObject({
      pending: 0,
      running: 2,
      residuePending: 0,
      residueRunning: 2,
      unrepresentedNonTerminalCount: 0,
      openChildren: 3,
      activeChildren: 3,
      reviewChildren: 0,
      waitingChildren: 0,
      backlogChildren: 0,
      openSpecVerifierChildren: 2,
      blockedWaitChildren: 0,
      lastPulseCreated: 1,
    });
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.specs["spec.a"].status).toBe("running");
    expect(state.specs["spec.b"].status).toBe("running");
    expect(state.specs["spec.a"].taskId).toBe("verify-spec-a");
    expect(state.specs["spec.b"].taskId).toBe("verify-spec-b");
  });

  test("releases stale running specs that no longer have an execution child", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["a.json", "b.json"] }, null, 2),
      "utf8",
    );
    for (const id of ["a", "b"]) {
      await writeFile(
        join(projectDir, "specs", `${id}.json`),
        JSON.stringify({
          id: `spec.${id}`,
          featurePathIds: [`path.${id}`],
        }),
        "utf8",
      );
    }
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "running",
              taskId: "missing-child",
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.b": {
              status: "pending",
              taskId: null,
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Released 1 stale running spec");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toEqual(["verify-spec-a"]);
    expect(dispatched.map((entry) => entry.taskId)).toEqual(["verify-spec-a"]);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.specs["spec.a"]).toMatchObject({
      status: "running",
      taskId: "verify-spec-a",
    });
    expect(state.specs["spec.b"]).toMatchObject({
      status: "pending",
      taskId: null,
    });
  });

  test("creates a retry child for a requeued spec with a terminal historical child", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["a.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "a.json"),
      JSON.stringify({ id: "spec.a", featurePathIds: ["path.a"] }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "pending",
              taskId: null,
              attempts: 1,
              lastRunId: "old-run",
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["verify-spec-a"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "verify-spec-a": {
              id: "verify-spec-a",
              parent_id: "aks-spec-verification-loop",
              state: "done",
              status: "done",
              workflow: "single-spec-verifier",
              priority: "P1",
              children: [],
              goal: "historical terminal verifier",
              inputs: ["spec:spec.a"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              context: {
                specId: "spec.a",
                stateRef: ".state/spec-loop/state.json",
                loopTaskId: "aks-spec-verification-loop",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 1 child task");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toHaveLength(2);
    const retryId = loop.children.find((id: string) =>
      id.startsWith("verify-spec-a-retry-"),
    );
    expect(retryId).toBeTruthy();
    expect(tree.tasks[retryId].state).toBe("active");
    expect(dispatched.map((entry) => entry.taskId)).toEqual([retryId]);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.specs["spec.a"]).toMatchObject({
      status: "running",
      taskId: retryId,
    });
  });

  test("creates grouped follow-up instead of direct retry after retry budget is exhausted", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["a.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "a.json"),
      JSON.stringify({ id: "spec.a.first" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a.first": {
              status: "error",
              taskId: "verify-spec-a-first",
              attempts: 3,
              lastRunId: "old-run",
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              failureClass: "request-shape-invalid",
              diagnosis: "BadRequest from agentPool create.",
              inputFingerprint: "input:spec-a-staging",
              errorFingerprint: "error:badrequest-agentpool",
              priorGithubAttempts: 2,
              budgetResetReason: "ado-migration-backend-change",
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                maxDirectAttemptsPerSpec: 3,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 0 child task");
    expect(result.message).toContain("Created 1 grouped follow-up task");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["verify-spec-a-first"]).toBeUndefined();
    const followup = tree.tasks["reconcile-spec-loop-error-a"];
    expect(followup).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        status: "error",
        featureFamily: "a",
        workflow: "fix-forward",
        subjectKind: "spec-family",
        reviewMode: "stalled-work-review",
        failureClasses: ["request-shape-invalid"],
        inputFingerprints: ["input:spec-a-staging"],
        errorFingerprints: ["error:badrequest-agentpool"],
        retryGuardedSpecIds: ["spec.a.first"],
        routeChangeSpecIds: ["spec.a.first"],
        routeChangeReasons: [
          "ado-migration-backend-change",
          "prior-github-attempts:2",
        ],
      },
    });
    expect(followup.inputs).toContain("currentBackend:ado");
    expect(followup.inputs).toContain(
      "routeChange:ado-migration-backend-change",
    );
    expect(followup.inputs).toContain("failureClass:request-shape-invalid");
    expect(followup.acceptance.join("\n")).toContain(
      "repaired in the aks-rp-e2e domain repo, committed, pushed",
    );
    expect(followup.acceptance.join("\n")).toContain(
      "Treat the controller packet, old task text, and prior reviews as hints",
    );
    expect(followup.acceptance.join("\n")).toContain(
      "emit specRetryReset for only the affected specs",
    );
    expect(followup.acceptance.join("\n")).toContain(
      "compare inputFingerprint and errorFingerprint",
    );
    expect(dispatched.map((entry) => entry.taskId)).toEqual([]);
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      executionDrained: true,
      retryBudgetExhausted: 1,
      openFollowups: 1,
      lastPulseCreated: 0,
      lastPulseCreatedFollowups: 1,
    });
  });

  test("completed spec repair can reset exhausted retry budget and dispatch fresh verifier", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["storage.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "storage.json"),
      JSON.stringify({ id: "spec.storage-csi.disk-resize" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.storage-csi.disk-resize": {
              status: "error",
              taskId: "reconcile-spec-loop-error-storage-csi",
              attempts: 3,
              lastRunId: "old-run",
              lastRunUrl: "https://example.test/run/old-run",
              lastResultPath: "/tmp/old-result.json",
              lastPrUrl: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "backlog",
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
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["reconcile-spec-loop-error-storage-csi"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Every spec has a live pass"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                maxDirectAttemptsPerSpec: 3,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "reconcile-spec-loop-error-storage-csi": {
              id: "reconcile-spec-loop-error-storage-csi",
              parent_id: "aks-spec-verification-loop",
              state: "done",
              status: "done",
              done_at: "2999-01-01T00:00:00.000Z",
              priority: "P1",
              children: [],
              goal: "Repair storage-csi spec-loop failures.",
              inputs: ["spec:spec.storage-csi.disk-resize"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Repair landed and should be rerun"],
              forbidden: [],
              conflict_scope: ["spec-loop-followup:error:storage-csi"],
              depends_on: [],
              context: {
                specLoopFollowup: true,
                status: "error",
                featureFamily: "storage-csi",
                representedSpecIds: ["spec.storage-csi.disk-resize"],
                specRetryReset: {
                  specIds: ["spec.storage-csi.disk-resize"],
                  reason:
                    "storage-csi carrier no longer depends on ignored evidence",
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Reset retry budget for 1 spec");
    expect(result.message).toContain("Created 1 child task");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const retryId = tree.tasks["aks-spec-verification-loop"].children.find(
      (id: string) =>
        id !== "reconcile-spec-loop-error-storage-csi" &&
        id.startsWith("verify-spec-storage-csi-disk-resize"),
    );
    expect(retryId).toBeTruthy();
    expect(tree.tasks[retryId].state).toBe("active");
    expect(dispatched.map((entry) => entry.taskId)).toEqual([retryId]);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.specs["spec.storage-csi.disk-resize"]).toMatchObject({
      status: "running",
      attempts: 0,
      taskId: retryId,
    });
    expect(state.specs["spec.storage-csi.disk-resize"].retryResetByTaskId).toBe(
      "reconcile-spec-loop-error-storage-csi",
    );
  });

  test("spec-loop follow-up only represents its own status and feature family, and uncovered groups get new recovery tasks", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        { specFiles: ["a-one.json", "a-two.json", "b-one.json"] },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "a-one.json"),
      JSON.stringify({ id: "spec.a.one" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "a-two.json"),
      JSON.stringify({ id: "spec.a.two" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "b-one.json"),
      JSON.stringify({ id: "spec.b.one" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    const now = new Date().toISOString();
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a.one": {
              status: "error",
              taskId: "old-a-one",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: "https://github.example/runs/a-one",
              lastResultPath: "missing-a-one.json",
              lastPrUrl: null,
              updatedAt: now,
            },
            "spec.a.two": {
              status: "error",
              taskId: "old-a-two",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: "https://github.example/runs/a-two",
              lastResultPath: "missing-a-two.json",
              lastPrUrl: null,
              updatedAt: now,
            },
            "spec.b.one": {
              status: "error",
              taskId: "old-b-one",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: "https://github.example/runs/b-one",
              lastResultPath: "missing-b-one.json",
              lastPrUrl: null,
              updatedAt: now,
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: now,
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
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
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["reconcile-spec-loop-error-a"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                maxDirectAttemptsPerSpec: 3,
                maxFollowupGroups: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "reconcile-spec-loop-error-a": {
              id: "reconcile-spec-loop-error-a",
              parent_id: "aks-spec-verification-loop",
              state: "backlog",
              status: "backlog",
              priority: "P1",
              children: [],
              goal: "Current error:a reconciliation wave.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Classify error:a specs"],
              forbidden: [],
              conflict_scope: ["spec-loop-followup:error:a"],
              depends_on: [],
              context: {
                specLoopFollowup: true,
                status: "error",
                featureFamily: "a",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      error: 3,
      openFollowups: 3,
      representedFollowupGroups: ["error:a", "error:b"],
      unrepresentedNonTerminalCount: 0,
      lastPulseCreatedFollowups: 2,
    });
    expect(tree.tasks["reconcile-spec-loop-error-a-2"]).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        status: "error",
        featureFamily: "a",
        totalSpecCount: 2,
        representedSpecIds: ["spec.a.one", "spec.a.two"],
      },
    });
    expect(tree.tasks["reconcile-spec-loop-error-b"]).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        status: "error",
        featureFamily: "b",
        totalSpecCount: 1,
        representedSpecIds: ["spec.b.one"],
      },
    });
  });

  test("keeps drained residue runnable when blocked waits do not represent every non-pass spec", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: ["alpha.json"],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha.wait-only" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha.wait-only": {
              status: "error",
              taskId: "reconcile-spec-loop-error-alpha",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [
                "wait-external-signal",
                "reconcile-spec-loop-error-alpha",
              ],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
              },
            },
            "wait-external-signal": {
              id: "wait-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact external signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "reconcile-spec-loop-error-alpha": {
              id: "reconcile-spec-loop-error-alpha",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for the exact resume signal before retrying the alpha follow-up.",
              outputs: ["evidence/archive/reconcile-alpha-wait.md"],
              acceptance: ["Resume signal returned"],
              blocker: {
                condition: "resume signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        "app: ",
        projectDir,
        `\nproject: ${projectDir}`,
        "\n",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join(""),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      openChildren: 0,
      activeChildren: 0,
      reviewChildren: 0,
      waitingChildren: 0,
      backlogChildren: 0,
      openSpecVerifierChildren: 0,
      openFollowups: 1,
      blockedWaitChildren: 2,
      lastPulseCreated: 0,
      lastPulseCreatedFollowups: 1,
      unrepresentedNonTerminalCount: 0,
    });
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress.reason,
    ).toContain("residue is still nonterminal");
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress
        .noRefillNow,
    ).toBeUndefined();
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("backlog");
    expect(tree.tasks["aks-spec-verification-loop"].blocker).toBeUndefined();
    expect(tree.active_task_ids).not.toContain("aks-spec-verification-loop");
    expect(
      summarizeTaskTree(config(projectDir)).frontier.blocked,
    ).not.toContain("aks-spec-verification-loop");
    expect(planningPacket(config(projectDir)).frontier.blocked).not.toContain(
      "aks-spec-verification-loop",
    );
    expect(planningPacket(config(projectDir)).frontier.blocked).toContain(
      "reconcile-spec-loop-error-alpha",
    );
  });

  test("does not let a partial family follow-up represent unnamed specs", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha-one.json", "alpha-two.json"] }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha-one.json"),
      JSON.stringify({ id: "spec.alpha.one" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha-two.json"),
      JSON.stringify({ id: "spec.alpha.two" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha.one": {
              status: "error",
              attempts: 3,
              taskId: "reconcile-spec-loop-error-alpha",
              updatedAt: new Date().toISOString(),
            },
            "spec.alpha.two": {
              status: "error",
              attempts: 3,
              taskId: "reconcile-spec-loop-error-alpha",
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["reconcile-spec-loop-error-alpha"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
              },
            },
            "reconcile-spec-loop-error-alpha": {
              id: "reconcile-spec-loop-error-alpha",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Hold only spec.alpha.one on an exact wait.",
              outputs: ["evidence/archive/reconcile-alpha-one.md"],
              acceptance: ["Resume signal returned"],
              conflict_scope: ["spec-loop-followup:error:alpha"],
              context: {
                specLoopFollowup: true,
                status: "error",
                featureFamily: "alpha",
                representedSpecIds: ["spec.alpha.one"],
              },
              blocker: {
                condition: "resume signal required for spec.alpha.one",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 1 grouped follow-up task(s)");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["reconcile-spec-loop-error-alpha-2"]).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        status: "error",
        featureFamily: "alpha",
        representedSpecIds: ["spec.alpha.one", "spec.alpha.two"],
      },
    });
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      error: 2,
      openFollowups: 1,
      unrepresentedNonTerminalCount: 0,
      lastPulseCreatedFollowups: 1,
    });
  });

  test("closes stale blocked wait children when their named specs already passed", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha.done" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha.done": {
              status: "pass",
              taskId: "wait-alpha-stale",
              attempts: 4,
              lastRunId: "1234567890",
              lastRunUrl: "https://github.example/run/1234567890",
              lastResultPath: "runs/test-results/alpha/result.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-alpha-stale"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
              },
            },
            "wait-alpha-stale": {
              id: "wait-alpha-stale",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for review of spec.alpha.done run 1234567890.",
              outputs: ["evidence/archive/alpha-wait.md"],
              acceptance: ["Review completed"],
              blocker: {
                condition: "run 1234567890 artifact review required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Closed 1 stale blocked wait");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["wait-alpha-stale"]).toMatchObject({
      state: "done",
      resolution: "completed",
    });
    expect(tree.tasks["wait-alpha-stale"].result).toContain("spec.alpha.done");
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: true,
      blockedWaitChildren: 0,
      pass: 1,
    });
  });

  test("keeps blocked wait children when the named pass spec still has terminal catalog posture", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({
        id: "spec.alpha.draft-pass",
        status: "draft",
        specState: "reviewed-exception",
      }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha.draft-pass": {
              status: "pass",
              taskId: "wait-alpha-draft-gap",
              attempts: 2,
              lastRunId: "2233445566",
              lastRunUrl: "https://github.example/run/2233445566",
              lastResultPath: "runs/test-results/alpha-draft/result.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
              catalogStatus: "draft",
              catalogSpecState: "reviewed-exception",
              terminalDisposition: true,
              successorDisposition: "reviewed-exception-draft-gap",
              resumeCondition:
                "Resume only after exact source parity or owner-approved reframe.",
              review: {
                classification: "draft_gap_reviewed_exception",
                reviewedAt: new Date().toISOString(),
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-alpha-draft-gap"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
              },
            },
            "wait-alpha-draft-gap": {
              id: "wait-alpha-draft-gap",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Hold the draft-gap frontier for spec.alpha.draft-pass.",
              conflict_scope: ["spec:spec.alpha.draft-pass"],
              outputs: ["evidence/archive/alpha-draft-gap.md"],
              acceptance: [
                "Owner/model boundary changes or exact parity lands",
              ],
              blocker: {
                condition:
                  "Exact source parity still missing for draft-gap frontier.",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).not.toContain("Closed 1 stale blocked wait");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["wait-alpha-draft-gap"]).toMatchObject({
      state: "blocked",
    });
    expect(tree.tasks["wait-alpha-draft-gap"].resolution).toBeUndefined();
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      blockedWaitChildren: 1,
      pass: 1,
    });
  });

  test("does not treat blocked family conflict scope as exact spec-loop residue", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha.wait-only" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha.wait-only": {
              status: "error",
              taskId: "wait-alpha-external-signal",
              attempts: 3,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-alpha-external-signal"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
              },
            },
            "wait-alpha-external-signal": {
              id: "wait-alpha-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact alpha resume signal.",
              outputs: ["evidence/archive/wait-alpha.md"],
              acceptance: ["Signal returned"],
              conflict_scope: ["spec-loop-followup:error:alpha"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      error: 1,
      representedFollowupGroups: ["error:alpha"],
      unrepresentedNonTerminalCount: 0,
      blockedWaitChildren: 1,
      openFollowups: 1,
      lastPulseCreatedFollowups: 1,
    });
    expect(tree.tasks["reconcile-spec-loop-error-alpha"]).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        status: "error",
        featureFamily: "alpha",
        totalSpecCount: 1,
        representedSpecIds: ["spec.alpha.wait-only"],
      },
    });
  });

  test("treats structured exact holder taskId as representing spec-loop residue", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha.wait-only" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha.wait-only": {
              status: "pending",
              taskId: "wait-alpha-external-signal",
              attempts: 3,
              lastRunId: "123",
              lastRunUrl: "https://example.test/run/123",
              lastResultPath: "/tmp/result.json",
              lastPrUrl: null,
              successorDisposition: "exact-wait",
              resumeCondition: "resume only after exact alpha signal returns",
              review: {
                classification: "external_wait",
                reviewedAt: new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-alpha-external-signal"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
              },
            },
            "wait-alpha-external-signal": {
              id: "wait-alpha-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact alpha resume signal.",
              outputs: ["evidence/archive/wait-alpha.md"],
              acceptance: ["Signal returned"],
              conflict_scope: ["feature:alpha"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      pending: 1,
      representedFollowupGroups: [],
      unrepresentedNonTerminalCount: 0,
      blockedWaitChildren: 1,
      openFollowups: 0,
      lastPulseCreatedFollowups: 0,
    });
    expect(tree.tasks["reconcile-spec-loop-pending-alpha"]).toBeUndefined();
  });

  test("treats blocked exact holder text mention as representing spec-loop residue", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        { specFiles: ["crud.json", "runtime.json", "upgrade.json"] },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "crud.json"),
      JSON.stringify({
        id: "spec.workload-autoscaler.keda-disable-reenable-crud",
      }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "runtime.json"),
      JSON.stringify({ id: "spec.workload-autoscaler.keda-runtime-scaling" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "upgrade.json"),
      JSON.stringify({ id: "spec.workload-autoscaler.keda-upgrade-survival" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.workload-autoscaler.keda-disable-reenable-crud": {
              status: "pending",
              taskId: "reconcile-spec-loop-pending-workload-autoscaler",
              attempts: 3,
              lastRunId: "28432674907",
              lastRunUrl: "https://example.test/run/28432674907",
              lastResultPath: "/tmp/crud.json",
              lastPrUrl: null,
              successorDisposition: "publish-repaired-ref-then-rerun",
              resumeCondition:
                "Resume only after the repaired CRUD carrier is published on the trusted workflow ref.",
              review: {
                classification: "publish_before_rerun",
                reviewedAt: new Date().toISOString(),
                lastAction: "Keep pending; publish then rerun.",
              },
              updatedAt: new Date().toISOString(),
            },
            "spec.workload-autoscaler.keda-runtime-scaling": {
              status: "pending",
              taskId: "reconcile-spec-loop-pending-workload-autoscaler",
              attempts: 3,
              lastRunId: "28432652349",
              lastRunUrl: "https://example.test/run/28432652349",
              lastResultPath: "/tmp/runtime.json",
              lastPrUrl: null,
              successorDisposition: "publish-repaired-ref-then-rerun",
              resumeCondition:
                "Resume only after the repaired runtime-scaling carrier is published on the trusted workflow ref.",
              review: {
                classification: "publish_before_rerun",
                reviewedAt: new Date().toISOString(),
                lastAction: "Keep pending; publish then rerun.",
              },
              updatedAt: new Date().toISOString(),
            },
            "spec.workload-autoscaler.keda-upgrade-survival": {
              status: "pending",
              taskId: "reconcile-spec-loop-pending-workload-autoscaler",
              attempts: 3,
              lastRunId: "28420142455",
              lastRunUrl: "https://example.test/run/28420142455",
              lastResultPath: "/tmp/upgrade.json",
              lastPrUrl: null,
              successorDisposition:
                "same-path-environment-blocker-reviewed-from-rerun",
              resumeCondition:
                "Resume only after the same-surface staging control-plane upgrade HTTP 400 family materially changes.",
              review: {
                classification: "environment_blocker",
                reviewedAt: new Date().toISOString(),
                lastAction: "Keep pending as an exact-run environment blocker.",
              },
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [
                "wait-spec-workload-autoscaler-keda-publish-gate-family-20260706",
                "hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260704",
              ],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 5,
                targetRunning: 5,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "wait-spec-workload-autoscaler-keda-publish-gate-family-20260706": {
              id: "wait-spec-workload-autoscaler-keda-publish-gate-family-20260706",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Preserve one exact publish-before-rerun family wait for spec.workload-autoscaler.keda-disable-reenable-crud and spec.workload-autoscaler.keda-runtime-scaling until trusted execution content carries the repaired slices, then rerun exact local gates and queue only bounded same-spec reruns.",
              outputs: [
                "evidence/archive/review-spec-loop-sampled-blocked-terminality-20260706.md",
              ],
              acceptance: ["family wait preserved"],
              conflict_scope: ["feature:workload-autoscaler"],
              blocker: {
                condition:
                  "Blocked until trusted origin/dev carries the repaired CRUD and runtime-scaling slices.",
                category: "external-wait",
              },
            },
            "hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260704":
              {
                id: "hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260704",
                parent_id: "aks-spec-verification-loop",
                state: "blocked",
                status: "blocked",
                goal: "Hold spec.workload-autoscaler.keda-upgrade-survival on the reviewed same-surface control-plane upgrade HTTP 400 frontier until the exact environment/product surface changes or an owner-approved replacement target exists.",
                outputs: [
                  "evidence/archive/hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260704.md",
                ],
                acceptance: ["upgrade wait preserved"],
                conflict_scope: ["feature:workload-autoscaler"],
                blocker: {
                  condition:
                    "Blocked on the reviewed same-surface workload-autoscaler upgrade-survival environment frontier.",
                  category: "external-wait",
                },
              },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      pending: 3,
      dispatchablePending: 0,
      strandedPending: 3,
      unrepresentedNonTerminalCount: 0,
      blockedWaitChildren: 2,
      openFollowups: 0,
      lastPulseCreatedFollowups: 0,
      noRefillNow: true,
    });
    expect(
      tree.tasks["reconcile-spec-loop-pending-workload-autoscaler-2"],
    ).toBeUndefined();
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("blocked");
  });

  test("treats normalized exact successor state as representing spec-loop residue without an open holder task", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha": {
              status: "pending",
              taskId: null,
              attempts: 3,
              lastRunId: "171341303",
              lastRunUrl: "https://example.test/run/171341303",
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
              normalizedAt: new Date().toISOString(),
              successorDisposition: "environment_blocker",
              successorRunId: "171341303",
              successorRunUrl: "https://example.test/run/171341303",
              successorStateReason:
                "Reviewed exact same-path run already returned the governing environment blocker.",
              resumeCondition:
                "Resume only when the same-surface precondition materially changes.",
              review: {
                classification: "environment_blocker",
                reviewedAt: new Date().toISOString(),
                acceptedRunId: "171341303",
                lastAction:
                  "Keep one concrete returned same-path environment-blocker disposition and do not queue another unchanged rerun.",
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-external-signal"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "wait-external-signal": {
              id: "wait-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact external signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      pending: 1,
      dispatchablePending: 0,
      strandedPending: 1,
      unrepresentedNonTerminalCount: 0,
      blockedWaitChildren: 1,
      openFollowups: 0,
      lastPulseCreatedFollowups: 0,
      noRefillNow: true,
    });
    expect(tree.tasks["reconcile-spec-loop-pending-alpha"]).toBeUndefined();
  });

  test("stranded pending residue creates grouped follow-up work", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha": {
              status: "pending",
              taskId: null,
              attempts: 3,
              lastRunId: "123",
              lastRunUrl: "https://example.test/run/123",
              lastResultPath: "/tmp/result.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-external-signal"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "wait-external-signal": {
              id: "wait-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact external signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        "app: ",
        projectDir,
        `\nproject: ${projectDir}`,
        "\n",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join(""),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      pending: 1,
      dispatchablePending: 0,
      strandedPending: 1,
      unrepresentedNonTerminalCount: 0,
      blockedWaitChildren: 1,
      openFollowups: 1,
      lastPulseCreatedFollowups: 1,
    });
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress.reason,
    ).toContain("residue is still nonterminal");
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress
        .noRefillNow,
    ).toBeUndefined();
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("backlog");
    expect(tree.tasks["reconcile-spec-loop-pending-alpha"]).toBeDefined();
    expect(summarizeTaskTree(config(projectDir)).frontier.runnable).toContain(
      "reconcile-spec-loop-pending-alpha",
    );
  });

  test("stranded pending residue creates a new follow-up when the deterministic follow-up id is terminal", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha": {
              status: "pending",
              taskId: null,
              attempts: 3,
              lastRunId: "123",
              lastRunUrl: "https://example.test/run/123",
              lastResultPath: "/tmp/result.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["reconcile-spec-loop-pending-alpha"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "reconcile-spec-loop-pending-alpha": {
              id: "reconcile-spec-loop-pending-alpha",
              parent_id: "aks-spec-verification-loop",
              state: "done",
              status: "done",
              goal: "Old pending alpha follow-up.",
              outputs: ["evidence/archive/old-alpha.md"],
              acceptance: ["Old review accepted."],
              context: {
                specLoopFollowup: true,
                status: "pending",
                featureFamily: "alpha",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 1 grouped follow-up task");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["reconcile-spec-loop-pending-alpha"]?.status ?? "done",
    ).toBe("done");
    expect(tree.tasks["reconcile-spec-loop-pending-alpha-2"]).toMatchObject({
      state: "backlog",
      context: {
        specLoopFollowup: true,
        status: "pending",
        featureFamily: "alpha",
      },
    });
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      strandedPending: 1,
      openFollowups: 1,
      lastPulseCreatedFollowups: 1,
    });
  });

  test("exhausted non-pass residue plus stranded pending creates grouped follow-up work", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json", "beta.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "beta.json"),
      JSON.stringify({ id: "spec.beta" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha": {
              status: "pending",
              taskId: null,
              attempts: 3,
              lastRunId: "123",
              lastRunUrl: "https://example.test/run/123",
              lastResultPath: "/tmp/result-alpha.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.beta": {
              status: "error",
              taskId: "repair-spec-loop-policy-beta",
              attempts: 3,
              lastRunId: "456",
              lastRunUrl: "https://example.test/run/456",
              lastResultPath: "/tmp/result-beta.json",
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          updated_at: new Date().toISOString(),
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-external-signal"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                maxDirectAttemptsPerSpec: 3,
                timeoutMinutes: 60,
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "wait-external-signal": {
              id: "wait-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact external signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        "app: ",
        projectDir,
        `\nproject: ${projectDir}`,
        "\n",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join(""),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      executionDrained: true,
      pending: 1,
      dispatchablePending: 0,
      strandedPending: 1,
      error: 1,
      retryBudgetExhausted: 1,
      unrepresentedNonTerminalCount: 0,
      blockedWaitChildren: 1,
      openFollowups: 2,
      lastPulseCreatedFollowups: 2,
    });
    expect(
      tree.tasks["aks-spec-verification-loop"].context.workflowProgress
        .noRefillNow,
    ).toBeUndefined();
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("backlog");
    expect(tree.tasks["reconcile-spec-loop-pending-alpha"]).toBeDefined();
    expect(tree.tasks["reconcile-spec-loop-error-beta"]).toBeDefined();
    expect(summarizeTaskTree(config(projectDir)).frontier.runnable).toContain(
      "reconcile-spec-loop-pending-alpha",
    );
  });

  test("mirrors app spec-loop state into the project-local snapshot", async () => {
    const projectDir = await makeProject();
    const appDir = join(projectDir, "app");
    await mkdir(join(appDir, ".github", "workflows", "feature-sets"), {
      recursive: true,
    });
    await mkdir(join(appDir, ".state"), { recursive: true });
    await mkdir(join(appDir, "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
    await writeFile(
      join(
        appDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.alpha": {
              status: "pending",
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const appState = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const projectState = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(projectState).toEqual(appState);
  });

  test("preserves reviewed pending successors instead of rewriting them to raw error", async () => {
    const projectDir = await makeProject();
    const appDir = join(projectDir, "app");
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await mkdir(join(appDir, "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );

    const reviewedPendingState = {
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 1,
      cursor: 0,
      prioritySpecIds: [],
      specs: {
        "spec.alpha": {
          status: "error",
          attempts: 4,
          taskId: "verify-spec-alpha",
          lastRunId: "28603571728",
          lastRunUrl:
            "https://github.com/example/repo/actions/runs/28603571728",
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-02T12:05:00.000Z",
          successorDisposition: "repaired-carrier-pending-rerun",
          successorEvidencePath: "/tmp/reconcile-spec-loop-error-alpha.md",
          resumeCondition: "wait for underlay kubeconfig",
          review: {
            classification: "underlay_kubeconfig_required",
            lastAction:
              "Keep pending and wait for underlay kubeconfig before rerun.",
            reviewedAt: "2026-07-02T12:05:00.000Z",
          },
        },
      },
    };
    await writeFile(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(reviewedPendingState, null, 2)}\n`,
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(reviewedPendingState, null, 2)}\n`,
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["verify-spec-alpha"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "verify-spec-alpha": {
              id: "verify-spec-alpha",
              parent_id: "aks-spec-verification-loop",
              state: "done",
              status: "done",
              workflow: "single-spec-verifier",
              priority: "P1",
              children: [],
              goal: "Verify spec.alpha",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              forbidden: [],
              conflict_scope: ["spec:alpha"],
              depends_on: [],
              context: {
                specId: "spec.alpha",
              },
              trace: {
                worker_started_at: "2026-07-02T10:55:00.000Z",
                last_worker_completed_at: "2026-07-02T10:56:00.000Z",
                reviewed_at: "2026-07-02T10:57:00.000Z",
                last_worker_result: "blocked",
                last_worker_summary:
                  "No parseable result.json artifact was found.",
              },
              result: "No parseable result.json artifact was found.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const appState = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const projectState = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(appState.specs["spec.alpha"]).toMatchObject({
      status: "pending",
      taskId: "verify-spec-alpha",
      normalizedFromStatus: "error",
      successorDisposition: "repaired-carrier-pending-rerun",
      review: {
        classification: "underlay_kubeconfig_required",
      },
    });
    expect(projectState).toEqual(appState);
  });

  test("preserves reviewed wait successors even when the last result artifact path is still present", async () => {
    const projectDir = await makeProject();
    const appDir = join(projectDir, "app");
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await mkdir(join(appDir, "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );

    const reviewedWaitState = {
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 1,
      cursor: 0,
      prioritySpecIds: [],
      specs: {
        "spec.alpha": {
          status: "error",
          attempts: 4,
          taskId: "verify-spec-alpha",
          lastRunId: "28609113218",
          lastRunUrl:
            "https://github.com/example/repo/actions/runs/28609113218",
          lastResultPath: "/tmp/spec-alpha/result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-02T17:34:45.000Z",
          normalizedFromStatus: "error",
          normalizedAt: "2026-07-03T00:47:22.578Z",
          successorDisposition: "exact_wait_execution_identity_permission_gate",
          successorEvidencePath: "/tmp/reconcile-spec-loop-error-alpha.md",
          resumeCondition:
            "resume only after the same-path permission gate changes",
          review: {
            classification: "execution_identity_permission_wait",
            lastAction:
              "Keep pending; do not rerun unchanged while the execution-identity permission blocker remains.",
            reviewedAt: "2026-07-03T00:34:45.000Z",
          },
        },
      },
    };
    await writeFile(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(reviewedWaitState, null, 2)}\n`,
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(reviewedWaitState, null, 2)}\n`,
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["verify-spec-alpha"],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
            "verify-spec-alpha": {
              id: "verify-spec-alpha",
              parent_id: "aks-spec-verification-loop",
              state: "done",
              status: "done",
              workflow: "single-spec-verifier",
              priority: "P1",
              children: [],
              goal: "Verify spec.alpha",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              forbidden: [],
              conflict_scope: ["spec:alpha"],
              depends_on: [],
              context: {
                specId: "spec.alpha",
              },
              trace: {
                worker_started_at: "2026-07-02T17:26:27.000Z",
                last_worker_completed_at: "2026-07-02T17:30:00.000Z",
                reviewed_at: "2026-07-02T17:31:00.000Z",
                last_worker_result: "blocked",
                last_worker_summary: "Permission blocked on same-path PUT.",
              },
              result: "Permission blocked on same-path PUT.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const appState = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const projectState = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(appState.specs["spec.alpha"]).toMatchObject({
      status: "pending",
      taskId: "verify-spec-alpha",
      lastResultPath: "/tmp/spec-alpha/result.json",
      normalizedFromStatus: "error",
      successorDisposition: "exact_wait_execution_identity_permission_gate",
      review: {
        classification: "execution_identity_permission_wait",
      },
    });
    expect(projectState).toEqual(appState);
  });

  test("imports newer project-local spec-loop mirror rows before scheduling", async () => {
    const projectDir = await makeProject();
    const appDir = join(projectDir, "app");
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await mkdir(join(appDir, "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify({ specFiles: ["alpha.json"] }, null, 2),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "alpha.json"),
      JSON.stringify({ id: "spec.alpha" }, null, 2),
      "utf8",
    );

    const oldState = {
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 1,
      cursor: 0,
      prioritySpecIds: [],
      specs: {
        "spec.alpha": {
          status: "error",
          attempts: 3,
          taskId: "verify-spec-alpha",
          lastRunId: "old",
          lastRunUrl: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      },
    };
    const newerMirrorState = {
      ...oldState,
      specs: {
        "spec.alpha": {
          ...oldState.specs["spec.alpha"],
          status: "pass",
          taskId: "reconcile-spec-loop-error-alpha",
          review: {
            classification: "stale_error_residue_cleared",
            reviewedAt: "2026-07-02T12:00:00.000Z",
          },
          updatedAt: "2026-07-02T12:00:00.000Z",
        },
      },
    };
    await writeFile(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(oldState, null, 2)}\n`,
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(newerMirrorState, null, 2)}\n`,
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
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              context: {
                windowSize: 1,
                targetRunning: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                githubAccessPreflight: false,
                specExecutionPolicyPreflight: false,
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Imported 1 newer domain mirror row");
    const appState = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    const projectState = JSON.parse(
      await readFile(
        join(projectDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(appState.specs["spec.alpha"]).toMatchObject({
      status: "pass",
      taskId: "reconcile-spec-loop-error-alpha",
      review: { classification: "stale_error_residue_cleared" },
    });
    expect(projectState).toEqual(appState);
  });

  test("reschedules non-pass specs as retry verifier children", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "index.json"),
      JSON.stringify(
        {
          specFiles: [
            "app-routing-default-internal.json",
            "app-routing-default-external.json",
            "aad-rbac-managed-v2.json",
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "app-routing-default-internal.json"),
      JSON.stringify({ id: "spec.app-routing.default-internal" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "app-routing-default-external.json"),
      JSON.stringify({ id: "spec.app-routing.default-external" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "aad-rbac-managed-v2.json"),
      JSON.stringify({ id: "spec.aad-rbac.managed-v2" }),
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 2,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.app-routing.default-internal": {
              status: "blocked",
              taskId: null,
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.app-routing.default-external": {
              status: "blocked",
              taskId: null,
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
            "spec.aad-rbac.managed-v2": {
              status: "error",
              taskId: null,
              attempts: 0,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              status: "blocked",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
              blocker: "Child blocked",
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep spec verification moving.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
              forbidden: [],
              conflict_scope: ["spec-loop"],
              depends_on: [],
              blocker: "Child blocked",
              context: {
                windowSize: 2,
                targetRunning: 2,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "spec-loop",
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
          target: { taskId: "aks-spec-verification-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 2 child task");
    expect(dispatched.map((entry) => entry.taskId)).toEqual([
      "verify-spec-aad-rbac-managed-v2",
      "verify-spec-app-routing-default-external",
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.context.workflowProgress).toMatchObject({
      completionReady: false,
      executionDrained: false,
      nonPass: 1,
      running: 2,
      lastPulseCreated: 2,
      lastPulseAssigned: 2,
    });
    expect(tree.tasks["verify-spec-aad-rbac-managed-v2"].state).toBe("active");
  });
});
