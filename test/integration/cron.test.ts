import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import { HostMaintenance } from "../../src/app/adapters/maintenance/runtime.js";

function tempCronConfig(entries: unknown[]): { root: string; configPath: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "may-cron-test-"));
  const configPath = join(root, "cron.json");
  writeFileSync(configPath, JSON.stringify(entries), "utf-8");
  return {
    root,
    configPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("HostMaintenance event triggers", () => {
  it("rejects detached agent-message entries without handlers", () => {
    const { root, configPath, cleanup } = tempCronConfig([
      {
        name: "detached",
        enabled: true,
        intervalMs: 600_000,
        agent: "may",
        message: "old detached shape",
      },
    ]);
    try {
      const errors: string[] = [];
      const cron = new HostMaintenance({ configPath: configPath, onError: (msg) => errors.push(msg), projectRoot: root });

      expect(() => cron.load()).toThrow("requires a named handler");
    } finally {
      cleanup();
    }
  });

  it("fires any cron entry via trigger.<entry-name> without per-entry on config", async () => {
    const { root, configPath, cleanup } = tempCronConfig([
      {
        name: "sample-maintenance",
        enabled: true,
        intervalMs: 600_000,
        handler: "sample-maintenance",
      },
    ]);
    try {
      const bus = new EventBus();
      const handler = vi.fn(async (_event?: unknown) => {});
      const cron = new HostMaintenance({ configPath: configPath, projectRoot: root, emitEvent: (event) => bus.emit(event as any) });
      cron.load();
      cron.registerHandler("sample-maintenance", handler);
      cron.subscribeToBus(bus);

      bus.emit({
        type: "trigger.sample-maintenance",
        source: "test",
        owner: "agent:may",
        data: {},
      } as any);
      await nextTick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0]).toMatchObject({
        type: "trigger.sample-maintenance",
        source: "test",
        owner: "agent:may",
        data: {},
      });
    } finally {
      cleanup();
    }
  });

  it("fires session recovery from canonical session.end error events", async () => {
    const { root, configPath, cleanup } = tempCronConfig([
      {
        name: "session-recovery",
        enabled: true,
        handler: "session-recovery",
        on: ["session.end"],
      },
    ]);
    try {
      const bus = new EventBus();
      const handler = vi.fn(async (_event?: unknown) => {});
      const cron = new HostMaintenance({ configPath: configPath, projectRoot: root, emitEvent: (event) => bus.emit(event as any) });
      cron.load();
      cron.registerHandler("session-recovery", handler);
      cron.subscribeToBus(bus);

      bus.emit({
        type: "session.end",
        source: "runtime",
        owner: "agent:may",
        data: { sessionId: "s_1", agent: "dev", outcome: "error", status: "error", error: "boom" },
      } as any);
      await nextTick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0]).toMatchObject({
        type: "session.end",
        source: "runtime",
        owner: "agent:may",
        data: expect.objectContaining({
          sessionId: "s_1",
          agent: "dev",
          error: "boom",
        }),
      });
    } finally {
      cleanup();
    }
  });

  it("does not treat handlerConfig.agent as trigger envelope owner", async () => {
    const { root, configPath, cleanup } = tempCronConfig([
      {
        name: "legacy-config-agent",
        enabled: true,
        intervalMs: 600_000,
        handler: "legacy-config-agent",
        handlerConfig: { agent: "evaluator" },
      },
    ]);
    try {
      const bus = new EventBus();
      const handler = vi.fn(async (_event?: unknown) => {});
      const cron = new HostMaintenance({ configPath: configPath, projectRoot: root, emitEvent: (event) => bus.emit(event as any) });
      cron.load();
      cron.registerHandler("legacy-config-agent", handler);

      expect(cron.triggerNow("legacy-config-agent")).toBe(true);
      await nextTick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0]).toMatchObject({
        type: "trigger.legacy-config-agent",
        source: "manual",
        owner: "agent:may",
        data: { entry: "legacy-config-agent" },
      });
    } finally {
      cleanup();
    }
  });
});
