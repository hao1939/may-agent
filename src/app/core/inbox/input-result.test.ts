import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { fakeTaskAttacher } from "../../../../test/fixtures/task-attachment.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { EventBus, EVENT_ROW_ID } from "../events/bus.js";
import type { AppInboxItem } from "../state/app-inbox-store.js";
import { AppInboxHost } from "./app-inbox-host.js";
import { appInputFeedbackEvent } from "./input-result.js";

const item: AppInboxItem = {
  id: "request-a", appId: "worker", source: { kind: "app", id: "caller" },
  input: { kind: "message", data: {} }, status: "handling",
  waitingOn: { kind: "task", id: "child" }, createdAt: 1, changedAt: 1, updatedAt: 1,
};
const report = { attemptId: "attempt-a", reportRevision: 1, summary: "Waiting for review" };
let root: string;
let bus: EventBus;
let route: "direct" | "noop" | undefined;
let routed: number;
let published: number;

function connect() {
  bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDurableRouteRecorder(writer.recordDurableRoute);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.subscribeDurableRoute(() => {
    routed++;
    return route ? { accepted: true, by: "caller", route } : undefined;
  }, { label: "test-durable-route-101" });
  bus.subscribe(() => { published++; });
}

function countEvents() {
  return Number(getDb(root).prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'app.dependency.updated'").get()!.count);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "may-report-publication-"));
  route = "direct";
  routed = published = 0;
  connect();
});
afterEach(() => {
  closeDb(root);
  rmSync(root, { recursive: true, force: true });
});

test("repeated result recovery reuses a report across restart, then publishes its revision and answer", async () => {
  const app = defineApp({
    id: "worker", version: 1, agent: "worker-owner",
    inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
    tasks: {},
    task: () => ({ kind: "desired", intent: {
      id: "child", parentId: "root", outcome: "Answer the caller", acceptance: ["Verified"],
    } }),
  });
  let revision = 1;
  let done = false;
  const createHost = () => new AppInboxHost({
    db: getDb(root), apps: [app],
    attachTask: fakeTaskAttacher(getDb(root), () => ({ taskId: "child" })),
    readDependency: async ({ dependency }) => done
      ? { ...dependency, status: "done", summary: "Verified" }
      : { ...dependency, status: "pending", report: { ...report, reportRevision: revision } },
    onRequestUpdated: (request, result, status) => { bus.emit(appInputFeedbackEvent(request, result, status)!); },
  });
  let host = createHost();
  try {
    host.admit({ id: item.id, appId: item.appId, source: item.source, input: item.input });
    await host.refreshTaskResults("worker", "child");
    for (let i = 0; i < 10; i++) await host.recoverTaskResults();
    expect([countEvents(), routed, published]).toEqual([1, 1, 1]);
    expect(host.get(item.id)?.status).toBe("handling");

    host.close();
    closeDb(root);
    connect();
    host = createHost();
    await host.recoverTaskResults();
    expect([countEvents(), routed, published]).toEqual([1, 1, 1]);

    // A newly selected report remains new evidence even with identical wording.
    revision++;
    await host.recoverTaskResults();
    expect([countEvents(), routed, published]).toEqual([2, 2, 2]);
    expect(host.get(item.id)?.status).toBe("handling");
    done = true;
    await host.recoverTaskResults();
    await host.recoverTaskResults();
    expect([countEvents(), routed, published]).toEqual([3, 3, 3]);
    expect(host.get(item.id)).toMatchObject({ status: "done", result: { summary: "Verified" } });
  } finally {
    host.close();
  }
});

test("separate requests and final answers retain their own publication identity", () => {
  const emit = (request = item, status: "blocked" | "done" = "blocked") =>
    bus.emit(appInputFeedbackEvent(request, report, status)!)[EVENT_ROW_ID];
  const first = emit();
  expect(emit()).toBe(first);
  const other = { ...item, id: "request-b" };
  const second = emit(other);
  expect(second).not.toBe(first);
  expect(emit(other)).toBe(second);
  const answer = emit(item, "done");
  expect(answer).not.toBe(first);
  expect(emit(item, "done")).toBe(answer);
  expect([countEvents(), routed, published]).toEqual([3, 3, 3]);
});

for (const initialRoute of [undefined, "noop"] as const) {
  test(`retries failed persistence and ${initialRoute ?? "pending"} delivery without another report record`, () => {
    const db = getDb(root);
    const emit = () => bus.emit(appInputFeedbackEvent(item, report, "blocked")!)[EVENT_ROW_ID];
    db.exec(`CREATE TRIGGER fail_report BEFORE INSERT ON events
      WHEN NEW.event_type = 'app.dependency.updated'
      BEGIN SELECT RAISE(ABORT, 'report storage unavailable'); END`);
    expect(emit).toThrow("report storage unavailable");
    expect([countEvents(), routed, published]).toEqual([0, 0, 0]);
    db.exec("DROP TRIGGER fail_report");

    route = initialRoute;
    const saved = emit();
    expect(emit()).toBe(saved);
    expect([countEvents(), routed, published]).toEqual([1, 2, 1]);
    route = "direct";
    expect(emit()).toBe(saved);
    expect(emit()).toBe(saved);
    expect([countEvents(), routed, published]).toEqual([1, 3, 1]);
    expect(db.prepare("SELECT delivery_status, delivery_route FROM events WHERE id = ?").get(saved)).toEqual({
      delivery_status: "accepted", delivery_route: "direct",
    });
  });
}
