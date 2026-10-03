import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { openDatabase, type SqliteDb } from "../may-agent/src/lib/db.js";
import { applyDbSchema } from "../may-agent/src/lib/db/schema.js";
import { saveExecutionUsage } from "../may-agent/src/lib/db/execution-usage.js";
import { createExecutionUsage } from "../may-agent/src/lib/execution-usage.js";
import { createMetricService } from "../may-agent/src/lib/metrics.js";
import { createAppReporting } from "../may-agent/src/app/composition/reporting.js";
import { readMetricEvidence } from "../may-agent/src/app/adapters/reporting/metric-evidence.js";
import evaluationApp, { taskInputForEvent } from "../evaluation.app/app.js";
import { reviewMetric } from "../evaluation.app/agents/evaluator/workflows/metric-review.js";
import { intakeEvaluationReport } from "./agents/may/workflows/evaluation-report-intake.js";
import {
  fixture,
  executeReview,
  until,
} from "./scripts/metric-follow-through.fixture.js";
import app, {
  evaluationOperationAlertInput,
  evaluationTaskReportInput,
} from "./app.js";
import {
  effortMetrics,
  TASK_EFFORT_METRIC,
  EVALUATION_EFFORT_METRIC,
  EFFORT_REVIEW_THRESHOLD,
} from "./effort-metrics.js";

let db: SqliteDb;
beforeEach(() => {
  db = openDatabase(":memory:");
  applyDbSchema(db);
});
afterEach(() => db.close());
const cut = Math.floor(Date.now() / 1000) * 1000;
const definition = (id: string) =>
  effortMetrics.find((metric) => metric.id === id)!;
function sample(store = db, id = TASK_EFFORT_METRIC, end = cut) {
  return store
    .prepare(
      definition(id).sourceQuery!.replace(
        "CAST(strftime('%s','now') AS INTEGER) * 1000",
        "?",
      ),
    )
    .get(end)!;
}
function usage(
  store: SqliteDb,
  id: string,
  appId: string | undefined,
  taskId: string | undefined,
  replies: number,
  updatedAt = cut - 1,
  startedAt = cut - 10_000,
) {
  const data = createExecutionUsage({
    preparer: "fixture",
    entryHash: null,
    durationMs: 0,
    taskBytes: 1,
    promptBytes: 1,
    systemBytes: 1,
    failed: false,
  }).snapshot();
  data.totals.replies = replies;
  saveExecutionUsage(
    store,
    {
      id,
      sessionId: id,
      appId,
      agent: appId ?? "fixture",
      taskId,
      attemptId: id,
      configuredModel: "fixture/model",
      startedAt,
    },
    data,
    null,
    updatedAt,
  );
}

test("effort observes accepted work and running invocations, preserves scopes and uses the time index", () => {
  for (let i = 0; i < 40; i++) usage(db, `repeat-${i}`, "may", "churn", 3);
  usage(db, "productive", "may", "productive", 110);
  usage(db, "long", "scout", "research", 130, cut - 1, cut - 7_200_000);
  usage(db, "old", "may", "quiet-wait", 999, cut - 3_600_001);
  usage(db, "future", "may", "future", 999, cut);
  usage(db, "evaluator", "evaluation", "assessment", 500);
  usage(db, "unattributed", undefined, undefined, 900);
  usage(db, "without-task", "may", undefined, 900);
  const observed = sample();
  expect(observed).toMatchObject({
    value: 130,
    sampleSize: 42,
    measuredAt: cut,
  });
  const note = JSON.parse(String(observed.note));
  expect(note).toMatchObject({
    taskGroups: 3,
    aboveCandidateThreshold: 3,
    groupsTruncated: 0,
    unattributedInvocations: 2,
  });
  expect(note.groups.map((group: any) => group.taskId)).toEqual([
    "research",
    "churn",
    "productive",
  ]);
  expect(note.coverage).toContain("not covered");
  expect(sample(db, EVALUATION_EFFORT_METRIC).value).toBe(500);
  usage(db, "long", "scout", "research", 131, cut - 1, cut - 7_200_000);
  expect(sample().value).toBe(131); // Replacing a cumulative snapshot does not add it again.
  expect(sample(db, TASK_EFFORT_METRIC, cut + 3_600_001).value).toBe(0);
  const plan = db
    .prepare(`EXPLAIN QUERY PLAN ${definition(TASK_EFFORT_METRIC).sourceQuery}`)
    .all();
  expect(
    plan.some((row) =>
      String(row.detail).includes("idx_execution_usage_updated"),
    ),
  ).toBe(true);
});

test("missing reply accounting is unavailable; calibration does not open alerts", () => {
  const metrics = createMetricService({ getDb: () => db });
  metrics.defineMany(effortMetrics);
  usage(db, "high", "may", "work", 300);
  metrics.record(TASK_EFFORT_METRIC, Number(sample().value));
  expect(metrics.evaluate()).toEqual([]);
  db.run("UPDATE execution_usage SET data = ? WHERE id = 'high'", [
    JSON.stringify({ totals: {} }),
  ]);
  expect(sample().value).toBeNull();
});

