import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activateAgentCrons } from "./agent-triggers.js";
import { Cron } from "../../cron.js";
import { EventBus } from "../../event-bus.js";
import { closeDb } from "../../../lib/requests.js";

describe("Cron generation activation", () => {
  it("keeps event routes across timer disable and reload without duplicate attachment", async () => {
    const root = mkdtempSync(join(tmpdir(), "cron-events-only-"));
    const bus = new EventBus();
    const cron = new Cron(join(root, "missing.json"), {} as any, () => "session", undefined, root);
    const start = spyOn(cron, "start");
    const stop = spyOn(cron, "stop");
    let fires = 0;
    cron.registerHandler("review", async () => {
      fires += 1;
    });
    cron.addSyntheticEntry({
      name: "review",
      enabled: true,
      intervalMs: 60_000,
      on: ["sample.changed"],
      handler: "review",
    });
    const crons = new Map([["sample", cron]]);
    try {
      activateAgentCrons(crons, bus, true);
      expect(start).toHaveBeenCalledTimes(1);
      stop.mockClear();
      activateAgentCrons(crons, bus, false);
      expect(stop).toHaveBeenCalledTimes(1);
      activateAgentCrons(crons, bus, false);
      cron.reload();
      expect(start).toHaveBeenCalledTimes(1);
      bus.emit({ type: "trigger.review", source: "test", owner: "app:sample", data: {} } as any);
      await Bun.sleep(0);
      expect(fires).toBe(1);
      cron.addSyntheticEntry({ name: "review", enabled: false, on: ["sample.changed"], handler: "review" });
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
    const cron = new Cron(join(root, "missing.json"), {} as any, () => "session", undefined, root);
    let fires = 0;
    cron.registerHandler("review", async () => {
      fires += 1;
    });
    cron.addSyntheticEntry({ name: "review", enabled: true, on: ["sample.changed"], handler: "review" });

    try {
      activateAgentCrons(new Map([["sample", cron]]), bus, true);
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
