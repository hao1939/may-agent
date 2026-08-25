import { afterEach, describe, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { HUMAN_TASK_LIST_TEXT_MAX_BYTES, HumanTaskService } from "./human-task-service.js";
import { claimNextAppInboxItem, createAppInboxItem, waitAppInboxClaim } from "./app-inbox-store.js";
import {
  ensureTaskReferenceIndex,
  indexTaskReference,
  resolveTaskReference,
  taskReferenceDigest,
} from "./task-reference-index.js";

const databases: SqliteDb[] = [];

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

function database(): SqliteDb {
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  return db;
}

function registry(...ids: string[]) {
  return {
    snapshot: () => ({
      id: "test:1",
      generation: 1,
      entries: ids.map((id) => ({
        appDir: `/tmp/${id}.app`,
        definition: {
          id,
          version: 1 as const,
          owner: `${id}-owner`,
          description: `${id} description`,
          inputSchema: {} as never,
        },
      })),
    }),
  };
}

function insertTask(
  db: SqliteDb,
  input: {
    appId: string;
    taskId: string;
    phase: string;
    updatedAt: number;
    mode?: "achieve" | "maintain";
    ready?: boolean;
    acceptance?: string[];
    category?: string;
  },
): void {
  const resource = {
    metadata: { id: input.taskId, generation: 2, resourceVersion: 3 },
    spec: {
      parentId: "root",
      outcome: `Handle ${input.taskId}`,
      acceptance: input.acceptance ?? ["done"],
      mode: input.mode ?? "achieve",
      owner: `${input.appId}-owner`,
      ...(input.category ? { category: input.category } : {}),
    },
    status: {
      observedGeneration: 2,
      phase: input.phase,
      summary: `${input.taskId} summary`,
      updatedAt: new Date(input.updatedAt).toISOString(),
    },
  };
  db.prepare(
    `INSERT INTO app_tasks(
       app_id, task_id, generation, resource_version, observed_generation, phase, lane,
       changed, ready, updated_at, resource_json
     ) VALUES (?, ?, 2, 3, 2, ?, 'normal', 0, ?, ?, ?)`,
  ).run(input.appId, input.taskId, input.phase, input.ready ? 1 : 0, input.updatedAt, JSON.stringify(resource));
}

test("hides internal maintenance Tasks from ordinary human lists and App counts", () => {
  const db = database();
  insertTask(db, { appId: "may", taskId: "conversation/follow-up", phase: "waiting", updatedAt: 2, category: "internal" });
  insertTask(db, { appId: "may", taskId: "goal/review", phase: "running", updatedAt: 1 });
  const service = new HumanTaskService(db, registry("may"));

  expect(service.listTasks({ appId: "may" }).items.map((task) => task.taskId)).toEqual(["goal/review"]);
  expect(service.listApps("may")).toEqual([
    expect.objectContaining({ id: "may", activeTasks: 1, runningTasks: 1, waitingTasks: 0 }),
  ]);
  expect(service.getTask({ appId: "may", taskId: "conversation/follow-up" })).toMatchObject({
    taskId: "conversation/follow-up",
    status: "waiting",
  });
});

function insertReceipt(db: SqliteDb, appId: string, taskId: string, completedAt: number): void {
  db.prepare(
    `INSERT INTO app_task_receipts(app_id, receipt_id, parent_id, completed_at, receipt_json)
     VALUES (?, ?, 'root', ?, ?)`,
  ).run(
    appId,
    taskId,
    completedAt,
    JSON.stringify({
      metadata: { id: taskId, generation: 4, resourceVersion: 5 },
      specHash: "hash",
      parentId: "root",
      outcome: `Finish ${taskId}`,
      acceptance: ["done"],
      owner: `${appId}-owner`,
      handler: "agent",
      summary: `${taskId} finished`,
      response: `${taskId} result`,
      evidence: ["proof"],
      acceptanceBasis: { kind: "owner" },
      failureFingerprints: [],
      completedAt: new Date(completedAt).toISOString(),
    }),
  );
}

function insertProgress(
  db: SqliteDb,
  input: { appId: string; taskId: string; timestamp: number; stage: string; message?: string; status?: string },
): void {
  db.prepare(
    `INSERT INTO events(event_type, data, project_id, task_id, timestamp)
     VALUES ('project.task.executor.progress', ?, ?, ?, ?)`,
  ).run(
    JSON.stringify({
      stage: input.stage,
      ...(input.message ? { message: input.message } : {}),
      ...(input.status ? { status: input.status } : {}),
    }),
    input.appId,
    input.taskId,
    input.timestamp,
  );
}

function insertCondition(
  db: SqliteDb,
  input: {
    appId: string;
    taskId: string;
    conditionId: string;
    owner?: string;
    requestedAction?: string;
    createdAt?: string;
    state?: "unknown" | "false" | "true";
  },
): void {
  const state = input.state ?? "unknown";
  const condition = {
    metadata: { id: input.conditionId, generation: 2, resourceVersion: 1 },
    spec: {
      type: "project.approval.submitted",
      subject: `task:${input.taskId}`,
      expected: { field: "decision", anyOf: ["approve", "reject"] },
      ...(input.requestedAction ? { requestedAction: input.requestedAction } : {}),
      ...(input.owner ? { owner: input.owner } : {}),
    },
    status: { observedGeneration: 2, state, ...(input.createdAt ? { createdAt: input.createdAt } : {}) },
  };
  db.prepare("INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES (?, ?, ?, ?)").run(
    input.appId,
    input.conditionId,
    state,
    JSON.stringify(condition),
  );
  db.prepare("INSERT INTO app_task_condition_routes(app_id, task_id, condition_id) VALUES (?, ?, ?)").run(
    input.appId,
    input.taskId,
    input.conditionId,
  );
}

describe("Task reference index", () => {
  test("derives stable length-safe references and backfills live and completed identities", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "one", phase: "running", updatedAt: 20 });
    insertReceipt(db, "beta", "two", 10);
    ensureTaskReferenceIndex(db);

    const digest = taskReferenceDigest("alpha", "one");
    expect(digest).toHaveLength(64);
    expect(taskReferenceDigest("alpha.app", "one")).toBe(digest);
    expect(resolveTaskReference(db, digest.slice(0, 8))).toEqual({
      kind: "resolved",
      task: { appId: "alpha", taskId: "one", digest },
    });
    expect(resolveTaskReference(db, taskReferenceDigest("beta", "two").slice(0, 8))).toMatchObject({
      kind: "resolved",
      task: { appId: "beta", taskId: "two" },
    });
    const count = db.prepare("SELECT COUNT(*) AS count FROM app_task_refs").get() as { count: number };
    ensureTaskReferenceIndex(db);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_task_refs").get()).toEqual(count);
  });

  test("backfills all references atomically", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "one", phase: "running", updatedAt: 20 });
    insertReceipt(db, "beta", "two", 10);
    db.exec(`
      CREATE TRIGGER reject_second_task_reference
      BEFORE INSERT ON app_task_refs WHEN NEW.task_id = 'two'
      BEGIN SELECT RAISE(ABORT, 'test backfill failure'); END;
    `);

    expect(() => ensureTaskReferenceIndex(db)).toThrow("test backfill failure");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_task_refs").get()).toEqual({ count: 0 });

    db.exec("DROP TRIGGER reject_second_task_reference");
    ensureTaskReferenceIndex(db);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_task_refs").get()).toEqual({ count: 2 });
  });

  test("rejects an ambiguous short prefix instead of choosing list order", () => {
    const db = database();
    const first = "12345678" + "0".repeat(56);
    const second = "12345678" + "1".repeat(56);
    db.prepare(
      `INSERT INTO app_task_refs(digest, prefix8, prefix16, app_id, task_id, indexed_at)
       VALUES (?, '12345678', ?, ?, ?, 1)`,
    ).run(first, first.slice(0, 16), "alpha", "one");
    db.prepare(
      `INSERT INTO app_task_refs(digest, prefix8, prefix16, app_id, task_id, indexed_at)
       VALUES (?, '12345678', ?, ?, ?, 1)`,
    ).run(second, second.slice(0, 16), "beta", "two");

    expect(resolveTaskReference(db, "12345678")).toMatchObject({
      kind: "ambiguous",
      candidates: [
        { appId: "alpha", taskId: "one" },
        { appId: "beta", taskId: "two" },
      ],
    });
    expect(resolveTaskReference(db, first.slice(0, 16))).toMatchObject({
      kind: "resolved",
      task: { appId: "alpha", taskId: "one" },
    });
  });
});

