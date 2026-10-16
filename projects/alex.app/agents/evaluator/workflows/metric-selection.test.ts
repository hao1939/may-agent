import { afterEach, expect, setSystemTime, test } from "bun:test";
import {
  createTestAppRead,
  createTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectMetricCandidate,
  metricReviewTaskId,
} from "./lib/metric-selection.js";
import { runTaskOutcomeSelector } from "./task-outcome-selector.js";
import { reviewMetric } from "./metric-review.js";
import { taskInputForEvent, taskIntentForInput } from "../../../app.js";
import type { MetricEvidence } from "./lib/metric-evidence.js";

const NOW = Date.UTC(2026, 9, 16);
const DAY = 86_400_000;
const metricId = "sample.effort";
const reviewer = "evaluator-deepseek";
const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "metric-transitions-"));
  roots.push(root);
  const tasks = new Map<string, any>();
  const events: any[] = [];
  let calls = 0;
  let failPublication = false;
  const context = (input: any = {}) =>
    createTestAppWorkflowContext({
      input,
      workspace: {
        root: appRoot,
        appRoot,
        projectRoot: appRoot,
        output: appRoot,
      },
      read: createTestAppRead({
        tasks: { get: async (id) => tasks.get(id) ?? null },
      }),
      callAgent: async () => {
        calls++;
        return {
          id: `review-${calls}`,
          kind: "agent",
          status: "done",
          output: {
            disposition: "assessed",
            summary: "Inspect the recorded observation",
            responsibility: "Sample owns the work",
            findings: [],
            verification: ["Supplied metric evidence"],
            delivery: "Observation retained",
            followUp: { kind: "none" },
          },
        };
      },
      emit: async (event) => {
        if (failPublication) throw new Error("publication unavailable");
        events.push(event);
      },
    });
  let alerts: any[] = [];
  let sample: any = {};
  const read = async (
    id: string,
    cut: number,
    alertId?: number,
  ): Promise<MetricEvidence> => ({
    available: true,
    version: 1,
    metricId: id,
    end: cut,
    windowMs: DAY,
    metric: { id, status: "active", project: "sample" },
    responsibility: {
      appId: "sample",
      status: "resolved",
      declaredOwner: "sample",
      project: "sample",
    },
    freshness: "fresh",
    comparison: { change: 4 },
    collectionFailures: [],
    ...sample,
    alerts: alerts
      .filter(
        (a) =>
          a.createdAt < cut && (alertId === undefined || a.alertId === alertId),
      )
      .map((a) => ({
        ...a,
        resolvedAt: a.resolvedAt < cut ? a.resolvedAt : null,
      })),
  });
  const select = (now: number, selectedReviewer = reviewer) =>
    selectMetricCandidate(
      context(),
      "",
      selectedReviewer,
      read,
      async () => ({
        metrics: [
          {
            id: metricId,
            status: "active",
            alertOpen: alerts.some((a) => !a.resolvedAt),
          },
        ],
      }),
      now,
    );
  const review = async (input: any) => {
    const result = await reviewMetric(context(input), read, root);
    // Ordinary accepted Task output, including quiet completion and waits.
    tasks.set(metricReviewTaskId(metricId, reviewer), {
      result: result.output,
    });
    return result.output as any;
  };
  return {
    root,
    tasks,
    events,
    context,
    read,
    select,
    review,
    get calls() {
      return calls;
    },
    set alerts(value: any[]) {
      alerts = value;
    },
    set sample(value: any) {
      sample = value;
    },
    set failPublication(value: boolean) {
      failPublication = value;
    },
  };
}

test.each([
  { comparison: { change: 10 } },
  { comparison: { change: -10 } },
  { comparison: { change: null } },
  { comparison: undefined },
  { freshness: "stale" },
  { freshness: "missing" },
  { collectionFailures: [{ at: NOW - 1 }], latest: { measuredAt: NOW - 2 } },
])(
  "ordinary observations do not become selector review requests: %j",
  async (sample) => {
    const f = fixture();
    f.sample = sample;
    const ctx = f.context();
    const result = await runTaskOutcomeSelector(
      {
        ...ctx,
        reconciliation: {
          taskId: "runtime/task-outcome-selector",
          resourceVersion: 1,
          taskSnapshot: { live: [], truncated: false },
        },
      } as any,
      async () => ({ type: "ok", command: "apps.list", apps: [] }),
      {
        enabled: true,
        reviewer,
        intervalMs: 300_000,
        maxApps: 10,
        maxTasksPerApp: 2,
        maxPagesPerApp: 2,
        recentWindowMs: 7 * DAY,
      },
      f.root,
      async () => f.select(NOW),
    );
    expect(result.output).toMatchObject({ state: "converged" });
    expect(f.events).toHaveLength(0);
    expect(f.calls).toBe(0);
  },
);

