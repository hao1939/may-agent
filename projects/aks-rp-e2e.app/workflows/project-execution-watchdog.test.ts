import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./project-execution-watchdog.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-watchdog-"));
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, "project.json"), `${JSON.stringify({
    id: "test-project",
    owner: "aks-explorer",
    status: "active",
    goal: "Test Project",
  }, null, 2)}\n`, "utf8");
  await writeFile(join(dir, "journal.jsonl"), "", "utf8");
  return dir;
}

function task(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    parent_id: id === "project" ? null : "project",
    status,
    children: [],
    goal: `${id} goal.`,
    inputs: [],
    outputs: [`evidence/archive/${id}.md`],
    acceptance: ["Done."],
    forbidden: [],
    gates: [],
    ...extra,
  };
}

async function writeTree(projectDir: string, tasks: Record<string, Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  const tree = {
    version: 1,
    project: "aks-rp-e2e",
    project_lifecycle: "active",
    root_task_id: "project",
    updated_at: new Date().toISOString(),
    active_task_id: null,
    active_task_ids: [],
    tasks: {
      project: {
        ...task("project", "decomposed", { outputs: ["tasks/tree.json"] }),
        children: Object.keys(tasks),
      },
      ...tasks,
    },
    ...extra,
  };
  await writeFile(join(projectDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");
}

function writeSession(dbPath: string, sessionId: string, status: string) {
  const db = new Database(dbPath);
  db.exec("create table sessions (sessionId text primary key, status text)");
  db.query("insert into sessions values (?, ?)").run(sessionId, status);
  db.close();
}

function context(input: {
  projectDir: string;
  stateDbPath?: string;
  maxConcurrent?: number;
  dispatched?: Array<{ type: string; payload: Record<string, unknown> }>;
}) {
  return {
    task: [
      `app: ${input.projectDir}`,
      `project: ${input.projectDir}`,
      `stateDb: ${input.stateDbPath ?? join(input.projectDir, "missing.db")}`,
      "maxAttempts: 2",
      `maxConcurrent: ${input.maxConcurrent ?? 3}`,
    ].join("\n"),
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      input.dispatched?.push({ type, payload });
    },
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: (result: { lastAssistantText?: string }) => result.lastAssistantText ?? "",
  } as any;
}

describe("project execution watchdog", () => {
  test("skips when the task tree does not exist", async () => {
    const projectDir = await makeProject();
    const result = await execute(context({ projectDir }));

    expect(result).toEqual({
      status: "done",
      message: "Watchdog skipped: task tree does not exist yet.",
    });
  });

  test("wakes worker pickup when ready leaves exist", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "ready-task": task("ready-task", "ready"),
    });

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog ran worker for 1 ready task(s): ready-task");
    expect(dispatched.some(event => event.type === "project.task.execution.requested" && event.payload.taskId === "ready-task")).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["ready-task"].status).toBe("active");
  });

  test("restarts an active leaf whose runtime session is no longer running", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_done", "done");
    await writeTree(projectDir, {
      "active-task": task("active-task", "active", {
        session_id: "s_done",
        claimed_by: "aks-explorer",
        lease_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    }, {
      active_task_id: "active-task",
      active_task_ids: ["active-task"],
    });

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({ projectDir, stateDbPath, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain("Watchdog ran worker for 1 ready task(s): active-task");
    expect(dispatched.some(event => event.type === "project.task.execution.requested" && event.payload.taskId === "active-task")).toBe(true);

    const updated = JSON.parse(await readFile(join(projectDir, "tasks", "tree.json"), "utf8"));
    expect(updated.tasks["active-task"].status).toBe("active");
    expect(updated.tasks["active-task"].claimed_by).toBe("aks-explorer");
  });

  test("leaves a running active leaf alone", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_running", "running");
    await writeTree(projectDir, {
      "active-task": task("active-task", "active", {
        session_id: "s_running",
        claimed_by: "aks-explorer",
        lease_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    }, {
      active_task_id: "active-task",
      active_task_ids: ["active-task"],
    });

    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const result = await execute(context({ projectDir, stateDbPath, dispatched }));

    expect(result).toEqual({
      status: "done",
      message: "Watchdog skipped: 1 active task(s) still have running attempts.",
    });
    expect(dispatched).toHaveLength(0);
  });
});