describe("Human Task service", () => {
  test("derives human actions only from explicit unsatisfied human Conditions", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "approval", phase: "waiting", updatedAt: 40 });
    insertTask(db, { appId: "alpha", taskId: "external", phase: "waiting", updatedAt: 30 });
    insertTask(db, { appId: "alpha", taskId: "broken", phase: "attention", updatedAt: 20 });
    insertTask(db, { appId: "beta", taskId: "input", phase: "waiting", updatedAt: 10 });
    insertCondition(db, {
      appId: "alpha",
      taskId: "approval",
      conditionId: "human-approval",
      owner: "human:operator",
      createdAt: "2026-08-20T01:02:03.000Z",
    });
    insertCondition(db, { appId: "alpha", taskId: "external", conditionId: "external-fact" });
    insertCondition(db, {
      appId: "beta",
      taskId: "input",
      conditionId: "human-input",
      owner: "human",
      requestedAction: "Provide the rollout window.",
    });
    const service = new HumanTaskService(db, registry("alpha", "beta"));

    expect(service.listTasks({ appId: "alpha", humanActionOnly: true })).toMatchObject({
      total: 1,
      items: [
        {
          appId: "alpha",
          taskId: "approval",
          status: "waiting",
          humanAction: {
            requestedAction: "Choose approve or reject for task:approval.",
            since: Date.parse("2026-08-20T01:02:03.000Z"),
          },
        },
      ],
    });
    expect(service.listTasks({ humanActionOnly: true }).items.map((task) => task.taskId)).toEqual([
      "approval",
      "input",
    ]);
    expect(service.getTask({ appId: "alpha", taskId: "approval" })?.humanAction).toEqual({
      requestedAction: "Choose approve or reject for task:approval.",
      since: Date.parse("2026-08-20T01:02:03.000Z"),
    });
    expect(service.getTask({ appId: "beta", taskId: "input" })?.humanAction).toEqual({
      requestedAction: "Provide the rollout window.",
    });
    expect(service.getTask({ appId: "alpha", taskId: "external" })?.humanAction).toBeUndefined();

    db.prepare(
      "UPDATE app_task_conditions SET state = 'true', condition_json = json_set(condition_json, '$.status.state', 'true') WHERE app_id = 'alpha' AND condition_id = 'human-approval'",
    ).run();
    expect(service.listTasks({ appId: "alpha", humanActionOnly: true })).toMatchObject({ total: 0, items: [] });
  });

  test("lists Apps and bounded Tasks from indexed resource rows", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "old", phase: "waiting", updatedAt: 10 });
    insertTask(db, { appId: "beta", taskId: "new", phase: "attention", updatedAt: 30 });
    insertReceipt(db, "alpha", "done", 20);
    const service = new HumanTaskService(db, registry("alpha", "beta"));

    expect(service.listApps()).toEqual([
      expect.objectContaining({ id: "alpha", activeTasks: 1, waitingTasks: 1 }),
      expect.objectContaining({ id: "beta", activeTasks: 1, attentionTasks: 1 }),
    ]);
    const first = service.listTasks({ includeDone: true, limit: 2 });
    expect(first.items.map((item) => [item.appId, item.taskId, item.status])).toEqual([
      ["beta", "new", "attention"],
      ["alpha", "done", "done"],
    ]);
    expect(first.items.every((item) => /^[0-9a-f]{8}$/.test(item.ref))).toBe(true);
    expect(first.nextCursor).toBeString();
    expect(service.listTasks({ includeDone: true, limit: 2, cursor: first.nextCursor }).items).toEqual([
      expect.objectContaining({ appId: "alpha", taskId: "old", status: "waiting" }),
    ]);
  });

  test("explains queued state and keeps exact acceptance criteria in detail only", () => {
    const db = database();
    insertTask(db, {
      appId: "gym",
      taskId: "deduplicate",
      phase: "pending",
      updatedAt: 10,
      ready: true,
      acceptance: ["List the identity evidence.", "Cancel only proven duplicates."],
    });
    const service = new HumanTaskService(db, registry("gym"));

    expect(service.getTask({ appId: "gym", taskId: "deduplicate" })).toMatchObject({
      status: "pending",
      statusDetail: "Accepted and ready to start; no attempt is running.",
      acceptance: ["List the identity evidence.", "Cancel only proven duplicates."],
    });
    const card = service.listTasks().items[0]!;
    expect(card.statusDetail).toBe("Accepted and ready to start; no attempt is running.");
    expect(card.acceptance).toBeUndefined();
  });

  test("marks normal Task lists only when an open human-owned Condition needs action", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "review", phase: "attention", updatedAt: 20 });
    insertTask(db, { appId: "alpha", taskId: "approval", phase: "waiting", updatedAt: 10 });
    insertCondition(db, {
      appId: "alpha",
      taskId: "approval",
      conditionId: "human-approval",
      owner: "human",
      requestedAction: "Approve or reject the rollout.",
    });
    const service = new HumanTaskService(db, registry("alpha"));

    const tasks = service.listTasks().items;
    expect(tasks.find((task) => task.taskId === "review")?.humanAction).toBeUndefined();
    expect(tasks.find((task) => task.taskId === "approval")?.humanAction).toEqual({
      requestedAction: "Approve or reject the rollout.",
    });
  });

  test("resolves exact detail by stable ref and preserves terminal results", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "maintain", phase: "running", updatedAt: 10, mode: "maintain" });
    insertReceipt(db, "alpha", "finished", 20);
    indexTaskReference(db, "alpha", "maintain");
    indexTaskReference(db, "alpha", "finished");
    const service = new HumanTaskService(db, registry("alpha"));

    const maintain = service.getTask({ ref: taskReferenceDigest("alpha", "maintain").slice(0, 8) });
    expect(maintain).toMatchObject({ appId: "alpha", taskId: "maintain", cancellable: false, terminal: false });
    const finished = service.getTask({ ref: taskReferenceDigest("alpha", "finished").slice(0, 8) });
    expect(finished).toMatchObject({
      appId: "alpha",
      taskId: "finished",
      status: "done",
      terminal: true,
      response: "finished result",
    });
  });

  test("projects only the latest passive executor progress into live Task detail", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "review", phase: "running", updatedAt: 10 });
    insertTask(db, { appId: "alpha", taskId: "other", phase: "running", updatedAt: 11 });
    insertProgress(db, {
      appId: "alpha",
      taskId: "review",
      timestamp: 20,
      stage: "turn-started",
      status: "inProgress",
    });
    insertProgress(db, {
      appId: "alpha",
      taskId: "other",
      timestamp: 30,
      stage: "intermediate",
      message: "Must not leak",
    });
    insertProgress(db, {
      appId: "alpha",
      taskId: "review",
      timestamp: 40,
      stage: "intermediate",
      message: "Inspecting the current behavior",
    });
    insertProgress(db, {
      appId: "alpha",
      taskId: "review",
      timestamp: 50,
      stage: "turn-completed",
      status: "completed",
    });
    const service = new HumanTaskService(db, registry("alpha"));

    expect(service.getTask({ appId: "alpha", taskId: "review" })?.progress).toEqual({
      stage: "intermediate",
      message: "Inspecting the current behavior",
      updatedAt: 40,
    });
    expect(service.listTasks().items.find((task) => task.taskId === "review")?.progress).toBeUndefined();
  });

  test("shows exact Task dependencies instead of internal App request ids", () => {
    const db = database();
    insertTask(db, { appId: "may", taskId: "conversation/one", phase: "waiting", updatedAt: 20 });
    insertTask(db, { appId: "evaluation", taskId: "review/docs", phase: "running", updatedAt: 30 });
    const request = createAppInboxItem(db, {
      id: "appdep_child",
      appId: "evaluation",
      source: { kind: "app", id: "may" },
      input: { kind: "probe", data: {} },
      now: 10,
    });
    const claim = claimNextAppInboxItem(db, "evaluation", "worker", 1_000, 11);
    if (!claim) throw new Error("expected child request claim");
    expect(request.item.id).toBe("appdep_child");
    expect(waitAppInboxClaim(db, claim, { kind: "task", id: "review/docs" }, { now: 12 })).toBe(true);

    const parent = db
      .prepare("SELECT resource_json FROM app_tasks WHERE app_id = 'may' AND task_id = 'conversation/one'")
      .get() as { resource_json: string };
    const parentResource = JSON.parse(parent.resource_json);
    parentResource.status.conditionIds = ["app-request:appdep_child"];
    db.prepare("UPDATE app_tasks SET resource_json = ? WHERE app_id = 'may' AND task_id = 'conversation/one'").run(
      JSON.stringify(parentResource),
    );
    const condition = {
      metadata: { id: "app-request:appdep_child", generation: 1, resourceVersion: 1 },
      spec: {
        type: "app.dependency.completed",
        subject: "id:appdep_child",
        expected: { field: "status", equals: "done" },
      },
      status: { observedGeneration: 1, state: "unknown" },
    };
    db.prepare(
      "INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES ('may', ?, 'unknown', ?)",
    ).run(condition.metadata.id, JSON.stringify(condition));
    db.prepare(
      "INSERT INTO app_task_condition_routes(app_id, task_id, condition_id) VALUES ('may', 'conversation/one', ?)",
    ).run(condition.metadata.id);

    const service = new HumanTaskService(db, registry("may", "evaluation"));
    expect(service.getTask({ appId: "may", taskId: "conversation/one" })?.waitingOn).toEqual([
      expect.objectContaining({
        kind: "task",
        appId: "evaluation",
        taskId: "review/docs",
        status: "running",
        outcome: "Handle review/docs",
      }),
    ]);
    expect(service.getTask({ appId: "evaluation", taskId: "review/docs" })?.requestedBy).toEqual(
      expect.objectContaining({
        appId: "may",
        taskId: "conversation/one",
        status: "waiting",
        outcome: "Handle conversation/one",
      }),
    );
  });

  test("lets a terminal Task result replace passive executor progress", () => {
    const db = database();
    insertReceipt(db, "alpha", "finished", 20);
    insertProgress(db, {
      appId: "alpha",
      taskId: "finished",
      timestamp: 30,
      stage: "intermediate",
      message: "Stale in-flight observation",
    });
    const service = new HumanTaskService(db, registry("alpha"));

    const finished = service.getTask({ appId: "alpha", taskId: "finished" });
    expect(finished).toMatchObject({
      terminal: true,
      response: "finished result",
    });
    expect(finished?.progress).toBeUndefined();
  });

  test("keeps list cards bounded and reserves full results for exact detail", () => {
    const db = database();
    insertReceipt(db, "alpha", "large", 20);
    const row = db
      .prepare("SELECT receipt_json FROM app_task_receipts WHERE app_id = 'alpha' AND receipt_id = 'large'")
      .get() as {
      receipt_json: string;
    };
    const receipt = JSON.parse(row.receipt_json);
    receipt.outcome = "目".repeat(1_000);
    receipt.summary = "摘".repeat(1_000);
    receipt.response = "full response";
    receipt.evidence = ["full evidence"];
    db.prepare("UPDATE app_task_receipts SET receipt_json = ? WHERE app_id = 'alpha' AND receipt_id = 'large'").run(
      JSON.stringify(receipt),
    );
    const service = new HumanTaskService(db, registry("alpha"));

    const card = service.listTasks({ includeDone: true }).items[0]!;
    expect(Buffer.byteLength(card.outcome, "utf8")).toBeLessThanOrEqual(HUMAN_TASK_LIST_TEXT_MAX_BYTES);
    expect(Buffer.byteLength(card.summary!, "utf8")).toBeLessThanOrEqual(HUMAN_TASK_LIST_TEXT_MAX_BYTES);
    expect(card.outcome.endsWith("…")).toBe(true);
    expect(card.response).toBeUndefined();
    expect(card.evidence).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(card), "utf8")).toBeLessThan(2_048);

    const detail = service.getTask({ ref: card.ref });
    expect(detail?.outcome).toBe(receipt.outcome);
    expect(detail?.summary).toBe(receipt.summary);
    expect(detail?.response).toBe("full response");
    expect(detail?.evidence).toEqual(["full evidence"]);
  });

  test("does not project a stale live row as active after its completion receipt exists", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "completed-but-stale", phase: "attention", updatedAt: 30 });
    insertReceipt(db, "alpha", "completed-but-stale", 40);
    const service = new HumanTaskService(db, registry("alpha"));

    expect(service.listTasks().items).toEqual([]);
    expect(service.listApps()).toEqual([expect.objectContaining({ id: "alpha", activeTasks: 0, attentionTasks: 0 })]);
    expect(service.listTasks({ includeDone: true }).items).toEqual([
      expect.objectContaining({ taskId: "completed-but-stale", status: "done", terminal: true }),
    ]);
  });

  test("persists Task-level cancellation, fences the attempt, and removes it from active work", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "work", phase: "running", updatedAt: 10 });
    const row = db.prepare("SELECT resource_json FROM app_tasks WHERE app_id = 'alpha' AND task_id = 'work'").get() as {
      resource_json: string;
    };
    const resource = JSON.parse(row.resource_json);
    resource.status.currentAttemptId = "attempt-1";
    db.prepare(
      `INSERT INTO app_task_attempts(
         app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json
       ) VALUES ('alpha', 'attempt-1', 'work', 2, 'running', 5, ?)`,
    ).run(
      JSON.stringify({
        metadata: { id: "attempt-1", resourceVersion: 1 },
        taskId: "work",
        taskGeneration: 2,
        specHash: "hash",
        owner: "alpha-owner",
        handler: "agent:alpha-owner",
        runtimeId: "runtime",
        state: "running",
        reason: "test",
        startedAt: new Date(5).toISOString(),
        sessionId: "session-1",
      }),
    );
    db.prepare(
      "UPDATE app_tasks SET current_attempt_id = 'attempt-1', resource_json = ? WHERE app_id = 'alpha' AND task_id = 'work'",
    ).run(JSON.stringify(resource));
    const cancelled: unknown[] = [];
    const service = new HumanTaskService(db, registry("alpha"), {
      onCancelled: (input) => cancelled.push(input),
    });

    const result = service.cancelTask({
      ref: taskReferenceDigest("alpha", "work").slice(0, 8),
      reason: "no longer needed",
    });

    expect(result).toMatchObject({ status: "cancelled", terminal: true, cancellable: false });
    expect(cancelled).toEqual([{ appId: "alpha", taskId: "work", sessionId: "session-1", reason: "no longer needed" }]);
    expect(service.listTasks().items).toEqual([]);
    expect(service.listTasks({ includeDone: true }).items).toEqual([
      expect.objectContaining({ taskId: "work", status: "cancelled" }),
    ]);
    expect(db.prepare("SELECT state FROM app_task_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({
      state: "interrupted",
    });
    expect(service.cancelTask({ appId: "alpha", taskId: "work" })).toMatchObject({ status: "cancelled" });
    expect(cancelled).toHaveLength(1);
  });

  test("refuses generic cancellation for maintained responsibilities", () => {
    const db = database();
    insertTask(db, { appId: "alpha", taskId: "watch", phase: "waiting", updatedAt: 10, mode: "maintain" });
    const service = new HumanTaskService(db, registry("alpha"));
    expect(() => service.cancelTask({ appId: "alpha", taskId: "watch" })).toThrow(
      "does not allow generic cancellation",
    );
  });
});
