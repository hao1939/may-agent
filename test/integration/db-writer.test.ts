import { afterEach, describe, expect, it, beforeEach } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus, EVENT_ROW_ID, EVENT_RECORD_ONLY, type AgentEvent } from "../../src/app/core/events/bus.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
import { taskUpdateIdentity } from "../../packages/control/src/task-wake.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";

let testDir: string;
beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "may-agent-db-writer-test-"));
});
afterEach(() => {
  closeDb(testDir);
  rmSync(testDir, { recursive: true, force: true });
});

describe("DbWriter", () => {
  it("ignores flat session lifecycle events", () => {
    const writer = new DbWriter(testDir);
    const db = getDb(testDir);

    writer.handler({
      type: "session.start",
      sessionId: "s_flat",
      agent: "dev",
      task: "flat start",
      source: "runtime",
      owner: "agent:dev",
    } as any);

    expect(db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE sessionId = ?").get("s_flat")).toMatchObject({
      count: 0,
    });

    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)", [
      "s_running",
      "dev",
      "task",
      "running",
      Date.now() - 1_000,
    ]);

    writer.handler({
      type: "session.end",
      sessionId: "s_running",
      agent: "dev",
      status: "error",
      source: "runtime",
      owner: "agent:dev",
    } as any);

    expect(db.prepare("SELECT status, endedAt FROM sessions WHERE sessionId = ?").get("s_running")).toMatchObject({
      status: "running",
      endedAt: null,
    });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type IN ('session.start', 'session.end')").get(),
    ).toMatchObject({ count: 0 });
  });

  it("only journals canonical session lifecycle events, without projections or result artifacts", () => {
    const writer = new DbWriter(testDir);
    const db = getDb(testDir);
    for (const type of ["session.start", "session.idle", "session.end"]) {
      writer.handler({
        type,
        source: "runtime",
        owner: "agent:worker",
        data: { sessionId: "unowned", agent: "worker", task: "work", status: "done", summary: "Reported" },
      });
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
    expect(existsSync(join(testDir, "sessions/unowned/result.json"))).toBe(false);
    expect(db.prepare("SELECT event_type, source, owner FROM events ORDER BY id").all()).toEqual(
      ["session.start", "session.idle", "session.end"].map((event_type) => ({
        event_type,
        source: "runtime",
        owner: "agent:worker",
      })),
    );
  });
});

const liveTypes = [
  "skill.loaded", "workflow.step_started", "workflow.step_completed", "handler.workflow_dispatched",
  "project.task.reconcile.started", "project.task.reconcile.profiled", "project.task.executor.progress",
];

it.each(liveTypes)("delivers %s to live routes and listeners without journaling or losing commit ordering", async (type) => {
  const bus = new EventBus();
  const writer = new DbWriter(testDir);
  const db = getDb(testDir);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const routed: string[] = [];
  const observed: AgentEvent[] = [];
  const stops = [
    bus.subscribeDurableRoute((event) => { routed.push(`durable:${event.type}`); }),
    bus.subscribe((event) => { routed.push(`first:${event.type}`); }, { priority: "first" }),
    bus.subscribe((event) => { routed.push(`normal:${event.type}`); }),
  ];
  let delivered!: () => void;
  const notification = new Promise<void>((resolve) => { delivered = resolve; });
  stops.push(bus.listen((event) => { observed.push(event); delivered(); }, { types: [type] }));
  const input = {
    type, source: "fixture", owner: "app:sample", [EVENT_RECORD_ONLY]: true,
    data: { appId: "sample", taskId: "work/review", message: "Review in progress", stage: "running" },
  } as AgentEvent;
  try {
    expect(() => stateTransaction(db, () => {
      bus.emit(input);
      expect(routed).toEqual([]);
      throw new Error("rollback observation");
    })).toThrow("rollback observation");
    expect(routed).toEqual([]);
    expect(observed).toEqual([]);
    stateTransaction(db, () => {
      const event = bus.emit(input);
      expect(event[EVENT_ROW_ID]).toBeUndefined();
      expect(routed).toEqual([]);
    });
    expect(routed).toEqual([`durable:${type}`, `first:${type}`, `normal:${type}`]);
    await notification;
    expect(observed).toEqual([input]);
    if (type === "project.task.reconcile.started" || type === "project.task.executor.progress")
      expect(taskUpdateIdentity(observed[0])).toEqual({ appId: "sample", taskId: "work/review" });
    expect(db.prepare("SELECT count(*) AS n FROM events").get()).toEqual({ n: 0 });
    // Skipping mechanics must not swallow meaningful domain/lifecycle events.
    for (const durableType of ["session.start", "workflow.started", "project.task.reconciled", "guard.triggered", "sample.reviewed"])
      bus.emit({ type: durableType, source: "fixture", owner: "app:sample", data: {} } as AgentEvent);
    expect(db.prepare("SELECT event_type FROM events ORDER BY id").all().map((row) => row.event_type))
      .toEqual(["session.start", "workflow.started", "project.task.reconciled", "guard.triggered", "sample.reviewed"]);
  } finally { stops.forEach((stop) => stop()); }
});
