import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  taskTreeConfig,
  type TaskAssignment,
} from "./lib/task-tree-tools.ts";
import { execute } from "./task-worker.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-task-worker-"));
  await mkdir(join(dir, ".state"), { recursive: true });
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

function config(projectDir: string) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent: 1,
  });
}

function assignedEvent(assignment: TaskAssignment): Record<string, unknown> {
  return {
    type: "project.task.assigned",
    project: "aks-rp-e2e",
    ...assignment,
  };
}

describe("task worker", () => {
  test("persists a stable session id for spec-runner leaves", async () => {
    const projectDir = await makeProject();
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
              status: "decomposed",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              status: "ready",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let observedSessionId = "";
    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (
        _agent: string,
        _prompt: string,
        sessionId: string,
      ) => {
        observedSessionId = sessionId;
        return { status: "success", message: "RESULT: done" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedSessionId).toBe("s_task_spec-task");

    const updated = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["spec-task"].session_id).toBe("s_task_spec-task");
    expect(updated.tasks["spec-task"].session_history).toContain(
      "s_task_spec-task",
    );
    expect(updated.tasks["spec-task"].status).toBe("review");
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        status: "review",
        attemptId: assignment.attemptId,
        result: "done",
      },
    });
  });

  test("keeps blocked worker results reviewable for the planner", async () => {
    const projectDir = await makeProject();
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
              status: "decomposed",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              status: "ready",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "error" }),
      runAgentSession: async () => ({
        status: "error",
        message: "ARM auth appears hung but no terminal artifact exists",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["spec-task"].status).toBe("review");
    expect(updated.tasks["spec-task"].blocker).toBeUndefined();
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("blocked");
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        status: "review",
        attemptId: assignment.attemptId,
        result: "blocked",
      },
    });
  });

  test("does not treat generic session success as task done", async () => {
    const projectDir = await makeProject();
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
              status: "decomposed",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              status: "ready",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        message: "I inspected the task but did not record a terminal result.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["spec-task"].status).toBe("review");
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("partial");
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        status: "review",
        attemptId: assignment.attemptId,
        result: "partial",
      },
    });
  });
});
