import { describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cron } from "../cron";
import { EventBus } from "../event-bus";
import { closeDb } from "../../lib/requests";
import {
  inferProjectAppOwner,
  installProjectApps,
  listProjectAppDirs,
  normalizeTaskHandlerResult,
  projectAppHostFingerprint,
} from "./project-app-loader";

function fixture() {
  const root = join(tmpdir(), `project-app-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const projectsRoot = join(root, "projects");
  const appDir = join(projectsRoot, "sample.app");
  const persistDir = join(root, ".state");
  mkdirSync(join(appDir, "agents", "owner"), { recursive: true });
  writeFileSync(
    join(appDir, "agents", "owner", "agent.json"),
    JSON.stringify({ name: "sample-owner", description: "owner", model: "test", tools: [] }),
  );
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "root",
      tasks: {
        root: { id: "root", state: "backlog", owner: "sample-owner", children: ["operations"] },
        operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
      },
    }),
  );
  return { root, projectsRoot, appDir, persistDir };
}

function writeApp(appDir: string, extra = "") {
  writeFileSync(
    join(appDir, "app.ts"),
    `export default {
      id: "sample",
      version: 1,
      owner: "sample-owner",
      description: "sample",
      workspace: { kind: "local", localPath: "." },
      budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 2 },
      schedules: [{ id: "pulse", enabled: true, intervalMs: 60000, emits: [{ type: "sample.work", project: "sample", itemId: "scheduled" }] }],
      tasks: {
        accepts: [{ type: "sample.work", project: "sample" }],
        resolve(event) {
          return {
            id: "work/" + event.itemId,
            parentId: "operations",
            outcome: "Process " + event.itemId,
            acceptance: ["Work converges"],
            mode: "achieve",
            ...(event.ownerOnly ? {} : { workflow: "worker" }),
            input: { itemId: event.itemId }
          };
        }
      },
      events: [{ type: "sample.note", project: "sample" }],
      actions: {
        run: { type: "async", description: "run work", event(params) { return { type: "sample.work", project: "sample", ...params }; } }
      },
      onEvent(ctx, event) { if (event.type === "sample.note") return ctx.noop("seen"); },
      ${extra}
    };\n`,
  );
  mkdirSync(join(appDir, "agents", "owner", "workflows"), { recursive: true });
  writeFileSync(
    join(appDir, "agents", "owner", "workflows", "worker.ts"),
    `export const name = "worker";
     export const description = "sample worker";
     export async function execute(ctx) {
       if (!ctx.task.includes("app: ${appDir}") || !ctx.task.includes("project: ${appDir}")) {
         return ctx.blocked("canonical app/workspace paths are missing");
       }
       return ctx.done("done", { state: "converged", summary: "workflow done", evidence: ["proof"], actions: [] });
     }`,
  );
}

function manager(ownerCalls: string[], ownerOptions: Array<Record<string, unknown>> = []) {
  return {
    hasAgent: () => true,
    async callAgent(_agent: string, task: string, options: Record<string, unknown>) {
      ownerCalls.push(task);
      ownerOptions.push(options);
      return {
        sessionId: "owner-session",
        status: "done",
        structuredResult: { state: "converged", summary: "owner done", evidence: ["owner proof"], actions: [] },
        lastAssistantText: "owner done",
        messages: [],
        duration: "0s",
        outputDir: "",
      };
    },
  } as any;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}

describe("project app loader handler result normalization", () => {
  it("preserves exact valid Conditions", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "waiting",
          summary: "wait for session terminal event",
          evidence: ["owner named the external wait"],
          actions: [],
          conditions: [
            {
              id: "session-terminal-s_1",
              type: "event-observed",
              subject: "session:s_1",
              expected: { status: "done" },
              owner: "agent:evaluator",
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "waiting",
      conditions: [
        {
          id: "session-terminal-s_1",
          type: "event-observed",
          subject: "session:s_1",
          expected: { status: "done" },
          owner: "agent:evaluator",
        },
      ],
    });
  });

  it("rejects malformed Conditions instead of absorbing unfinished work", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "waiting",
          summary: "malformed wait",
          evidence: ["condition identity was blank"],
          actions: [],
          conditions: [
            {
              id: "",
              type: "event-observed",
              subject: "session:s_1",
              expected: { status: "done" },
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "failed",
      summary: "Workflow returned an invalid Condition at conditions[0]",
      actions: [],
    });
  });

  it("rejects waiting without an exact Condition", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "waiting",
          summary: "wait later",
          evidence: [],
          actions: [],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "failed",
      summary: "Workflow returned waiting without an exact Condition",
      actions: [],
    });
  });

  it("rejects the removed progressing result state", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "progressing",
          summary: "standing monitor observed unchanged work",
          evidence: ["no task-tree mutation is needed"],
          actions: [],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "failed",
      summary: "Workflow returned an invalid task handler result envelope",
      actions: [],
    });
  });

  it("rejects owner-style prose action names instead of applying them", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "converged",
          summary: "dispatch an existing review task",
          evidence: ["owner inspected the stalled review queue"],
          actions: [
            {
              type: "task.dispatch-existing-review",
              taskId: "domain/wait-ado-run-123",
              reason: "fallback passed",
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "failed",
      summary:
        "Workflow returned an invalid task action: actions[0].kind must be one of create-task, update-task, close-task, unblock-task",
      actions: [],
    });
  });

  it("rejects project as a fake workflow name", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "converged",
          summary: "create owner-handled domain work",
          evidence: ["owner named the exact next task"],
          actions: [
            {
              kind: "create-task",
              id: "domain/fix-one-spec",
              parentId: "domain/root",
              goal: "Fix one spec",
              mode: "achieve",
              outputs: ["evidence/archive/fix-one-spec.json"],
              acceptance: ["The exact spec has a live pass or exact blocker."],
              owner: "aks-explorer",
              workflow: "project",
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "failed",
      summary:
        "Workflow returned an invalid task action: actions[0].workflow must name a real workflow; omit workflow for owner-handled project work",
      actions: [],
    });
  });

  it("accepts the supported task action shape", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "converged",
          summary: "create bounded follow-up",
          evidence: ["owner named the exact next task"],
          actions: [
            {
              kind: "create-task",
              id: "domain/fix-one-spec",
              parentId: "domain/root",
              goal: "Fix one spec",
              mode: "achieve",
              outputs: ["evidence/archive/fix-one-spec.json"],
              acceptance: ["The exact spec has a live pass or exact blocker."],
              priority: "P1",
              owner: "aks-explorer",
              workflow: "default-task-worker",
              input: { specId: "spec.example" },
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          id: "domain/fix-one-spec",
        },
      ],
    });
  });
});

describe("project app loader", () => {
  it("loads an owner-only app without creating or attaching task runtime state", async () => {
    const f = fixture();
    try {
      writeFileSync(
        join(f.appDir, "app.ts"),
        `export default {
          id: "sample",
          version: 1,
          owner: "sample-owner",
          description: "direct owner-only app"
        };\n`,
      );
      const result = await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus: new EventBus(),
        agentCrons: new Map(),
      });

      expect(result.installed.map((descriptor) => descriptor.id)).toEqual(["sample"]);
      expect(result.entries).toBe(0);
      expect(existsSync(join(f.appDir, ".state", "tasks"))).toBe(false);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("discovers app directories and infers the conventional owner", () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      expect(listProjectAppDirs(f.projectsRoot)).toEqual([f.appDir]);
      expect(inferProjectAppOwner(f.appDir)).toBe("sample-owner");
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("reloads for lifecycle changes but not ordinary task-state writes", () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const treeDir = join(f.appDir, ".state", "tasks");
      const treePath = join(treeDir, "tree.json");
      mkdirSync(treeDir, { recursive: true });
      writeFileSync(treePath, JSON.stringify({ project_lifecycle: "paused", tasks: {} }));
      const paused = projectAppHostFingerprint(f.projectsRoot);

      writeFileSync(treePath, JSON.stringify({ project_lifecycle: "paused", tasks: { changed: {} } }));
      expect(projectAppHostFingerprint(f.projectsRoot)).toBe(paused);

      writeFileSync(treePath, JSON.stringify({ project_lifecycle: "active", tasks: { changed: {} } }));
      expect(projectAppHostFingerprint(f.projectsRoot)).not.toBe(paused);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("installs no schedules or controller when project lifecycle is paused", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      mkdirSync(join(f.appDir, ".state", "tasks"), { recursive: true });
      writeFileSync(
        join(f.appDir, ".state", "tasks", "tree.json"),
        JSON.stringify({
          project_lifecycle: "paused",
          root_task_id: "root",
          tasks: {
            root: { id: "root", state: "backlog", children: ["operations"] },
            operations: { id: "operations", parent_id: "root", state: "backlog", children: ["work/orphan"] },
            "work/orphan": {
              id: "work/orphan",
              parent_id: "operations",
              state: "active",
              owner: "sample-owner",
              revision: 1,
              goal: "Process orphan",
              acceptance: ["Work converges"],
              children: [],
            },
          },
          active_task_ids: ["work/orphan"],
          active_task_id: "work/orphan",
          resources: {
            "work/orphan": {
              metadata: { id: "work/orphan", generation: 1, resourceVersion: 1 },
              spec: {
                parentId: "operations",
                outcome: "Process orphan",
                acceptance: ["Work converges"],
                mode: "achieve",
                workflow: "worker",
              },
              status: {
                observedGeneration: 0,
                phase: "running",
                currentAttemptId: "r_orphan",
                updatedAt: "2026-07-19T00:00:00.000Z",
              },
            },
          },
          attempts: {
            r_orphan: {
              metadata: { id: "r_orphan", resourceVersion: 1 },
              taskId: "work/orphan",
              taskGeneration: 1,
              specHash: "old",
              owner: "sample-owner",
              handler: "workflow:worker",
              runtimeId: "previous-runtime",
              state: "running",
              startedAt: "2026-07-19T00:00:00.000Z",
            },
          },
        }),
      );
      const crons = new Map<string, Cron>();
      const result = await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        manager: manager([]),
        bus: new EventBus(),
        agentCrons: crons,
      });
      expect(result.entries).toBe(0);
      expect(result.installed[0].reconciliationPaused).toBe(true);
      expect(crons.get("sample-owner")?.getEntries()).toEqual([]);
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(tree.tasks["work/orphan"].state).toBe("backlog");
      expect(tree.resources["work/orphan"].status.phase).toBe("pending");
      expect(tree.active_task_ids).not.toContain("work/orphan");
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("reconciles workflows and owner fallback through one app controller", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    const ownerOptions: Array<Record<string, unknown>> = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager(ownerCalls, ownerOptions),
        bus,
        agentCrons: new Map(),
      });
      bus.emit({ type: "sample.work", project: "sample", itemId: "workflow" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/workflow" &&
            event.data?.disposition === "converged",
        ),
      ).catch((error) => {
        throw new Error(
          `${String(error)} events=${JSON.stringify(events.map((event) => ({ type: event.type, data: event.data })))}`,
        );
      });
      bus.emit({ type: "sample.work", project: "sample", itemId: "owner", ownerOnly: true } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner" &&
            event.data?.disposition === "converged",
        ),
      );
      expect(ownerCalls).toHaveLength(1);
      expect(ownerCalls[0]).toContain("Allowed actions:");
      expect(ownerCalls[0]).toContain('kind: "create-task"');
      expect(ownerCalls[0]).toContain("Do not invent action names");
      expect(ownerCalls[0]).toContain("Do not include an action for the current Reconciliation Task taskId");
      expect(ownerOptions[0]).toMatchObject({
        projectId: "sample",
        recoveryOwner: "project-app-task-reconciler",
        source: "project-app-task-owner",
      });
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(tree.receipts["work/workflow"]).toBeTruthy();
      expect(tree.receipts["work/owner"]).toBeTruthy();
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("installs conventional periodic resync when the app omits an interval", async () => {
    const f = fixture();
    const intervalSpy = spyOn(globalThis, "setInterval");
    try {
      writeApp(f.appDir);
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus: new EventBus(),
        agentCrons: new Map(),
      });
      expect(intervalSpy.mock.calls.some((call) => call[1] === 60_000)).toBe(true);
    } finally {
      intervalSpy.mockRestore();
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("releases previous-runtime active tasks without trigger packets on startup", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      mkdirSync(join(f.appDir, ".state", "tasks"), { recursive: true });
      writeFileSync(
        join(f.appDir, ".state", "tasks", "tree.json"),
        JSON.stringify({
          root_task_id: "root",
          tasks: {
            root: { id: "root", state: "backlog", owner: "sample-owner", children: ["operations"] },
            operations: { id: "operations", parent_id: "root", state: "backlog", children: ["work/orphan"] },
            "work/orphan": {
              id: "work/orphan",
              parent_id: "operations",
              state: "active",
              owner: "sample-owner",
              revision: 1,
              goal: "Process orphan",
              acceptance: ["Work converges"],
              children: [],
            },
          },
          active_task_ids: ["work/orphan"],
          active_task_id: "work/orphan",
          resources: {
            "work/orphan": {
              metadata: { id: "work/orphan", generation: 1, resourceVersion: 1 },
              spec: {
                parentId: "operations",
                outcome: "Process orphan",
                acceptance: ["Work converges"],
                mode: "achieve",
                workflow: "worker",
                input: { itemId: "orphan" },
              },
              status: {
                observedGeneration: 0,
                phase: "running",
                currentAttemptId: "r_orphan",
                updatedAt: "2026-07-19T00:00:00.000Z",
              },
            },
          },
          attempts: {
            r_orphan: {
              metadata: { id: "r_orphan", resourceVersion: 1 },
              taskId: "work/orphan",
              taskGeneration: 1,
              specHash: "old",
              owner: "sample-owner",
              handler: "workflow:worker",
              runtimeId: "previous-runtime",
              state: "running",
              startedAt: "2026-07-19T00:00:00.000Z",
            },
          },
        }),
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(tree.tasks["work/orphan"]).toMatchObject({
        state: "backlog",
        summary:
          "Interrupted reconciliation work/orphan cannot resume because its previous runtime did not persist the trigger packet; retrying from current task evidence",
      });
      expect(tree.resources["work/orphan"].status.phase).toBe("pending");
      expect(tree.resources["work/orphan"].status.currentAttemptId).toBeUndefined();
      expect(tree.active_task_ids).not.toContain("work/orphan");
      expect(events).not.toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          source: "project-app:sample:task-recovery",
        }),
      );
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("translates declared actions directly and keeps schedules in Cron only", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      const crons = new Map<string, Cron>();
      const result = await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        manager: manager([]),
        bus,
        agentCrons: crons,
      });
      expect(result.entries).toBe(1);
      expect(
        crons
          .get("sample-owner")
          ?.getEntries()
          .map((entry) => entry.name),
      ).toEqual(["sample-schedule-pulse"]);
      bus.emit({
        type: "project.action.invoked",
        project: "sample",
        action: "run",
        params: { itemId: "action" },
      } as any);
      await waitUntil(() => events.some((event) => event.type === "project.action.accepted"));
      expect(events.some((event) => event.type === "sample.work" && event.data?.itemId === "action")).toBe(true);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });
});
