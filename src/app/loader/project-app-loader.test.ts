import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Cron } from "../cron.ts";
import { EVENT_ROW_ID, EventBus } from "../event-bus.ts";
import { closeDb, getDb } from "../../lib/requests.ts";
import {
  inferProjectAppOwner,
  installProjectApps,
  listProjectAppDirs,
  startProjectAppWatcher,
} from "./project-app-loader.ts";

function tempRoot(): string {
  const root = join(tmpdir(), `project-app-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function writeAgent(appDir: string, dirName: string, name = dirName): void {
  const agentDir = join(appDir, "agents", dirName);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    join(agentDir, "agent.json"),
    JSON.stringify({
      name,
      description: `${name} agent`,
      domain: "test",
      model: "opus",
      tools: [],
    }),
  );
}

function writeApp(appDir: string, body: string): void {
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(appDir, "app.ts"), `export default ${body};\n`);
}

function writeAppModule(appDir: string, source: string): void {
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(appDir, "app.ts"), source);
}

function writeWorkflow(appDir: string, name: string, body: string): void {
  const workflowDir = join(appDir, "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, `${name}.ts`), body);
}

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}

describe("project app loader", () => {
  it("discovers .app projects with app.ts", () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeApp(appDir, "{ id: 'sample' }");

      expect(listProjectAppDirs(projectsRoot)).toEqual([appDir]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("infers a single local app agent as owner", () => {
    const root = tempRoot();
    try {
      const appDir = join(root, "projects", "sample.app");
      writeAgent(appDir, "explorer", "sample-owner");

      expect(inferProjectAppOwner(appDir)).toBe("sample-owner");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses agents/owner when multiple local app agents exist", () => {
    const root = tempRoot();
    try {
      const appDir = join(root, "projects", "sample.app");
      writeAgent(appDir, "worker", "worker-agent");
      writeAgent(appDir, "owner", "owner-agent");

      expect(inferProjectAppOwner(appDir)).toBe("owner-agent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails ambiguous multi-agent apps without a conventional owner directory", () => {
    const root = tempRoot();
    try {
      const appDir = join(root, "projects", "sample.app");
      writeAgent(appDir, "alpha");
      writeAgent(appDir, "beta");

      expect(() => inferProjectAppOwner(appDir)).toThrow("no agents/owner or agents/project-owner");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses declared owner and workspace localPath for sibling project apps", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample-lib.app");
      const domainDir = join(projectsRoot, "sample-lib");
      mkdirSync(domainDir, { recursive: true });
      writeApp(
        appDir,
        `{
        id: "sample-lib",
        owner: "scout",
        workspace: { localPath: "../sample-lib" }
      }`,
      );

      const bus = new EventBus();
      const result = await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: (name: string) => name === "scout" } as any,
        bus,
        agentCrons: new Map(),
      });

      expect(result.installed.map((app) => `${app.id}:${app.owner}:${app.projectDir}`)).toEqual([
        `sample-lib:scout:${domainDir}`,
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exposes explicit workspace and app path helpers", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample-lib.app");
      const domainDir = join(projectsRoot, "sample-lib");
      mkdirSync(domainDir, { recursive: true });
      writeApp(
        appDir,
        `{
          id: "sample-lib",
          owner: "scout",
          workspace: { localPath: "../sample-lib" },
          events: ["project.path.check", "project.path.observed"],
          async onEvent(ctx, event) {
            if (event.type === "project.path.check") {
              return ctx.emit({
                type: "project.path.observed",
                target: { project: "sample-lib" },
                data: {
                  workspacePath: ctx.workspacePath("src/index.ts"),
                  workspaceCwd: ctx.workspaceCwd(),
                  appPath: ctx.appPath("tasks/tree.json")
                }
              });
            }
            if (event.type === "project.path.observed") return ctx.noop("observed");
          }
        }`,
      );

      const observed: Array<Record<string, unknown>> = [];
      const bus = new EventBus();
      bus.subscribe((event) => observed.push(event as unknown as Record<string, unknown>), { priority: "first" });
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: (name: string) => name === "scout" } as any,
        bus,
        agentCrons: new Map(),
      });
      bus.emit({
        type: "project.path.check",
        source: "test",
        owner: "agent:scout",
        target: { project: "sample-lib" },
        data: {},
      } as any);
      await waitForMicrotasks();
      await waitForMicrotasks();

      const pathEvent = observed.find((event) => event.type === "project.path.observed") as any;
      expect(pathEvent.data).toMatchObject({
        workspacePath: join(domainDir, "src/index.ts"),
        workspaceCwd: domainDir,
        appPath: join(appDir, "tasks/tree.json"),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("syncs the runtime project read model from project.json", async () => {
    const root = tempRoot();
    const persistDir = join(root, ".state");
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeApp(
        appDir,
        `{
        id: "sample",
        owner: "old-owner"
      }`,
      );
      writeFileSync(
        join(appDir, "project.json"),
        JSON.stringify({
          id: "sample.app",
          owner: "tech-lead",
          status: "active",
          type: "project-app",
          priority: "P0",
        }),
      );

      const db = getDb(persistDir);
      db.run(
        "INSERT INTO projects (id, path, name, owner, status, type, priority, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sample.app", "projects/sample.app", "sample.app", "may", "active", "project-app", "P1", 1],
      );

      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        persistDir,
        manager: { hasAgent: (name: string) => name === "old-owner" } as any,
        bus: new EventBus(),
        agentCrons: new Map(),
      });

      const row = db
        .prepare("SELECT id, path, name, owner, status, type, priority FROM projects WHERE id = ?")
        .get("sample.app") as Record<string, unknown>;
      expect(row).toMatchObject({
        id: "sample.app",
        path: "projects/sample.app",
        name: "sample.app",
        owner: "tech-lead",
        status: "active",
        type: "project-app",
        priority: "P0",
      });
    } finally {
      closeDb(persistDir);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not route undeclared project-scoped events", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        async onEvent() { return undefined; }
      }`,
      );

      const calls: Array<{ agent: string; task: string; opts: Record<string, unknown> | undefined }> = [];
      const bus = new EventBus();
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: {
          hasAgent: (name: string) => name === "sample-owner",
          runAgent: (agent: string, task: string, opts?: Record<string, unknown>) => {
            calls.push({ agent, task, opts });
            return "sess_1";
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "project.unhandled",
        source: "test",
        owner: "human:test",
        data: { project: "sample", note: "needs owner" },
      } as any);
      await waitForMicrotasks();

      expect(calls).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("routes explicitly subscribed metric feedback through the bounded adapter", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        events: ["metric.breach", "project.owner.requested"],
        async onEvent(ctx, event) {
          if (event.type === "metric.breach") {
            return ctx.emit({
              type: "project.owner.requested",
              project: "sample",
              reason: "metric-breach",
              params: { metricId: event.metricId, alertId: event.alertId }
            });
          }
          if (event.type === "project.owner.requested") return ctx.noop("owner wake handled");
          return undefined;
        }
      }`,
      );

      const observed: Array<Record<string, unknown>> = [];
      const bus = new EventBus();
      bus.subscribe((event) => observed.push(event as unknown as Record<string, unknown>), { priority: "first" });
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: (name: string) => name === "sample-owner" } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "metric.breach",
        source: "test",
        owner: "agent:sample-owner",
        data: {
          metricId: "sample.task.no-work",
          project: "sample",
          alertId: 7,
          current: 1,
          threshold: 0,
          priority: "P1",
        },
      } as any);
      await waitForMicrotasks();
      await waitForMicrotasks();

      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "metric.feedback.routed",
          owner: "agent:sample-owner",
          data: expect.objectContaining({
            metricId: "sample.task.no-work",
            alertId: 7,
            project: "sample",
            appId: "sample",
            route: "owner-app",
            eventType: "metric.breach",
          }),
        }),
      );
      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          owner: "agent:sample-owner",
          data: expect.objectContaining({
            project: "sample",
            reason: "metric-breach",
            params: { metricId: "sample.task.no-work", alertId: 7 },
          }),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs an explicitly subscribed bounded adapter without starting a session", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        events: ["project.unhandled"],
        onEvent(ctx) { return ctx.noop("handled"); }
      }`,
      );

      const calls: string[] = [];
      const bus = new EventBus();
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: {
          hasAgent: () => true,
          runAgent: (agent: string) => calls.push(agent),
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "project.unhandled",
        source: "test",
        owner: "human:test",
        data: { project: "sample" },
      } as any);
      await waitForMicrotasks();

      expect(calls).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves scheduled event action on the envelope", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "pulse",
          enabled: true,
          intervalMs: 60000,
          emits: [{
            type: "project.task.tick",
            target: { project: "sample", taskId: "loop-a" },
            action: "known-loop",
            data: { project: "sample", reason: "test-pulse" }
          }]
        }],
        actions: {}
      }`,
      );

      const events: any[] = [];
      const bus = new EventBus();
      bus.subscribe((event) => {
        if (event.type === "project.task.tick") events.push(event);
      });
      const agentCrons = new Map<string, Cron>();
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: () => true } as any,
        bus,
        agentCrons,
      });

      const cron = agentCrons.get("sample-owner")!;
      cron.triggerNow("sample-schedule-pulse", { force: true });
      await waitUntil(() => events.length === 1);

      expect(events[0]).toMatchObject({
        type: "project.task.tick",
        owner: "project:sample",
        target: { project: "sample", taskId: "loop-a" },
        action: "known-loop",
        data: { project: "sample", reason: "test-pulse" },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reconciles task routes through workflows and falls back to the owner entry", async () => {
    const root = tempRoot();
    const persistDir = join(root, ".state");
    let cron: Cron | undefined;
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      mkdirSync(join(appDir, "tasks"), { recursive: true });
      writeFileSync(
        join(appDir, "tasks", "seed.json"),
        JSON.stringify({
          root_task_id: "root",
          tasks: {
            root: { id: "root", state: "backlog", children: ["operations"], owner: "sample-owner" },
            operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
          },
        }),
      );
      writeApp(
        appDir,
        `{
          id: "sample",
          owner: "sample-owner",
          budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 2 },
          ownerEntry: {
            workflow: "owner-entry",
            agent: "sample-owner",
            task: "Handle task exception",
            timeoutMs: 60000,
            context: []
          },
          taskWorkflows: {
            known: {
              workflow: "worker",
              agent: "sample-owner",
              task: "Perform known work",
              timeoutMs: 60000,
              context: []
            }
          },
          taskRoutes: [{
            name: "sample-task-route",
            enabled: true,
            maxConcurrentTriggers: 2,
            description: "Resolve sample work into tasks",
            accepts: ["project.work"],
            resolve(event) {
              return {
                id: "work/" + event.itemId,
                parentId: "operations",
                outcome: "Process " + event.itemId,
                acceptance: ["Workflow completed"],
                mode: "achieve",
                ...(event.ownerOnly ? {} : { workflow: event.useMissing ? "missing" : "known" }),
                input: { itemId: event.itemId, eventId: event.eventId }
              };
            }
          }]
        }`,
      );
      writeWorkflow(
        appDir,
        "worker",
        `export const name = "worker";
