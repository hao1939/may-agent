import { describe, expect, test } from "bun:test";
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
    join(appDir, "tasks", "tree.json"),
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

describe("project owner workflow", () => {
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

  test("runs owner review when worker results are pending even with runnable backlog work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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

  test("short-circuits task-completed wake after first bounded successor assignment", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
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
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
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
      join(appDir, "tasks", "tree.json"),
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

  test("skips owner session for stale watchdog-runnable-backlog packets even when unrelated blocked leaves exist", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const treeUpdatedAt = "2026-06-18T01:52:39.649Z";
    await writeFile(
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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

  test("skips owner session for already-settled task completion when completedTaskId is nested under trigger data.params", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(appDir, "tasks", "tree.json"),
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

  test("skips owner session for already-settled task completion when only blocked frontier remains", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(appDir, "tasks", "tree.json"),
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

  test("short-circuits planner-timeout-underfilled-frontier wake after first refill assignment", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      join(appDir, "tasks", "tree.json"),
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
      join(appDir, "tasks", "tree.json"),
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
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
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
      join(appDir, "tasks", "tree.json"),
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
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
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
