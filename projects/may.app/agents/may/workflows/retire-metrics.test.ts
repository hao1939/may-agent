import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { applyDbSchema } from "../../../../may-agent/src/lib/db/schema.js";
import { closeDb, getDb } from "../../../../may-agent/src/lib/requests.js";
import { createMetricService } from "../../../../may-agent/src/lib/metrics.js";
import { EventBus } from "../../../../may-agent/src/app/core/events/bus.js";
import { measureSourceMetrics } from "../../../../may-agent/src/app/metric-source-measurement.js";
import { execute } from "./retire-metrics.js";

const TASK_ID = "goal/appdep_3b8a01a40248c98c6d59ce4c";
const ROW_KEYS = [
  "id",
  "name",
  "type",
  "owner",
  "current",
  "target",
  "threshold",
  "unit",
  "priority",
  "status",
  "blocker",
  "project",
  "source",
  "source_query",
  "source_command",
  "sensitivity",
  "measure_interval",
  "alert_op",
  "speed",
  "description",
  "direction",
  "config",
  "created_at",
  "updated_at",
  "closed_at",
];
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function definition(row: any) {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    type: row.type,
    target: row.target,
    threshold: row.threshold,
    unit: row.unit,
    priority: row.priority,
    status: row.status,
    blocker: row.blocker,
    project: row.project,
    source: row.source,
    sourceQuery: row.source_query,
    sourceCommand: row.source_command,
    sensitivity: row.sensitivity,
    measureInterval: row.measure_interval,
    alertOp: row.alert_op,
    speed: row.speed,
    description: row.description,
    direction: row.direction,
    config: row.config === null ? null : JSON.parse(row.config),
  };
}
function expected(row: any) {
  return { ...row, status: "retired", updated_at: "$operation-time" };
}
function packet(manifest: any) {
  const manifestJson = JSON.stringify(manifest);
  return {
    manifestJson,
    manifestSha256: createHash("sha256").update(manifestJson).digest("hex"),
  };
}
function context(
  input: any,
  metric: (id: string) => any,
  defineMany: (defs: any[]) => void,
) {
  const ctx = createTestAppWorkflowContext({
    input,
    reconciliation: {
      appId: "may",
      taskId: TASK_ID,
      generation: 1,
    } as any,
    read: {
      contract: async () => ({}) as any,
      appResult: async () => null,
      tasks: {} as any,
      execution: async () => null,
      metric: async (id: string) => metric(id),
    },
  });
  ctx.metrics.defineMany = defineMany;
  return ctx;
}

async function fixture() {
  const persistDir = mkdtempSync(join(tmpdir(), "retire-metrics-"));
  const oldRoot = process.env.APP_ROOT;
  process.env.APP_ROOT = persistDir;
  const db = getDb(persistDir);
  applyDbSchema(db);
  let now = 1000;
  const service = createMetricService({ getDb: () => db, now: () => ++now });
  const ids = Array.from(
    { length: 39 },
    (_, index) => `aks-rp-e2e.fixture.${String(index).padStart(2, "0")}`,
  );
  for (const [index, id] of ids.entries()) {
    service.define({
      id,
      name: `Fixture ${index}`,
      owner: "may",
      project: "aks-rp-e2e",
      type: "gauge",
      target: index + 100,
      threshold: index + 200,
      unit: "count",
      priority: "P2",
      status: "active",
      blocker: "fixture-blocker",
      source: "fixture",
      sourceQuery: `SELECT ${index} AS value`,
      sourceCommand: `printf '${index}'`,
      sensitivity: 0.5,
      measureInterval: 300000,
      alertOp: ">",
      speed: "slow",
      description: "preserve every definition field",
      direction: "lower",
      config: { index },
    });
  }
  const closedIds = Array.from(
    { length: 7 },
    (_, index) => `aks-rp-e2e.closed.${index}`,
  );
  for (const id of closedIds)
    service.define({
      id,
      name: id,
      owner: "may",
      status: "retired",
      unit: "",
      priority: "P2",
      alertOp: "<",
      speed: "fast",
    });
  const activePass = await measureSourceMetrics({
    bus: new EventBus(),
    persistDir,
  });
  const selectRows = (selected: string[]) =>
    selected.map(
      (id) =>
        db
          .prepare(`SELECT ${ROW_KEYS.join(",")} FROM metrics WHERE id = ?`)
          .get(id) as any,
    );
  const before = selectRows(ids);
  const excludedClosed = selectRows(closedIds);
  const manifest = {
    version: 1,
    binding: { appId: "may", taskId: TASK_ID, generation: 1 },
    capture: {
      capturedAt: "2026-10-01T00:00:00.000Z",
      source: "isolated production-path fixture",
      sourceRevision: "264ded592ac98387f8f54050d87b8f44eb009708",
    },
    metricIds: ids,
    before,
    definitions: before.map(definition),
    expectedAfter: before.map(expected),
    excludedClosed,
    openAlerts: [],
    baselines: {
      snapshotCountByMetric: Object.fromEntries(ids.map((id) => [id, 1])),
      measurementFailureCutoff: 0,
    },
  };
  const view = (id: string) => {
    const row = service.get(id);
    return (
      row && {
        id: row.id,
        value: row.current,
        status: row.status,
        target: row.target,
        threshold: row.threshold,
        unit: row.unit,
        measureInterval: row.measure_interval ?? null,
      }
    );
  };
  cleanup = () => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
    if (oldRoot === undefined) delete process.env.APP_ROOT;
    else process.env.APP_ROOT = oldRoot;
    cleanup = undefined;
  };
  return {
    persistDir,
    db,
    service,
    ids,
    manifest,
    activePass,
    view,
    excludedClosed,
  };
}

