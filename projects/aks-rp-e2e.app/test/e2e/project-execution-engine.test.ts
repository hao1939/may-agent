import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import app from "../../app.ts";
import { execute } from "../../workflows/project-execution-engine.ts";
import { execute as executePlanner } from "../../workflows/project-planner.ts";
import { execute as executeTaskWorker } from "../../workflows/task-worker.ts";

function projectMd(status: string) {
  return `---
id: test-project
owner: aks-explorer
status: ${status}
close_reason: Closed for test.
---

# Project: Test Project

## Goal
Make progress through a task tree.

## Current State
Testing.

## Next Action
Use the task tree.
`;
}

async function makeProject(status: string) {
  const dir = await mkdtemp(join(tmpdir(), "aks-task-engine-"));
  await mkdir(join(dir, ".app"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await mkdir(join(dir, "evidence", "outputs"), { recursive: true });
  await writeFile(join(dir, ".app", "project.md"), projectMd(status), "utf8");
  await writeFile(join(dir, ".app", "journal.jsonl"), "", "utf8");
  return dir;
}

function featureQueueMd() {
  return `# AKS Feature-Learning Queue

| # | Feature Area | Current Stage | Status | Safe Local Work? | Rationale |
|---|---|---|---|---|---|
| 1 | **workload-identity** | loop accepted | ready | YES - already represented | Existing feature task is accepted. |
| 2 | **oidc-issuer** | model paths exist, no loop entry | ready | YES - reference packet, input enumeration | Local learning work remains. |
| 3 | **managedsystem-pool** | loop entry exists, live-run blocked | blocked | NO - gated | Waiting for auth. |
`;
}

function context(input: {
  projectDir: string;
  maxAttempts?: number;
  maxConcurrent?: number;
  triggerEvent?: Record<string, unknown>;
  dispatched?: Array<{ type: string; payload: Record<string, unknown> }>;
  runAgent?: (agent: string, prompt: string) => Promise<{ status: string; lastAssistantText?: string }>;
  summarize?: (result: { lastAssistantText?: string }) => string;
}) {
  const trigger = input.triggerEvent
    ? `\n\n## Trigger Event\n\`\`\`json\n${JSON.stringify(input.triggerEvent, null, 2)}\n\`\`\``
    : "";
  return {
    task: `project: ${input.projectDir}\nagent: aks-explorer\nmaxAttempts: ${input.maxAttempts ?? 5}\nmaxConcurrent: ${input.maxConcurrent ?? 1}${trigger}`,
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      input.dispatched?.push({ type, payload });
    },
    runAgent: input.runAgent ?? (async () => ({ status: "error", lastAssistantText: "" })),
    summarize: input.summarize ?? ((result: { lastAssistantText?: string }) => result.lastAssistantText ?? ""),
  } as any;
}

describe("project execution engine", () => {
  test("project app watcher emits execution events through one schedule path", () => {
    const regularLearning = app.schedules.find(schedule => schedule.id === "regular-learning");

    expect(regularLearning?.enabled).toBe(true);
    expect(regularLearning?.event).toEqual({
      type: "project.tick",
      project: "aks-rp-e2e",
      lane: "learning",
    });
    expect(app.actions.watch.type).toBe("async");
    expect((app.actions.watch as any).event({}).type).toBe("project.execution.requested");
    expect(app.events).toContainEqual({ type: "project.task.completed", project: "aks-rp-e2e" });
    expect(app.events).toContainEqual({ type: "project.tasks.ready", project: "aks-rp-e2e" });
  });

  test("project app turns task completion events into coordinator wakes", async () => {
    const emitted: unknown[] = [];
    const result = await app.onEvent({
      projectPath: (path: string) => path,
      appPath: (path: string) => path,
      readJson: async () => ({}),
      importModule: async () => ({}),
      startSession: () => ({}),
      emit: event => {
        emitted.push(event);
        return event;
      },
      noop: reason => ({ type: "noop", reason }),
    } as any, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      taskId: "task-a",
      status: "accepted",
      verification_verdict: "accepted",
    });

    expect(result).toEqual({
      type: "project.execution.requested",
      project: "aks-rp-e2e",
      reason: "task-completed",
      params: {
        maxConcurrent: 3,
        completedTaskId: "task-a",
        status: "accepted",
        verificationVerdict: "accepted",
      },
    });
    expect(emitted).toHaveLength(1);
  });

  test("bootstraps task tree and creates blocked-review work instead of passively stopping", async () => {
    const projectDir = await makeProject("closed");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created blocked review task");

    const tree = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(tree.project_lifecycle).toBe("closed");
    expect(tree.active_task_id).toBe("blocked-frontier-review");
    expect(tree.tasks.project.status).toBe("decomposed");
    expect(tree.tasks["blocked-frontier-review"].status).toBe("ready");
    expect(tree.tasks["blocked-frontier-review"].kind).toBe("blocked_review");
    expect(tree.tasks["managedsystem-live-auth-gate"].status).toBe("decomposed");
    expect(tree.tasks["managedsystem-live-auth-gate-blocker-review"].status).toBe("ready");

    const project = await readFile(join(projectDir, ".app", "project.md"), "utf8");
    expect(project).toContain("## Active Task");
    expect(project).toContain("blocked-frontier-review");
    expect(project).toContain(".app/tasks/tree.json");
  });

  test("keeps executing ready leaf tasks until no ready work remains", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Finish two local leaves.",
          children: ["task-a", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Both children accepted."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    let calls = 0;
    const result = await execute(context({
      projectDir,
      runAgent: async (_agent, prompt) => {
        calls++;
        const outputSection = prompt.split("## Required Outputs\n")[1] ?? prompt;
        const output = outputSection.match(/(?:evidence\/outputs|tasks)\/[^\s]+(?:\.md|\.json)/)?.[0] ?? "evidence/archive/unknown.md";
        return { status: "ok", lastAssistantText: `CLAIM: done\noutputs:\n- ${output}` };
      },
    }));

    expect(result.status).toBe("done");
    expect(calls).toBe(3);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("accepted");
    expect(updated.tasks["task-b"].status).toBe("accepted");
    expect(updated.tasks["project-rollup-review"].status).toBe("accepted");
    expect(updated.tasks.project.status).toBe("accepted");
    expect(updated.active_task_id).toBe(null);
  });

  test("event coordinator leases and dispatches independent ready leaves in parallel", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Dispatch two independent leaves.",
          children: ["task-a", "task-b", "task-c"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Children complete."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          conflict_scope: ["evidence/archive/a.md"],
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          conflict_scope: ["evidence/archive/b.md"],
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
        "task-c": {
          id: "task-c",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce C.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/c.md"],
          acceptance: ["C exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxConcurrent: 2,
      triggerEvent: {
        type: "project.execution.requested",
        data: { project: "aks-rp-e2e", reason: "test" },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("coordinator should dispatch events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Dispatched 2 task execution event");
    const taskEvents = dispatched.filter(event => event.type === "project.task.execution.requested");
    expect(taskEvents.map(event => event.payload.taskId).sort()).toEqual(["task-a", "task-b"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("active");
    expect(updated.tasks["task-b"].status).toBe("active");
    expect(updated.tasks["task-c"].status).toBe("ready");
    expect(updated.active_task_ids.sort()).toEqual(["task-a", "task-b"]);
  });

  test("event coordinator leases independent review leaves in parallel", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Dispatch independent reviews.",
          children: ["review-a", "review-b", "review-c"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Reviews complete."],
          forbidden: [],
          gates: [],
        },
        "review-a": {
          id: "review-a",
          parent_id: "project",
          kind: "rework_review",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review A.",
          conflict_scope: ["ui:feature-a"],
          children: [],
          inputs: [],
          outputs: ["evidence/archive/review-a.md"],
          acceptance: ["A reviewed."],
          forbidden: [],
          gates: [],
        },
        "review-b": {
          id: "review-b",
          parent_id: "project",
          kind: "rework_review",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review B.",
          conflict_scope: ["ui:feature-b"],
          children: [],
          inputs: [],
          outputs: ["evidence/archive/review-b.md"],
          acceptance: ["B reviewed."],
          forbidden: [],
          gates: [],
        },
        "review-c": {
          id: "review-c",
          parent_id: "project",
          kind: "rework_review",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review C.",
          conflict_scope: ["ui:feature-c"],
          children: [],
          inputs: [],
          outputs: ["evidence/archive/review-c.md"],
          acceptance: ["C reviewed."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxConcurrent: 2,
      triggerEvent: {
        type: "project.execution.requested",
        data: { project: "aks-rp-e2e", reason: "test" },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("coordinator should dispatch events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Dispatched 2 task execution event");
    const taskEvents = dispatched.filter(event => event.type === "project.task.execution.requested");
    expect(taskEvents.map(event => event.payload.taskId).sort()).toEqual(["review-a", "review-b"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["review-a"].status).toBe("active");
    expect(updated.tasks["review-b"].status).toBe("active");
    expect(updated.tasks["review-c"].status).toBe("ready");
    expect(updated.active_task_ids.sort()).toEqual(["review-a", "review-b"]);
  });

  test("ignores legacy timer triggers instead of entering the direct execution loop", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do not let old timers run direct work.",
          children: ["task-a", "gated-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Timer is ignored."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "gated-task": {
          id: "gated-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "This leaf has a closed gate.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/gated.md"],
          acceptance: ["Gate is open."],
          forbidden: [],
          gates: ["external approval required"],
          gate_status: "closed",
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxAttempts: 50,
      triggerEvent: {
        type: "timer.tick",
        data: { entry: "aks-rp-e2e-project-execution" },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("legacy timer trigger must not run leaf tasks directly");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Ignored non-v2 project execution trigger timer.tick");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested")).toHaveLength(0);
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("ready");
  });

  test("planner loop signals ready tasks without leasing workers", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Expose ready work.",
          children: ["task-a", "local-check", "gated-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Ready work is visible."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "gated-task": {
          id: "gated-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "This leaf has a closed gate.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/gated.md"],
          acceptance: ["Gate is open."],
          forbidden: [],
          gates: ["external approval required"],
          gate_status: "closed",
        },
        "local-check": {
          id: "local-check",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Run a safety-bounded local check.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/local-check.md"],
          acceptance: ["Local check output is recorded."],
          forbidden: ["Do not mutate cloud resources."],
          gates: ["No cloud mutation: --check only"],
          gate_status: "closed",
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await executePlanner(context({
      projectDir,
      maxConcurrent: 3,
      dispatched,
      runAgent: async () => {
        throw new Error("planner loop should not run workers");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("signaled 2 ready task");
    expect(dispatched.find(event => event.type === "project.tasks.ready")?.payload.readyTaskIds).toEqual(["local-check", "task-a"]);
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("ready");
    expect(updated.tasks["task-a"].lease_expires_at).toBeUndefined();
    expect(updated.tasks["gated-task"].status).toBe("ready");
  });

  test("task worker loop leases ready tasks from planner signal", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Dispatch ready work.",
          children: ["task-a", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Ready work is dispatched."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await executeTaskWorker(context({
      projectDir,
      maxConcurrent: 2,
      triggerEvent: {
        type: "project.tasks.ready",
        data: { project: "aks-rp-e2e", readyTaskIds: ["task-a", "task-b"], maxConcurrent: 2 },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("ready-task pickup should dispatch execution events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Dispatched 2 task execution event");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId).sort()).toEqual(["task-a", "task-b"]);
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("active");
    expect(updated.tasks["task-b"].status).toBe("active");
  });

  test("task worker fills capacity past serialized review work using explicit conflict scopes", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "active-model-task",
      active_task_ids: ["active-model-task"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Dispatch independent model work while review waits.",
          children: ["active-model-task", "review-task", "ready-model-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Ready work is dispatched."],
          forbidden: [],
          gates: [],
        },
        "active-model-task": {
          id: "active-model-task",
          parent_id: "project",
          status: "active",
          priority: "P1",
          owner: "aks-explorer",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          goal: "Edit model path A.",
          children: [],
          inputs: [],
          outputs: ["model/knowledge-map/model.json"],
          conflict_scope: ["model/knowledge-map/model.json:path.a"],
          acceptance: ["Model validates."],
          forbidden: [],
          gates: [],
        },
        "review-task": {
          id: "review-task",
          parent_id: "project",
          status: "ready",
          kind: "rework_review",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Serialized review should not block independent ordinary work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/review.md"],
          acceptance: ["Review done."],
          forbidden: [],
          gates: [],
        },
        "ready-model-task": {
          id: "ready-model-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Edit model path B.",
          children: [],
          inputs: [],
          outputs: ["model/knowledge-map/model.json"],
          conflict_scope: ["model/knowledge-map/model.json:path.b"],
          acceptance: ["Model validates."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await executeTaskWorker(context({
      projectDir,
      maxConcurrent: 3,
      triggerEvent: {
        type: "project.tasks.ready",
        data: { project: "aks-rp-e2e", maxConcurrent: 3 },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("ready-task pickup should dispatch execution events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["review-task", "ready-model-task"]);
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-model-task"].status).toBe("active");
    expect(updated.tasks["ready-model-task"].status).toBe("active");
    expect(updated.tasks["review-task"].status).toBe("active");
  });

  test("task worker fills capacity while an unrelated review task is active", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "active-review",
      active_task_ids: ["active-review"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do not globally freeze work while a review is active.",
          children: ["active-review", "ready-domain-task", "ready-review"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Independent work is dispatched."],
          forbidden: [],
          gates: [],
        },
        "active-review": {
          id: "active-review",
          parent_id: "project",
          status: "active",
          kind: "rework_review",
          priority: "P0",
          owner: "aks-explorer",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          goal: "Review a UI branch.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/ui-review.md"],
          conflict_scope: ["ui:feature-shell"],
          acceptance: ["Review done."],
          forbidden: [],
          gates: [],
        },
        "ready-domain-task": {
          id: "ready-domain-task",
          parent_id: "project",
          status: "ready",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Retarget domain probe.",
          children: [],
          inputs: [],
          outputs: ["replays/oidc.ts"],
          conflict_scope: ["golden-path:oidc-rest-retarget"],
          acceptance: ["Probe check passes."],
          forbidden: [],
          gates: [],
        },
        "ready-review": {
          id: "ready-review",
          parent_id: "project",
          status: "ready",
          kind: "parent_review",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Another independent review can run in parallel.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/other-review.md"],
          acceptance: ["Review done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await executeTaskWorker(context({
      projectDir,
      maxConcurrent: 3,
      triggerEvent: {
        type: "project.tasks.ready",
        data: { project: "aks-rp-e2e", maxConcurrent: 3 },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("ready-task pickup should dispatch execution events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["ready-domain-task", "ready-review"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-review"].status).toBe("active");
    expect(updated.tasks["ready-domain-task"].status).toBe("active");
    expect(updated.tasks["ready-review"].status).toBe("active");
  });

  test("event coordinator promotes clear backlog leaves before parallel dispatch", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Promote clear backlog work.",
          children: ["task-a", "task-b", "unclear-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Clear backlog work is dispatched."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "proposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "proposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
        "unclear-task": {
          id: "unclear-task",
          parent_id: "project",
          status: "proposed",
          priority: "P2",
          owner: "aks-explorer",
          goal: "Missing output artifact keeps this in backlog.",
          children: [],
          inputs: [],
          outputs: [],
          acceptance: ["Needs an output before execution."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxConcurrent: 2,
      triggerEvent: {
        type: "project.execution.requested",
        data: { project: "aks-rp-e2e", reason: "test" },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("coordinator should dispatch events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Dispatched 2 task execution event");
    expect(dispatched.filter(event => event.type === "task.promoted").map(event => event.payload.taskId).sort()).toEqual(["task-a", "task-b"]);
    const taskEvents = dispatched.filter(event => event.type === "project.task.execution.requested");
    expect(taskEvents.map(event => event.payload.taskId).sort()).toEqual(["task-a", "task-b"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("active");
    expect(updated.tasks["task-b"].status).toBe("active");
    expect(updated.tasks["unclear-task"].status).toBe("proposed");
    expect(updated.active_task_ids.sort()).toEqual(["task-a", "task-b"]);
  });

  test("event coordinator normalizes string conflict scopes before dispatch selection", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a",
      active_task_ids: ["task-a"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Dispatch independent tasks even if conflict_scope was written as a string.",
          children: ["task-a", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Independent leaves can run together."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          conflict_scope: "replays/a.ts" as any,
          children: [],
          inputs: [],
          outputs: ["replays/a.ts"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          conflict_scope: "replays/b.ts" as any,
          children: [],
          inputs: [],
          outputs: ["replays/b.ts"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxConcurrent: 2,
      triggerEvent: {
        type: "project.execution.requested",
        data: { project: "aks-rp-e2e", reason: "test" },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("coordinator should dispatch events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Dispatched 1 task execution event");
    expect(dispatched.find(event => event.type === "project.task.execution.requested")?.payload.taskId).toBe("task-b");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].conflict_scope).toEqual(["replays/a.ts"]);
    expect(updated.tasks["task-b"].conflict_scope).toEqual(["replays/b.ts"]);
    expect(updated.active_task_ids.sort()).toEqual(["task-a", "task-b"]);
  });

  test("event coordinator requeues stale active leaves before scheduling", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "stale-review",
      active_task_ids: ["stale-review"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Recover stale active serialized work.",
          children: ["stale-review", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Stale active work is leased again."],
          forbidden: [],
          gates: [],
        },
        "stale-review": {
          id: "stale-review",
          parent_id: "project",
          kind: "parent_review",
          status: "active",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review stale parent state.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/stale-review.md"],
          acceptance: ["Review is complete."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Ordinary ready work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxConcurrent: 3,
      triggerEvent: {
        type: "project.execution.requested",
        data: { project: "aks-rp-e2e", reason: "test" },
      },
      dispatched,
      runAgent: async () => {
        throw new Error("coordinator should dispatch events, not run workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Dispatched 2 task execution event");
    expect(dispatched.find(event => event.type === "task.requeued")?.payload.taskId).toBe("stale-review");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["stale-review", "task-b"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["stale-review"].status).toBe("active");
    expect(typeof updated.tasks["stale-review"].lease_expires_at).toBe("string");
    expect(updated.tasks["task-b"].status).toBe("active");
  });

  test("task execution event processes one leased leaf and requests coordinator continuation", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a",
      active_task_ids: ["task-a"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Process one worker event.",
          children: ["task-a", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Children complete."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      triggerEvent: {
        type: "project.task.execution.requested",
        data: { project: "aks-rp-e2e", taskId: "task-a" },
      },
      dispatched,
      runAgent: async (_agent, prompt) => {
        expect(prompt).toContain("id: task-a");
        return { status: "ok", lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/a.md" };
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Task worker processed task-a");
    const completedEvent = dispatched.find(event => event.type === "project.task.completed");
    expect(completedEvent?.payload.taskId).toBe("task-a");
    expect(completedEvent?.payload.status).toBe("accepted");
    const continuationEvent = dispatched.find(event => event.type === "project.execution.requested");
    expect(continuationEvent?.payload.reason).toBe("task-completed");
    expect(continuationEvent?.payload.completedTaskId).toBe("task-a");
    expect(continuationEvent?.payload.status).toBe("accepted");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("accepted");
    expect(updated.tasks["task-a"].claimed_by).toBeUndefined();
    expect(updated.tasks["task-b"].status).toBe("ready");
  });

  test("task execution event preserves another worker completion written before final save", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a",
      active_task_ids: ["task-a", "task-b"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Process parallel worker completions without clobbering.",
          children: ["task-a", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Children complete."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    let injectedConcurrentCompletion = false;
    const result = await execute(context({
      projectDir,
      triggerEvent: {
        type: "project.task.execution.requested",
        data: { project: "aks-rp-e2e", taskId: "task-a" },
      },
      runAgent: async () => ({ status: "ok", lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/a.md" }),
      summarize: output => {
        if (!injectedConcurrentCompletion) {
          const treePath = join(projectDir, "tasks", "tree.json");
          const current = JSON.parse(readFileSync(treePath, "utf8"));
          current.tasks["task-b"].status = "accepted";
          delete current.tasks["task-b"].claimed_by;
          delete current.tasks["task-b"].lease_expires_at;
          current.tasks["task-b"].attempts = [{
            id: "attempt-concurrent",
            ts: new Date().toISOString(),
            agent: "aks-explorer",
            claim: "done",
            summary: "CLAIM: done\noutputs:\n- evidence/archive/b.md",
            outputs: ["evidence/archive/b.md"],
            checks: [],
            open_risks: [],
          }];
          current.tasks["task-b"].verification = {
            ts: new Date().toISOString(),
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Concurrent worker accepted task-b.",
            criteria: [{ item: "B exists.", result: "pass" }],
          };
          writeFileSync(treePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
          injectedConcurrentCompletion = true;
        }
        return output.lastAssistantText ?? "";
      },
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("accepted");
    expect(updated.tasks["task-b"].status).toBe("accepted");
    expect(updated.active_task_ids ?? []).not.toContain("task-a");
    expect(updated.active_task_ids ?? []).not.toContain("task-b");
  });

  test("does not execute ready leaf tasks with unsatisfied gates", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Run gated work safely.",
          children: ["gated-live-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Child is accepted or blocked."],
          forbidden: [],
          gates: [],
        },
        "gated-live-task": {
          id: "gated-live-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Run live work only after auth is proven.",
          children: [],
          inputs: [".app/project.md"],
          outputs: ["evidence/archive/gated-live-task.md"],
          acceptance: ["Auth gate is proven before live work starts."],
          forbidden: ["Do not run cloud mutation without the gate."],
          gates: ["Azure CLI ARM token gate succeeds."],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const prompts: string[] = [];
    const result = await execute(context({
      projectDir,
      runAgent: async (_agent, prompt) => {
        prompts.push(prompt);
        const outputSection = prompt.split("## Required Outputs\n")[1] ?? prompt;
        const output = outputSection.match(/evidence\/outputs\/[^\s]+\.md/)?.[0] ?? "evidence/archive/unknown.md";
        return { status: "ok", lastAssistantText: `CLAIM: done\noutputs:\n- ${output}` };
      },
    }));

    expect(result.status).toBe("done");
    expect(prompts.some(prompt => prompt.includes("## Task\nid: gated-live-task\n"))).toBe(false);
    expect(prompts.some(prompt => prompt.includes("Blocked Review Mode"))).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.active_task_id).not.toBe("gated-live-task");
    expect(updated.tasks["gated-live-task"].status).toBe("blocked");
    expect(updated.tasks["gated-live-task"].blocker).toContain("Azure CLI ARM token gate succeeds");
    expect(updated.tasks["gated-live-task-blocker-review"].status).toBe("accepted");
  });

  test("turns blocked leaves into local blocked-review tasks", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review a blocked branch.",
          children: ["blocked-branch"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Blocked branches are reviewed."],
          forbidden: [],
          gates: [],
        },
        "blocked-branch": {
          id: "blocked-branch",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do work that hit a blocker.",
          children: [],
          inputs: [".app/project.md"],
          outputs: ["evidence/archive/blocked-branch.md"],
          acceptance: ["Blocker is resolved or proven external."],
          forbidden: ["Do not run live mutation."],
          gates: [],
          blocker: "The prior task was too coarse to continue safely.",
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.active_task_id).toBe("blocked-frontier-review");
    expect(updated.tasks["blocked-frontier-review"].status).toBe("ready");
    expect(updated.tasks["blocked-branch"].status).toBe("decomposed");
    expect(updated.tasks["blocked-branch-blocker-review"].status).toBe("ready");
    expect(updated.tasks["blocked-branch-blocker-review"].forbidden.join("\n")).toContain("Do not run cloud mutation");
  });

  test("converts rejected leaves into rework review instead of stopping", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Recover rejected work.",
          children: ["task-a"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Rejected work is reviewed."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      dispatched,
      runAgent: async () => ({ status: "ok", lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/wrong.md" }),
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("continuation requested");
    expect(dispatched.some(event => event.type === "project.execution.requested")).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("decomposed");
    expect(updated.tasks["task-a"].verification.verdict).toBe("rejected");
    expect(updated.tasks["task-a-rework-review"].status).toBe("ready");
    expect(updated.tasks["task-a-rework-review"].kind).toBe("rework_review");
    expect(updated.active_task_id).toBe("task-a-rework-review");
  });

  test("retries a rejected review task in place instead of nesting rework reviews", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a-rework-review",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Retry review task without nesting.",
          children: ["task-a"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Review is recovered."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: ["task-a-rework-review"],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-a-rework-review": {
          id: "task-a-rework-review",
          parent_id: "task-a",
          kind: "rework_review",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review rejected task A.",
          children: [],
          inputs: [".app/tasks/tree.json"],
          outputs: ["evidence/archive/task-a-rework-review.md"],
          acceptance: ["Review exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({ status: "interrupted", lastAssistantText: "**Status:** interrupted (5m10s)" }),
    }));

    expect(result.status).toBe("done");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a-rework-review"].status).toBe("ready");
    expect(updated.tasks["task-a-rework-review"].verification.verdict).toBe("rejected");
    expect(updated.tasks["task-a-rework-review"].attempts).toHaveLength(1);
    expect(updated.tasks["task-a-rework-review-rework-review"]).toBeUndefined();
    expect(updated.active_task_id).toBe("task-a-rework-review");
  });

  test("rejects a done claim when a required validation check failed", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Verify validation work.",
          children: ["validation-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Validation task is verified."],
          forbidden: [],
          gates: [],
        },
        "validation-task": {
          id: "validation-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Run model validation.",
          children: [],
          inputs: ["model/knowledge-map/model.json"],
          outputs: ["evidence/archive/validation.md"],
          acceptance: ["bun model/tools/src/validate.ts model/knowledge-map/model.json exits 0."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({
        status: "ok",
        lastAssistantText: [
          "CLAIM: done",
          "outputs:",
          "- evidence/archive/validation.md",
          "Commands run:",
          "- ❌ `bun model/tools/src/validate.ts model/knowledge-map/model.json`",
        ].join("\n"),
      }),
    }));

    expect(result.status).toBe("done");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["validation-task"].verification.verdict).toBe("rejected");
    expect(updated.tasks["validation-task"].status).toBe("decomposed");
    expect(updated.tasks["validation-task-rework-review"].status).toBe("ready");
  });

  test("rejects worker errors even when expected output files already exist", async () => {
    const projectDir = await makeProject("active");
    await writeFile(join(projectDir, "evidence", "outputs", "existing.md"), "old output\n", "utf8");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Reject errored workers.",
          children: ["errored-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Worker errors do not become accepted blockers."],
          forbidden: [],
          gates: [],
        },
        "errored-task": {
          id: "errored-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Task whose output path already exists.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/existing.md"],
          acceptance: ["Fresh work is completed."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({
        status: "error",
        lastAssistantText: "**Status:** error\noutputs:\n- evidence/archive/existing.md",
      }),
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["errored-task"].verification.verdict).toBe("rejected");
    expect(updated.tasks["errored-task"].status).toBe("decomposed");
    expect(updated.tasks["errored-task-rework-review"].status).toBe("ready");
  });

  test("rejects interrupted workers even when expected output files already exist", async () => {
    const projectDir = await makeProject("active");
    await writeFile(join(projectDir, "evidence", "outputs", "existing.md"), "old output\n", "utf8");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Reject interrupted workers.",
          children: ["interrupted-output-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Interrupted workers do not become accepted blockers."],
          forbidden: [],
          gates: [],
        },
        "interrupted-output-task": {
          id: "interrupted-output-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Task whose output path already exists.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/existing.md"],
          acceptance: ["Fresh work is completed."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({
        status: "interrupted",
        lastAssistantText: "**Status:** interrupted\noutputs:\n- evidence/archive/existing.md",
      }),
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["interrupted-output-task"].verification.verdict).toBe("rejected");
    expect(updated.tasks["interrupted-output-task"].status).toBe("decomposed");
    expect(updated.tasks["interrupted-output-task-rework-review"].status).toBe("ready");
  });

  test("rejects no-work claims from frontier reviews", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do not accept no-work terminal claims.",
          children: ["project-frontier-replan"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Frontier has concrete next action."],
          forbidden: [],
          gates: [],
        },
        "project-frontier-replan": {
          id: "project-frontier-replan",
          parent_id: "project",
          kind: "frontier_replan",
          status: "ready",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review frontier.",
          children: [],
          inputs: [".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-frontier-replan.md"],
          acceptance: ["Creates concrete next work or a concrete input question."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({
        status: "ok",
        lastAssistantText: [
          "CLAIM: done",
          "No actionable local work remains. Project transitions to waiting.",
          "outputs:",
          "- evidence/archive/project-frontier-replan.md",
        ].join("\n"),
      }),
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-frontier-replan"].verification.verdict).toBe("rejected");
    expect(updated.tasks["project-frontier-replan-rework-review"].status).toBe("ready");
  });

  test("does not auto-review concrete human input questions as ordinary no-work", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Wait only on a concrete human question.",
          children: ["credential-question"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Question is answered or project is intentionally deferred."],
          forbidden: [],
          gates: [],
        },
        "credential-question": {
          id: "credential-question",
          parent_id: "project",
          kind: "human_question",
          status: "blocked",
          priority: "P0",
          owner: "human",
          goal: "Decide where Azure CLI credentials should be provisioned.",
          blocker: "Human must provide a credentialed execution host or explicitly defer live execution.",
          children: [],
          inputs: [".app/project.md"],
          outputs: [],
          acceptance: ["Human answers the credential-host question."],
          forbidden: ["Do not infer credentials from prose."],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 1 }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("human/input question");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["credential-question"].status).toBe("blocked");
    expect(updated.tasks["credential-question-blocker-review"]).toBeUndefined();
    expect(updated.tasks["project-frontier-replan"]).toBeUndefined();
  });

  test("normalizes non-leaf active task states written by workers", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "parent-task",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Normalize external edits.",
          children: ["parent-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Tree is normalized."],
          forbidden: [],
          gates: [],
        },
        "parent-task": {
          id: "parent-task",
          parent_id: "project",
          status: "in-progress",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Container task.",
          children: ["child-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Child accepted."],
          forbidden: [],
          gates: [],
        },
        "child-task": {
          id: "child-task",
          parent_id: "parent-task",
          status: "active",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Actual running leaf.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/child.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["parent-task"].status).toBe("decomposed");
    expect(updated.active_task_id).toBe("child-task");
  });

  test("resumes an interrupted active leaf before starting another ready leaf", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "interrupted-task",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Resume interrupted work before new work.",
          children: ["interrupted-task", "ready-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Both tasks accepted."],
          forbidden: [],
          gates: [],
        },
        "interrupted-task": {
          id: "interrupted-task",
          parent_id: "project",
          status: "active",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Interrupted leaf.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/interrupted.md"],
          acceptance: ["Interrupted work completed."],
          forbidden: [],
          gates: [],
        },
        "ready-task": {
          id: "ready-task",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Queued leaf.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/ready.md"],
          acceptance: ["Ready work completed."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const prompts: string[] = [];
    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async (_agent, prompt) => {
        prompts.push(prompt);
        return { status: "ok", lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/interrupted.md" };
      },
    }));

    expect(result.status).toBe("done");
    expect(prompts[0]).toContain("id: interrupted-task");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["interrupted-task"].status).toBe("accepted");
    expect(updated.tasks["ready-task"].status).toBe("ready");
    expect(updated.active_task_id).toBe("ready-task");
  });

  test("creates frontier replan when active project is blocked but not complete", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep finding safe local work until genuinely blocked.",
          children: ["blocked-work", "blocked-frontier-review"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Project goal is achieved or blocked with exact unblock triggers."],
          forbidden: [],
          gates: [],
          blocker: "Required child task is blocked.",
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do gated work.",
          children: ["blocked-work-blocker-review"],
          inputs: [".app/project.md"],
          outputs: ["evidence/archive/blocked-work.md"],
          acceptance: ["Gate is satisfied."],
          forbidden: ["Do not run live mutation."],
          gates: ["External gate."],
          blocker: "External gate.",
        },
        "blocked-work-blocker-review": {
          id: "blocked-work-blocker-review",
          parent_id: "blocked-work",
          kind: "blocked_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review blocker.",
          children: ["blocked-work-blocker-review"],
          inputs: [],
          outputs: ["evidence/archive/blocked-work-blocker-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
        },
        "blocked-frontier-review": {
          id: "blocked-frontier-review",
          parent_id: "project",
          kind: "blocked_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review blocked frontier.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-frontier-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const prompts: string[] = [];
    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async (_agent, prompt) => {
        prompts.push(prompt);
        const treePath = join(projectDir, "tasks", "tree.json");
        const current = JSON.parse(readFileSync(treePath, "utf8"));
        current.tasks.project.children = [...current.tasks.project.children, "task-1", "task-2", "task-3", "task-4", "task-5"];
        for (let index = 1; index <= 5; index++) {
          current.tasks[`task-${index}`] = {
            id: `task-${index}`,
            parent_id: "project",
            status: "proposed",
            priority: "P1",
            owner: "aks-explorer",
            goal: `Concrete safe local task ${index}.`,
            conflict_scope: [`evidence/archive/task-${index}.md`],
            children: [],
            inputs: [".app/tasks/tree.json"],
            outputs: [`evidence/archive/task-${index}.md`],
            acceptance: [`Task ${index} writes reviewable evidence.`],
            forbidden: ["Do not run live mutation."],
            gates: [],
          };
        }
        writeFileSync(treePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
        return { status: "ok", lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/project-planning-loop.md\n- .app/planner-runs.jsonl\n- .app/tasks/tree.json" };
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).not.toContain("No open tasks remain");
    expect(prompts.some(prompt => prompt.includes("Planning Loop Mode"))).toBe(true);
    expect(prompts.some(prompt => prompt.includes("batch of 5-10 proposed ordinary leaf tasks"))).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop-run"].verification.verdict).toBe("accepted");
    expect(updated.tasks["project-planning-history"]).toBeDefined();
    expect(updated.tasks["task-1"].status).toBe("proposed");
    expect(["blocked", "decomposed"]).toContain(updated.tasks.project.status);
  });

  test("rejects a frontier replan done claim that creates no task batch", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep finding concrete work.",
          children: ["project-frontier-replan"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Concrete next tasks exist."],
          forbidden: [],
          gates: [],
        },
        "project-frontier-replan": {
          id: "project-frontier-replan",
          parent_id: "project",
          kind: "frontier_replan",
          status: "ready",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Find safe local work.",
          children: [],
          inputs: [".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-frontier-replan.md"],
          acceptance: ["Creates 5-10 proposed concrete ordinary leaf tasks."],
          forbidden: ["Do not run live mutation."],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({
        status: "ok",
        lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/project-frontier-replan.md",
      }),
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-frontier-replan"].verification.verdict).toBe("rejected");
    expect(updated.tasks["project-frontier-replan"].blocker).toContain("created 0 new ordinary executable leaf");
    expect(updated.tasks["project-frontier-replan-rework-review"].status).toBe("ready");
  });

  test("creates another frontier replan after an accepted replan's child work is exhausted", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep finding safe local work until genuinely blocked.",
          children: ["blocked-work", "blocked-frontier-review", "project-frontier-replan", "local-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Project goal is achieved or blocked with exact unblock triggers."],
          forbidden: [],
          gates: [],
          blocker: "Required child task is blocked.",
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do gated work.",
          children: ["blocked-work-blocker-review"],
          inputs: [".app/project.md"],
          outputs: ["evidence/archive/blocked-work.md"],
          acceptance: ["Gate is satisfied."],
          forbidden: ["Do not run live mutation."],
          gates: ["External gate."],
          blocker: "External gate.",
        },
        "blocked-work-blocker-review": {
          id: "blocked-work-blocker-review",
          parent_id: "blocked-work",
          kind: "blocked_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review blocker.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-work-blocker-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:01:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "blocked-frontier-review": {
          id: "blocked-frontier-review",
          parent_id: "project",
          kind: "blocked_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review blocked frontier.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-frontier-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:02:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "project-frontier-replan": {
          id: "project-frontier-replan",
          parent_id: "project",
          kind: "frontier_replan",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Prior frontier replan.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/project-frontier-replan.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:00:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "local-task": {
          id: "local-task",
          parent_id: "project",
          status: "accepted",
          priority: "P2",
          owner: "aks-explorer",
          goal: "Prior local work produced by the old replan.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/local-task.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:03:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const prompts: string[] = [];
    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async (_agent, prompt) => {
        prompts.push(prompt);
        return { status: "ok", lastAssistantText: "CLAIM: blocked\noutputs:\n- evidence/archive/project-planning-loop.md" };
      },
    }));

    expect(result.status).toBe("done");
    expect(prompts.some(prompt => prompt.includes("id: project-planning-loop"))).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].verification.verdict).toBe("rejected");
    expect(updated.tasks["project-planning-loop-run"].verification.reason).toContain("Blocked claims must name a concrete external/input/safety wait");
    expect(updated.tasks["project-planning-loop-run-rework-review"].status).toBe("ready");
    expect(updated.tasks[updated.active_task_id].status).toBe("ready");
    expect(updated.active_task_id).not.toBe("project-planning-loop");
  });

  test("creates another frontier replan when the latest accepted replan child branch is exhausted", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep finding safe local work until genuinely blocked.",
          children: ["blocked-work", "blocked-frontier-review", "project-frontier-replan"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Project goal is achieved or blocked with exact unblock triggers."],
          forbidden: [],
          gates: [],
          blocker: "Required child task is blocked.",
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Do gated work.",
          children: ["blocked-work-blocker-review"],
          inputs: [".app/project.md"],
          outputs: ["evidence/archive/blocked-work.md"],
          acceptance: ["Gate is satisfied."],
          forbidden: ["Do not run live mutation."],
          gates: ["External gate."],
          blocker: "External gate.",
          verification: { ts: "2026-06-01T00:00:00.000Z", verifier: "test", verdict: "accepted", reason: "blocked", criteria: [] },
        },
        "blocked-work-blocker-review": {
          id: "blocked-work-blocker-review",
          parent_id: "blocked-work",
          kind: "blocked_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review blocker.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-work-blocker-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:01:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "blocked-frontier-review": {
          id: "blocked-frontier-review",
          parent_id: "project",
          kind: "blocked_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review blocked frontier.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-frontier-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:01:30.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "project-frontier-replan": {
          id: "project-frontier-replan",
          parent_id: "project",
          kind: "frontier_replan",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Prior frontier replan.",
          children: ["local-task"],
          inputs: [],
          outputs: ["evidence/archive/project-frontier-replan.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:03:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "local-task": {
          id: "local-task",
          parent_id: "project-frontier-replan",
          status: "accepted",
          priority: "P2",
          owner: "aks-explorer",
          goal: "Prior local work produced by the old replan.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/local-task.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
          verification: { ts: "2026-06-01T00:02:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].status).toBe("ready");
    expect(updated.active_task_id).toBe("project-planning-loop-run");
  });

  test("creates frontier replan when only review work is ready and ordinary backlog is empty", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "task-a-rework-review",
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep ordinary backlog filled even while rework reviews are pending.",
          children: ["blocked-work", "task-a"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Planner refills ordinary work."],
          forbidden: [],
          gates: [],
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Blocked ordinary branch proves the project still has unresolved work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-work.md"],
          acceptance: ["Blocker reviewed."],
          forbidden: [],
          gates: [],
          blocker: "Needs local unblock review.",
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Rejected branch with only review work ready.",
          children: ["task-a-rework-review"],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A recovered."],
          forbidden: [],
          gates: [],
        },
        "task-a-rework-review": {
          id: "task-a-rework-review",
          parent_id: "task-a",
          kind: "rework_review",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review rejected attempt for task-a.",
          children: [],
          inputs: [".app/tasks/tree.json"],
          outputs: ["evidence/archive/task-a-rework-review.md"],
          acceptance: ["Review written."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await executePlanner(context({
      projectDir,
      maxConcurrent: 3,
      dispatched,
      runAgent: async () => {
        throw new Error("planner should not execute worker sessions");
      },
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].status).toBe("ready");
    expect(dispatched.find(event => event.type === "project.tasks.ready")?.payload.readyTaskIds)
      .toContain("project-planning-loop-run");
  });

  test("does not turn accepted work into blocked when its review child is accepted", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "accepted-work-rework-review",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep accepted work accepted after review-only children settle.",
          children: ["accepted-work"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Accepted work remains accepted."],
          forbidden: [],
          gates: [],
        },
        "accepted-work": {
          id: "accepted-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Already completed work.",
          children: ["accepted-work-rework-review"],
          inputs: [],
          outputs: ["evidence/archive/accepted-work.md"],
          acceptance: ["Work is complete."],
          forbidden: [],
          gates: [],
          blocker: "Blocked task reviewed by accepted-work-rework-review.",
          verification: { ts: "2026-06-01T00:00:00.000Z", verifier: "test", verdict: "accepted", reason: "accepted", criteria: [] },
        },
        "accepted-work-rework-review": {
          id: "accepted-work-rework-review",
          parent_id: "accepted-work",
          kind: "rework_review",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review accepted work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/accepted-work-rework-review.md"],
          acceptance: ["Review is written."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      runAgent: async () => ({
        status: "ok",
        lastAssistantText: "CLAIM: done\noutputs:\n- evidence/archive/accepted-work-rework-review.md",
      }),
    }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["accepted-work-rework-review"].status).toBe("accepted");
    expect(updated.tasks["accepted-work"].status).toBe("accepted");
    expect(updated.tasks["accepted-work"].blocker).toBeUndefined();
  });

  test("normalizes non-external blocked work to accepted when verification accepted it", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Recover stale procedural blocked state.",
          children: ["ui-task"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["UI task is accepted."],
          forbidden: [],
          gates: [],
        },
        "ui-task": {
          id: "ui-task",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Finish a UI implementation task for Request REST Staging Replay action labels.",
          children: ["ui-task-rework-review"],
          inputs: [],
          outputs: [".app/ui/quality-panel.js"],
          acceptance: ["Implementation is present."],
          forbidden: [],
          gates: [],
          blocker: "Worker session was interrupted or cancelled; create a retry/rework task instead of accepting an incomplete claim.",
          attempts: [{
            id: "attempt-1",
            ts: "2026-06-01T00:00:00.000Z",
            agent: "aks-explorer",
            claim: "blocked",
            summary: "Interrupted procedural claim.",
            outputs: [".app/ui/quality-panel.js"],
            checks: [],
            open_risks: ["Worker session interrupted."],
          }],
          verification: {
            ts: "2026-06-01T00:01:00.000Z",
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Rework review confirmed all acceptance criteria are satisfied; original rejection was procedural.",
            criteria: [{ item: "Implementation is present.", result: "pass" }],
          },
        },
        "ui-task-rework-review": {
          id: "ui-task-rework-review",
          parent_id: "ui-task",
          kind: "rework_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review UI task.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/ui-task-rework-review.md"],
          acceptance: ["Review is written."],
          forbidden: [],
          gates: [],
          verification: {
            ts: "2026-06-01T00:02:00.000Z",
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Review accepted.",
            criteria: [{ item: "Review is written.", result: "pass" }],
          },
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["ui-task"].status).toBe("accepted");
    expect(updated.tasks["ui-task"].blocker).toBeUndefined();
  });

  test("creates a new frontier replan instead of rescheduling a non-leaf stale replan", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Recover from an exhausted blocked frontier.",
          children: ["blocked-work", "blocked-frontier-review", "project-frontier-replan"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["A new executable replan is created."],
          forbidden: [],
          gates: [],
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "External gated branch.",
          children: ["blocked-work-blocker-review"],
          inputs: [],
          outputs: ["evidence/archive/blocked-work.md"],
          acceptance: ["Gate is satisfied."],
          forbidden: [],
          gates: ["External gate."],
          blocker: "External gate.",
        },
        "blocked-work-blocker-review": {
          id: "blocked-work-blocker-review",
          parent_id: "blocked-work",
          kind: "blocked_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review blocked work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-work-blocker-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
        },
        "blocked-frontier-review": {
          id: "blocked-frontier-review",
          parent_id: "project",
          kind: "blocked_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review blocked frontier.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-frontier-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
        },
        "project-frontier-replan": {
          id: "project-frontier-replan",
          parent_id: "project",
          kind: "frontier_replan",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Old non-leaf replan.",
          children: ["old-replan-child"],
          inputs: [],
          outputs: ["evidence/archive/project-frontier-replan.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
        },
        "old-replan-child": {
          id: "old-replan-child",
          parent_id: "project-frontier-replan",
          status: "accepted",
          priority: "P2",
          owner: "aks-explorer",
          goal: "Old child work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/old-replan-child.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("project-planning-loop");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-frontier-replan"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].status).toBe("ready");
    expect(updated.active_task_id).toBe("project-planning-loop-run");
  });

  test("wakes planning loop when active project has no ready work but unfinished gated frontier remains", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Learn AKS input and expectation space.",
          children: ["feature-learning-loop", "project-control"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Feature learning is complete or exactly gated."],
          forbidden: [],
          gates: [],
          progress: { accepted: 0, blocked: 0, total: 1 },
        },
        "feature-learning-loop": {
          id: "feature-learning-loop",
          parent_id: "project",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Maintain concrete AKS feature-learning tasks.",
          children: ["managedsystem-two-path-live-run"],
          inputs: ["model/knowledge-map/views/path-summary.json"],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Next feature-learning work is scheduled."],
          forbidden: ["Do not run live mutation without gates."],
          gates: [],
          progress: { accepted: 0, blocked: 0, total: 1 },
        },
        "managedsystem-two-path-live-run": {
          id: "managedsystem-two-path-live-run",
          parent_id: "feature-learning-loop",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Run ManagedSystem live validation only after gate review.",
          children: ["managedsystem-devbox-msi-two-path-live-run"],
          inputs: ["evidence/archive/20260602T100036Z-devbox-msi-auth-preflight.md"],
          outputs: ["evidence/archive/managedsystem-two-path-live-run.md"],
          acceptance: ["Live run is executed or exact safe follow-up work is created."],
          forbidden: ["Do not run live mutation without explicit gate satisfaction."],
          gates: [],
          progress: { accepted: 0, blocked: 0, total: 1 },
        },
        "managedsystem-devbox-msi-two-path-live-run": {
          id: "managedsystem-devbox-msi-two-path-live-run",
          parent_id: "managedsystem-two-path-live-run",
          status: "proposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review devbox MSI gate and either open the live-run gate or create safe local follow-up work.",
          children: [],
          inputs: ["evidence/archive/20260602T100036Z-devbox-msi-auth-preflight.md"],
          outputs: ["evidence/archive/managedsystem-devbox-msi-two-path-live-run.md"],
          acceptance: ["Gate decision or safe local follow-up is recorded."],
          forbidden: ["Do not run live mutation without explicit gate satisfaction."],
          gates: [
            "devbox MSI auth is still valid immediately before live execution.",
            "The live run command and cleanup plan are explicit.",
          ],
          gate_status: "closed",
          blocker: "Waiting for planner/worker to explicitly open the devbox MSI live-run gate after reviewing the accepted auth preflight and run plan.",
        },
        "project-control": {
          id: "project-control",
          parent_id: "project",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Visible control plane for standing project loops.",
          children: ["project-planning-loop"],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Standing loops are visible."],
          forbidden: [],
          gates: [],
          progress: { accepted: 1, blocked: 0, total: 1 },
        },
        "project-planning-loop": {
          id: "project-planning-loop",
          parent_id: "project-control",
          kind: "loop_task",
          workflow: "project-planner",
          wake_on: ["project.ready.empty", "project.backlog.low"],
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: [],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records the next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
          attempts: [{
            id: "attempt-old",
            ts: "2026-06-02T00:00:00.000Z",
            agent: "aks-explorer",
            claim: "done",
            summary: "Prior planning run accepted.",
            outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
            checks: [],
            open_risks: [],
          }],
          verification: {
            ts: "2026-06-02T00:01:00.000Z",
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Prior planning run accepted.",
            criteria: [{ item: "Planning run records the next work.", result: "pass" }],
          },
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("project-planning-loop");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop"].verification).toBeUndefined();
    expect(updated.tasks["project-planning-loop-run"].status).toBe("ready");
    expect(updated.active_task_id).toBe("project-planning-loop-run");
    expect(updated.tasks["managedsystem-devbox-msi-two-path-live-run"].status).toBe("proposed");
  });

  test("creates an executable planning loop run when the standing loop has accepted history children", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep learning.",
          children: ["blocked-work", "blocked-frontier-review", "project-control"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done or exactly blocked."],
          forbidden: [],
          gates: [],
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "External gated work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked.md"],
          acceptance: ["Gate clears."],
          forbidden: [],
          gates: ["Waiting for owner input."],
          blocker: "Waiting for owner input.",
        },
        "blocked-work-blocker-review": {
          id: "blocked-work-blocker-review",
          parent_id: "blocked-work",
          kind: "blocked_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review blocked work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-work-blocker-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: {
            ts: "2026-06-03T00:00:00.000Z",
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Accepted.",
            criteria: [{ item: "Reviewed.", result: "pass" }],
          },
        },
        "project-control": {
          id: "project-control",
          parent_id: "project",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Control plane.",
          children: ["project-planning-loop"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Control visible."],
          forbidden: [],
          gates: [],
        },
        "blocked-frontier-review": {
          id: "blocked-frontier-review",
          parent_id: "project",
          kind: "blocked_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review blocked frontier.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-frontier-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: {
            ts: "2026-06-03T00:00:00.000Z",
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Accepted.",
            criteria: [{ item: "Reviewed.", result: "pass" }],
          },
        },
        "project-planning-loop": {
          id: "project-planning-loop",
          parent_id: "project-control",
          kind: "loop_task",
          workflow: "project-planner",
          wake_on: ["project.ready.empty"],
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: ["project-planning-loop-rework-review"],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
        },
        "project-planning-loop-rework-review": {
          id: "project-planning-loop-rework-review",
          parent_id: "project-planning-loop",
          kind: "rework_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Accepted old loop recovery.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/project-planning-loop-rework-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: {
            ts: "2026-06-03T00:00:00.000Z",
            verifier: "aks-explorer",
            verdict: "accepted",
            reason: "Accepted.",
            criteria: [{ item: "Reviewed.", result: "pass" }],
          },
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("project-planning-loop-run");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].status).toBe("ready");
    expect(updated.tasks["project-planning-loop-run"].parent_id).toBe("project-planning-loop");
    expect(updated.active_task_id).toBe("project-planning-loop-run");
  });

  test("supersedes repeatedly interrupted planning-loop recovery and creates a fresh run", async () => {
    const projectDir = await makeProject("active");
    const interruptedAttempt = (n: number) => ({
      id: `attempt-${n}`,
      ts: `2026-06-03T00:0${n}:00.000Z`,
      agent: "aks-explorer",
      claim: "blocked",
      summary: "**Status:** interrupted (5m0s)",
      outputs: [],
      checks: [],
      open_risks: ["Worker session interrupted or cancelled."],
    });
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "project-planning-loop-run-rework-review",
      active_task_ids: ["project-planning-loop-run-rework-review"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep learning.",
          children: ["project-control"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Planning continues."],
          forbidden: [],
          gates: [],
        },
        "project-control": {
          id: "project-control",
          parent_id: "project",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Control plane.",
          children: ["project-planning-loop"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Control visible."],
          forbidden: [],
          gates: [],
        },
        "project-planning-loop": {
          id: "project-planning-loop",
          parent_id: "project-control",
          kind: "loop_task",
          workflow: "project-planner",
          wake_on: ["project.ready.empty"],
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: ["project-planning-loop-run"],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
        },
        "project-planning-loop-run": {
          id: "project-planning-loop-run",
          parent_id: "project-planning-loop",
          kind: "loop_task",
          workflow: "project-planner",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: ["project-planning-loop-run-rework-review"],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
          verification: {
            ts: "2026-06-03T00:00:00.000Z",
            verifier: "aks-explorer",
            verdict: "rejected",
            reason: "Worker session was interrupted or cancelled.",
            criteria: [],
          },
        },
        "project-planning-loop-run-rework-review": {
          id: "project-planning-loop-run-rework-review",
          parent_id: "project-planning-loop-run",
          kind: "rework_review",
          status: "active",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review failed planning loop run.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/project-planning-loop-run-rework-review.md"],
          acceptance: ["Review produces recovery."],
          forbidden: [],
          gates: [],
          attempts: [interruptedAttempt(1), interruptedAttempt(2), interruptedAttempt(3)],
          verification: {
            ts: "2026-06-03T00:03:00.000Z",
            verifier: "aks-explorer",
            verdict: "rejected",
            reason: "Worker session was interrupted or cancelled.",
            criteria: [{ item: "Review produces recovery.", result: "not_proven" }],
          },
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop-run"].status).toBe("superseded");
    expect(updated.tasks["project-planning-loop-run-rework-review"].status).toBe("superseded");
    expect(updated.tasks["project-planning-loop-run-2"].status).toBe("ready");
    expect(updated.tasks["project-planning-loop-run-2"].parent_id).toBe("project-planning-loop");
    expect(updated.active_task_id).toBe("project-planning-loop-run-2");
  });

  test("supersedes stale planning-loop recovery when a fresher loop run is live", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "project-planning-loop-run-3",
      active_task_ids: ["project-planning-loop-run-3"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep learning.",
          children: ["project-control"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Planning continues."],
          forbidden: [],
          gates: [],
        },
        "project-control": {
          id: "project-control",
          parent_id: "project",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Control plane.",
          children: ["project-planning-loop"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Control visible."],
          forbidden: [],
          gates: [],
        },
        "project-planning-loop": {
          id: "project-planning-loop",
          parent_id: "project-control",
          kind: "loop_task",
          workflow: "project-planner",
          wake_on: ["project.ready.empty"],
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: ["project-planning-loop-run-2", "project-planning-loop-run-3"],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
        },
        "project-planning-loop-run-2": {
          id: "project-planning-loop-run-2",
          parent_id: "project-planning-loop",
          kind: "loop_task",
          workflow: "project-planner",
          status: "decomposed",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: ["project-planning-loop-run-2-rework-review"],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
          verification: {
            ts: "2026-06-03T00:00:00.000Z",
            verifier: "aks-explorer",
            verdict: "rejected",
            reason: "Worker session was interrupted or cancelled.",
            criteria: [],
          },
        },
        "project-planning-loop-run-2-rework-review": {
          id: "project-planning-loop-run-2-rework-review",
          parent_id: "project-planning-loop-run-2",
          kind: "rework_review",
          status: "ready",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Review failed planning loop run.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/project-planning-loop-run-2-rework-review.md"],
          acceptance: ["Review produces recovery."],
          forbidden: [],
          gates: [],
        },
        "project-planning-loop-run-3": {
          id: "project-planning-loop-run-3",
          parent_id: "project-planning-loop",
          kind: "loop_task",
          workflow: "project-planner",
          status: "active",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Standing planning loop.",
          children: [],
          inputs: [".app/project.md", ".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
          acceptance: ["Planning run records next work."],
          forbidden: ["Do not run live mutation."],
          gates: [],
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-planning-loop-run-3"].status).toBe("active");
    expect(updated.tasks["project-planning-loop-run-2"].status).toBe("superseded");
    expect(updated.tasks["project-planning-loop-run-2-rework-review"].status).toBe("superseded");
    expect(updated.tasks["project-planning-loop-run-4"]).toBeUndefined();
    expect(updated.active_task_id).toBe("project-planning-loop-run-3");
  });

  test("promotes local check tasks when gates are safety constraints rather than dependencies", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Root.",
          children: ["local-check"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "local-check": {
          id: "local-check",
          parent_id: "project",
          status: "proposed",
          priority: "P2",
          owner: "aks-explorer",
          goal: "Run a local probe check.",
          children: [],
          inputs: ["replays/example.ts"],
          outputs: ["evidence/archive/local-check.md"],
          acceptance: ["Records local --check output."],
          forbidden: ["Do not run live mutation."],
          gates: ["No cloud mutation: --check only"],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["local-check"].status).toBe("ready");
    expect(updated.active_task_id).toBe("local-check");
  });

  test("creates feature queue advance work before treating aks learning as blocked", async () => {
    const projectDir = await makeProject("active");
    await writeFile(join(projectDir, "evidence", "outputs", "feature-learning-queue.md"), featureQueueMd(), "utf8");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Learn AKS features from a queue.",
          children: ["feature-learning-loop"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Queue is exhausted or gated."],
          forbidden: [],
          gates: [],
        },
        "feature-learning-loop": {
          id: "feature-learning-loop",
          parent_id: "project",
          status: "blocked",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Run the repeated AKS feature-learning loop.",
          children: ["feature-workload-identity"],
          inputs: ["evidence/archive/feature-learning-queue.md"],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Every selected feature is accepted or externally gated."],
          forbidden: ["Do not run cloud mutation."],
          gates: [],
          blocker: "Required child task is blocked: old-feature",
        },
        "feature-workload-identity": {
          id: "feature-workload-identity",
          parent_id: "feature-learning-loop",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Already represented queue item.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/workload-identity.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created feature queue advance task");

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.active_task_id).toBe("advance-feature-oidc-issuer");
    expect(updated.tasks["advance-feature-oidc-issuer"].kind).toBe("domain_planner");
    expect(updated.tasks["advance-feature-oidc-issuer"].status).toBe("ready");
    expect(updated.tasks["advance-feature-oidc-issuer"].acceptance.join("\n")).toContain("batch of 3-7 concrete proposed local leaves");
    expect(updated.tasks["feature-learning-loop"].status).toBe("decomposed");
    expect(updated.tasks["feature-learning-loop"].children).toContain("advance-feature-oidc-issuer");
  });

  test("does not let an accepted childless frontier replan quiet blocked project work", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Keep finding safe local work until genuinely blocked.",
          children: ["blocked-work", "blocked-frontier-review", "project-frontier-replan"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Blocked work is periodically replanned."],
          forbidden: [],
          gates: [],
          blocker: "Required child task is blocked.",
        },
        "blocked-work": {
          id: "blocked-work",
          parent_id: "project",
          status: "blocked",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Blocked ordinary work.",
          children: ["blocked-work-blocker-review"],
          inputs: [],
          outputs: ["evidence/archive/blocked-work.md"],
          acceptance: ["Gate is satisfied or follow-up work is created."],
          forbidden: ["Do not run live mutation."],
          gates: ["External gate."],
          blocker: "External gate.",
        },
        "blocked-work-blocker-review": {
          id: "blocked-work-blocker-review",
          parent_id: "blocked-work",
          kind: "blocked_review",
          status: "accepted",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Review blocked ordinary work.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-work-blocker-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: {
            ts: "2026-06-01T00:02:00.000Z",
            verifier: "old-verifier",
            verdict: "accepted",
            reason: "Already reviewed.",
            criteria: [],
          },
        },
        "project-frontier-replan": {
          id: "project-frontier-replan",
          parent_id: "project",
          kind: "frontier_replan",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Prior empty replan.",
          children: [],
          inputs: [".app/tasks/tree.json"],
          outputs: ["evidence/archive/project-frontier-replan.md"],
          acceptance: ["Creates a batch of 5-10 proposed concrete ordinary leaf tasks."],
          forbidden: ["Do not run live mutation."],
          gates: [],
          attempts: [{
            id: "attempt-empty",
            ts: "2026-06-01T00:00:00.000Z",
            agent: "aks-explorer",
            claim: "done",
            summary: "CLAIM: done\noutputs:\n- evidence/archive/project-frontier-replan.md",
            outputs: ["evidence/archive/project-frontier-replan.md"],
            checks: [],
            open_risks: [],
          }],
          verification: {
            ts: "2026-06-01T00:00:00.000Z",
            verifier: "old-verifier",
            verdict: "accepted",
            reason: "Old verifier accepted an empty replan.",
            criteria: [],
          },
        },
        "blocked-frontier-review": {
          id: "blocked-frontier-review",
          parent_id: "project",
          kind: "blocked_review",
          status: "accepted",
          priority: "P0",
          owner: "aks-explorer",
          goal: "Already reviewed blocked frontier.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/blocked-frontier-review.md"],
          acceptance: ["Reviewed."],
          forbidden: [],
          gates: [],
          verification: {
            ts: "2026-06-01T00:01:00.000Z",
            verifier: "old-verifier",
            verdict: "accepted",
            reason: "Already reviewed.",
            criteria: [],
          },
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["project-frontier-replan"].verification.verdict).toBe("accepted");
    expect(updated.tasks["project-planning-loop"].kind).toBe("loop_task");
    expect(updated.tasks["project-planning-loop"].status).toBe("decomposed");
    expect(updated.tasks["project-planning-loop-run"].status).toBe("ready");
    expect(updated.active_task_id).toBe("project-planning-loop-run");
  });

  test("requests continuation when wake budget ends with runnable work", async () => {
    const projectDir = await makeProject("active");
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: null,
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Run multiple leaves.",
          children: ["task-a", "task-b"],
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Both children accepted."],
          forbidden: [],
          gates: [],
        },
        "task-a": {
          id: "task-a",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce A.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "task-b": {
          id: "task-b",
          parent_id: "project",
          status: "ready",
          priority: "P1",
          owner: "aks-explorer",
          goal: "Produce B.",
          children: [],
          inputs: [],
          outputs: ["evidence/archive/b.md"],
          acceptance: ["B exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      maxAttempts: 1,
      dispatched,
      runAgent: async (_agent, prompt) => {
        const outputSection = prompt.split("## Required Outputs\n")[1] ?? prompt;
        const output = outputSection.match(/evidence\/outputs\/[^\s]+\.md/)?.[0] ?? "evidence/archive/unknown.md";
        return { status: "ok", lastAssistantText: `CLAIM: done\noutputs:\n- ${output}` };
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("continuation requested");
    expect(dispatched.some(event => event.type === "project.execution.requested")).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["task-a"].status).toBe("accepted");
    expect(updated.tasks["task-b"].status).toBe("ready");
    expect(updated.active_task_id).toBe("task-b");
  });

  test("blocks planning loop when consecutive failed runs exceed budget cap", async () => {
    const projectDir = await makeProject("active");
    const interruptedAttempt = (n: number) => ({
      id: `attempt-${n}`,
      ts: `2026-06-03T00:0${n}:00.000Z`,
      agent: "aks-explorer",
      claim: "blocked",
      summary: "**Status:** interrupted (5m0s)",
      outputs: [],
      checks: [],
      open_risks: ["Worker session interrupted or cancelled."],
    });

    // Build a tree with 5 superseded planning runs (at the budget cap)
    // and a 6th run whose rework review has been interrupted 3x
    const planningRunChildren: string[] = [];
    const tasks: Record<string, any> = {
      project: {
        id: "project",
        parent_id: null,
        status: "decomposed",
        priority: "P1",
        owner: "aks-explorer",
        goal: "Keep learning.",
        children: ["project-control"],
        inputs: [],
        outputs: [".app/tasks/tree.json"],
        acceptance: ["Planning continues."],
        forbidden: [],
        gates: [],
      },
      "project-control": {
        id: "project-control",
        parent_id: "project",
        status: "decomposed",
        priority: "P0",
        owner: "aks-explorer",
        goal: "Control plane.",
        children: ["project-planning-loop"],
        inputs: [],
        outputs: [".app/tasks/tree.json"],
        acceptance: ["Control visible."],
        forbidden: [],
        gates: [],
      },
      "project-planning-loop": {
        id: "project-planning-loop",
        parent_id: "project-control",
        kind: "loop_task",
        workflow: "project-planner",
        wake_on: ["project.ready.empty"],
        status: "decomposed",
        priority: "P0",
        owner: "aks-explorer",
        goal: "Standing planning loop.",
        children: [] as string[],
        inputs: [".app/project.md", ".app/tasks/tree.json"],
        outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
        acceptance: ["Planning run records next work."],
        forbidden: ["Do not run live mutation."],
        gates: [],
      },
    };

    // Add 5 superseded planning runs (ordinals 1-5)
    for (let i = 1; i <= 5; i++) {
      const runId = i === 1 ? "project-planning-loop-run" : `project-planning-loop-run-${i}`;
      tasks[runId] = {
        id: runId,
        parent_id: "project-planning-loop",
        kind: "loop_task",
        workflow: "project-planner",
        status: "superseded",
        priority: "P0",
        owner: "aks-explorer",
        goal: "Standing planning loop.",
        children: [],
        inputs: [".app/project.md", ".app/tasks/tree.json"],
        outputs: ["evidence/archive/project-planning-loop.md"],
        acceptance: ["Planning run records next work."],
        forbidden: ["Do not run live mutation."],
        gates: [],
        blocker: "Superseded after interrupted recovery.",
      };
      planningRunChildren.push(runId);
    }

    // Add the 6th run with a rework review that exhausted its interrupt budget
    const run6Id = "project-planning-loop-run-6";
    const reworkId = `${run6Id}-rework-review`;
    tasks[run6Id] = {
      id: run6Id,
      parent_id: "project-planning-loop",
      kind: "loop_task",
      workflow: "project-planner",
      status: "decomposed",
      priority: "P0",
      owner: "aks-explorer",
      goal: "Standing planning loop.",
      children: [reworkId],
      inputs: [".app/project.md", ".app/tasks/tree.json"],
      outputs: ["evidence/archive/project-planning-loop.md"],
      acceptance: ["Planning run records next work."],
      forbidden: ["Do not run live mutation."],
      gates: [],
      verification: {
        ts: "2026-06-03T00:06:00.000Z",
        verifier: "aks-explorer",
        verdict: "rejected",
        reason: "Worker session was interrupted or cancelled.",
        criteria: [],
      },
    };
    tasks[reworkId] = {
      id: reworkId,
      parent_id: run6Id,
      kind: "rework_review",
      status: "active",
      priority: "P0",
      owner: "aks-explorer",
      goal: "Review failed planning loop run.",
      children: [],
      inputs: [],
      outputs: [`evidence/archive/${reworkId}.md`],
      acceptance: ["Review produces recovery."],
      forbidden: [],
      gates: [],
      attempts: [interruptedAttempt(1), interruptedAttempt(2), interruptedAttempt(3)],
      verification: {
        ts: "2026-06-03T00:09:00.000Z",
        verifier: "aks-explorer",
        verdict: "rejected",
        reason: "Worker session was interrupted or cancelled.",
        criteria: [{ item: "Review produces recovery.", result: "not_proven" }],
      },
      claimed_by: "aks-explorer",
      lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    };
    planningRunChildren.push(run6Id);
    tasks["project-planning-loop"].children = planningRunChildren;

    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: reworkId,
      active_task_ids: [reworkId],
      tasks,
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({ projectDir, maxAttempts: 0 }));

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    // The rework review should be superseded
    expect(updated.tasks[reworkId].status).toBe("superseded");
    // The planning loop should be blocked (budget exhausted)
    expect(updated.tasks["project-planning-loop"].status).toBe("blocked");
    expect(updated.tasks["project-planning-loop"].blocker).toContain("Planning loop exhausted");
    // No new planning run should have been created
    expect(updated.tasks["project-planning-loop-run-7"]).toBeUndefined();
    // Active task should not be a planning loop run (loop is blocked)
    expect(updated.active_task_id).not.toMatch(/^project-planning-loop-run/);
  });
});
