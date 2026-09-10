import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { createMetricService } from "../../../lib/metrics.js";
import { EventBus } from "../../core/events/bus.js";
import { createRuntimeAppRead } from "../../core/reads/app-read.js";
import { createAppReporting } from "../../composition/reporting.js";
import { measureSourceMetrics } from "../../metric-source-measurement.js";
import { WORKFLOW_OUTCOME_METRICS } from "./workflow-metrics.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "workflow-metrics-"));
  roots.push(root);
  const db = getDb(root);
  const service = createMetricService({ getDb: () => db });
  service.defineMany(WORKFLOW_OUTCOME_METRICS);
  return { root, db, service, bus: new EventBus(), read: createAppReporting(() => db).readMetric };
}

describe("replaceable workflow reporting", () => {
  it("samples an honest finished cohort, excludes nested/running work, and exposes freshness", async () => {
    const { root, db, bus, read } = fixture();
    const now = Date.now();
    const insert =
      db.prepare(`INSERT INTO workflow_runs (runId, workflow, task, status, startedAt, endedAt, parentWorkflowRunId)
      VALUES (?, 'upload', 'fixture', ?, ?, ?, ?)`);
    for (const [index, status] of [
      "done",
      "done",
      "done",
      "done",
      "done",
      "done",
      "error",
      "error",
      "blocked",
      "interrupted",
    ].entries()) {
      insert.run(`wr_${index}`, status, now - 20_000, now - 10_000, null);
    }
    insert.run("wr_child_failure", "error", now - 20_000, now - 10_000, "wr_0");
    insert.run("wr_running", "running", now - 20_000, null, null);
    insert.run("wr_old", "error", now - 90_000_000, now - 89_000_000, null);
    insert.run("wr_future", "error", now, now + 60_000, null);
    insert.run("wr_missing_end", "error", now - 20_000, null, null);

    expect(await measureSourceMetrics({ bus, persistDir: root })).toMatchObject({ skipped: [], failures: [] });
    const samples = await Promise.all(WORKFLOW_OUTCOME_METRICS.map((metric) => read(metric.id)));
    expect(samples.map((sample) => sample?.value)).toEqual([6, 2, 1, 1]);
    expect(samples.every((sample) => sample?.sampleSize === 10 && sample.measuredAt! >= now - 1_000)).toBe(true);
    expect(samples[0]?.note).toContain("Retained top-level runs");
    expect(samples[0]?.measureInterval).toBe(300_000);
    expect(db.prepare("SELECT COUNT(*) AS n FROM metric_alerts").get()).toEqual({ n: 0 });
    expect(
      db
        .prepare("EXPLAIN QUERY PLAN " + WORKFLOW_OUTCOME_METRICS[0]!.sourceQuery)
        .all()
        .some((row) => JSON.stringify(row).includes("idx_wfr_parent_ended")),
    ).toBe(true);
  });

  it("keeps no data, failed measurement, and absent reporting distinct", async () => {
    const { root, db, bus, service, read } = fixture();
    const id = WORKFLOW_OUTCOME_METRICS[0]!.id;
    expect(await read(id)).toMatchObject({ value: null, measuredAt: null, sampleSize: null });
    await measureSourceMetrics({ bus, persistDir: root });
    const empty = await read(id);
    expect(empty).toMatchObject({ value: 0, sampleSize: 0 });
    db.run("UPDATE metrics SET source_query = 'SELECT * FROM missing_fixture_table' WHERE id = ?", [id]);
    const failed = await measureSourceMetrics({ bus, persistDir: root });
    expect(failed.skipped).toEqual([id]);
    expect(failed.failures).toEqual([{ id, reason: expect.stringContaining("missing_fixture_table") }]);
    expect(failed.measured).toHaveLength(3);
    expect(await read(id)).toEqual(empty);
    // Definition changes and late-arriving old samples do not refresh the latest observation.
    service.define(WORKFLOW_OUTCOME_METRICS[0]!);
    service.record(id, 99, { measuredAt: empty!.measuredAt! - 1_000, sampleSize: 99, note: "late old sample" });
    expect(await read(id)).toEqual(empty);
    await expect(createRuntimeAppRead({ getDb: () => db }).metric(id)).rejects.toThrow(
      "Metric reporting is unavailable",
    );
  });
});
