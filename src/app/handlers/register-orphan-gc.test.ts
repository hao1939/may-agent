import { describe, expect, it } from "bun:test";
import { registerEventPairOrphanGc } from "./register-orphan-gc.js";

// Minimal Cron mock
function createMockCron() {
  const handlers = new Map<string, unknown>();
  const entries: Array<Record<string, unknown>> = [];
  return {
    registerHandler(name: string, handler: unknown) {
      handlers.set(name, handler);
    },
    addSyntheticEntry(entry: Record<string, unknown>) {
      entries.push(entry);
    },
    getHandler(name: string) {
      return handlers.get(name);
    },
    getEntries() {
      return entries;
    },
  };
}

// Minimal EventBus mock
function createMockBus() {
  const emitted: Array<Record<string, unknown>> = [];
  return {
    emit(event: Record<string, unknown>) {
      emitted.push(event);
    },
    getEmitted() {
      return emitted;
    },
    subscribe() {},
    setPersistenceSubscriber() {},
    setDeliveryRecorder() {},
  };
}

describe("event-pair-orphan-gc handler", () => {
  it("registers handler and synthetic entry", () => {
    const cron = createMockCron();
    const bus = createMockBus();
    registerEventPairOrphanGc(cron as any, "/tmp/nonexistent", bus as any);

    expect(cron.getHandler("event-pair-orphan-gc")).toBeDefined();
    expect(cron.getEntries()).toHaveLength(1);
    expect(cron.getEntries()[0].name).toBe("event-pair-orphan-gc");
    expect(cron.getEntries()[0]).toMatchObject({
      intervalMs: 15 * 60 * 1000,
      handler: "event-pair-orphan-gc",
      handlerConfig: {
        maxAgeMs: 24 * 60 * 60 * 1000,
        batchSize: 10_000,
      },
    });
  });
});