test("normal definition activation retires the reviewed catalog and its alerts while preserving history", () => {
  const metrics = createMetricService({ getDb: () => db });
  const retired = [...app.metrics!, ...evaluationApp.metrics!].filter(
    (metric) => metric.status === "retired",
  );
  for (const metric of retired) {
    metrics.define({ id: metric.id, threshold: 0, alertOp: ">" });
    metrics.record(metric.id, 2);
    metrics.evaluate(metric.id);
  }
  createAppReporting(() => db).syncDefinitions([
    { definition: app },
    { definition: evaluationApp },
  ]);
  expect(retired).toHaveLength(97);
  expect(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM metric_alerts WHERE resolved_at IS NULL",
      )
      .get()!.n,
  ).toBe(0);
  expect(
    db.prepare("SELECT COUNT(*) AS n FROM metric_snapshots").get()!.n,
  ).toBe(97);
  for (const metric of retired) {
    expect(metrics.get(metric.id)?.status).toBe("retired");
    expect(
      db
        .prepare(
          "SELECT source_query, source_command, threshold FROM metrics WHERE id = ?",
        )
        .get(metric.id),
    ).toEqual({ source_query: null, source_command: null, threshold: null });
  }
});

test("effort review publishes evidence and reaches an accepted May decision without forcing expensive work to fail", async () => {
  const root = mkdtempSync(join(tmpdir(), "effort-review-"));
  const previousAutomatic = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
  process.env.EVALUATION_AUTO_REVIEW_ENABLED = "true";
  let chosen: any;
  const f = await fixture((attempt) =>
    executeReview(attempt, async () => chosen),
  );
  try {
    const events: any[] = [];
    const metrics = createMetricService({
      getDb: () => f.db,
      emit: (type, data, envelope) => events.push({ type, data, ...envelope }),
    });
    metrics.define({
      ...definition(TASK_EFFORT_METRIC),
      threshold: EFFORT_REVIEW_THRESHOLD,
    });
    usage(f.db, "productive", "may", "implementation", 120);
    const observed = sample(f.db);
    metrics.record(TASK_EFFORT_METRIC, Number(observed.value), {
      measuredAt: cut,
      sampleSize: Number(observed.sampleSize),
      note: String(observed.note),
    });
    metrics.evaluate(TASK_EFFORT_METRIC);
    const opening = events[0];
    const input = taskInputForEvent(opening)!;
    expect(input.kind).toBe("review-metric");
    const pinnedEnd = (input.data as any).end;
    const evidence = async () =>
      ({
        ...readMetricEvidence(f.db, TASK_EFFORT_METRIC, {
          end: pinnedEnd,
          windowMs: 3_600_000,
        }),
        responsibility: {
          appId: "may",
          status: "resolved",
          declaredOwner: "may",
          project: "may",
        },
      }) as any;
    const published: any[] = [];
    const ctx = createTestAppWorkflowContext({
      input: input.data,
      workspace: {
        appRoot: fileURLToPath(new URL("../evaluation.app/", import.meta.url)),
        root,
        projectRoot: root,
        output: root,
      },
      callAgent: async (_agent, prompt) => {
        expect(prompt).toContain("not proof of waste");
        expect(prompt).toContain("implementation");
        return {
          id: "scripted-review",
          kind: "agent",
          status: "done",
          summary: "Reviewed",
          output: {
            disposition: "assessed",
            summary:
              "The effort produced a useful implementation; no change recommended.",
            responsibility: "May owns the implementation",
            findings: ["Useful intermediate artifact retained"],
            verification: ["Scripted fixture artifact evidence"],
            delivery:
              "May should judge the recommendation against current work",
          },
        };
      },
      emit: async (event) => {
        published.push(event);
      },
    });
    await reviewMetric(ctx, evidence, root);
    expect(published).toHaveLength(1);
    expect(evaluationTaskReportInput(published[0])?.kind).toBe("message");
    const intake = await intakeEvaluationReport(
      createTestAppWorkflowContext({ input: published[0].data }),
      root,
      async () => null,
      evidence,
    );
    expect((intake.output as any).state).toBe("converged");
    chosen = {
      task: {
        state: "converged",
        summary: "Reviewed useful effort",
        facts: [],
      },
      decisions: [
        {
          metricId: TASK_EFFORT_METRIC,
          alertId: opening.data.alertId,
          disposition: "no-change",
          reason: "The retained implementation justifies the observed effort",
          evidence: [published[0].data.report],
        },
      ],
    };
    await f.attach("effort-review", {
      context: { publication: published[0].data },
    });
    await until(
      () =>
        f
          .decisions()
          .some((row) => row.decision.metricId === TASK_EFFORT_METRIC),
      "accepted effort disposition",
    );
    expect(
      f.decisions().find((row) => row.decision.metricId === TASK_EFFORT_METRIC)
        ?.decision.disposition,
    ).toBe("no-change");
    metrics.record(TASK_EFFORT_METRIC, 121);
    metrics.evaluate(TASK_EFFORT_METRIC);
    expect(events).toHaveLength(1);
    const independent = {
      ...opening,
      data: {
        ...opening.data,
        metricId: EVALUATION_EFFORT_METRIC,
        project: "evaluation",
      },
      owner: "app:evaluation",
    };
    expect(taskInputForEvent(independent)).toBeNull();
    expect(evaluationOperationAlertInput(independent)?.kind).toBe("message");
    expect(
      evaluationOperationAlertInput({
        ...independent,
        data: { ...independent.data, repeat: true },
      }),
    ).toBeNull();
  } finally {
    await f.close();
    if (previousAutomatic === undefined)
      delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previousAutomatic;
    rmSync(root, { recursive: true, force: true });
  }
});
