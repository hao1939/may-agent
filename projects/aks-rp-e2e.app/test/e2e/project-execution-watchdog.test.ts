import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "../../workflows/project-execution-watchdog.ts";

function projectMd() {
  return `---
id: test-project
owner: aks-explorer
status: active
---

# Project: Test Project

## Goal
Keep work moving.

## Current State
Testing.

## Next Action
Use the task tree.
`;
}

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-watchdog-"));
  await mkdir(join(dir, ".app"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await mkdir(join(dir, "evidence", "outputs"), { recursive: true });
  await writeFile(join(dir, ".app", "project.md"), projectMd(), "utf8");
  await writeFile(join(dir, ".app", "journal.jsonl"), "", "utf8");
  return dir;
}

function context(input: {
  projectDir: string;
  stateDbPath?: string;
  staleMs?: number;
  zeroOpStaleMs?: number;
  controlZeroOpStaleMs?: number;
  noSessionStaleMs?: number;
  maxAttempts?: number;
  maxConcurrent?: number;
  dispatched?: Array<{ type: string; payload: Record<string, unknown> }>;
  emitted?: Array<Record<string, unknown>>;
  runAgent?: (agent: string, prompt: string) => Promise<{ status: string; lastAssistantText?: string }>;
}) {
  return {
    task: [
      `project: ${input.projectDir}`,
      `stateDb: ${input.stateDbPath ?? join(input.projectDir, ".missing-may.db")}`,
      `staleMs: ${input.staleMs ?? 300_000}`,
      `zeroOpStaleMs: ${input.zeroOpStaleMs ?? 600_000}`,
      `controlZeroOpStaleMs: ${input.controlZeroOpStaleMs ?? 120_000}`,
      `noSessionStaleMs: ${input.noSessionStaleMs ?? 120_000}`,
      `maxAttempts: ${input.maxAttempts ?? 1}`,
      `maxConcurrent: ${input.maxConcurrent ?? 3}`,
    ].join("\n"),
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit(event: Record<string, unknown>) {
      input.emitted?.push(event);
    },
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      input.dispatched?.push({ type, payload });
    },
    runAgent: input.runAgent ?? (async () => ({ status: "error", lastAssistantText: "" })),
    summarize: (result: { lastAssistantText?: string }) => result.lastAssistantText ?? "",
  } as any;
}

