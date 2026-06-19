import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
        on: ["project.planning.requested"],
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
        type: "project.planning.requested",
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
        on: ["project.planning.requested"],
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
        type: "project.planning.requested",
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
});
