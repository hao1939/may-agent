import { configureMaintenance } from "../../../test/fixtures/maintenance.js";
import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activateAgentMaintenance } from "./maintenance-activation.js";
import { HostMaintenance } from "../adapters/maintenance/runtime.js";
import { EventBus } from "../event-bus.js";
import { closeDb } from "../../lib/requests.js";

describe("HostMaintenance generation activation", () => {
  it("resolves added and repaired event handlers on config reload with timers disabled", async () => {
    const root = mkdtempSync(join(tmpdir(), "cron-event-reload-"));
    const configPath = join(root, "cron.json");
    const bus = new EventBus();
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: root });
    let available = false;
    let resolutions = 0;
    let fires = 0;
    let resolved!: () => void;
    cron.setHandlerResolver(async () => {
      resolutions++;
      resolved();
      return available
        ? async () => {
            fires++;
          }
        : undefined;
    });
    const reload = async () => {
      const resolution = new Promise<void>((resolve) => {
        resolved = resolve;
      });
      cron.reload();
      await resolution;
    };
    try {
      activateAgentMaintenance(new Map([["sample", cron]]), bus, false);
      writeFileSync(configPath, JSON.stringify([{ name: "review", handler: "review", on: ["sample.changed"] }]));
      await reload();
      expect(resolutions).toBe(1);
      expect(cron.hasHandler("review")).toBe(false);
      available = true;
      await reload();
      expect(resolutions).toBe(2);
      expect(cron.hasHandler("review")).toBe(true);
      bus.emit({ type: "sample.changed", source: "test", owner: "app:sample", data: {} } as any);
      await Bun.sleep(0);
      expect(fires).toBe(1);
      cron.reload();
      expect(resolutions).toBe(2);
    } finally {
      cron.close();
      closeDb(join(root, ".state"));
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps event routes across timer disable and reload without duplicate attachment", async () => {
    const root = mkdtempSync(join(tmpdir(), "cron-events-only-"));
    const bus = new EventBus();
    const cron = new HostMaintenance({ configPath: join(root, "missing.json"), projectRoot: root });
    const start = spyOn(cron, "start");
    const stop = spyOn(cron, "stop");
    let fires = 0;
    cron.registerHandler("review", async () => {
      fires += 1;
    });
    configureMaintenance(cron, {
      name: "review",
      enabled: true,
      intervalMs: 60_000,
      on: ["sample.changed"],
      handler: "review",
    });
    const maintenance = new Map([["sample", cron]]);
    try {
      activateAgentMaintenance(maintenance, bus, true);
      expect(start).toHaveBeenCalledTimes(1);
      stop.mockClear();
      activateAgentMaintenance(maintenance, bus, false);
      expect(stop).toHaveBeenCalledTimes(1);
      activateAgentMaintenance(maintenance, bus, false);
      cron.reload();
      expect(start).toHaveBeenCalledTimes(1);
      bus.emit({ type: "trigger.review", source: "test", owner: "app:sample", data: {} } as any);
      await Bun.sleep(0);
      expect(fires).toBe(1);
      configureMaintenance(cron, { name: "review", enabled: false, on: ["sample.changed"], handler: "review" });
      bus.emit({ type: "trigger.review", source: "test", owner: "app:sample", data: {} } as any);
      await Bun.sleep(0);
      expect(fires).toBe(1);
    } finally {
      start.mockRestore();
      stop.mockRestore();
      cron.close();
      closeDb(join(root, ".state"));
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("starts a committed scheduler and detaches it when retired", async () => {
    const root = mkdtempSync(join(tmpdir(), "cron-generation-"));
    const bus = new EventBus();
    const cron = new HostMaintenance({ configPath: join(root, "missing.json"), projectRoot: root });
    let fires = 0;
    cron.registerHandler("review", async () => {
      fires += 1;
    });
    configureMaintenance(cron, { name: "review", enabled: true, on: ["sample.changed"], handler: "review" });

    try {
      activateAgentMaintenance(new Map([["sample", cron]]), bus, true);
      bus.emit({ type: "sample.changed", source: "test", owner: "app:sample", data: {} } as any);
      await Bun.sleep(0);
      expect(fires).toBe(1);

      cron.close();
      bus.emit({ type: "sample.changed", source: "test", owner: "app:sample", data: {} } as any);
      await Bun.sleep(0);
      expect(fires).toBe(1);
    } finally {
      cron.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
