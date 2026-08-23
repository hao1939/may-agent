import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activateAgentCrons } from "./cron-activation.js";
import { Cron } from "./cron.js";
import { EventBus } from "./event-bus.js";

describe("Cron generation activation", () => {
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
      activateAgentCrons(new Map([["sample", cron]]), bus);
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
