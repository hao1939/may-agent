import { afterEach, expect, test } from "bun:test";
import {
  createTestAppRead,
  createTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewMetric } from "./metric-review.js";
import { readPublishedEvaluationReport } from "./evaluation-report-reader.js";
import {
  selectMetricCandidate,
  metricReviewTaskId,
} from "./lib/metric-selection.js";
import { type MetricEvidence } from "./lib/metric-evidence.js";
import { taskInputForEvent, taskIntentForInput } from "../../../app.js";
import { evaluationTaskReportInput } from "../../../../may.app/app.js";
import { intakeEvaluationReport } from "../../../../may.app/agents/may/workflows/evaluation-report-intake.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const end = Math.floor(Date.now() / 3_600_000) * 3_600_000;
function evidence(metricId = "sample.failures", cut = end): MetricEvidence {
  return {
    version: 1,
    available: true,
    metricId,
    end: cut,
    windowMs: 86400000,
    metric: {
      id: metricId,
      project: "sample",
      status: "active",
      type: "gauge",
    },
    freshness: "fresh",
    latest: {
      value: 10,
      sampleSize: 50,
      measuredAt: cut - 1,
      note: "Failure percentage remains 20%; no Task started for the unresolved input.",
    },
    comparison: { previousLast: 5, currentLast: 10, change: 5 },
    collectionFailures: [],
  };
}
const judgment = {
  disposition: "assessed",
  summary:
    "Unresolved admission warrants investigation; greater volume alone is not a regression.",
  responsibility: "sample owns recovery; May coordinates follow-up",
  findings: ["An unadmitted input remains unresolved"],
  verification: ["Exact input reference in the retained sample"],
  delivery:
    "Recommend owner investigation and next-day reconsideration; recovery is unverified",
};
function context(options: any = {}) {
  return createTestAppWorkflowContext({
    input: { metricId: "sample.failures", end },
    workspace: {
      root: appRoot,
      appRoot,
      projectRoot: appRoot,
      output: appRoot,
    },
    ...options,
  });
}

test("pre-Task evidence uses the existing report, publication reader and May intake without inventing a Task", async () => {
  const root = mkdtempSync(join(tmpdir(), "metric-review-"));
  roots.push(root);
  const events: any[] = [];
  let calls = 0;
  const ctx = context({
    callAgent: async (_agent: string, prompt: string) => {
      calls++;
      expect(prompt).toContain("A Task is not required");
      expect(prompt).toContain("not verified recovery");
      return {
        id: "fixture-review",
        kind: "agent",
        status: "done",
        summary: "reviewed",
        output: { ...judgment, summary: judgment.summary + "x".repeat(6_100) },
      };
    },
    emit: async (event: any) => events.push(event),
  });
  const result = await reviewMetric(ctx, async () => evidence(), root);
  expect(result.output).toMatchObject({ state: "converged" });
  expect(events).toHaveLength(1);
  const publication = events[0].data;
  expect(publication).toHaveProperty("metricId", "sample.failures");
  expect(publication).not.toHaveProperty("taskId");
  expect(readPublishedEvaluationReport(publication, root).status).toBe("valid");
  await reviewMetric(ctx, async () => evidence(), root);
  expect(calls).toBe(1);
  expect(events).toHaveLength(1);
  const message = evaluationTaskReportInput(events[0])!;
  expect((message.data as any).context.publication.metricId).toBe(
    "sample.failures",
  );
  let taskReads = 0;
  const intake = await intakeEvaluationReport(
    context({ input: publication }),
    root,
    async () => {
      taskReads++;
      throw new Error("No execution Task exists");
    },
    async (id, cut) => ({
      ...evidence(id, cut),
      latest: {
        ...(evidence(id, cut).latest as object),
        note: "x".repeat(2_200),
      },
    }),
  );
  expect(taskReads).toBe(0);
  expect((intake.output as any).result).toMatchObject({
    disposition: "investigate",
    followUpKey: "metric:sample/sample.failures",
    checkedReport: { complete: true },
    currentEvidence: { complete: true },
  });
  expect(Buffer.byteLength(JSON.stringify(intake.output))).toBeLessThan(16_000);
  const largeIntake = await intakeEvaluationReport(
    context({ input: publication }),
    root,
    async () => {
      throw new Error("No execution Task exists");
    },
    async (id, cut) => ({
      ...evidence(id, cut),
      metric: { ...evidence(id, cut).metric, description: "x".repeat(8_000) },
      latest: {
        ...(evidence(id, cut).latest as object),
        note: "x".repeat(4_000),
      },
    }),
  );
  expect((largeIntake.output as any).result.currentEvidence).toMatchObject({
    metricId: publication.metricId,
    complete: false,
    omission: expect.stringContaining("reread this metric"),
  });
  expect(Buffer.byteLength(JSON.stringify(largeIntake.output))).toBeLessThan(
    16_000,
  );
  const jsonPath = join(root, publication.facts);
  const bytes = readFileSync(jsonPath, "utf8");
  writeFileSync(
    jsonPath,
    bytes.replace("Unresolved admission", "Tampered finding"),
  );
  expect(readPublishedEvaluationReport(publication, root).status).toBe(
    "invalid",
  );
});

