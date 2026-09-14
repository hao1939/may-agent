import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus, EVENT_ROW_ID } from "../../src/app/core/events/bus.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb, upsertSession } from "../../src/lib/requests.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { appTaskContext, observeAppTaskIntent, claimObservedAppTask, completeAppTask } from "../../src/app/core/tasks/app-task-reconciler.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => { closeDb(root); rmSync(root, { recursive: true, force: true }); }));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-escalation-feedback-"));
  roots.push(root);
  const db = getDb(root);
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot({ project: "sample", project_lifecycle: "active", root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } } }, "fixture");
  const context = () => appTaskContext({ appDir: root, projectDir: root, agent: "worker", maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.fromDb(getDb(root), "sample") });
  observeAppTaskIntent(context(), { appAgent: "worker", intent: { id: "work", parentId: "root", outcome: "Handle feedback", acceptance: ["Reviewed"] } });
  const claim = claimObservedAppTask(context(), { taskId: "work", appAgent: "worker", handler: "agent" });
  if (claim.kind !== "claimed") throw new Error("Expected claim");
  completeAppTask(context(), claim, { summary: "Current" });
  upsertSession(root, { sessionId: "old-session", agent: "worker", task: "Work", status: "done", startedAt: 1,
    taskBinding: { appId: "sample", taskId: "work", generation: 1, attemptId: claim.attemptId } });
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const created = bus.emit({ type: "escalation.created", source: "test", owner: "agent:reviewer",
    data: { escalationId: "question", sourceSessionId: "old-session", reason: "Need a decision" } });
  return { root, db, bus, context, created };
}

test.each(["answered", "needs_human", "superseded"])("%s is ordinary feedback, durable even with no listener or session", outcome => {
  const f = fixture();
  const event = f.bus.emit({ type: "escalation.resolved", source: "test", owner: "agent:reviewer",
    data: { openEventId: f.created[EVENT_ROW_ID], outcome, summary: "Review the latest facts", idempotencyKey: "reply" } });
  expect(event.target).toEqual({ appId: "sample", taskId: "work" });
  closeDb(f.root);
  const claim = claimObservedAppTask(f.context(), { taskId: "work", appAgent: "worker", handler: "agent", reason: "passive-resync" });
  expect(claim.kind).toBe("claimed");
  if (claim.kind !== "claimed") throw new Error("Expected recovery claim");
  expect(claim.events.map(entry => entry.event.eventId)).toContain(event[EVENT_ROW_ID]);
  expect(claim.events.find(entry => entry.event.eventId === event[EVENT_ROW_ID])?.event.data).toMatchObject({ outcome });
});

test("feedback admission rolls back if the exact durable wake cannot be saved, then retry succeeds once", () => {
  const f = fixture();
  f.db.exec("CREATE TRIGGER reject_wake BEFORE UPDATE ON app_tasks BEGIN SELECT RAISE(ABORT, 'wake unavailable'); END");
  const publish = () => f.bus.emit({ type: "escalation.resolved", source: "test", owner: "agent:reviewer",
    data: { escalationId: "question", outcome: "answered", idempotencyKey: "reply" } });
  expect(publish).toThrow("wake unavailable");
  expect(f.db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'escalation.resolved'").get()).toEqual({ n: 0 });
  f.db.exec("DROP TRIGGER reject_wake");
  const first = publish();
  expect(publish()[EVENT_ROW_ID]).toBe(first[EVENT_ROW_ID]);
  expect(f.context().resourceStore.readTrigger("work")?.events).toHaveLength(1);
});

test("unknown ownership is visible; no guessed App or resumed session", () => {
  const f = fixture();
  const event = f.bus.emit({ type: "escalation.resolved", source: "test", owner: "agent:reviewer",
    data: { escalationId: "unknown", outcome: "answered" } });
  expect(event.target).toBeUndefined();
  expect(event.data).toMatchObject({ feedbackRoute: "unresolved" });
  expect(f.context().resourceStore.readTrigger("work")).toBeNull();
});

test("an explicit Task address needs no historical escalation or session lookup", () => {
  const f = fixture();
  const event = f.bus.emit({ type: "escalation.resolved", source: "test", owner: "app:sample",
    target: { appId: "sample", taskId: "work" },
    data: { escalationId: "external-question", outcome: "answered" } });
  expect(event.data).toMatchObject({ feedbackRoute: "task" });
  expect(f.context().resourceStore.readTrigger("work")?.events?.[0]?.event.eventId).toBe(event[EVENT_ROW_ID]);
});
