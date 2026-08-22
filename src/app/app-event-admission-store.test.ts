import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import {
  completeAppEventAdmissionPlan,
  createAppEventAdmissionPlan,
  getAppEventAdmissionPlan,
  listPendingAppEventAdmissionPlans,
  markAppEventAdmissionCommandAdmitted,
  recordAppEventAdmissionCommandFailure,
} from "./app-event-admission-store.js";

let root: string | undefined;
let db: SqliteDb | undefined;

function fixture(): SqliteDb {
  root = mkdtempSync(join(tmpdir(), "may-app-admission-"));
  db = openDatabase(join(root, "may.db"));
  applyDbSchema(db);
  db.prepare(
    `INSERT INTO events (id, event_type, data, timestamp)
     VALUES (101, 'sample.changed', '{}', 1000)`,
  ).run();
  return db;
}

afterEach(() => {
  db?.close();
  db = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe("App event admission store", () => {
  it("freezes one route kind and validated payload per App", () => {
    const database = fixture();
    const plan = createAppEventAdmissionPlan(database, {
      eventId: 101,
      registrySnapshotId: "boot-a:7",
      registryGeneration: 7,
      now: 1100,
      routes: [
        {
          appId: "evaluation",
          kind: "inbox",
          routeId: "owner-review",
          input: { kind: "review", data: { finding: "f-1" } },
          conditionTaskIds: ["wait/review"],
        },
        {
          appId: "alpha-project",
          kind: "task",
          routeId: "work/f-1",
          intent: {
            id: "work/f-1",
            outcome: "Resolve finding f-1",
            acceptance: ["The finding is resolved."],
            mode: "achieve",
          },
          conditionTaskIds: ["wait/f-1"],
        },
      ],
    });

    expect(plan).toMatchObject({
      eventId: 101,
      registrySnapshotId: "boot-a:7",
      registryGeneration: 7,
      status: "pending",
      commands: [
        {
          appId: "alpha-project",
          kind: "task",
          routeId: "work/f-1",
          status: "pending",
        },
        {
          appId: "evaluation",
          kind: "inbox",
          routeId: "owner-review",
          payloadVersion: 2,
          conditionTaskIds: ["wait/review"],
          status: "pending",
        },
      ],
    });
    database.prepare("DELETE FROM events WHERE id = 101").run();
    expect(database.prepare("SELECT id FROM events WHERE id = 101").get()).toEqual({ id: 101 });

    const replay = createAppEventAdmissionPlan(database, {
      eventId: 101,
      registrySnapshotId: "boot-b:8",
      registryGeneration: 8,
      routes: [
        {
          appId: "evaluation",
          kind: "task",
          routeId: "replacement",
          intent: null,
          conditionTaskIds: ["replacement"],
        },
      ],
    });
    expect(replay).toEqual(plan);
  });

  it("records partial admission and completes only after every command", () => {
    const database = fixture();
    createAppEventAdmissionPlan(database, {
      eventId: 101,
      registrySnapshotId: "boot-a:3",
      registryGeneration: 3,
      now: 1200,
      routes: [
        {
          appId: "may",
          kind: "inbox",
          routeId: "human-decision",
          input: { kind: "human-decision", data: { message: "decide" } },
          conditionTaskIds: [],
        },
        {
          appId: "platform",
          kind: "exact-task",
          routeId: "work/exact",
          targetedTaskId: "work/exact",
          conditionTaskIds: [],
        },
      ],
    });

    markAppEventAdmissionCommandAdmitted(database, {
      eventId: 101,
      appId: "may",
      now: 1300,
    });
    recordAppEventAdmissionCommandFailure(database, {
      eventId: 101,
      appId: "platform",
      error: new Error("task runtime unavailable"),
      now: 1400,
    });
    expect(completeAppEventAdmissionPlan(database, 101, 1500)).toBeFalse();
    expect(getAppEventAdmissionPlan(database, 101)).toMatchObject({
      status: "pending",
      lastError: "task runtime unavailable",
      commands: [
        { appId: "may", status: "admitted" },
        {
          appId: "platform",
          status: "pending",
          lastError: "task runtime unavailable",
        },
      ],
    });

    markAppEventAdmissionCommandAdmitted(database, {
      eventId: 101,
      appId: "platform",
      now: 1600,
    });
    expect(completeAppEventAdmissionPlan(database, 101, 1700)).toBeTrue();
    expect(getAppEventAdmissionPlan(database, 101)).toMatchObject({
      status: "completed",
      lastError: undefined,
      completedAt: 1700,
    });
  });

  it("reads only a bounded due slice for recovery", () => {
    const database = fixture();
    database
      .prepare(
        `INSERT INTO events (id, event_type, data, timestamp)
         VALUES (102, 'sample.changed', '{}', 1001), (103, 'sample.changed', '{}', 1002)`,
      )
      .run();
    for (const [eventId, now] of [
      [101, 1_000],
      [102, 2_000],
      [103, 3_000],
    ] as const) {
      createAppEventAdmissionPlan(database, {
        eventId,
        registrySnapshotId: "boot-a:1",
        registryGeneration: 1,
        now,
        routes: [
          {
            appId: "sample",
            kind: "task",
            routeId: `work/${eventId}`,
            intent: null,
            conditionTaskIds: [],
          },
        ],
      });
    }

    expect(listPendingAppEventAdmissionPlans(database, { updatedBefore: 2_500, limit: 1 })).toMatchObject([
      { eventId: 101 },
    ]);
    expect(listPendingAppEventAdmissionPlans(database, { updatedBefore: 2_500, limit: 10 })).toMatchObject([
      { eventId: 101 },
      { eventId: 102 },
    ]);
    expect(() => listPendingAppEventAdmissionPlans(database, { limit: 0 })).toThrow(
      "recovery limit must be an integer",
    );
  });

  it("replays the retained version-one inbox payload without inventing Condition wakes", () => {
    const database = fixture();
    database
      .prepare(
        `INSERT INTO app_event_admission_plans
           (event_id, registry_snapshot_id, registry_generation, status, created_at, updated_at)
         VALUES (101, 'legacy:unknown', 1, 'pending', 1000, 1000)`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO app_event_admission_commands
           (event_id, app_id, route_kind, route_id, payload_version, payload, status, updated_at)
         VALUES (101, 'may', 'inbox', 'message', 1, ?, 'pending', 1000)`,
      )
      .run(JSON.stringify({ input: { kind: "message", data: { text: "retained" } } }));

    expect(getAppEventAdmissionPlan(database, 101)).toMatchObject({
      registrySnapshotId: "legacy:unknown",
      commands: [
        {
          appId: "may",
          kind: "inbox",
          payloadVersion: 1,
          input: { kind: "message", data: { text: "retained" } },
          conditionTaskIds: [],
          status: "pending",
        },
      ],
    });
  });

  it("rejects two route authorities for one App", () => {
    const database = fixture();
    expect(() =>
      createAppEventAdmissionPlan(database, {
        eventId: 101,
        registrySnapshotId: "boot-a:1",
        registryGeneration: 1,
        routes: [
          {
            appId: "sample",
            kind: "inbox",
            routeId: "request",
            input: { kind: "request", data: {} },
            conditionTaskIds: [],
          },
          {
            appId: "sample",
            kind: "task",
            routeId: "work/sample",
            intent: null,
            conditionTaskIds: ["work/sample"],
          },
        ],
      }),
    ).toThrow("multiple routes for App sample");
  });
});
