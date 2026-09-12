import { openDatabase } from "../src/lib/db.js";
import { ensureTaskResourceSchema } from "../src/lib/db/task-resource-schema.js";
import { HumanTaskService } from "../src/app/human-task-service.js";
import { indexTaskReference, taskReferenceDigest } from "../src/app/core/state/task-reference-index.js";

const db = openDatabase(":memory:");
ensureTaskResourceSchema(db);
const appIds = Array.from({ length: 8 }, (_, index) => `app-${index}`);
const activeCount = 10_000;
const completedCount = 10_000;

db.exec("BEGIN");
for (let index = 0; index < activeCount; index += 1) {
  const appId = appIds[index % appIds.length]!;
  const taskId = `active/${String(index).padStart(6, "0")}`;
  const updatedAt = 1_800_000_000_000 - index;
  const phase = ["pending", "running", "waiting", "attention"][index % 4]!;
  const resource = {
    metadata: { id: taskId, generation: 1, resourceVersion: 1 },
    spec: { parentId: "root", outcome: `Handle ${taskId}`, acceptance: ["done"] },
    status: { observedGeneration: 0, phase, updatedAt: new Date(updatedAt).toISOString() },
  };
  db.prepare(
    `INSERT INTO app_tasks(
       app_id, task_id, generation, resource_version, observed_generation, phase, lane,
       changed, ready, updated_at, resource_json
     ) VALUES (?, ?, 1, 1, 0, ?, 'normal', 0, 0, ?, ?)`,
  ).run(appId, taskId, phase, updatedAt, JSON.stringify(resource));
  indexTaskReference(db, appId, taskId, updatedAt);
}
for (let index = 0; index < completedCount; index += 1) {
  const appId = appIds[index % appIds.length]!;
  const taskId = `done/${String(index).padStart(6, "0")}`;
  const completedAt = 1_700_000_000_000 - index;
  const receipt = {
    metadata: { id: taskId, generation: 1, resourceVersion: 2 },
    specHash: "hash",
    parentId: "root",
    outcome: `Finish ${taskId}`,
    acceptance: ["done"],
    owner: "may",
    handler: "owner",
    summary: "done",
    facts: [],
    acceptanceBasis: { kind: "owner" },
    failureFingerprints: [],
    completedAt: new Date(completedAt).toISOString(),
  };
  db.prepare(
    `INSERT INTO app_task_receipts(app_id, receipt_id, parent_id, completed_at, receipt_json)
     VALUES (?, ?, 'root', ?, ?)`,
  ).run(appId, taskId, completedAt, JSON.stringify(receipt));
  indexTaskReference(db, appId, taskId, completedAt);
}
db.exec("COMMIT");

const service = new HumanTaskService(db, {
  snapshot: () => ({
    id: "benchmark:1",
    generation: 1,
    entries: appIds.map((id) => ({
      appDir: `/tmp/${id}.app`,
      definition: { id, version: 1 as const, owner: "may", inputSchema: {} as never },
    })),
  }),
});

function p95(samples: number[]): number {
  return [...samples].sort((left, right) => left - right)[Math.ceil(samples.length * 0.95) - 1] ?? 0;
}

function sample(operation: () => unknown, count = 100): number {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const startedAt = performance.now();
    operation();
    samples.push(performance.now() - startedAt);
  }
  return p95(samples);
}

service.listTasks({ limit: 30 });
service.listTasks({ includeDone: true, limit: 30 });
service.listApps();
const exactRef = taskReferenceDigest("app-0", "active/000000").slice(0, 8);
service.getTask({ ref: exactRef });

const result = {
  rows: activeCount + completedCount,
  taskP95Ms: sample(() => service.getTask({ ref: exactRef })),
  activeTasksP95Ms: sample(() => service.listTasks({ limit: 30 })),
  allTasksP95Ms: sample(() => service.listTasks({ includeDone: true, limit: 30 })),
  appsP95Ms: sample(() => service.listApps()),
};

console.log(JSON.stringify(result, null, 2));
if (result.taskP95Ms >= 50 || result.activeTasksP95Ms >= 100 || result.allTasksP95Ms >= 100 || result.appsP95Ms >= 100) {
  throw new Error("Human Task interface exceeded its non-model latency budget");
}
db.close();
