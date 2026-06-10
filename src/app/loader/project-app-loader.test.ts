import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Cron } from "../cron.ts";
import { EventBus } from "../event-bus.ts";
import { inferProjectAppOwner, installProjectApps, listProjectAppDirs } from "./project-app-loader.ts";

function tempRoot(): string {
  const root = join(tmpdir(), `project-app-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function writeAgent(appDir: string, dirName: string, name = dirName): void {
  const agentDir = join(appDir, "agents", dirName);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, "agent.json"), JSON.stringify({
    name,
    description: `${name} agent`,
    domain: "test",
    model: "opus",
    tools: [],
  }));
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
      writeApp(appDir, `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker", task: "work" }
        }]
      }`);

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

  it("routes unhandled project-scoped events to the inferred owner", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(appDir, `{
        id: "sample",
        async onEvent() { return undefined; }
      }`);

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

  it("does not fallback when app onEvent explicitly noops", async () => {
    const root = tempRoot();
    try {
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "sample.app");
      writeAgent(appDir, "owner", "sample-owner");
      writeApp(appDir, `{
        id: "sample",
        onEvent(ctx) { return ctx.noop("handled"); }
      }`);

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
      writeApp(appDir, `{
        id: "sample",
        workflowHandlers: [{
          name: "sample-worker",
          enabled: true,
          on: ["project.work"],
          handler: { workflow: "worker", task: "work" }
        }],
        onEvent() { return undefined; }
      }`);

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
});