export const description = "Perform known sample work";
export async function execute(ctx: any) {
  ctx.dispatchEvent("test.task.workflow", { task: ctx.task });
  if (ctx.task.includes('"itemId": "waiting"') && ctx.task.includes('"type": "project.work"')) {
    return ctx.done("waiting for dependency", {
      disposition: "waiting",
      summary: "waiting for dependency",
      evidence: ["dependency is not done"],
      actions: [],
      conditions: [{
        id: "task-done:dependency/waiting",
        observer: "project.dependency.ready",
        taskId: "dependency/waiting",
        expectedState: "done"
      }]
    });
  }
  return ctx.done("known workflow converged");
}
`,
      );
      writeWorkflow(
        appDir,
        "owner-entry",
        `export const name = "owner-entry";
export const description = "Handle sample task exceptions";
export async function execute(ctx: any) {
  ctx.dispatchEvent("test.task.owner", { task: ctx.task });
  if (ctx.task.includes('"itemId": "action"')) {
    return ctx.done("owner proposed child task", {
      disposition: "converged",
      summary: "owner proposed child task",
      evidence: ["owner reviewed the task packet"],
      actions: [{
        kind: "create-task",
        id: "owner-created-child",
        parentId: "operations",
        goal: "Apply owner proposal through the reconciler",
        outputs: ["proof.md"],
        acceptance: ["Child is applied atomically"]
      }]
    });
  }
  return ctx.done("owner handled fallback");
}
`,
      );

      const events: any[] = [];
      const bus = new EventBus();
      bus.subscribe((event) => events.push(event));
      const agentCrons = new Map<string, Cron>();
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        persistDir,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        manager: {
          hasAgent: () => true,
          runAgent: () => {
            throw new Error("raw owner fallback must not bypass ownerEntry");
          },
        } as any,
        bus,
        agentCrons,
      });

      cron = agentCrons.get("sample-owner")!;
      expect(cron.getEventSubscriptions()).toMatchObject({
        "project.work": ["sample-task-route"],
      });
      cron.subscribeToBus(bus);
      cron.start();

      const knownTrigger = {
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "known" },
      } as any;
      Object.defineProperty(knownTrigger, EVENT_ROW_ID, { value: 73 });
      bus.emit(knownTrigger);
      await waitUntil(
        () =>
          events.some(
            (event) =>
              event.type === "project.task.reconciled" &&
              event.data?.taskId === "work/known" &&
              event.data?.disposition === "converged",
          ),
        3_000,
      ).catch((error) => {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}; observed=${JSON.stringify(
            events.map((event) => ({ type: event.type, data: event.data })),
          )}`,
        );
      });
      expect(events.find((event) => event.type === "test.task.workflow")?.data?.task).toContain('"eventId": 73');

      const knownWorkflowRuns = events.filter((event) => event.type === "test.task.workflow").length;
      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "known", redelivery: true },
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconcile.skipped" &&
            event.data?.taskId === "work/known" &&
            event.data?.reason === "already-completed",
        ),
      );
      expect(events.filter((event) => event.type === "test.task.workflow")).toHaveLength(knownWorkflowRuns);

      const waitingTrigger = {
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "waiting" },
      } as any;
      Object.defineProperty(waitingTrigger, EVENT_ROW_ID, { value: 74 });
      bus.emit(waitingTrigger);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/waiting" &&
            event.data?.disposition === "waiting",
        ),
      );
      expect(
        JSON.parse(readFileSync(join(appDir, ".state", "tasks", "tree.json"), "utf8")).tasks["work/waiting"].trace
          .reconciliation.trigger.eventId,
      ).toBe(74);
      const waitingWorkflowRuns = events.filter((event) => event.type === "test.task.workflow").length;

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "waiting", redelivery: true },
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconcile.skipped" &&
            event.data?.taskId === "work/waiting" &&
            event.data?.reason === "conditions-open",
        ),
      );
      expect(events.filter((event) => event.type === "test.task.workflow")).toHaveLength(waitingWorkflowRuns);

      bus.emit({
        type: "project.dependency.ready",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", taskId: "dependency/other", state: "done" },
      } as any);
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(events.filter((event) => event.type === "test.task.workflow")).toHaveLength(waitingWorkflowRuns);

      bus.emit({
        type: "project.dependency.ready",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", taskId: "dependency/waiting", state: "done" },
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/waiting" &&
            event.data?.disposition === "converged" &&
            event.data?.handler === "workflow:known",
        ),
      );
      const resumedWorkflowRuns = events.filter((event) => event.type === "test.task.workflow").length;

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "action", ownerOnly: true },
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/action" &&
            event.data?.disposition === "converged" &&
            event.data?.actionsApplied?.includes("created owner-created-child"),
        ),
      );
      expect(events.filter((event) => event.type === "test.task.workflow")).toHaveLength(resumedWorkflowRuns);

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "owner", ownerOnly: true },
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner" &&
            event.data?.handler === "owner:sample-owner" &&
            event.data?.disposition === "converged",
        ),
      );

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample", itemId: "fallback", useMissing: true },
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/fallback" &&
            event.data?.handler === "owner:sample-owner" &&
            event.data?.disposition === "converged",
        ),
      );

      expect(events.some((event) => event.type === "test.task.workflow")).toBe(true);
      expect(events.some((event) => event.type === "test.task.owner")).toBe(true);
      expect(
        events.some(
          (event) => event.type === "project.task.handler.unavailable" && event.data?.taskId === "work/fallback",
        ),
      ).toBe(true);
      const tree = JSON.parse(readFileSync(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(tree.tasks["work/known"]).toBeUndefined();
      expect(tree.tasks["work/owner"]).toBeUndefined();
      expect(tree.tasks["work/fallback"]).toBeUndefined();
      expect(tree.tasks["work/waiting"]).toBeUndefined();
      expect(tree.tasks["owner-created-child"]).toMatchObject({
        state: "backlog",
        owner: "sample-owner",
      });
      expect(tree.completions["work/known"].handler).toBe("workflow:known");
      expect(tree.completions["work/owner"].handler).toBe("owner:sample-owner");
      expect(tree.completions["work/fallback"].handler).toBe("owner:sample-owner");
      expect(tree.completions["work/waiting"].handler).toBe("workflow:known");
      expect(tree.conditions["task-done:dependency/waiting"]).toMatchObject({
        status: "resolved",
        waitingTaskId: "work/waiting",
      });
      expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("work/known");
    } finally {
      cron?.stop();
      closeDb(persistDir);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes stale project app schedules on reload", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "wake",
          enabled: true,
          intervalMs: 60000,
          emits: [{ type: "project.owner.requested", project: "sample" }]
        }]
      }`,
      );

      const bus = new EventBus();
      const agentCrons = new Map<string, Cron>();
      const manager = { hasAgent: () => true } as any;

      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });
      expect(
        agentCrons
          .get("sample-owner")!
          .getEntries()
          .map((entry) => entry.name),
      ).toEqual(["sample-schedule-wake"]);

      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "review",
          enabled: true,
          intervalMs: 60000,
          emits: [{ type: "project.watchdog.tick", project: "sample" }]
        }]
      }`,
      );
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });

      expect(
        agentCrons
          .get("sample-owner")!
          .getEntries()
          .map((entry) => entry.name),
      ).toEqual(["sample-schedule-review"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves project app schedule envelope metadata", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "urgent-review",
          enabled: true,
          intervalMs: 60000,
          emits: [{
            type: "project.owner.requested",
            target: { project: "sample", taskId: "review-task" },
            data: { reason: "urgent-review" },
            urgency: "high",
            ttlMs: 5000
          }]
        }]
      }`,
      );

      const observed: Array<Record<string, unknown>> = [];
      const bus = new EventBus();
      bus.subscribe((event) => observed.push(event as unknown as Record<string, unknown>), { priority: "first" });
      const agentCrons = new Map<string, Cron>();

      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: () => true } as any,
        bus,
        agentCrons,
      });

      expect(agentCrons.get("sample-owner")!.triggerNow("sample-schedule-urgent-review", { force: true })).toBe(true);
      await waitUntil(() => observed.some((event) => event.type === "project.owner.requested"));

      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          owner: "project:sample",
          urgency: "high",
          ttl_ms: 5000,
          target: { project: "sample", taskId: "review-task" },
          data: expect.objectContaining({
            project: "sample",
            taskId: "review-task",
            task_id: "review-task",
            reason: "urgent-review",
          }),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits every event declared by a project app schedule emits list", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "multi",
          enabled: true,
          intervalMs: 60000,
          emits: [
            { type: "project.tick", target: { project: "sample" }, data: { lane: "learning" } },
            { type: "project.watchdog.tick", target: { project: "sample" } }
          ]
        }]
      }`,
      );

      const observed: Array<Record<string, unknown>> = [];
      const bus = new EventBus();
      bus.subscribe((event) => observed.push(event as unknown as Record<string, unknown>), { priority: "first" });
      const agentCrons = new Map<string, Cron>();

      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: () => true } as any,
        bus,
        agentCrons,
      });

      expect(agentCrons.get("sample-owner")!.triggerNow("sample-schedule-multi", { force: true })).toBe(true);
      await waitUntil(
        () => observed.filter((event) => event.source === "project-app:sample:schedule:multi").length === 2,
      );

      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "project.tick",
          target: { project: "sample" },
          data: expect.objectContaining({ project: "sample", lane: "learning" }),
        }),
      );
      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "project.watchdog.tick",
          target: { project: "sample" },
          data: expect.objectContaining({ project: "sample" }),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not resolve project app schedule handlers as files after cron has started", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: []
      }`,
      );

      const bus = new EventBus();
      const agentCrons = new Map<string, Cron>();
      const manager = { hasAgent: () => true } as any;

      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });

      const cron = agentCrons.get("sample-owner")!;
      let resolverCalls = 0;
      cron.setHandlerResolver(async () => {
        resolverCalls++;
        return false;
      });
      cron.start();

      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "review",
          enabled: true,
          intervalMs: 60000,
          emits: [{ type: "project.focus.review.requested", project: "sample" }]
        }]
      }`,
      );
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });

      expect(resolverCalls).toBe(0);
      expect(cron.hasHandler("sample-schedule-review")).toBe(true);
      expect(cron.getEntries().map((entry) => entry.name)).toEqual(["sample-schedule-review"]);
      cron.stop();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("auto-reloads project app manifests when the watcher sees app.ts change", async () => {
    const root = tempRoot();
    let watcher: ReturnType<typeof startProjectAppWatcher> | undefined;
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "worker-v1",
          enabled: true,
          intervalMs: 60000,
          emits: [{ type: "project.work", target: { project: "sample" } }]
        }]
      }`,
      );

      const bus = new EventBus();
      const agentCrons = new Map<string, Cron>();
      const manager = { hasAgent: () => true } as any;
      const opts = {
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      };

      await installProjectApps(opts);
      watcher = startProjectAppWatcher(opts, { intervalMs: 60_000 });

      writeApp(
        appDir,
        `{
        id: "sample",
        schedules: [{
          id: "worker-v2",
          enabled: true,
          intervalMs: 60000,
          emits: [{ type: "project.work", target: { project: "sample" } }]
        }]
      }`,
      );

      expect(await watcher.scanNow()).toBe(true);
      expect(
        agentCrons
          .get("sample-owner")!
          .getEntries()
          .map((entry) => entry.name),
      ).toEqual(["sample-schedule-worker-v2"]);
    } finally {
      watcher?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("auto-reloads project app manifests when a local agent config changes", async () => {
    const root = tempRoot();
    let watcher: ReturnType<typeof startProjectAppWatcher> | undefined;
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeAgent(appDir, "ops", "sample-ops");
      writeApp(
        appDir,
        `{
        id: "sample",
        taskWorkflows: {
          worker: {
            workflow: "worker",
            agent: "sample-ops",
            task: "work",
            timeoutMs: 60000,
            context: []
          }
        }
      }`,
      );

      const bus = new EventBus();
      const agentCrons = new Map<string, Cron>();
      const manager = { hasAgent: () => true } as any;
      const opts = {
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      };

      await installProjectApps(opts);
      watcher = startProjectAppWatcher(opts, { intervalMs: 60_000 });

      writeFileSync(
        join(appDir, "agents", "ops", "agent.json"),
        JSON.stringify({
          name: "sample-ops",
          description: "updated ops agent",
          domain: "test",
          model: "opus",
          tools: [],
        }),
      );

      expect(await watcher.scanNow()).toBe(true);
    } finally {
      watcher?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
