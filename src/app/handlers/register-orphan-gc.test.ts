import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
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

  it("re-wakes unfinished owner messages instead of expiring them", async () => {
    const root = mkdtempSync(join(tmpdir(), "owner-message-resync-"));
    try {
      const db = getDb(root);
      const openedAt = Date.now() - 48 * 60 * 60_000;
      const message = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          "message.created",
          "agent:requester",
          "agent:tech-lead",
          JSON.stringify({ from: "requester", to: "tech-lead", content: "Finish this request" }),
          openedAt,
        );
      const openEventId = Number(message.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('owner_inbox', ?, ?, 'agent:tech-lead', 'orphan', ?, ?)`,
      ).run(`event:${openEventId}`, openEventId, openedAt, openedAt + 2 * 60 * 60_000);

      const cron = createMockCron();
      const bus = createMockBus();
      registerEventPairOrphanGc(cron as any, root, bus as any);
      const handler = cron.getHandler("event-pair-orphan-gc") as (
        event: unknown,
        signal: AbortSignal,
      ) => Promise<void>;
      await handler({}, new AbortController().signal);

      expect(bus.getEmitted()).toContainEqual(
        expect.objectContaining({
          type: "owner.inbox.accepted",
          owner: "agent:tech-lead",
          data: expect.objectContaining({
            sourceEventId: openEventId,
            sourceEventType: "message.created",
            reason: "periodic-resync",
            input: expect.objectContaining({ to: "tech-lead", content: "Finish this request" }),
          }),
        }),
      );
      expect(
        bus
          .getEmitted()
          .some((event) => event.type === "event-pair.orphan-gc.close" && event.data?.openEventId === openEventId),
      ).toBe(false);
      expect(
        db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId),
      ).toMatchObject({ status: "orphan" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