describe("project execution watchdog", () => {
  test("skips when the task tree was updated recently", async () => {
    const projectDir = await makeProject();
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "active-task",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["active-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "active-task": {
          id: "active-task",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          children: [],
          goal: "Recent active work.",
          inputs: [],
          outputs: ["evidence/archive/active.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await execute(context({
      projectDir,
      runAgent: async () => {
        throw new Error("watchdog should not start a worker when tree is fresh");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog skipped");
  });

  test("does not cancel a running zero-op session inside the conservative startup window", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    const startedAt = Date.now() - 7 * 60_000;
    const db = new Database(stateDbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        projectId text,
        status text,
        startedAt integer,
        opCount integer,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?)").run(
      "still-starting",
      "aks-rp-e2e",
      "running",
      startedAt,
      0,
      "id: active-task\nowner: aks-explorer",
    );
    db.close();

    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date(startedAt).toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "active-task",
      active_task_ids: ["active-task"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["active-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "active-task": {
          id: "active-task",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
          children: [],
          goal: "Allow a slow worker startup before cancelling.",
          inputs: [],
          outputs: ["evidence/archive/active.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    const treePath = join(projectDir, "tasks", "tree.json");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    await utimes(treePath, new Date(startedAt), new Date(startedAt));

    const emitted: Array<Record<string, unknown>> = [];
    const result = await execute(context({
      projectDir,
      stateDbPath,
      staleMs: 300_000,
      zeroOpStaleMs: 600_000,
      emitted,
      runAgent: async () => {
        throw new Error("watchdog should not recover a zero-op session inside the conservative startup window");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("running zero-op session is within conservative startup window");
    expect(emitted.some(event => event.type === "session.cancel.requested")).toBe(false);
  });

  test("recovers a zero-op control-loop session before it freezes project scheduling", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    const startedAt = Date.now() - 3 * 60_000;
    const db = new Database(stateDbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        projectId text,
        status text,
        startedAt integer,
        opCount integer,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?)").run(
      "stale-control-zero-op",
      "aks-rp-e2e",
      "running",
      startedAt,
      0,
      "id: project-planning-loop-run-rework-review\nowner: aks-explorer",
    );
    db.close();

    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date(startedAt).toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "project-planning-loop-run-rework-review",
      active_task_ids: ["project-planning-loop-run-rework-review"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["project-control"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "project-control": {
          id: "project-control",
          parent_id: "project",
          status: "decomposed",
          children: ["project-planning-loop"],
          goal: "Project control.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Control work advances."],
          forbidden: [],
          gates: [],
        },
        "project-planning-loop": {
          id: "project-planning-loop",
          parent_id: "project-control",
          status: "decomposed",
          kind: "loop_task",
          children: ["project-planning-loop-run"],
          goal: "Plan project work.",
          inputs: [],
          outputs: ["evidence/archive/project-planning-loop.md"],
          acceptance: ["Project work is planned."],
          forbidden: [],
          gates: [],
        },
        "project-planning-loop-run": {
          id: "project-planning-loop-run",
          parent_id: "project-planning-loop",
          status: "decomposed",
          kind: "loop_task",
          children: ["project-planning-loop-run-rework-review"],
          goal: "Plan project work.",
          inputs: [],
          outputs: ["evidence/archive/project-planning-loop.md"],
          acceptance: ["Project work is planned."],
          forbidden: [],
          gates: [],
        },
        "project-planning-loop-run-rework-review": {
          id: "project-planning-loop-run-rework-review",
          parent_id: "project-planning-loop-run",
          status: "active",
          kind: "rework_review",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
          conflict_scope: ["project-control:planning-loop"],
          children: [],
          goal: "Review failed planner loop run.",
          inputs: [],
          outputs: ["evidence/archive/project-planning-loop-run-rework-review.md"],
          acceptance: ["Recovery path is clear."],
          forbidden: [],
          gates: [],
        },
      },
    };
    const treePath = join(projectDir, "tasks", "tree.json");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    await utimes(treePath, new Date(startedAt), new Date(startedAt));

    const emitted: Array<Record<string, unknown>> = [];
    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      stateDbPath,
      staleMs: 300_000,
      zeroOpStaleMs: 600_000,
      controlZeroOpStaleMs: 120_000,
      emitted,
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should recover the stale control loop through worker pickup");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog recovered abandoned control task(s)");
    expect(emitted.some(event => event.type === "session.cancel.requested" && event.sessionId === "stale-control-zero-op")).toBe(true);
    expect(dispatched.some(event => event.type === "task.requeued" && event.payload.reason === "zero-op-worker-session-abandoned")).toBe(true);
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual([]);

    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["project-planning-loop-run-rework-review"].status).toBe("superseded");
  });

  test("wakes worker pickup when a fresh tree still has open parallel capacity", async () => {
    const projectDir = await makeProject();
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "active-task",
      active_task_ids: ["active-task"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["active-task", "ready-task-a", "ready-task-b"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "active-task": {
          id: "active-task",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          children: [],
          goal: "Recent active work.",
          conflict_scope: ["evidence/archive/active.md"],
          inputs: [],
          outputs: ["evidence/archive/active.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "ready-task-a": {
          id: "ready-task-a",
          parent_id: "project",
          status: "ready",
          children: [],
          goal: "Ready independent work A.",
          conflict_scope: ["evidence/archive/a.md"],
          inputs: [],
          outputs: ["evidence/archive/a.md"],
          acceptance: ["A exists."],
          forbidden: [],
          gates: [],
        },
        "ready-task-b": {
          id: "ready-task-b",
          parent_id: "project",
          status: "ready",
          children: [],
          goal: "Ready independent work B.",
          conflict_scope: ["evidence/archive/b.md"],
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
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should dispatch extra task execution events instead of running workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId).sort())
      .toEqual(["ready-task-a", "ready-task-b"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-task"].status).toBe("active");
    expect(updated.tasks["ready-task-a"].status).toBe("active");
    expect(updated.tasks["ready-task-b"].status).toBe("active");
  });

  test("advances stale runnable work by waking the task worker loop", async () => {
    const projectDir = await makeProject();
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "ready-task",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["ready-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "ready-task": {
          id: "ready-task",
          parent_id: "project",
          status: "ready",
          children: [],
          goal: "Stale ready work.",
          inputs: [],
          outputs: ["evidence/archive/ready.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      staleMs: 0,
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should dispatch task execution events instead of running workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.some(event => event.type === "project.task.execution.requested")).toBe(true);
    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["ready-task"].status).toBe("active");
    expect(updated.tasks["ready-task"].lease_expires_at).toBeTruthy();
  });

  test("wakes worker pickup for ordinary work and one independent review lane", async () => {
    const projectDir = await makeProject();
    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "ordinary-task",
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["ordinary-task", "review-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "ordinary-task": {
          id: "ordinary-task",
          parent_id: "project",
          status: "ready",
          children: [],
          goal: "Ready ordinary work.",
          conflict_scope: ["evidence/archive/ordinary.md"],
          inputs: [],
          outputs: ["evidence/archive/ordinary.md"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "review-task": {
          id: "review-task",
          parent_id: "project",
          kind: "rework_review",
          status: "ready",
          children: [],
          goal: "Serialized review work.",
          inputs: [],
          outputs: ["evidence/archive/review.md"],
          acceptance: ["Review done."],
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
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should dispatch task execution events instead of running workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["ordinary-task", "review-task"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["ordinary-task"].status).toBe("active");
    expect(updated.tasks["review-task"].status).toBe("active");
  });

  test("wakes worker pickup when active model work has independent ready and review work", async () => {
    const projectDir = await makeProject();
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
          children: ["active-model-task", "review-task", "ready-model-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "active-model-task": {
          id: "active-model-task",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          children: [],
          goal: "Edit model path A.",
          conflict_scope: ["model/knowledge-map/model.json:path.a"],
          inputs: [],
          outputs: ["model/knowledge-map/model.json"],
          acceptance: ["Model validates."],
          forbidden: [],
          gates: [],
        },
        "review-task": {
          id: "review-task",
          parent_id: "project",
          kind: "rework_review",
          priority: "P0",
          status: "ready",
          children: [],
          goal: "Serialized review work.",
          inputs: [],
          outputs: ["evidence/archive/review.md"],
          acceptance: ["Review done."],
          forbidden: [],
          gates: [],
        },
        "ready-model-task": {
          id: "ready-model-task",
          parent_id: "project",
          priority: "P1",
          status: "ready",
          children: [],
          goal: "Edit model path B.",
          conflict_scope: ["model/knowledge-map/model.json:path.b"],
          inputs: [],
          outputs: ["model/knowledge-map/model.json"],
          acceptance: ["Model validates."],
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
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should dispatch task execution events instead of running workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["review-task", "ready-model-task"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-model-task"].status).toBe("active");
    expect(updated.tasks["ready-model-task"].status).toBe("active");
    expect(updated.tasks["review-task"].status).toBe("active");
  });

  test("wakes worker pickup when an active review has unrelated ordinary ready work", async () => {
    const projectDir = await makeProject();
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
          children: ["active-review", "ready-domain-task", "ready-review"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "active-review": {
          id: "active-review",
          parent_id: "project",
          status: "active",
          kind: "rework_review",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          children: [],
          goal: "Review a UI branch.",
          conflict_scope: ["ui:feature-shell"],
          inputs: [],
          outputs: ["evidence/archive/ui-review.md"],
          acceptance: ["Review done."],
          forbidden: [],
          gates: [],
        },
        "ready-domain-task": {
          id: "ready-domain-task",
          parent_id: "project",
          status: "ready",
          children: [],
          goal: "Retarget domain probe.",
          conflict_scope: ["golden-path:oidc-rest-retarget"],
          inputs: [],
          outputs: ["replays/oidc.ts"],
          acceptance: ["Probe check passes."],
          forbidden: [],
          gates: [],
        },
        "ready-review": {
          id: "ready-review",
          parent_id: "project",
          status: "ready",
          kind: "parent_review",
          children: [],
          goal: "Another independent review can run in parallel.",
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
    const result = await execute(context({
      projectDir,
      maxConcurrent: 3,
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should dispatch task execution events instead of running workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["ready-domain-task", "ready-review"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-review"].status).toBe("active");
    expect(updated.tasks["ready-domain-task"].status).toBe("active");
    expect(updated.tasks["ready-review"].status).toBe("active");
  });

  test("wakes worker pickup when an active review has only independent ready review work", async () => {
    const projectDir = await makeProject();
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
          children: ["active-review", "ready-review"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "active-review": {
          id: "active-review",
          parent_id: "project",
          status: "active",
          kind: "rework_review",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          children: [],
          goal: "Review a UI branch.",
          conflict_scope: ["ui:feature-shell"],
          inputs: [],
          outputs: ["evidence/archive/ui-review.md"],
          acceptance: ["Review done."],
          forbidden: [],
          gates: [],
        },
        "ready-review": {
          id: "ready-review",
          parent_id: "project",
          status: "ready",
          kind: "parent_review",
          children: [],
          goal: "Review an independent branch.",
          conflict_scope: ["ui:feature-actions"],
          inputs: [],
          outputs: ["evidence/archive/action-review.md"],
          acceptance: ["Review done."],
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
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should dispatch task execution events instead of running workers inline");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["ready-review"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-review"].status).toBe("active");
    expect(updated.tasks["ready-review"].status).toBe("active");
  });

  test("recovers a fresh active lease when its latest worker session is stale with zero operations", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    const db = new Database(stateDbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        projectId text,
        status text,
        startedAt integer,
        opCount integer,
        task text
      )
    `);
    db.query(`
      insert into sessions (sessionId, projectId, status, startedAt, opCount, task)
      values (?, ?, ?, ?, ?, ?)
    `).run(
      "stale-zero-op",
      "aks-rp-e2e",
      "running",
      Date.now() - 5 * 60_000,
      0,
      "You are executing one leaf task.\n\n## Task\nid: stuck-task\ngoal: Recover me.",
    );
    db.close();

    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "stuck-task",
      active_task_ids: ["stuck-task"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["stuck-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "stuck-task": {
          id: "stuck-task",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
          children: [],
          goal: "Recover a leased task whose worker never started.",
          conflict_scope: ["evidence/archive/stuck.md"],
          inputs: [],
          outputs: ["evidence/archive/stuck.md"],
          acceptance: ["Evidence exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const emitted: Array<Record<string, unknown>> = [];
    const result = await execute(context({
      projectDir,
      stateDbPath,
      staleMs: 300_000,
      zeroOpStaleMs: 60_000,
      maxConcurrent: 1,
      dispatched,
      emitted,
      runAgent: async () => {
        throw new Error("watchdog should recover the abandoned lease through worker pickup");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(emitted.some(event => event.type === "session.cancel.requested" && event.sessionId === "stale-zero-op")).toBe(true);
    expect(dispatched.some(event => event.type === "task.requeued" && event.payload.reason === "zero-op-worker-session-abandoned")).toBe(true);
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["stuck-task"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["stuck-task"].status).toBe("active");
    expect(updated.tasks["stuck-task"].lease_expires_at).toBeTruthy();
    expect(updated.active_task_ids).toEqual(["stuck-task"]);
  });

  test("recovers an active lease that has no matching running worker session", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    const db = new Database(stateDbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        projectId text,
        status text,
        startedAt integer,
        opCount integer,
        task text
      )
    `);
    db.close();

    const tree = {
      version: 1,
      project: "aks-rp-e2e",
      updated_at: new Date().toISOString(),
      project_lifecycle: "active",
      root_task_id: "project",
      active_task_id: "phantom-task",
      active_task_ids: ["phantom-task"],
      tasks: {
        project: {
          id: "project",
          parent_id: null,
          status: "decomposed",
          children: ["phantom-task", "ready-task"],
          goal: "Root.",
          inputs: [],
          outputs: [".app/tasks/tree.json"],
          acceptance: ["Done."],
          forbidden: [],
          gates: [],
        },
        "phantom-task": {
          id: "phantom-task",
          parent_id: "project",
          status: "active",
          claimed_by: "aks-explorer",
          lease_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
          children: [],
          goal: "Recover active lease whose execution event never produced a running session.",
          conflict_scope: ["evidence/archive/phantom.md"],
          inputs: [],
          outputs: ["evidence/archive/phantom.md"],
          acceptance: ["Evidence exists."],
          forbidden: [],
          gates: [],
        },
        "ready-task": {
          id: "ready-task",
          parent_id: "project",
          status: "ready",
          children: [],
          goal: "Independent ready work.",
          conflict_scope: ["evidence/archive/ready.md"],
          inputs: [],
          outputs: ["evidence/archive/ready.md"],
          acceptance: ["Ready evidence exists."],
          forbidden: [],
          gates: [],
        },
      },
    };
    await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({
      projectDir,
      stateDbPath,
      noSessionStaleMs: 60_000,
      maxConcurrent: 2,
      dispatched,
      runAgent: async () => {
        throw new Error("watchdog should recover phantom active leases through worker pickup");
      },
    }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog advanced task worker loop");
    expect(dispatched.filter(event => event.type === "task.requeued").map(event => event.payload.taskId))
      .toEqual(["phantom-task"]);
    expect(dispatched.filter(event => event.type === "project.task.execution.requested").map(event => event.payload.taskId))
      .toEqual(["phantom-task", "ready-task"]);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["phantom-task"].status).toBe("active");
    expect(updated.tasks["ready-task"].status).toBe("active");
  });
});
