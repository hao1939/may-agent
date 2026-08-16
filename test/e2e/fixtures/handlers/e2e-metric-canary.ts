/**
 * E2E fixture handler: defines a canary metric, then advances phases based on
 * the number of existing snapshots (since the handler module is hot-reloaded
 * per fire — module-level state is reset every call).
 *
 * Phase decision (by snapshot count for e2e.canary at start of fire):
 *   0: define metric, record 1.0 (baseline)
 *   1: record 0.3 (breach)
 *   2: record 0.95 (recover)
 *   3+: noop
 */
import type { CronEntry } from "../../../../src/lib/cron-tool.js";
import type { HandlerContext, HandlerModule, EventEnvelope } from "../../../../src/lib/handler-context.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const metricId = "e2e.canary";

  return async (_event?: EventEnvelope) => {
    const db = ctx.sdk.getDb() as { prepare: (sql: string) => { get: (...args: unknown[]) => unknown } };
    const row = db.prepare("SELECT COUNT(*) AS c FROM metric_snapshots WHERE metric_id = ?").get(metricId) as {
      c: number;
    };
    const phase = row.c;

    if (phase === 0) {
      ctx.sdk.metrics.define({
        id: metricId,
        name: "E2E Canary Metric",
        owner: "agent:may",
        type: "rate",
        target: 1.0,
        threshold: 0.8,
        priority: "P1",
        alertOp: "lt",
        direction: "higher-is-better",
        description: "E2E canary metric; not real.",
      });
      ctx.sdk.metrics.record(metricId, 1.0, { note: "healthy baseline" });
      ctx.sdk.emit("e2e.metric.phase", { phase: "baseline", value: 1.0 });
    } else if (phase === 1) {
      ctx.sdk.metrics.record(metricId, 0.3, { note: "breach trigger" });
      ctx.sdk.metrics.evaluate(metricId);
      ctx.sdk.emit("e2e.metric.phase", { phase: "breach", value: 0.3 });
    } else if (phase === 2) {
      ctx.sdk.metrics.record(metricId, 0.95, { note: "recovery" });
      ctx.sdk.metrics.evaluate(metricId);
      ctx.sdk.emit("e2e.metric.phase", { phase: "recover", value: 0.95 });
    }
  };
};