test("lost publication reuses staged judgment and an exhausted allowance retains review work", async () => {
  const root = mkdtempSync(join(tmpdir(), "metric-replay-"));
  roots.push(root);
  let calls = 0;
  let fail = true;
  const ctx = context({
    callAgent: async () => {
      calls++;
      return {
        id: "fixture",
        kind: "agent",
        status: "done",
        summary: "reviewed",
        output: judgment,
      };
    },
    emit: async () => {
      if (fail) throw new Error("publication unavailable");
    },
  });
  await expect(reviewMetric(ctx, async () => evidence(), root)).rejects.toThrow(
    "publication unavailable",
  );
  fail = false;
  await reviewMetric(ctx, async () => evidence(), root);
  expect(calls).toBe(1);
  const changed = context({
    input: { metricId: "other.metric", end },
    callAgent: async () => {
      throw new Error("allowance must defer");
    },
  });
  const deferred = await reviewMetric(
    changed,
    async () => evidence("other.metric"),
    root,
  );
  expect(deferred.output).toMatchObject({
    state: "waiting",
    result: { disposition: "budget-deferred" },
  });
});

test("periodic selection revisits persistent metrics, honors the prior review boundary and exposes unavailable coverage", async () => {
  let nextReviewAt = end + 3_600_000;
  const ctx = context({
    read: createTestAppRead({
      tasks: { get: async () => ({ result: { nextReviewAt } }) as any },
    }),
  });
  const list = async () => ({
    metrics: [
      {
        id: "sample.failures",
        project: "sample",
        status: "active",
        alertOpen: true,
      },
      {
        id: "own.review",
        project: "evaluation",
        status: "active",
        alertOpen: true,
      },
    ],
  });
  expect(
    (
      await selectMetricCandidate(
        ctx,
        "",
        "evaluator",
        async () => evidence(),
        list,
        end,
      )
    ).candidate,
  ).toBeNull();
  nextReviewAt = end - 1;
  const selected = await selectMetricCandidate(
    ctx,
    "",
    "evaluator",
    async () => evidence(),
    list,
    end,
  );
  expect(selected.candidate).toMatchObject({
    metricId: "sample.failures",
    end,
  });
  const input = taskInputForEvent({
    type: "evaluation.metric.review.requested",
    data: selected.candidate!,
  } as any)!;
  const first = taskIntentForInput(input)!;
  const second = taskIntentForInput({
    ...input,
    data: { ...(input.data as any), end: end + 3_600_000 },
  })!;
  expect(first.id).toBe(metricReviewTaskId("sample.failures"));
  expect(second.id).toBe(first.id);
  const missing = await selectMetricCandidate(
    ctx,
    "",
    "evaluator",
    async () => {
      throw new Error("collector unavailable");
    },
    list,
    end,
  );
  expect(missing.candidate).toBeNull();
  expect(missing.facts.join("\n")).toContain("metric-read-deferred");
  const stale = await selectMetricCandidate(
    context(),
    "",
    "evaluator",
    async () => ({ ...evidence(), freshness: "stale" }),
    async () => ({
      metrics: [
        {
          id: "sample.failures",
          project: "sample",
          status: "active",
          alertOpen: false,
        },
      ],
    }),
    end,
  );
  expect(stale.candidate?.metricId).toBe("sample.failures");
});