test("missed breach and recovery notifications are repaired once; daily samples do not renew the investigation", async () => {
  const f = fixture();
  let now = NOW;
  setSystemTime(now);
  f.alerts = [{ alertId: 7, createdAt: now - 1000, resolvedAt: null }];
  const first = (await f.select(now)).candidate!;
  expect(first).toEqual({ metricId, reviewer, alertId: 7, end: now - 999 });
  const intent = taskIntentForInput(
    taskInputForEvent({
      type: "evaluation.metric.review.requested",
      data: first,
    } as any)!,
  )!;
  expect(intent.id).toBe(metricReviewTaskId(metricId, reviewer));
  expect(await f.review(intent.input)).toMatchObject({
    state: "converged",
    result: { reviewedThrough: first.end },
  });

  for (let i = 0; i < 12; i++) {
    now += DAY;
    setSystemTime(now);
    f.sample = {
      comparison: { change: i + 1 },
      latest: { value: 20 + i, measuredAt: now - 1 },
    };
    expect((await f.select(now)).candidate).toBeNull();
  }
  expect(f.calls).toBe(1);
  // Reviewer coverage is independent; another reviewer can still assess it.
  expect((await f.select(now, "evaluator" as any)).candidate?.alertId).toBe(7);

  f.alerts = [{ alertId: 7, createdAt: NOW - 1000, resolvedAt: now - 10 }];
  const recovery = (await f.select(now)).candidate!;
  expect(recovery.end).toBe(now - 9);
  expect(await f.review({ ...recovery, automatic: true })).toMatchObject({
    state: "converged",
  });
  expect(f.calls).toBe(2);
  expect((await f.select(now + DAY)).candidate).toBeNull();

  // A late old delivery must not lower the saved boundary or republish a report.
  expect(await f.review({ ...first, automatic: true })).toMatchObject({
    result: { reviewedThrough: recovery.end },
  });
  expect(f.calls).toBe(2);
  expect(f.events).toHaveLength(2);
  expect((await f.select(now + DAY)).candidate).toBeNull();

  now += DAY;
  setSystemTime(now);
  f.alerts = [{ alertId: 8, createdAt: now - 1, resolvedAt: null }];
  const next = (await f.select(now)).candidate!;
  expect(next.alertId).toBe(8);
  await f.review({ ...next, automatic: true });
  expect(f.calls).toBe(3);
});

test("legacy sample requests stay quiet, while explicit review remains available", async () => {
  const f = fixture();
  setSystemTime(NOW);
  for (let i = 0; i < 5; i++) {
    expect(
      await f.review({ metricId, reviewer, end: NOW + i, automatic: true }),
    ).toMatchObject({
      state: "converged",
      result: { disposition: "no-new-transition", reviewedThrough: 0 },
    });
  }
  expect(f.calls).toBe(0);
  expect(f.events).toHaveLength(0);
  await f.review({ metricId, reviewer, end: NOW, automatic: false });
  expect(f.calls).toBe(1);
  expect(f.events).toHaveLength(1);
});

test("a staged legacy judgment still publishes on retry without a second model call", async () => {
  const f = fixture();
  setSystemTime(NOW);
  const input = { metricId, reviewer, end: NOW };
  f.failPublication = true;
  await expect(f.review(input)).rejects.toThrow("publication unavailable");
  expect((await f.select(NOW)).candidate).toBeNull();
  expect(f.calls).toBe(1);
  f.failPublication = false;
  // The old automatic path is now quiet, but its already accepted judgment is retained.
  expect(await f.review({ ...input, automatic: true })).toMatchObject({
    state: "converged",
    result: { reviewedThrough: NOW },
  });
  expect(f.calls).toBe(1);
  expect(f.events).toHaveLength(1);
});

test("failed publication leaves the transition due; retry reuses its judgment and then quiets the scan", async () => {
  const f = fixture();
  setSystemTime(NOW);
  f.alerts = [{ alertId: 9, createdAt: NOW - 10, resolvedAt: null }];
  const candidate = (await f.select(NOW)).candidate!;
  const input = { ...candidate, automatic: true };
  f.failPublication = true;
  await expect(f.review(input)).rejects.toThrow("publication unavailable");
  expect(f.calls).toBe(1);
  expect((await f.select(NOW + DAY)).candidate).toEqual(candidate);
  f.failPublication = false;
  await f.review(input);
  expect(f.calls).toBe(1);
  expect(f.events).toHaveLength(1);
  expect((await f.select(NOW + DAY)).candidate).toBeNull();
});

test("a capacity wait keeps completed coverage and does not mark the next transition reviewed", async () => {
  const f = fixture();
  setSystemTime(NOW);
  await f.review({ metricId, reviewer, end: NOW - 1000 });
  f.alerts = [{ alertId: 10, createdAt: NOW - 10, resolvedAt: null }];
  const candidate = (await f.select(NOW)).candidate!;
  const input = { ...candidate, automatic: true };
  expect(await f.review(input)).toMatchObject({
    state: "waiting",
    result: { reviewedThrough: NOW - 1000 },
  });
  expect((await f.select(NOW)).candidate).toEqual(candidate);
  expect(f.calls).toBe(1);
  setSystemTime(NOW + DAY);
  await f.review(input);
  expect(f.calls).toBe(2);
  expect((await f.select(NOW + DAY)).candidate).toBeNull();
});

test("unknown alert evidence and unreadable prior review remain observable without a model call", async () => {
  const f = fixture();
  const list = async () => ({
    metrics: [{ id: metricId, status: "active", alertOpen: true }],
  });
  for (const gap of [undefined, [{ alertId: 7, createdAt: "unknown" }]]) {
    const selection = await selectMetricCandidate(
      f.context(),
      "",
      reviewer,
      async (id, cut) => ({ ...(await f.read(id, cut)), alerts: gap }),
      list,
      NOW,
    );
    expect(selection.candidate).toBeNull();
    expect(selection.facts.join("\n")).toContain("metric-read-deferred");
  }
  const result = await reviewMetric(
    {
      ...f.context({
        metricId,
        reviewer,
        end: NOW,
        alertId: 7,
        automatic: true,
      }),
      read: createTestAppRead({
        tasks: {
          get: async () => {
            throw new Error("read unavailable");
          },
        },
      }),
    },
    f.read,
    f.root,
  );
  expect(result.output).toMatchObject({ state: "incomplete", report: true });
  expect(f.calls).toBe(0);
});
