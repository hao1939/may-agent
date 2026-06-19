import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Cron } from "../cron.ts";
import { EventBus } from "../event-bus.ts";
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

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

  it("installs app workflow handlers with inferred owner and project defaults", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker", task: "work" }
        }]
      }`,
      );

      const agentCrons = new Map<string, Cron>();
      const bus = new EventBus();
      const result = await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: (name: string) => name === "sample-owner" } as any,
        bus,
        agentCrons,
      });

      expect(result.installed.map((app) => `${app.id}:${app.owner}`)).toEqual(["sample:sample-owner"]);
      const entries = agentCrons.get("sample-owner")!.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        name: "sample-worker",
        agent: "sample-owner",
        handler: {
          workflow: "worker",
          agent: "sample-owner",
          projectId: "sample",
          task: "work",
        },
      });
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
        workspace: { localPath: "../sample-lib" },
        workflowHandlers: [{
          name: "sample-lib-planner",
          enabled: true,
          on: ["project.owner.requested"],
          handler: { workflow: "planner", task: "plan" }
        }]
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

  it("routes unhandled project-scoped events to the inferred owner", async () => {
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

      expect(calls).toHaveLength(1);
      expect(calls[0]!.agent).toBe("sample-owner");
      expect(calls[0]!.opts?.projectId).toBe("sample");
      expect(calls[0]!.task).toContain("project.unhandled");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("offers metric feedback events to the resolved owner app without explicit metric subscriptions", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
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

  it("falls back to the owner session when metric feedback is not handled by the app", async () => {
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
      const observed: Array<Record<string, unknown>> = [];
      const bus = new EventBus();
      bus.subscribe((event) => observed.push(event as unknown as Record<string, unknown>), { priority: "first" });
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: {
          hasAgent: (name: string) => name === "sample-owner",
          runAgent: (agent: string, task: string, opts?: Record<string, unknown>) => {
            calls.push({ agent, task, opts });
            return "sess_metric";
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "metric.breach",
        source: "test",
        owner: "agent:sample-owner",
        data: {
          metricId: "sample.task.no-work",
          alertId: 7,
          current: 1,
          threshold: 0,
          priority: "P1",
        },
      } as any);
      await waitForMicrotasks();

      expect(calls).toHaveLength(1);
      expect(calls[0]!.agent).toBe("sample-owner");
      expect(calls[0]!.opts?.projectId).toBe("sample");
      expect(calls[0]!.task).toContain("metric feedback event");
      expect(calls[0]!.task).toContain("sample.task.no-work");
      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "metric.feedback.routed",
          owner: "agent:sample-owner",
          data: expect.objectContaining({
            metricId: "sample.task.no-work",
            alertId: 7,
            appId: "sample",
          }),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not fallback when app onEvent explicitly noops", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
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

  it("does not fallback for events with explicit workflow handlers", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker", task: "work" }
        }],
        onEvent() { return undefined; }
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
        type: "project.work",
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

  it("dispatches project events to installed workflow handler entries", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-planner",
          enabled: true,
          on: ["project.planning.requested"],
          handler: { workflow: "planner", task: "plan", includeEvent: true }
        }],
        onEvent() { return undefined; }
      }`,
      );

      const fired: string[] = [];
      const bus = new EventBus();
      const agentCrons = new Map<string, Cron>();
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager: { hasAgent: () => true } as any,
        bus,
        agentCrons,
      });

      const cron = agentCrons.get("sample-owner")!;
      expect(cron.getEventSubscriptions()).toMatchObject({
        "project.planning.requested": ["sample-planner"],
      });
      cron.registerHandler("sample-planner", async () => {
        fired.push("sample-planner");
      });
      cron.subscribeToBus(bus);
      cron.start();

      bus.emit({
        type: "project.planning.requested",
        source: "test",
        owner: "human:test",
        data: { project: "sample" },
      } as any);
      await waitForMicrotasks();

      expect(fired).toEqual(["sample-planner"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reinstalls project app handlers and router state on reload", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(
        appDir,
        `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker-v1", task: "work v1" }
        }],
        onEvent() { return undefined; }
      }`,
      );

      const calls: string[] = [];
      const bus = new EventBus();
      const agentCrons = new Map<string, Cron>();
      const manager = {
        hasAgent: () => true,
        runAgent: (agent: string) => calls.push(agent),
      } as any;

      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });
      expect((agentCrons.get("sample-owner")!.getEntries()[0]!.handler as any).workflow).toBe("worker-v1");

      writeApp(
        appDir,
        `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker-v2", task: "work v2" }
        }],
        onEvent() { return undefined; }
      }`,
      );
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });

      const updatedEntry = agentCrons.get("sample-owner")!.getEntries()[0]!;
      expect((updatedEntry.handler as any).workflow).toBe("worker-v2");
      expect((updatedEntry.handler as any).task).toBe("work v2");

      writeApp(
        appDir,
        `{
        id: "sample",
        onEvent() { return undefined; }
      }`,
      );
      await installProjectApps({
        projectsRoot,
        projectRoot: root,
        manager,
        bus,
        agentCrons,
      });
      expect(agentCrons.get("sample-owner")!.getEntries()).toHaveLength(0);

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample" },
      } as any);
      await waitForMicrotasks();

      expect(calls).toEqual(["sample-owner"]);
    } finally {
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
          event: { type: "project.owner.requested", project: "sample" }
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
          event: { type: "project.watchdog.tick", project: "sample" }
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
          event: { type: "project.focus.review.requested", project: "sample" }
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

  it("keeps schedule entries separate from workflow handlers with similar names", async () => {
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
          id: "worker",
          enabled: true,
          intervalMs: 60000,
          event: { type: "project.work", project: "sample" }
        }],
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker", task: "work" }
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

      const cron = agentCrons.get("sample-owner")!;
      const handled: string[] = [];
      cron.registerHandler("sample-worker", async () => {
        handled.push("sample-worker");
      });
      cron.subscribeToBus(bus);
      cron.start();

      expect(
        cron
          .getEntries()
          .map((entry) => entry.name)
          .sort(),
      ).toEqual(["sample-schedule-worker", "sample-worker"]);

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "human:test",
        data: { project: "sample" },
      } as any);
      await waitForMicrotasks();

      expect(handled).toEqual(["sample-worker"]);
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
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker-v1", task: "work v1" }
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
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker-v2", task: "work v2" }
        }]
      }`,
      );

      expect(await watcher.scanNow()).toBe(true);
      const updatedEntry = agentCrons.get("sample-owner")!.getEntries()[0]!;
      expect((updatedEntry.handler as any).workflow).toBe("worker-v2");
      expect((updatedEntry.handler as any).task).toBe("work v2");
    } finally {
      watcher?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
