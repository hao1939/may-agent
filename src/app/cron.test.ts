import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./event-bus.js";
import { Cron } from "./cron.js";

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

describe("Cron event triggers", () => {
  it("fires any cron entry via trigger.<entry-name> without per-entry on config", async () => {
    const { root, configPath, cleanup } = tempCronConfig([
      {
        name: "closed-loop-steward",
        enabled: true,
        intervalMs: 600_000,
        handler: "closed-loop-steward",
      },
    ]);
    try {
      const bus = new EventBus();
      const handler = vi.fn(async (_event?: unknown) => {});
      const cron = new Cron(configPath, {} as any, () => "", undefined, root, undefined, (event) => bus.emit(event as any));
      cron.load();
      cron.registerHandler("closed-loop-steward", handler);
      cron.subscribeToBus(bus);

      bus.emit({ type: "trigger.closed-loop-steward", source: "test" } as any);
      await nextTick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0]).toMatchObject({
        type: "trigger.closed-loop-steward",
        source: "event",
        entry: "closed-loop-steward",
      });
    } finally {
      cleanup();
    }
  });
});
