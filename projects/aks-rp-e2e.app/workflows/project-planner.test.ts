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
            status: "decomposed",
            children: ["knowledge-model-gap-reconciliation"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "knowledge-model-gap-reconciliation": {
            id: "knowledge-model-gap-reconciliation",
            parent_id: "project",
            status: "decomposed",
            kind: "standing_task",
            children: ["accepted-gap-report"],
            goal: "turn gaps into work",
            outputs: ["tasks/tree.json"],
            acceptance: ["gaps represented as work"],
          },
          "accepted-gap-report": {
            id: "accepted-gap-report",
            parent_id: "knowledge-model-gap-reconciliation",
            status: "accepted",
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

describe("project planner", () => {
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
    expect(prompts[1]).not.toContain("Current project status packet");
    expect(prompts[1]).not.toContain('"path_gap_count"');
    expect(prompts[1]).toContain(
      "Do not stop merely because one rollup or one new leaf was created.",
    );
    expect(prompts[1]).not.toContain("Stop after one small material update");
  });

  test("runs owner review when worker results are pending even with ready work", async () => {
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
              status: "decomposed",
              children: ["review-task", "ready-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "review-task": {
              id: "review-task",
              parent_id: "project",
              status: "review",
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
            "ready-task": {
              id: "ready-task",
              parent_id: "project",
              status: "ready",
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
          assignTask(config(appDir, projectDir), { taskId: "ready-task" });
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
          event.payload.taskId === "ready-task",
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
              status: "decomposed",
              children: ["ready-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ready-task": {
              id: "ready-task",
              parent_id: "project",
              status: "ready",
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
          assignTask(config(appDir, projectDir), { taskId: "ready-task" });
          return { status: "success", message: "created more frontier work" };
        }
        return { status: "success", message: "EVENT_REVIEW: ready refill" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Planning Update Step");
    expect(prompts[1]).toContain("assign ready leaves");
    expect(prompts[1]).not.toContain('"capacity_underfilled_with_gaps"');
    expect(
      dispatched.some(
        (event) =>
          event.type === "project.task.assigned" &&
          event.payload.taskId === "ready-task",
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
              status: "decomposed",
              children: ["backlog-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "backlog-task": {
              id: "backlog-task",
              parent_id: "project",
              status: "backlog",
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

  test("deterministically refills routine watchdog gaps without owner session", async () => {
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
        return { status: "success", message: "should not run" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("deterministic-refill seeded 1 task");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe("project.task.assigned");
    expect(String(dispatched[0].payload.taskId)).toContain(
      "feature-a-staging-frontier",
    );

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"steps":["deterministic-refill"]');
    expect(plannerRuns).toContain('"ran_agent":false');
    expect(plannerRuns).toContain(
      '"routine-refill:watchdog-open-work-reconcile"',
    );
  });

  test("requeues watchdog-stale active work before quick refill", async () => {
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
              status: "decomposed",
              children: ["stale-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "stale-task": {
              id: "stale-task",
              parent_id: "project",
              status: "active",
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
    expect(result.message).toContain("quick-refill assigned 1 task");
    expect(prompts).toHaveLength(0);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.assigned",
      payload: {
        taskId: "stale-task",
        sessionId: "s_task_stale-task",
      },
    });

    const updated = JSON.parse(
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["stale-task"].status).toBe("active");
    expect(updated.tasks["stale-task"].trace.stale_active_requeue_reason).toBe(
      "watchdog-stale-active-review",
    );

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"requeued_stale_task_ids":["stale-task"]');
  });

  test("seeds executable model-gap backlog when owner planning times out under capacity", async () => {
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
              status: "decomposed",
              children: ["spec-runner-and-replays"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-runner-and-replays": {
              id: "spec-runner-and-replays",
              parent_id: "project",
              status: "decomposed",
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
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe("project.task.assigned");
    expect(String(dispatched[0].payload.taskId)).toContain(
      "feature-a-staging-frontier",
    );

    const updated = JSON.parse(
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
    );
    const seededTask = updated.tasks[dispatched[0].payload.taskId as string];
    expect(seededTask.status).toBe("active");
    expect(seededTask.parent_id).toBe("spec-runner-and-replays");
    expect(seededTask.context.model_path_id).toBe("path.feature-a.create");
    expect(seededTask.context.replay).toBe("replays/feature-a-create.ts");

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"seeded_task_ids"');
    expect(plannerRuns).toContain('"planner-timeout-underfilled-frontier"');
  });

  test("seeds source/spec backlog without dispatch when slow execution is already full", async () => {
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
              status: "decomposed",
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
              status: "decomposed",
              kind: "work",
              children: ["slow-execution"],
              goal: "Execute specs and replays.",
              outputs: ["runs/"],
              acceptance: ["gaps verified by execution"],
            },
            "go-e2ev3-source-discovery": {
              id: "go-e2ev3-source-discovery",
              parent_id: "project",
              status: "decomposed",
              kind: "work",
              children: [],
              goal: "Explore source and build specs.",
              outputs: ["features/", "specs/", "replays/"],
              acceptance: ["source-grounded specs exist"],
            },
            "slow-execution": {
              id: "slow-execution",
              parent_id: "spec-runner-and-replays",
              status: "active",
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
    expect(result.message).toContain("Planner seeded 1 backlog task");
    expect(dispatched).toHaveLength(0);

    const updated = JSON.parse(
      await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
    );
    const seeded = Object.values(updated.tasks).find(
      (task: any) =>
        task.id !== "slow-execution" &&
        task.id.includes("feature-a-source-spec-frontier"),
    ) as any;
    expect(seeded.status).toBe("backlog");
    expect(seeded.parent_id).toBe("go-e2ev3-source-discovery");
    expect(seeded.context.seed_preference).toBe("source-spec");
    expect(seeded.goal).toContain("build up the source-grounded spec/replay");

    const plannerRuns = await readFile(
      join(appDir, ".state", "planner-runs.jsonl"),
      "utf8",
    );
    expect(plannerRuns).toContain('"status":"seeded"');
    expect(plannerRuns).toContain(
      '"planner-timeout-execution-full-backlog-empty"',
    );
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
