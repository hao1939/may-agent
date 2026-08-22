import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Cron } from "./cron.ts";
import { EventBus } from "./event-bus.ts";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "may-cron-"));
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Cron event dispatch", () => {
  it("keeps config activation explicit instead of polling cron.json", () => {
    const root = tempRoot();
    const configPath = join(root, "cron.json");
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "maintenance", intervalMs: 60_000, handler: "maintenance" }]),
    );
    const cron = new Cron(configPath, {} as any, () => "s1", undefined, root);
    try {
      cron.start();
      const runtime = cron as unknown as Record<string, unknown>;
      expect(runtime.watchConfig).toBeUndefined();
      expect(runtime.configWatcher).toBeUndefined();
      expect(runtime.configPollTimer).toBeUndefined();
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses typed heartbeat category instead of entry-name inference", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const observed: any[] = [];
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => bus.emit(event as any),
    );
    try {
      bus.subscribe((event) => observed.push(event));
      cron.registerHandler("agent-pulse", async () => {});
      cron.addSyntheticEntry({
        name: "agent-pulse",
        category: "heartbeat",
        agent: "dev",
        enabled: true,
        handler: "agent-pulse",
      });

      expect(cron.triggerNow("agent-pulse", { force: true })).toBe(true);
      await tick();
      expect(observed).toContainEqual(expect.objectContaining({ type: "heartbeat", agent: "dev", entry: "agent-pulse" }));
      const started = observed.find((event) => event.type === "handler.started");
      const completed = observed.find((event) => event.type === "handler.completed");
      expect(started?.data.handlerRunId).toMatch(/^handler:agent-pulse:/);
      expect(completed?.data.handlerRunId).toBe(started?.data.handlerRunId);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps timed-out handlers in flight until they actually stop", async () => {
    const root = tempRoot();
    const failures: any[] = [];
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => failures.push(event),
    );
    let release!: () => void;
    let receivedSignal: AbortSignal | undefined;
    let calls = 0;
    try {
      cron.registerHandler("slow-handler", async (_event, signal) => {
        calls += 1;
        receivedSignal = signal;
        await new Promise<void>((resolve) => { release = resolve; });
      });
      cron.addSyntheticEntry({
        name: "slow-handler",
        enabled: true,
        handler: "slow-handler",
        timeoutMs: 5,
      });

      expect(cron.triggerNow("slow-handler", { force: true })).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 15));

      expect(receivedSignal?.aborted).toBe(true);
      expect(calls).toBe(1);
      expect(cron.triggerNow("slow-handler", { force: true })).toBe(false);
      expect(failures.filter((event) => event.type === "handler.failed")).toHaveLength(1);

      release();
      await tick();
      expect((cron as any).inflightJobs.get("slow-handler") ?? []).toHaveLength(0);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not prune timed-out in-flight handlers just because wall time advanced", async () => {
    const root = tempRoot();
    const failures: any[] = [];
    const originalNow = Date.now;
    let now = 1_700_000_000_000;
    Date.now = () => now;
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => failures.push(event),
    );
    let release!: () => void;
    let calls = 0;
    try {
      cron.registerHandler("slow-handler", async () => {
        calls += 1;
        await new Promise<void>((resolve) => { release = resolve; });
      });
      cron.addSyntheticEntry({
        name: "slow-handler",
        enabled: true,
        handler: "slow-handler",
        timeoutMs: 5,
      });

      expect(cron.triggerNow("slow-handler", { force: true })).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(failures.filter((event) => event.type === "handler.failed")).toHaveLength(1);

      now += 11 * 60_000;
      expect(cron.triggerNow("slow-handler", { force: true })).toBe(false);
      expect(calls).toBe(1);

      release();
      await tick();
      expect((cron as any).inflightJobs.get("slow-handler") ?? []).toHaveLength(0);
    } finally {
      Date.now = originalNow;
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("notifies only after three consecutive transient handler failures", async () => {
    const root = tempRoot();
    const notifications: string[] = [];
    const failures: any[] = [];
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      (message) => notifications.push(message),
      (event) => failures.push(event),
    );
    try {
      cron.registerHandler("flaky-handler", async () => {
        throw new Error("database is locked");
      });
      cron.addSyntheticEntry({
        name: "flaky-handler",
        enabled: true,
        handler: "flaky-handler",
      });

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        expect(cron.triggerNow("flaky-handler", { force: true })).toBe(true);
        await tick();
        expect(notifications).toHaveLength(attempt === 3 ? 1 : 0);
      }
      expect(failures.filter((event) => event.type === "handler.failed")).toHaveLength(3);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resets transient failure suppression after a successful run", async () => {
    const root = tempRoot();
    const notifications: string[] = [];
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      (message) => notifications.push(message),
    );
    let fail = true;
    try {
      cron.registerHandler("recovering-handler", async () => {
        if (fail) throw new Error("SQLITE_BUSY");
      });
      cron.addSyntheticEntry({
        name: "recovering-handler",
        enabled: true,
        handler: "recovering-handler",
      });

      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(cron.triggerNow("recovering-handler", { force: true })).toBe(true);
        await tick();
      }
      fail = false;
      expect(cron.triggerNow("recovering-handler", { force: true })).toBe(true);
      await tick();
      fail = true;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(cron.triggerNow("recovering-handler", { force: true })).toBe(true);
        await tick();
      }

      expect(notifications).toEqual([]);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not fire project-scoped workflow handlers for untargeted project events", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => bus.emit(event as any),
    );
    try {
      let fires = 0;
      cron.registerHandler("sample-planner", async () => {
        fires += 1;
      });
      cron.addSyntheticEntry({
        name: "sample-planner",
        enabled: true,
        on: ["project.owner.requested"],
        handler: {
          workflow: "planner",
          agent: "owner",
          projectId: "sample",
          task: "plan",
        },
      });
      cron.subscribeToBus(bus);
      cron.start();

      bus.emit({
        type: "project.owner.requested",
        source: "test",
        owner: "agent:owner",
        data: { reason: "missing-project-target" },
      } as any);
      await tick();

      expect(fires).toBe(0);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not fire project-scoped workflow handlers for another projectId shape", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => bus.emit(event as any),
    );
    try {
      const fired: string[] = [];
      cron.registerHandler("sample-worker", async () => {
        fired.push("sample-worker");
      });
      cron.addSyntheticEntry({
        name: "sample-worker",
        enabled: true,
        on: ["project.work"],
        handler: {
          workflow: "worker",
          agent: "owner",
          projectId: "sample",
          task: "work",
        },
      });
      cron.subscribeToBus(bus);
      cron.start();

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "agent:owner",
        data: { projectId: "other" },
      } as any);
      await tick();
      expect(fired).toEqual([]);

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "agent:owner",
        data: { project_id: "sample" },
      } as any);
      await tick();
      expect(fired).toEqual(["sample-worker"]);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts nested project payloads when filtering project-scoped handlers", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => bus.emit(event as any),
    );
    try {
      let fires = 0;
      cron.registerHandler("sample-worker", async () => {
        fires += 1;
      });
      cron.addSyntheticEntry({
        name: "sample-worker",
        enabled: true,
        on: ["project.work"],
        handler: {
          workflow: "worker",
          agent: "owner",
          projectId: "sample",
          task: "work",
        },
      });
      cron.subscribeToBus(bus);
      cron.start();

      bus.emit({
        type: "project.work",
        source: "test",
        owner: "agent:owner",
        data: { params: { project: "sample" } },
      } as any);
      await tick();

      expect(fires).toBe(1);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("repairs event subscriptions when reinstalling an unchanged synthetic entry", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
      undefined,
      (event) => bus.emit(event as any),
    );
    try {
      let fires = 0;
      const entry = {
        name: "sample-planner",
        enabled: true,
        on: ["project.owner.requested"],
        handler: {
          workflow: "planner",
          agent: "owner",
          projectId: "sample",
          task: "plan",
        },
      };

      cron.registerHandler("sample-planner", async () => {
        fires += 1;
      });
      cron.addSyntheticEntry(entry);
      (cron as unknown as { eventSubscriptions: Map<string, Set<string>> }).eventSubscriptions.clear();
      cron.addSyntheticEntry(entry);
      cron.subscribeToBus(bus);
      cron.start();

      bus.emit({
        type: "project.owner.requested",
        source: "test",
        owner: "agent:owner",
        data: { project: "sample" },
      } as any);
      await tick();

      expect(fires).toBe(1);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stops an enabled synthetic entry when an app reload disables it", () => {
    const root = tempRoot();
    const cron = new Cron(
      join(root, "missing-cron.json"),
      {} as any,
      () => "s1",
      undefined,
      root,
    );
    try {
      cron.registerHandler("sample-schedule", async () => {});
      cron.addSyntheticEntry({
        name: "sample-schedule",
        enabled: true,
        intervalMs: 60_000,
        handler: "sample-schedule",
      });
      cron.start();

      const runtime = cron as unknown as {
        pendingStartTimers: Map<string, ReturnType<typeof setTimeout>>;
        queuedEventTriggers: Map<string, unknown[]>;
      };
      expect(runtime.pendingStartTimers.has("sample-schedule")).toBe(true);
      runtime.queuedEventTriggers.set("sample-schedule", [{ type: "project.tick" }]);

      cron.addSyntheticEntry({
        name: "sample-schedule",
        enabled: false,
        intervalMs: 60_000,
        handler: "sample-schedule",
      });

      expect(runtime.pendingStartTimers.has("sample-schedule")).toBe(false);
      expect(runtime.queuedEventTriggers.has("sample-schedule")).toBe(false);
      expect(cron.triggerNow("sample-schedule")).toBe(false);

      // Reinstalling the same disabled descriptor is also a repair boundary.
      runtime.queuedEventTriggers.set("sample-schedule", [{ type: "project.tick" }]);
      cron.addSyntheticEntry({
        name: "sample-schedule",
        enabled: false,
        intervalMs: 60_000,
        handler: "sample-schedule",
      });
      expect(runtime.queuedEventTriggers.has("sample-schedule")).toBe(false);
    } finally {
      cron.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
