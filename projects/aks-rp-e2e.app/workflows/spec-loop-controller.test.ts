import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  completeTask,
  peekTaskAssignments,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.children).toContain("legacy-retry");
    expect(loop.context.workflowProgress).toMatchObject({
      pending: 0,
      running: 2,
      openChildren: 2,
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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
      join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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

  test("materializes grouped follow-up tasks when execution is drained with non-pass results", async () => {
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
      join(projectDir, "tasks", "tree.json"),
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
    expect(result.message).toContain("Created 2 grouped follow-up task");
    expect(dispatched.map((entry) => entry.taskId)).toEqual([
      "reconcile-spec-loop-error-app-routing",
      "reconcile-spec-loop-error-aad-rbac",
    ]);
    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    const loop = tree.tasks["aks-spec-verification-loop"];
    expect(loop.context.workflowProgress).toMatchObject({
      completionReady: false,
      executionDrained: true,
      nonPass: 3,
      openFollowups: 2,
      lastPulseCreatedFollowups: 2,
    });
    expect(
      tree.tasks["reconcile-spec-loop-error-app-routing"].context,
    ).toMatchObject({
      specLoopFollowup: true,
      status: "error",
      featureFamily: "app-routing",
      totalSpecCount: 2,
    });
    expect(tree.tasks["reconcile-spec-loop-error-aad-rbac"].state).toBe(
      "active",
    );
  });
});
