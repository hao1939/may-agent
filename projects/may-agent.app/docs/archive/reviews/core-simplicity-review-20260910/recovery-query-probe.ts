// Measure the actual store query against synthetic backlog in fresh SQLite.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const hostRoot = resolve(process.argv[2]);
const { openDatabase } = await import(pathToFileURL(resolve(hostRoot, "src/lib/db.ts")).href);
const { applyDbSchema } = await import(pathToFileURL(resolve(hostRoot, "src/lib/db/schema.ts")).href);
const { AppTaskResourceStore } = await import(pathToFileURL(resolve(hostRoot, "src/app/app-task-resource-store.ts")).href);
for (const count of [256, 20_000]) {
  const db = openDatabase(":memory:");
  applyDbSchema(db);
  let capturedSql = "";
  const tracedDb = {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => {
      if (sql.includes("UNION") && sql.includes("idx_app_tasks_ready")) capturedSql = sql;
      return db.prepare(sql);
    },
    run: (sql: string, params?: unknown[]) => db.run(sql, params),
    close: () => db.close(),
  };
  const store = AppTaskResourceStore.fromDb(tracedDb, "probe");
  const resources: Record<string, unknown> = {};
  for (let n = 0; n < count; n++) {
    const id = `t-${String(n).padStart(6, "0")}`;
    resources[id] = { metadata: { id, generation: 1, resourceVersion: 1 },
      spec: { outcome: "fixture", acceptance: ["fixture result"], parentId: "root", mode: "achieve", priority: "P2" },
      status: { observedGeneration: 0, phase: "pending", lane: "normal", updatedAt: "2026-09-10T00:00:00.000Z" } };
  }
  store.bootstrapSnapshot({ version: 1, project: "probe", project_lifecycle: "active",
    root_task_id: "root", groups: { root: { id: "root", parent_id: null } }, resources, tasks: {} }, "fixture");
  const samples: number[] = [];
  let returned = 0;
  const now = Date.parse("2026-09-10T00:00:01.000Z");
  for (let n = 0; n < 5; n++) {
    const start = performance.now();
    returned = store.listRecoveryCandidates(now, 256).items.length;
    samples.push(performance.now() - start);
  }
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${capturedSql}`).all("probe", "probe", "probe", now, "probe", now, 256);
  console.log(JSON.stringify({ backlog: count, limit: 256, returned, elapsedMs: samples, plan }));
  db.close();
}