test("rejects a partial complete-definition manifest before any write", async () => {
  const f = await fixture();
  const partial = structuredClone(f.manifest);
  delete partial.definitions[0].sourceCommand;
  let writes = 0;
  const result = await execute(
    context(packet(partial), f.view, () => writes++),
  );
  expect(result.status).toBe("blocked");
  expect(result.summary).toContain("every exact field");
  expect(writes).toBe(0);
  expect(f.service.get(f.ids[0]!)?.status).toBe("active");
});

test("rejects wrong Task binding, stale state, changed after rows, and a substituted ID before writes", async () => {
  for (const mutate of [
    (m: any) => (m.binding.generation = 2),
    (m: any) => (m.expectedAfter[0].source_command = "cleared"),
    (m: any) => (m.metricIds[0] = "aks-rp-e2e.fixture.substituted"),
  ]) {
    const f = await fixture();
    const changed = structuredClone(f.manifest);
    mutate(changed);
    let writes = 0;
    const result = await execute(
      context(packet(changed), f.view, () => writes++),
    );
    expect(result.status).toBe("blocked");
    expect(writes).toBe(0);
    cleanup?.();
  }
  const f = await fixture();
  let writes = 0;
  const result = await execute(
    context(
      packet(f.manifest),
      (id) => ({
        ...f.view(id),
        status: id === f.ids[0] ? "retired" : "active",
      }),
      () => writes++,
    ),
  );
  expect(result.status).toBe("blocked");
  expect(result.summary).toContain("preflight rejected");
  expect(writes).toBe(0);
});

test("production path retires all 39 with one status-only complete replay and stops later source collection", async () => {
  const f = await fixture();
  expect(f.activePass.measured).toHaveLength(39);
  let calls = 0;
  let payload: any[] = [];
  const result = await execute(
    context(packet(f.manifest), f.view, (defs) => {
      calls++;
      payload = defs;
      f.service.defineMany(defs);
    }),
  );
  expect(result.status).toBe("done");
  expect(calls).toBe(1);
  expect(payload).toHaveLength(39);
  expect(
    payload.every(
      (row) =>
        row.status === "retired" &&
        row.sourceQuery &&
        row.sourceCommand &&
        row.measureInterval === 300000,
    ),
  ).toBe(true);
  const retiredPass = await measureSourceMetrics({
    bus: new EventBus(),
    persistDir: f.persistDir,
  });
  expect(retiredPass).toEqual({ measured: [], skipped: [], failures: [] });

  const after = f.ids.map(
    (id) =>
      f.db
        .prepare(`SELECT ${ROW_KEYS.join(",")} FROM metrics WHERE id = ?`)
        .get(id) as any,
  );
  for (const [index, row] of after.entries()) {
    const changed = ROW_KEYS.filter(
      (key) => row[key] !== f.manifest.before[index][key],
    );
    expect(changed).toEqual(["status", "updated_at"]);
    expect(row.status).toBe("retired");
  }
  const closedAfter = f.excludedClosed.map((row: any) =>
    f.db
      .prepare(`SELECT ${ROW_KEYS.join(",")} FROM metrics WHERE id = ?`)
      .get(row.id),
  );
  expect(closedAfter).toEqual(f.excludedClosed);
});

test("reports per-ID state when sequential defineMany fails part way", async () => {
  const f = await fixture();
  const result = await execute(
    context(packet(f.manifest), f.view, (defs) => {
      f.service.defineMany(defs.slice(0, 3));
      throw new Error("fixture interruption");
    }),
  );
  expect(result.status).toBe("blocked");
  expect(result.summary).toContain("potentially partial");
  expect((result as any).facts.readback).toHaveLength(39);
  expect(
    (result as any).facts.readback.filter(
      (row: any) => row.view.status === "retired",
    ),
  ).toHaveLength(3);
});
