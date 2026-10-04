import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/requests.js";
import { fakeTaskAttacher } from "../../../test/fixtures/task-attachment.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus, EVENT_ROW_ID } from "../core/events/bus.js";
import { getAppEventAdmissionPlan } from "../core/state/app-event-admission-store.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Event App-admission recovery did not complete");
    await Bun.sleep(5);
  }
}

function producer(root: string): EventBus {
  const bus = new EventBus();
  bus.setPersistenceSubscriber(new DbWriter(root).handler);
  return bus;
}

async function fixture(root: string) {
  const appDir = join(root, "evaluation.app");
  mkdirSync(appDir, { recursive: true });
  const definition = defineApp({
    id: "evaluation",
    version: 1,
    agent: "evaluator",
    inputSchema: Type.Object({
      kind: Type.Literal("message"),
      data: Type.Object({ message: Type.String() }),
    }),
    task: ({ id }) => ({
      kind: "desired",
      intent: { id: `work/${id}`, parentId: "root", outcome: "Review report", acceptance: ["Reviewed"] },
    }),
    tasks: {},
    subscriptions: [{
      id: "evaluation-report",
      event: "evaluation.task_report_published",
      toInput: () => ({ kind: "message", data: { message: "Review the retained evaluation report" } }),
    }],
  });
  const registry = new AppRegistry(async () => [{ appDir, definition }]);
  await registry.reload();
  return registry;
}

test("recovers a report saved before its first App plan, independent of global delivery status", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-app-outbox-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const registry = await fixture(root);
    const event = producer(root).emit({
      type: "evaluation.task_report_published",
      source: "worker:evaluation",
      owner: "agent:evaluator",
      data: { taskId: "review/example", report: "retained", idempotencyKey: "evaluation-report:review/example" },
    } as any);
    const eventId = event[EVENT_ROW_ID]!;
    let db = getDb(root);
    expect(db.prepare("SELECT app_admission_pending FROM events WHERE id = ?").get(eventId)).toEqual({
      app_admission_pending: 1,
    });
    expect(getAppEventAdmissionPlan(db, eventId)).toBeNull();
    // Another durable route can accept the Event globally without satisfying
    // the independent App-admission outbox obligation.
    db.prepare("UPDATE events SET delivery_status = 'accepted', accepted_by = 'other-route' WHERE id = ?").run(eventId);
    closeDb(root);

    db = getDb(root);
    const bus = producer(root);
    const writer = new DbWriter(root);
    bus.setDeliveryRecorder(writer.recordDelivery);
    runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      schedulesEnabled: false,
      scanIntervalMs: 10_000,
      attachTask: fakeTaskAttacher(db, (input) => {
        return { taskId: `work/${input.inboxInputId ?? input.inputId}` };
      }),
    });
    // The marker is acknowledged once the complete plan is durable; command
    // dispatch follows asynchronously from that saved authority.
    await until(() => db.prepare("SELECT app_admission_pending FROM events WHERE id = ?").get(eventId)?.app_admission_pending === 0);
    await until(() => db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()?.count === 1);
    expect(db.prepare("SELECT origin_event_id FROM app_inbox_items").all()).toEqual([{ origin_event_id: eventId }]);
    await until(() => getAppEventAdmissionPlan(db, eventId)?.status === "completed");

    // Lost acknowledgement can expose the marker again. The saved plan and
    // stable inbox identity make the repeated transport consequentially inert.
    db.prepare("UPDATE events SET app_admission_pending = 1 WHERE id = ?").run(eventId);
    runtime.close();
    runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      schedulesEnabled: false,
      scanIntervalMs: 10_000,
      attachTask: fakeTaskAttacher(db, (input) => {
        return { taskId: `work/${input.inboxInputId ?? input.inputId}` };
      }),
    });
    await until(() => db.prepare("SELECT app_admission_pending FROM events WHERE id = ?").get(eventId)?.app_admission_pending === 0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });

    const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM events INDEXED BY idx_events_app_admission_pending
      WHERE app_admission_pending = 1 AND id > ? ORDER BY id LIMIT ?`).all(0, 64) as Array<{ detail?: string }>;
    expect(plan.some(({ detail }) => detail?.includes("idx_events_app_admission_pending"))).toBe(true);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("marker recovery acknowledges a Stop control without repeating it", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-control-outbox-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const registry = await fixture(root);
    const event = producer(root).emit({
      type: "conversation.turn.stop.requested",
      source: "control-socket",
      owner: "app:evaluation",
      data: { appId: "evaluation", conversationId: "evaluation:primary", turnId: "turn-1", expectedRevision: 1 },
    } as any);
    const eventId = event[EVENT_ROW_ID]!;
    const db = getDb(root);
    let stops = 0;
    runtime = await startAppInboxRuntime({
      db,
      bus: producer(root),
      registry,
      persistDir: root,
      schedulesEnabled: false,
      scanIntervalMs: 10_000,
      stopConversationTurn: () => { stops += 1; return { stopped: true }; },
    });
    await until(() => db.prepare("SELECT app_admission_pending FROM events WHERE id = ?").get(eventId)?.app_admission_pending === 0);
    expect(stops).toBe(0);
    expect(getAppEventAdmissionPlan(db, eventId)).toBeNull();
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
