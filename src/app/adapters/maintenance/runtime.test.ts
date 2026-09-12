import { configureMaintenance } from "../../../../test/fixtures/maintenance.js";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HostMaintenance } from "./runtime.ts";
import { EventBus } from "../../core/events/bus.ts";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "may-cron-"));
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("HostMaintenance event dispatch", () => {
  it.each([
    ["disable", false],
    ["remove", false],
    ["disable", true],
    ["remove", true],
  ] as const)("discards queued events on %s before reuse (delivery scheduled=%s)", async (action, scheduled) => {
    const root = tempRoot();
    const configPath = join(root, "cron.json");
    const entry = { name: "review", handler: "review", on: ["fixture.changed"], enabled: true };
    const bus = new EventBus();
    const publish = (value: string) =>
      bus.emit({ type: "fixture.changed", source: "fixture", owner: "host:maintenance", data: { value } });
    writeFileSync(configPath, JSON.stringify([entry]));
    const finished = Promise.withResolvers<void>();
    const cron = new HostMaintenance({
      configPath: configPath,
      projectRoot: root,
      emitEvent: (event) => {
        if (event.type === "handler.completed") finished.resolve();
      },
    });
    const release = Promise.withResolvers<void>();
    const fresh = Promise.withResolvers<void>();
    const seen: unknown[] = [];
    const handler = async (event?: { data?: unknown }) => {
      seen.push(event?.data);
      if (seen.length === 1) await release.promise;
      else fresh.resolve();
    };
    try {
      cron.load();
      cron.registerHandler("review", handler);
      cron.subscribeToBus(bus);
      publish("running");
      publish("stale");
      if (scheduled) {
        release.resolve();
        await finished.promise; // The old queue now has a deferred delivery callback.
      }
      writeFileSync(configPath, JSON.stringify(action === "remove" ? [] : [{ ...entry, enabled: false }]));
      cron.reload();
      writeFileSync(configPath, JSON.stringify([entry]));
      cron.reload();
      cron.registerHandler("review", handler);
      publish("fresh");
      release.resolve();
      await fresh.promise;
      await tick();
      expect(seen).toEqual([{ value: "running" }, { value: "fresh" }]);
    } finally {
      release.resolve();
      cron.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps config activation explicit instead of polling cron.json", () => {
    const root = tempRoot();
    const configPath = join(root, "cron.json");
    writeFileSync(configPath, JSON.stringify([{ name: "maintenance", intervalMs: 60_000, handler: "maintenance" }]));
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: root });
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

  it("correlates the started and completed maintenance facts", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const observed: any[] = [];
    const cron = new HostMaintenance({
      configPath: join(root, "missing-cron.json"),
      projectRoot: root,
      emitEvent: (event) => bus.emit(event as any),
    });
    try {
      bus.subscribe((event) => observed.push(event));
      cron.registerHandler("agent-pulse", async () => {});
      configureMaintenance(cron, {
        name: "agent-pulse",
        agent: "dev",
        enabled: true,
        handler: "agent-pulse",
      });

      expect(cron.triggerNow("agent-pulse", { force: true })).toBe(true);
      await tick();
      expect(observed.some((event) => event.type === "heartbeat")).toBeFalse();
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
    const cron = new HostMaintenance({
      configPath: join(root, "missing-cron.json"),
      projectRoot: root,
      emitEvent: (event) => failures.push(event),
    });
    let release!: () => void;
    let receivedSignal: AbortSignal | undefined;
    let calls = 0;
    try {
      cron.registerHandler("slow-handler", async (_event, signal) => {
        calls += 1;
        receivedSignal = signal;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      });
      configureMaintenance(cron, {
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
    const cron = new HostMaintenance({
      configPath: join(root, "missing-cron.json"),
      projectRoot: root,
      emitEvent: (event) => failures.push(event),
    });
    let release!: () => void;
    let calls = 0;
    try {
      cron.registerHandler("slow-handler", async () => {
        calls += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      });
      configureMaintenance(cron, {
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
    const cron = new HostMaintenance({
      configPath: join(root, "missing-cron.json"),
      projectRoot: root,
      notify: (message) => notifications.push(message),
      emitEvent: (event) => failures.push(event),
    });
    try {
      cron.registerHandler("flaky-handler", async () => {
        throw new Error("database is locked");
      });
      configureMaintenance(cron, {
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
    const cron = new HostMaintenance({
      configPath: join(root, "missing-cron.json"),
      projectRoot: root,
      notify: (message) => notifications.push(message),
    });
    let fail = true;
    try {
      cron.registerHandler("recovering-handler", async () => {
        if (fail) throw new Error("SQLITE_BUSY");
      });
      configureMaintenance(cron, {
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

  it("repairs event subscriptions when reinstalling an unchanged maintenance declaration", async () => {
    const root = tempRoot();
    const bus = new EventBus();
    const cron = new HostMaintenance({
      configPath: join(root, "missing-cron.json"),
      projectRoot: root,
      emitEvent: (event) => bus.emit(event as any),
    });
    try {
      let fires = 0;
      const entry = {
        name: "sample-planner",
        enabled: true,
        on: ["project.owner.requested"],
        handler: "review",
      };

      cron.registerHandler("sample-planner", async () => {
        fires += 1;
      });
      configureMaintenance(cron, entry);
      (cron as unknown as { eventSubscriptions: Map<string, Set<string>> }).eventSubscriptions.clear();
      configureMaintenance(cron, entry);
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

  it("stops an enabled maintenance declaration when an configuration reload disables it", () => {
    const root = tempRoot();
    const cron = new HostMaintenance({ configPath: join(root, "missing-cron.json"), projectRoot: root });
    try {
      cron.registerHandler("sample-schedule", async () => {});
      configureMaintenance(cron, {
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

      configureMaintenance(cron, {
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
      configureMaintenance(cron, {
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
