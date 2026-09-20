import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { openDatabase } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { createAppInboxItem } from "./app-inbox-store.js";
import { appTaskTestContext } from "../tasks/app-task-test-support.js";
import { appTaskContext } from "../tasks/app-task-reconciler.js";
import type { AppTaskResource } from "../tasks/app-task-state.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { admitTaskInput } from "./inbox.js";
import {
  initializeLegacyTaskCreators,
  legacyTaskSpecHash,
  type LegacyTaskCreatorManifest,
} from "./legacy-task-creator-initialization.js";

const cleanups: Array<() => void> = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup()),
);

function resource(id: string): AppTaskResource {
  return {
    metadata: { id, generation: 1, resourceVersion: 1 },
    spec: {
      parentId: "root",
      outcome: `Legacy ${id}`,
      acceptance: [`Retain ${id}`],
      workflow: "legacy-workflow",
      input: { id, retained: true },
      outputs: [`output:${id}`],
    },
    status: {
      observedGeneration: 1,
      phase: "waiting",
      summary: `Waiting ${id}`,
      facts: [`fact:${id}`],
      conditionIds: [`condition:${id}`],
      inputWaits: {
        [`input:${id}`]: { taskGeneration: 1, conditions: [{ id: `condition:${id}`, generation: 1 }] },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "legacy-creator-init-"));
  const first = resource("legacy-one");
  const second = resource("legacy-two");
  const unrelated = resource("unrelated");
  const context = appTaskTestContext({
    appDir: root,
    databasePath: join(root, "may.db"),
    appId: "example",
    agent: "worker",
    maxConcurrent: 1,
    tree: {
      project: "example",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
      resources: { "legacy-one": first, "legacy-two": second, unrelated },
      attempts: {
        "attempt:legacy-one": {
          metadata: { id: "attempt:legacy-one", resourceVersion: 3 },
          taskId: "legacy-one",
          taskGeneration: 1,
          specHash: "retained-attempt-spec",
          owner: "worker",
          handler: "workflow:legacy-workflow",
          runtimeId: "retired:fixture",
          state: "completed",
          reason: "Retained accepted result",
          startedAt: "2025-12-31T23:00:00.000Z",
          finishedAt: "2025-12-31T23:01:00.000Z",
          acceptedResult: {
            state: "waiting",
            summary: "Accepted result remains pending",
            result: { retainedEvidence: true },
            facts: ["accepted:retained"],
            acceptedLiveEventIds: [17],
          },
        },
      },
      taskTriggers: {
        "legacy-one": {
          taskId: "legacy-one",
          taskGeneration: 1,
          resourceVersion: 4,
          event: { type: "example.arbitrary", data: { retained: "pending-input" } },
          observedAt: "2026-01-01T00:00:01.000Z",
        },
      },
      conditions: Object.fromEntries(
        [first, second, unrelated].map((item) => [
          `condition:${item.metadata.id}`,
          {
            metadata: { id: `condition:${item.metadata.id}`, generation: 1, resourceVersion: 1 },
            spec: { type: "example.ready", subject: item.metadata.id, expected: { field: "ready", equals: true } },
            status: { observedGeneration: 1, state: "false" as const },
          },
        ]),
      ),
      appTaskAdmissions: {
        retained: {
          taskId: "legacy-one",
          taskGeneration: 1,
          specHash: "retained-admission",
          admittedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    },
  });
  applyDbSchema(context.resourceStore.db);
  createAppInboxItem(context.resourceStore.db, {
    id: "retained-inbox",
    appId: "example",
    targetTaskId: "legacy-one",
    source: { kind: "system", id: "retained-source" },
    input: { kind: "arbitrary", data: { retained: true } },
    idempotencyKey: "retained-inbox-v1",
    now: 1,
  });
  context.resourceStore.db
    .prepare(
      `UPDATE app_inbox_items SET status = 'handling', waiting_on_kind = 'task',
       waiting_on_id = 'legacy-one', task_admission_key = 'retained' WHERE id = 'retained-inbox'`,
    )
    .run();
  context.resourceStore.db
    .prepare(
      `INSERT INTO app_task_cancellations(app_id, task_id, requested_at, reason, cancellation_json)
       VALUES ('example', 'unrelated', 2, 'retained closure', ?)`,
    )
    .run(
      JSON.stringify({
        kind: "cancelled",
        appId: "example",
        taskId: "unrelated",
        generation: 1,
        resourceVersion: 1,
        outcome: "Legacy unrelated",
        reason: "retained closure",
        summary: "Unrelated cancellation survives",
        cancelledAt: "2026-01-01T00:00:02.000Z",
      }),
    );
  cleanups.push(() => {
    context.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  });
  const entries = [first, second].map((item) => ({
    appId: "example",
    taskId: item.metadata.id,
    expectedGeneration: item.metadata.generation,
    expectedResourceVersion: item.metadata.resourceVersion,
    legacySpecHash: legacyTaskSpecHash(item.spec),
    provenance: { earliestRetainedAttempt: `attempt:${item.metadata.id}`, trigger: { type: "example.legacy" } },
  }));
  const manifest: LegacyTaskCreatorManifest = {
    schemaVersion: 1,
    appId: "example",
    expectedEntryCount: 2,
    creator: { appId: "example" },
    entries,
  };
  return { root, context, db: context.resourceStore.db, manifest };
}

function allRows(db: ReturnType<typeof fixture>["db"], table: string): unknown[] {
  return db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all();
}

function preservedResource(resource: AppTaskResource | null) {
  if (!resource) return resource;
  const copy = structuredClone(resource);
  delete copy.metadata.creator;
  copy.metadata.resourceVersion = 1;
  return copy;
}

test("initializes one fenced batch, preserves all other state, and exact replay is a no-op", () => {
  const f = fixture();
  const before = {
    tasks: Object.fromEntries(
      ["legacy-one", "legacy-two", "unrelated"].map((id) => [id, f.context.resourceStore.readTask(id)]),
    ),
    attempts: allRows(f.db, "app_task_attempts"),
    conditions: allRows(f.db, "app_task_conditions"),
    admissions: allRows(f.db, "app_task_admissions"),
    cancellations: allRows(f.db, "app_task_cancellations"),
    inbox: allRows(f.db, "app_inbox_items"),
    triggers: f.context.resourceStore.readSnapshot().taskTriggers,
  };
  expect(before.attempts.length).toBeGreaterThan(0);
  expect(before.attempts.some((row) => JSON.stringify(row).includes("acceptedResult"))).toBe(true);
  expect(Object.keys(before.triggers)).toHaveLength(1);
  expect(before.admissions).toHaveLength(1);
  expect(before.cancellations).toHaveLength(1);
  expect(before.inbox).toHaveLength(1);
  expect(JSON.stringify(before.inbox[0])).toContain("retained");
  expect(JSON.stringify(before.tasks["legacy-one"])).toContain("condition:legacy-one");
  const revision = f.context.resourceStore.revision();
  expect(initializeLegacyTaskCreators(f.db, f.manifest, { hostAndWorkersStopped: true })).toEqual({
    status: "initialized",
    appId: "example",
    initializedCount: 2,
    alreadyInitializedCount: 0,
    entries: f.manifest.entries.map((entry) => ({
      taskId: entry.taskId,
      generation: entry.expectedGeneration,
      legacyResourceVersion: entry.expectedResourceVersion,
      resultingResourceVersion: entry.expectedResourceVersion + 1,
      legacySpecHash: entry.legacySpecHash,
    })),
  });
  for (const id of ["legacy-one", "legacy-two"]) {
    const after = f.context.resourceStore.readTask(id)!;
    expect(after.metadata.creator).toEqual({ appId: "example" });
    expect(after.metadata.resourceVersion).toBe(2);
    expect(preservedResource(after)).toEqual(before.tasks[id]);
  }
  expect(f.context.resourceStore.readTask("unrelated")).toEqual(before.tasks.unrelated);
  expect(allRows(f.db, "app_task_attempts")).toEqual(before.attempts);
  expect(allRows(f.db, "app_task_conditions")).toEqual(before.conditions);
  expect(allRows(f.db, "app_task_admissions")).toEqual(before.admissions);
  expect(allRows(f.db, "app_task_cancellations")).toEqual(before.cancellations);
  expect(allRows(f.db, "app_inbox_items")).toEqual(before.inbox);
  expect(f.context.resourceStore.readSnapshot().taskTriggers).toEqual(before.triggers);
  expect(f.context.resourceStore.revision()).toBe(revision + 1);

  const afterApply = f.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all();
  const replayRevision = f.context.resourceStore.revision();
  expect(initializeLegacyTaskCreators(f.db, f.manifest, { hostAndWorkersStopped: true })).toMatchObject({
    status: "already-initialized",
  });
  expect(f.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all()).toEqual(afterApply);
  expect(f.context.resourceStore.revision()).toBe(replayRevision);
});

test("dry-run rolls back and a later App-only revision uses ordinary creator authority", () => {
  const f = fixture();
  const before = f.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all();
  expect(initializeLegacyTaskCreators(f.db, f.manifest, { hostAndWorkersStopped: true, dryRun: true })).toMatchObject({
    status: "would-initialize",
  });
  expect(f.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all()).toEqual(before);

  initializeLegacyTaskCreators(f.db, f.manifest, { hostAndWorkersStopped: true });
  const failures: unknown[] = [];
  const app = defineApp({
    id: "example",
    version: 1,
    owner: "worker",
    inputSchema: Type.Object({ kind: Type.Literal("refresh"), data: Type.Object({ taskId: Type.String() }) }),
    task: (input) => ({
      kind: "desired",
      intent: {
        id: input.input.data.taskId,
        parentId: "root",
        outcome: "Installed complete outcome",
        acceptance: ["Installed complete acceptance"],
        input: { complete: "installed intent" },
        outputs: ["installed-output"],
        owner: "worker",
      },
    }),
    tasks: {},
  });
  const host = new AppInboxHost({
    db: f.db,
    apps: [app],
    attachTask: (input) => admitTaskInput(f.context, input),
    onFailure: (failure) => failures.push(failure),
  });
  try {
    const admitted = host.admit({
      id: "portable-refresh",
      appId: "example",
      source: { kind: "system", id: "portable-regression" },
      input: { kind: "refresh", data: { taskId: "legacy-one" } },
    });
    expect(failures).toEqual([]);
    expect(host.get(admitted.item.id)?.waitingOn).toEqual({ kind: "task", id: "legacy-one" });
  } finally {
    host.close();
  }
  expect(f.context.resourceStore.readTask("legacy-one")).toMatchObject({
    metadata: { creator: { appId: "example" }, generation: 2 },
    spec: {
      outcome: "Installed complete outcome",
      acceptance: ["Installed complete acceptance"],
      input: { complete: "installed intent" },
      outputs: ["installed-output"],
      owner: "worker",
    },
    status: { facts: ["fact:legacy-one"], conditionIds: ["condition:legacy-one"] },
  });
  expect(f.context.resourceStore.readTask("legacy-one")?.spec.workflow).toBeUndefined();
});

test("rejects stale or unauthorized batches atomically", () => {
  const cases: Array<[string, (f: ReturnType<typeof fixture>) => void, string]> = [
    ["missing Task", (f) => (f.manifest.entries[1]!.taskId = "missing"), "missing"],
    ["changed generation", (f) => (f.manifest.entries[1]!.expectedGeneration = 2), "generation changed"],
    [
      "changed resource version",
      (f) => (f.manifest.entries[1]!.expectedResourceVersion = 2),
      "resource version changed",
    ],
    ["changed spec", (f) => (f.manifest.entries[1]!.legacySpecHash = "0".repeat(64)), "legacy spec changed"],
    [
      "foreign creator",
      (f) => {
        const task = f.context.resourceStore.readTask("legacy-two")!;
        task.metadata.creator = { appId: "foreign" };
        f.db
          .prepare("UPDATE app_tasks SET resource_json = ? WHERE app_id = 'example' AND task_id = 'legacy-two'")
          .run(JSON.stringify(task));
      },
      "conflicting creator",
    ],
    [
      "Task creator",
      (f) => {
        const task = f.context.resourceStore.readTask("legacy-two")!;
        task.metadata.creator = { appId: "example", taskId: "caller" };
        f.db
          .prepare("UPDATE app_tasks SET resource_json = ? WHERE app_id = 'example' AND task_id = 'legacy-two'")
          .run(JSON.stringify(task));
      },
      "conflicting Task creator",
    ],
    [
      "running phase",
      (f) => {
        const task = f.context.resourceStore.readTask("legacy-two")!;
        task.status.phase = "running";
        task.status.currentAttemptId = "attempt-running";
        f.db
          .prepare(
            "UPDATE app_tasks SET phase = 'running', current_attempt_id = 'attempt-running', resource_json = ? WHERE app_id = 'example' AND task_id = 'legacy-two'",
          )
          .run(JSON.stringify(task));
      },
      "running",
    ],
  ];
  for (const [, mutate, message] of cases) {
    const f = fixture();
    mutate(f);
    const before = f.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all();
    expect(() => initializeLegacyTaskCreators(f.db, f.manifest, { hostAndWorkersStopped: true })).toThrow(message);
    expect(f.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all()).toEqual(before);
  }
});

test("rejects malformed manifests and mixed partial application", () => {
  const duplicate = fixture();
  duplicate.manifest.entries[1]!.taskId = "legacy-one";
  expect(() => initializeLegacyTaskCreators(duplicate.db, duplicate.manifest, { hostAndWorkersStopped: true })).toThrow(
    "Duplicate",
  );

  const extra = fixture();
  extra.manifest.expectedEntryCount = 1;
  expect(() => initializeLegacyTaskCreators(extra.db, extra.manifest, { hostAndWorkersStopped: true })).toThrow(
    "missing or extra",
  );

  const mismatch = fixture();
  mismatch.manifest.entries[1]!.appId = "foreign";
  expect(() => initializeLegacyTaskCreators(mismatch.db, mismatch.manifest, { hostAndWorkersStopped: true })).toThrow(
    "another App",
  );

  const taskCreator = fixture();
  taskCreator.manifest.creator = { appId: "example", taskId: "not-authority" };
  expect(() =>
    initializeLegacyTaskCreators(taskCreator.db, taskCreator.manifest, { hostAndWorkersStopped: true }),
  ).toThrow("App-only");

  const partial = fixture();
  const first = partial.context.resourceStore.readTask("legacy-one")!;
  first.metadata.creator = { appId: "example" };
  first.metadata.resourceVersion += 1;
  partial.db
    .prepare(
      "UPDATE app_tasks SET resource_version = 2, resource_json = ? WHERE app_id = 'example' AND task_id = 'legacy-one'",
    )
    .run(JSON.stringify(first));
  const before = partial.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all();
  expect(() => initializeLegacyTaskCreators(partial.db, partial.manifest, { hostAndWorkersStopped: true })).toThrow(
    "partially applied",
  );
  expect(partial.db.prepare("SELECT * FROM app_tasks ORDER BY app_id, task_id").all()).toEqual(before);
});

test("offline CLI requires acknowledgement and dry-runs then applies the private manifest", async () => {
  const f = fixture();
  const manifestPath = join(f.root, "private-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(f.manifest));
  const before = f.db.prepare("SELECT resource_json FROM app_tasks ORDER BY task_id").all();
  f.context.resourceStore.close();
  const script = join(process.cwd(), "scripts/operations/initialize-legacy-task-creators.ts");
  const run = async (...extra: string[]) => {
    const child = Bun.spawn({
      cmd: ["bun", script, "--state-dir", f.root, "--manifest", manifestPath, ...extra],
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const timeout = setTimeout(() => child.kill(), 10_000);
    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { exitCode, stdout, stderr };
    } finally {
      clearTimeout(timeout);
    }
  };
  expect((await run("--dry-run")).exitCode).not.toBe(0);
  const dryRun = await run("--confirm-host-and-workers-stopped", "--dry-run");
  expect(dryRun.exitCode).toBe(0);
  expect(dryRun.stdout).toContain('"status": "would-initialize"');
  let verify = openDatabase(join(f.root, "may.db"));
  expect(verify.prepare("SELECT resource_json FROM app_tasks ORDER BY task_id").all()).toEqual(before);
  verify.close();
  const apply = await run("--confirm-host-and-workers-stopped");
  expect(apply.exitCode).toBe(0);
  expect(apply.stdout).toContain('"status": "initialized"');
  verify = openDatabase(join(f.root, "may.db"));
  expect(
    verify
      .prepare(
        "SELECT json_extract(resource_json, '$.metadata.creator.appId') creator FROM app_tasks WHERE task_id LIKE 'legacy-%' ORDER BY task_id",
      )
      .all(),
  ).toEqual([{ creator: "example" }, { creator: "example" }]);
  verify.close();
});

const scoutSources = ["hn", "arxiv", "github", "reddit", "xhs"] as const;

function scoutIntent(source: (typeof scoutSources)[number]) {
  return {
    id: `explore-${source}`,
    parentId: "ongoing-research",
    outcome: `Continuously explore ${source} for source-grounded AI-agent signals and integrate useful findings.`,
    acceptance: [
      `Reconcile ${source} from current non-simulated proof and retain every independent pending obligation.`,
    ],
    input: { source },
    outputs: ["knowledge/scout", "digest/today.md"],
    owner: "scout",
    priority: source === "xhs" ? ("P2" as const) : ("P1" as const),
  };
}

test("portable five-entry Scout operation uses the CLI and recovers saved failed inputs completely", async () => {
  const root = mkdtempSync(join(tmpdir(), "legacy-scout-operation-"));
  const databasePath = join(root, "may.db");
  const resources = Object.fromEntries(
    scoutSources.map((source) => {
      const desired = scoutIntent(source);
      const retained = resource(desired.id);
      retained.spec = {
        ...desired,
        acceptance: [`Legacy ${source} acceptance`],
        outputs: [],
        workflow: "scout-explore",
      };
      retained.status.facts = [`retained:${source}`];
      return [desired.id, retained];
    }),
  );
  const tree = {
    project: "scout-knowledge-lib",
    root_task_id: "ongoing-research",
    groups: { "ongoing-research": { id: "ongoing-research", parent_id: null } },
    resources,
    attempts: Object.fromEntries(
      scoutSources.map((source) => [
        `accepted:${source}`,
        {
          metadata: { id: `accepted:${source}`, resourceVersion: 1 },
          taskId: `explore-${source}`,
          taskGeneration: 1,
          specHash: `retained:${source}`,
          owner: "scout",
          handler: "workflow:scout-explore",
          runtimeId: "retired:portable-fixture",
          state: "completed" as const,
          reason: "Accepted evidence retained",
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:01:00.000Z",
          acceptedResult: {
            state: "waiting" as const,
            summary: "Accepted result retains a pending dependency",
            result: { source },
            facts: [`accepted:${source}`],
          },
        },
      ]),
    ),
    taskTriggers: Object.fromEntries(
      scoutSources.map((source) => [
        `explore-${source}`,
        {
          taskId: `explore-${source}`,
          taskGeneration: 1,
          resourceVersion: 1,
          event: { type: "scout.explore", data: { source, arbitrary: `pending:${source}` } },
          observedAt: "2026-01-01T00:02:00.000Z",
        },
      ]),
    ),
    conditions: Object.fromEntries(
      scoutSources.map((source) => [
        `condition:explore-${source}`,
        {
          metadata: { id: `condition:explore-${source}`, generation: 1, resourceVersion: 1 },
          spec: {
            type: "app.dependency.updated",
            subject: `id:publication:${source}`,
            expected: { field: "status", equals: true },
            owner: "app:scout-knowledge-lib",
          },
          status: { observedGeneration: 1, state: "false" as const },
        },
      ]),
    ),
  };
  let config = appTaskTestContext({
    appDir: root,
    databasePath,
    appId: "scout-knowledge-lib",
    agent: "scout",
    maxConcurrent: 1,
    tree,
  });
  applyDbSchema(config.resourceStore.db);
  const app = defineApp({
    id: "scout-knowledge-lib",
    version: 1,
    owner: "scout",
    inputSchema: Type.Object({ kind: Type.Literal("explore"), data: Type.Object({ source: Type.String() }) }),
    task: (input) => ({ kind: "desired", intent: scoutIntent(input.input.data.source as (typeof scoutSources)[number]) }),
    tasks: {},
  });
  const failures: unknown[] = [];
  const failedHost = new AppInboxHost({
    db: config.resourceStore.db,
    apps: [app],
    attachTask: (input) => admitTaskInput(config, input),
    onFailure: (failure) => failures.push(failure),
  });
  for (const source of scoutSources) {
    failedHost.admit({
      id: `saved-refresh-${source}`,
      appId: app.id,
      source: { kind: "system", id: "portable-fixture" },
      input: { kind: "explore", data: { source } },
    });
  }
  expect(failures).toHaveLength(5);
  config.resourceStore.db
    .prepare("UPDATE app_inbox_items SET status = 'handling', handling = ? WHERE id = 'saved-refresh-hn'")
    .run(JSON.stringify({ phase: "failed", reason: "creator metadata was absent" }));
  const inboxBefore = allRows(config.resourceStore.db, "app_inbox_items");
  expect(inboxBefore).toHaveLength(5);
  expect(inboxBefore.some((row) => String((row as { handling?: unknown }).handling).includes('"phase":"failed"'))).toBe(
    true,
  );
  const manifest: LegacyTaskCreatorManifest = {
    schemaVersion: 1,
    appId: app.id,
    expectedEntryCount: 5,
    creator: { appId: app.id },
    entries: scoutSources.map((source) => {
      const current = config.resourceStore.readTask(`explore-${source}`)!;
      return {
        appId: app.id,
        taskId: current.metadata.id,
        expectedGeneration: current.metadata.generation,
        expectedResourceVersion: current.metadata.resourceVersion,
        legacySpecHash: legacyTaskSpecHash(current.spec),
        provenance: { kind: "portable synthetic operational fixture", source },
      };
    }),
  };
  const expectedReceiptEntries = manifest.entries
    .map((entry) => ({
      taskId: entry.taskId,
      generation: entry.expectedGeneration,
      legacyResourceVersion: entry.expectedResourceVersion,
      resultingResourceVersion: entry.expectedResourceVersion + 1,
      legacySpecHash: entry.legacySpecHash,
    }))
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
  const before = config.resourceStore.readSnapshot();
  const manifestPath = join(root, "scout-five-entry-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest));
  failedHost.close();
  config.resourceStore.close();

  const script = join(process.cwd(), "scripts/operations/initialize-legacy-task-creators.ts");
  const runCli = async (...extra: string[]) => {
    const child = Bun.spawn({
      cmd: [
        "bun",
        script,
        "--state-dir",
        root,
        "--manifest",
        manifestPath,
        "--confirm-host-and-workers-stopped",
        ...extra,
      ],
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const timeout = setTimeout(() => child.kill(), 10_000);
    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { exitCode, stdout, stderr, receipt: stdout ? JSON.parse(stdout) : undefined };
    } finally {
      clearTimeout(timeout);
    }
  };
  const dryRun = await runCli("--dry-run");
  expect(dryRun.exitCode).toBe(0);
  expect(dryRun.receipt).toEqual({
    status: "would-initialize",
    appId: app.id,
    initializedCount: 0,
    alreadyInitializedCount: 0,
    entries: expectedReceiptEntries,
  });
  let readback = openDatabase(databasePath);
  expect(allRows(readback, "app_inbox_items")).toEqual(inboxBefore);
  expect(
    readback
      .prepare("SELECT COUNT(*) count FROM app_tasks WHERE json_extract(resource_json, '$.metadata.creator') IS NOT NULL")
      .get(),
  ).toEqual({ count: 0 });
  readback.close();

  const applied = await runCli();
  expect(applied.exitCode).toBe(0);
  expect(applied.receipt).toEqual({
    status: "initialized",
    appId: app.id,
    initializedCount: 5,
    alreadyInitializedCount: 0,
    entries: expectedReceiptEntries,
  });
  readback = openDatabase(databasePath);
  expect(
    readback
      .prepare(
        "SELECT task_id taskId, json_extract(resource_json, '$.metadata.creator.appId') creator FROM app_tasks ORDER BY task_id",
      )
      .all(),
  ).toEqual(
    scoutSources
      .map((source) => ({ taskId: `explore-${source}`, creator: app.id }))
      .sort((left, right) => left.taskId.localeCompare(right.taskId)),
  );
  expect(allRows(readback, "app_inbox_items")).toEqual(inboxBefore);
  readback.close();
  const replay = await runCli();
  expect(replay.exitCode).toBe(0);
  expect(replay.receipt).toEqual({
    ...applied.receipt,
    status: "already-initialized",
    initializedCount: 0,
    alreadyInitializedCount: 5,
  });

  config = appTaskContext({
    appDir: root,
    projectDir: root,
    agent: "scout",
    maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.openStandalone(databasePath, app.id),
  });
  const recoveryFailures: unknown[] = [];
  const host = new AppInboxHost({
    db: config.resourceStore.db,
    apps: [app],
    attachTask: (input) => admitTaskInput(config, input),
    onFailure: (failure) => recoveryFailures.push(failure),
  });
  try {
    await host.recoverAdmissions();
    expect(recoveryFailures).toEqual([]);
    expect(allRows(config.resourceStore.db, "app_inbox_items")).toHaveLength(5);
    for (const source of scoutSources) {
      const desired = scoutIntent(source);
      const after = config.resourceStore.readTask(desired.id)!;
      expect(after.metadata.id).toBe(desired.id);
      expect(after.metadata.creator).toEqual({ appId: app.id });
      const { id: _id, ...expectedSpec } = desired;
      expect(after.spec).toEqual(expectedSpec);
      expect(after.spec.outcome).toBe(desired.outcome);
      expect(after.spec.acceptance).toEqual(desired.acceptance);
      expect(after.spec.input).toEqual(desired.input);
      expect(after.spec.outputs).toEqual(desired.outputs);
      expect(after.spec.owner).toBe("scout");
      expect(after.spec.workflow).toBeUndefined();
      expect(after.status.facts).toEqual(before.resources![desired.id]!.status.facts);
      expect(host.get(`saved-refresh-${source}`)?.waitingOn).toEqual({ kind: "task", id: desired.id });
    }
    expect(config.resourceStore.readSnapshot().conditions).toEqual(before.conditions);
  } finally {
    host.close();
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  }
});
