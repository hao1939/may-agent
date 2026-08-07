import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
import { DbWriter } from "../../lib/db-writer.js";
import { EVENT_ROW_ID, EventBus } from "../event-bus.js";
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
  const subscribers: Array<(event: Record<string, unknown>) => void> = [];
  return {
    emit(event: Record<string, unknown>) {
      emitted.push(event);
      for (const subscriber of subscribers) subscriber(event);
    },
    getEmitted() {
      return emitted;
    },
    subscribe(handler: (event: Record<string, unknown>) => void) {
      subscribers.push(handler);
      return () => {
        const index = subscribers.indexOf(handler);
        if (index >= 0) subscribers.splice(index, 1);
      };
    },
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
        deliveryProofTimeoutMs: 2 * 60 * 60 * 1000,
        maxAgeMs: 24 * 60 * 60 * 1000,
        batchSize: 10_000,
      },
    });
  });

  it("resolves a delivered notification immediately from exact channel proof", () => {
    const root = mkdtempSync(join(tmpdir(), "message-delivered-"));
    try {
      const db = getDb(root);
      const openedAt = Date.now();
      const inserted = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('message.created', 'agent:scout', 'agent:scout', ?, ?)`,
        )
        .run(JSON.stringify({ from: "scout", to: "human", content: "Daily digest" }), openedAt);
      const openEventId = Number(inserted.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('owner_inbox', ?, ?, 'agent:scout', 'open', ?, ?)`,
      ).run(`event:${openEventId}`, openEventId, openedAt, openedAt + 2 * 60 * 60_000);
      db.prepare(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES ('channel.delivery.completed', 'telegram', 'agent:may', ?, ?)`,
      ).run(JSON.stringify({ channel: "telegram", sourceEventId: openEventId, externalMessageId: 42 }), openedAt + 1);

      const cron = createMockCron();
      const bus = createMockBus();
      registerEventPairOrphanGc(cron as any, root, bus as any);
      bus.emit({
        type: "channel.delivery.completed",
        data: { channel: "telegram", sourceEventId: openEventId, externalMessageId: 42 },
      });

      expect(bus.getEmitted()).toContainEqual(
        expect.objectContaining({
          type: "message.resolved",
          data: expect.objectContaining({
            openEventId,
            outcome: "fulfilled",
            summary: "Channel delivery was confirmed.",
          }),
        }),
      );
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes the persisted message pair in the same delivery event turn", () => {
    const root = mkdtempSync(join(tmpdir(), "message-live-delivery-"));
    try {
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      registerEventPairOrphanGc(createMockCron() as any, root, bus);

      const message = bus.emit({
        type: "message.created",
        source: "agent:scout",
        owner: "agent:scout",
        data: { from: "scout", to: "human", content: "Daily digest" },
      } as any);
      const openEventId = Number(message[EVENT_ROW_ID]);
      bus.emit({
        type: "channel.delivery.completed",
        source: "telegram",
        owner: "agent:may",
        data: { channel: "telegram", sourceEventId: openEventId, externalMessageId: 44 },
      } as any);

      const db = getDb(root);
      expect(
        db.prepare("SELECT status, close_event_id FROM event_pair_runs WHERE open_event_id = ?").get(openEventId),
      ).toMatchObject({ status: "closed", close_event_id: expect.any(Number) });
      expect(
        db
          .prepare(
            "SELECT event_type, json_extract(data, '$.outcome') AS outcome FROM events WHERE event_type = 'message.resolved' AND json_extract(data, '$.openEventId') = ?",
          )
          .get(openEventId),
      ).toEqual({ event_type: "message.resolved", outcome: "fulfilled" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a delivered request open until its exact expected response arrives", () => {
    const root = mkdtempSync(join(tmpdir(), "message-response-"));
    try {
      const db = getDb(root);
      const openedAt = Date.now();
      const approvalId = "approval-1";
      const inserted = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('message.created', 'agent:gym', 'agent:gym', ?, ?)`,
        )
        .run(
          JSON.stringify({
            from: "gym",
            to: "human:operator",
            content: "Approve the candidate",
            requestedAction: "Approve or reject",
            expectedResponse: {
              type: "project.approval.submitted",
              target: { project: "gym" },
              approvalId,
              acceptedDecisions: ["approve", "reject"],
            },
          }),
          openedAt,
        );
      const openEventId = Number(inserted.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('owner_inbox', ?, ?, 'agent:gym', 'open', ?, ?)`,
      ).run(`event:${openEventId}`, openEventId, openedAt, openedAt + 2 * 60 * 60_000);
      db.prepare(
        `INSERT INTO events (event_type, source, owner, project_id, data, timestamp)
         VALUES ('channel.delivery.completed', 'telegram', 'agent:may', 'gym', ?, ?)`,
      ).run(JSON.stringify({ sourceEventId: openEventId, externalMessageId: 43 }), openedAt + 1);

      const cron = createMockCron();
      const bus = createMockBus();
      registerEventPairOrphanGc(cron as any, root, bus as any);
      bus.emit({ type: "channel.delivery.completed", data: { sourceEventId: openEventId } });
      expect(bus.getEmitted().some((event) => event.type === "message.resolved")).toBe(false);

      db.prepare(
        `INSERT INTO events (event_type, source, owner, project_id, data, timestamp)
         VALUES ('project.approval.submitted', 'telegram', 'agent:gym', 'gym', ?, ?)`,
      ).run(JSON.stringify({ project: "gym", approvalId, decision: "approve" }), openedAt + 2);
      bus.emit({
        type: "project.approval.submitted",
        data: { project: "gym", approvalId, decision: "approve" },
      });

      expect(bus.getEmitted()).toContainEqual(
        expect.objectContaining({
          type: "message.resolved",
          data: expect.objectContaining({ openEventId, outcome: "fulfilled" }),
        }),
      );
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps one semantic request when a reviewed delivery recovery uses a new carrier", () => {
    const root = mkdtempSync(join(tmpdir(), "message-recovery-lineage-"));
    try {
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      registerEventPairOrphanGc(createMockCron() as any, root, bus);
      const expectedResponse = {
        type: "project.approval.submitted",
        target: { project: "alpha-project" },
        approvalId: "approval-recovery-1",
        acceptedDecisions: ["approve", "decline"],
      };

      const original = bus.emit({
        type: "message.created",
        source: "agent:app-ops",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Choose one approval outcome",
          expectedResponse,
        },
      } as any);
      const originalId = Number(original[EVENT_ROW_ID]);
      const recovery = bus.emit({
        type: "message.created",
        source: "agent:app-ops",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Reviewed recovery of the same approval request",
          expectedResponse,
          recovery: { sourceEventId: originalId, reason: "reviewed-delivery-recovery" },
        },
      } as any);
      const recoveryId = Number(recovery[EVENT_ROW_ID]);
      bus.emit({
        type: "channel.delivery.completed",
        source: "telegram",
        owner: "agent:may",
        data: { sourceEventId: recoveryId, externalMessageId: 88 },
      } as any);

      const db = getDb(root);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(originalId)).toEqual({
        status: "closed",
      });
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(recoveryId)).toEqual({
        status: "open",
      });
      expect(
        db
          .prepare(
            `SELECT json_extract(data, '$.outcome') AS outcome
             FROM events
             WHERE event_type = 'message.resolved'
               AND json_extract(data, '$.openEventId') = ?`,
          )
          .get(originalId),
      ).toEqual({ outcome: "superseded" });

      bus.emit({
        type: "project.approval.submitted",
        source: "telegram",
        owner: "agent:app-ops",
        target: { project: "alpha-project" },
        data: { project: "alpha-project", approvalId: "approval-recovery-1", decision: "approve" },
      } as any);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(recoveryId)).toEqual({
        status: "closed",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes earlier recovery carriers when a later admission review successfully delivers the lineage", () => {
    const root = mkdtempSync(join(tmpdir(), "message-reviewed-recovery-lineage-"));
    try {
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      registerEventPairOrphanGc(createMockCron() as any, root, bus);
      const expectedResponse = {
        type: "project.approval.submitted",
        target: { project: "alpha-project" },
        approvalId: "approval-recovery-2",
        acceptedDecisions: ["approve", "decline"],
      };

      const original = bus.emit({
        type: "message.created",
        source: "agent:app-ops",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Original approval request",
          expectedResponse,
        },
      } as any);
      const originalId = Number(original[EVENT_ROW_ID]);
      const replay = bus.emit({
        type: "message.created",
        source: "agent:app-ops",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Direct replay of the same approval request",
          expectedResponse,
          recovery: { sourceEventId: originalId, reason: "retry" },
        },
      } as any);
      const replayId = Number(replay[EVENT_ROW_ID]);
      const recovery = bus.emit({
        type: "message.created",
        source: "telegram-admission-recovery",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Validated fallback for the same approval request",
          expectedResponse,
          recovery: { sourceEventId: originalId, previousReplayEventId: replayId, reason: "validated-fallback" },
        },
      } as any);
      const recoveryId = Number(recovery[EVENT_ROW_ID]);
      bus.emit({
        type: "human.attention.reviewed",
        source: "telegram-outbound",
        owner: "agent:may",
        data: {
          sourceEventId: recoveryId,
          status: "completed",
          disposition: "deliver",
          delivered: true,
          understoodIntent: "Recover the approval lineage.",
          reason: "Human authority is still required.",
          nextAction: "Wait for the approval response.",
          evidence: ["Validated recovery carrier delivered."],
          deliveredMessage: "Please choose approve or decline.",
        },
      } as any);

      const db = getDb(root);
      for (const openEventId of [originalId, replayId]) {
        expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toEqual({
          status: "closed",
        });
        expect(
          db
            .prepare(
              `SELECT json_extract(data, '$.outcome') AS outcome
               FROM events
               WHERE event_type = 'message.resolved'
                 AND json_extract(data, '$.openEventId') = ?`,
            )
            .get(openEventId),
        ).toEqual({ outcome: "superseded" });
      }
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(recoveryId)).toEqual({
        status: "open",
      });

      bus.emit({
        type: "project.approval.submitted",
        source: "telegram",
        owner: "agent:app-ops",
        target: { project: "alpha-project" },
        data: { project: "alpha-project", approvalId: "approval-recovery-2", decision: "approve" },
      } as any);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(recoveryId)).toEqual({
        status: "closed",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes an earlier recovery lineage from a later carrier's structured terminal disposition", async () => {
    const root = mkdtempSync(join(tmpdir(), "message-structured-recovery-lineage-"));
    try {
      const cron = createMockCron();
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      registerEventPairOrphanGc(cron as any, root, bus);

      const original = bus.emit({
        type: "message.created",
        source: "agent:app-ops",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Original request that later needed structured recovery.",
          requestedAction: "Decide whether to keep the stale packet live.",
        },
      } as any);
      const originalId = Number(original[EVENT_ROW_ID]);
      const recovery = bus.emit({
        type: "message.created",
        source: "telegram-admission-recovery",
        owner: "agent:app-ops",
        data: {
          from: "app-ops",
          to: "human:operator",
          content: "Validated fallback for the same request.",
          requestedAction: "Route or clarify from bounded evidence.",
          recovery: { sourceEventId: originalId, reason: "validated-fallback" },
        },
      } as any);
      const recoveryId = Number(recovery[EVENT_ROW_ID]);
      bus.emit({
        type: "message.resolved",
        source: "handler:message-lifecycle",
        owner: "agent:app-ops",
        data: {
          openEventId: recoveryId,
          openEventType: "message.created",
          disposition: "superseded",
          outcome: "superseded",
          summary: "Recovery review routed the request to the accountable owner from bounded evidence.",
          taskRefs: [],
        },
        trace: {
          traceId: `event:${recoveryId}`,
          parentEventId: recoveryId,
          links: [{ eventId: recoveryId, type: "closure", label: "message.resolved" }],
        },
      } as any);

      const runGc = cron.getHandler("event-pair-orphan-gc") as ((event: unknown, signal: AbortSignal) => Promise<void>) | undefined;
      expect(runGc).toBeDefined();
      await runGc?.({}, new AbortController().signal);

      const db = getDb(root);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(originalId)).toEqual({
        status: "closed",
      });
      expect(
        db
          .prepare(
            `SELECT json_extract(data, '$.outcome') AS outcome
             FROM events
             WHERE event_type = 'message.resolved'
               AND json_extract(data, '$.openEventId') = ?
             ORDER BY id DESC
             LIMIT 1`,
          )
          .get(originalId),
      ).toEqual({ outcome: "superseded" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("treats a completed non-deliver admission disposition as terminal message resolution", () => {
    const root = mkdtempSync(join(tmpdir(), "message-reviewed-route-"));
    try {
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      registerEventPairOrphanGc(createMockCron() as any, root, bus);

      const message = bus.emit({
        type: "message.created",
        source: "agent:ops",
        owner: "agent:ops",
        data: {
          from: "ops",
          to: "human:operator",
          content: "Need Hao approval",
          requestedAction: "Approve or reject",
        },
      } as any);
      const openEventId = Number(message[EVENT_ROW_ID]);
      bus.emit({
        type: "human.attention.reviewed",
        source: "telegram-outbound",
        owner: "agent:may",
        data: {
          sourceEventId: openEventId,
          status: "completed",
          disposition: "route",
          understoodIntent: "Route the request back to the owner.",
          reason: "The owner can finish this before Hao is needed.",
          nextAction: "Return the bounded gap to the owner.",
          owner: "tech-lead",
          reviewAgainWhen: "After the owner reruns the missing check.",
          evidence: ["Bounded owner recovery is available."],
          actionTaken: "Routed the recovery to the owner.",
          closureCondition: "A later owner review records the missing proof.",
        },
      } as any);

      const db = getDb(root);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toEqual({
        status: "closed",
      });
      expect(
        db
          .prepare(
            `SELECT json_extract(data, '$.outcome') AS outcome
             FROM events
             WHERE event_type = 'message.resolved'
               AND json_extract(data, '$.openEventId') = ?`,
          )
          .get(openEventId),
      ).toEqual({ outcome: "superseded" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves explicit expiry and bounded missing delivery proof without blind resend", async () => {
    const root = mkdtempSync(join(tmpdir(), "message-terminal-failures-"));
    try {
      const db = getDb(root);
      const now = Date.now();
      const insertMessage = (data: Record<string, unknown>, openedAt: number, ttlMs: number | null) => {
        const inserted = db
          .prepare(
            `INSERT INTO events (event_type, source, owner, data, timestamp, ttl_ms)
             VALUES ('message.created', 'agent:scout', 'agent:scout', ?, ?, ?)`,
          )
          .run(JSON.stringify(data), openedAt, ttlMs);
        const openEventId = Number(inserted.lastInsertRowid);
        db.prepare(
          `INSERT INTO event_pair_runs
           (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
           VALUES ('owner_inbox', ?, ?, 'agent:scout', 'open', ?, ?)`,
        ).run(`event:${openEventId}`, openEventId, openedAt, openedAt + 2 * 60 * 60_000);
        return openEventId;
      };
      const expiredId = insertMessage(
        { from: "scout", to: "human", content: "Short-lived notice", expiresAt: now - 1 },
        now - 60_000,
        null,
      );
      const unprovedId = insertMessage(
        { from: "scout", to: "human", content: "Undelivered notice" },
        now - 3 * 60 * 60_000,
        null,
      );

      const cron = createMockCron();
      const bus = createMockBus();
      registerEventPairOrphanGc(cron as any, root, bus as any);
      const handler = cron.getHandler("event-pair-orphan-gc") as (event: unknown, signal: AbortSignal) => Promise<void>;
      await handler({}, new AbortController().signal);

      expect(bus.getEmitted()).toContainEqual(
        expect.objectContaining({
          type: "message.resolved",
          data: expect.objectContaining({ openEventId: expiredId, outcome: "expired" }),
        }),
      );
      expect(bus.getEmitted()).toContainEqual(
        expect.objectContaining({
          type: "message.resolved",
          data: expect.objectContaining({ openEventId: unprovedId, outcome: "failed" }),
        }),
      );
      expect(bus.getEmitted().some((event) => event.type === "message.created")).toBe(false);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
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
      const handler = cron.getHandler("event-pair-orphan-gc") as (event: unknown, signal: AbortSignal) => Promise<void>;
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
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toMatchObject({
        status: "orphan",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
