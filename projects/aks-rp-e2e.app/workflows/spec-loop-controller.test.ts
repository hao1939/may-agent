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
} from "./lib/spec-loop-store.ts";
import { execute } from "./spec-loop-controller.ts";

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
  test("treats terminal-disposition and legacy done specs as pending live work", async () => {
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
    tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
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

    tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-spec-verification-loop"].children).toHaveLength(3);
    expect(secondDispatches.map((entry) => entry.taskId)).toEqual([
      secondChild,
    ]);
    expect(tree.tasks[secondChild].state).toBe("active");
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
      },
    });
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
      openFollowups: 2,
      representedFollowupGroups: ["error:a", "error:b"],
      unrepresentedNonTerminalCount: 0,
      lastPulseCreatedFollowups: 1,
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
      openFollowups: 0,
      blockedWaitChildren: 2,
      lastPulseCreated: 0,
      lastPulseCreatedFollowups: 0,
      strandedExhaustedResidueOnly: true,
      unrepresentedNonTerminalCount: 1,
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

  test("treats blocked wait conflict scope as representing spec-loop residue", async () => {
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
      lastPulseCreatedFollowups: 0,
    });
    expect(tree.tasks["reconcile-spec-loop-error-alpha"]).toBeUndefined();
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
          normalizedFromStatus: "error",
          normalizedAt: "2026-07-02T12:05:00.000Z",
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
