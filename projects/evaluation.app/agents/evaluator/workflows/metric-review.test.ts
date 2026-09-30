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
import {
  resolveMetricResponsibility,
  type MetricEvidence,
} from "./lib/metric-evidence.js";
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
    responsibility: {
      appId: metricId === "own.review" ? "evaluation" : "sample",
      status: "resolved",
      declaredOwner: "sample",
      project: "sample",
    },
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
    followUpKey: JSON.stringify(["metric", "sample.failures", null]),
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
        async (id, cut) => evidence(id, cut),
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
    async (id, cut) => evidence(id, cut),
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

test("owner-only and unattributed metrics remain reviewable without treating project labels as App identity", async () => {
  const apps = [
    { id: "platform", owner: "operator" },
    { id: "evaluation", owner: "evaluator" },
  ];
  expect(
    resolveMetricResponsibility({ owner: "operator" }, apps),
  ).toMatchObject({ appId: "platform", status: "resolved" });
  expect(
    resolveMetricResponsibility({ project: "project-with-no-app" }, apps),
  ).toMatchObject({ appId: null, status: "unknown" });
  expect(
    resolveMetricResponsibility({ owner: "shared" }, [
      { id: "a", owner: "shared" },
      { id: "b", owner: "shared" },
    ]),
  ).toMatchObject({ appId: null, status: "ambiguous" });
  const selected = await selectMetricCandidate(
    context(),
    "",
    "evaluator",
    async (id, cut) => ({
      ...evidence(id, cut),
      metric: { id, owner: "operator", status: "active" },
    }),
    async () => ({
      metrics: [
        {
          id: "owner.only",
          owner: "operator",
          status: "active",
          alertOpen: true,
        },
      ],
    }),
    end,
  );
  expect(selected.candidate?.metricId).toBe("owner.only");
  const root = mkdtempSync(join(tmpdir(), "metric-owner-"));
  roots.push(root);
  const ctx = context({
    callAgent: async () => ({
      id: "review",
      kind: "agent",
      status: "done",
      output: judgment,
    }),
  });
  const reviewed = await reviewMetric(
    ctx,
    async () => ({
      ...evidence(),
      metric: { ...evidence().metric, project: "project-with-no-app" },
      responsibility: resolveMetricResponsibility(
        { project: "project-with-no-app" },
        apps,
      ),
    }),
    root,
  );
  const publication = (reviewed.output as any).result.publication;
  expect(publication).not.toHaveProperty("appId");
  expect(readPublishedEvaluationReport(publication, root).status).toBe("valid");
});

test("publication retry uses the retained assessment even when metric source reads would now differ or fail", async () => {
  const root = mkdtempSync(join(tmpdir(), "metric-replay-"));
  roots.push(root);
  let calls = 0,
    reads = 0,
    fail = true;
  const ctx = context({
    callAgent: async () => {
      calls++;
      return {
        id: "first-assessment",
        kind: "agent",
        status: "done",
        output: judgment,
      };
    },
    emit: async () => {
      if (fail) throw new Error("publication unavailable");
    },
  });
  const reader = async () => {
    reads++;
    return {
      ...evidence(),
      alerts: [{ alertId: 42, createdAt: end - 10, resolvedAt: null }],
    };
  };
  await expect(reviewMetric(ctx, reader, root)).rejects.toThrow(
    "publication unavailable",
  );
  fail = false;
  const replay = await reviewMetric(
    ctx,
    async () => {
      reads++;
      throw new Error("definition was changed and source is now unavailable");
    },
    root,
  );
  const publication = (replay.output as any).result.publication;
  expect(calls).toBe(1);
  expect(reads).toBe(1);
  expect(publication).toMatchObject({
    executionId: "first-assessment",
    alertId: 42,
  });
  expect(readPublishedEvaluationReport(publication, root).status).toBe("valid");
  expect(
    readPublishedEvaluationReport({ ...publication, alertId: 43 }, root).status,
  ).toBe("invalid");
});

test("new reports for a breach retain the direct owner's investigation and duplicate intake reads its accepted link", async () => {
  const root = mkdtempSync(join(tmpdir(), "metric-intake-"));
  roots.push(root);
  const reader = async (id: string, cut: number) => ({
    ...evidence(id, cut),
    alerts: [{ alertId: 42, createdAt: end - 10, resolvedAt: null }],
  });
  const review = await reviewMetric(
    context({
      callAgent: async () => ({
        id: "review",
        kind: "agent",
        status: "done",
        output: judgment,
      }),
    }),
    reader,
    root,
  );
  const publication = (review.output as any).result.publication;
  const reads: string[] = [];
  const link = { appId: "sample", taskId: "repair/existing" };
  const current = async (id: string, cut: number) => ({
    ...(await reader(id, cut)),
    dispositions: [
      {
        appId: "sample",
        taskId: "owner-review",
        attemptId: "accepted",
        decision: {
          version: 1,
          metricId: id,
          alertId: 42,
          disposition: "investigate",
          linkedTask: link,
        },
      },
    ],
  });
  const linkedRead = async (appId: string, taskId: string) => {
    reads.push(`${appId}/${taskId}`);
    return { appId, taskId, status: "waiting" };
  };
  const first = await intakeEvaluationReport(
    context({ input: publication }),
    root,
    undefined,
    current,
    linkedRead,
  );
  const saved = (first.output as any).result;
  expect(saved).toMatchObject({
    disposition: "investigate",
    linkedTaskId: link.taskId,
    linkedAppId: link.appId,
  });
  let ownerReads = 0;
  const replay = await intakeEvaluationReport(
    context({
      input: publication,
      reconciliation: { taskId: "may-owner" },
      read: createTestAppRead({
        tasks: {
          get: async () => {
            ownerReads++;
            return { id: "may-owner", result: saved } as any;
          },
        },
      }),
    }),
    root,
    undefined,
    current,
    linkedRead,
  );
  expect(ownerReads).toBe(1);
  expect((replay.output as any).result).toMatchObject({
    disposition: "reuse",
    linkedTaskId: link.taskId,
  });
  expect(reads.every((id) => id === "sample/repair/existing")).toBe(true);
  const laterRoot = mkdtempSync(join(tmpdir(), "metric-later-"));
  roots.push(laterRoot);
  const laterReview = await reviewMetric(
    context({
      input: { metricId: "sample.failures", end: end + 1 },
      callAgent: async () => ({
        id: "later-review",
        kind: "agent",
        status: "done",
        output: judgment,
      }),
    }),
    reader,
    laterRoot,
  );
  const later = await intakeEvaluationReport(
    context({
      input: (laterReview.output as any).result.publication,
      reconciliation: { taskId: "may-owner" },
      read: createTestAppRead({
        tasks: { get: async () => ({ id: "may-owner", result: saved }) as any },
      }),
    }),
    laterRoot,
    undefined,
    current,
    linkedRead,
  );
  expect((later.output as any).result).toMatchObject({
    disposition: "investigate",
    priorRead: "absent",
    linkedTaskId: link.taskId,
  });
  expect((later.output as any).result.handoffKey).toBe(saved.handoffKey);
  const missing = await intakeEvaluationReport(
    context({ input: publication }),
    root,
    undefined,
    current,
    async () => {
      throw new Error("missing linked owner");
    },
  );
  expect(missing.output).toMatchObject({ state: "incomplete" });
});
