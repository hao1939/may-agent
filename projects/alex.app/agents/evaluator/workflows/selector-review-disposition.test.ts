import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskClosure, WorkflowContext } from "@may-agent/sdk";
import { retainedRequestedReviewTaskIds, runTaskOutcomeSelector } from "./task-outcome-selector.js";
import {
  hashReport, markTaskReportPublished, renderTaskReportMarkdown,
  taskReportPaths, TASK_OUTCOME_RUBRIC_VERSION, writeImmutable,
} from "./lib/task-report-store.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const selectorId = "runtime/task-outcome-selector";
const reviewId = "review/one-finite-assessment";
const hash = "c".repeat(64);
const config = {
  enabled: true, reviewer: "evaluator" as const, intervalMs: 300_000,
  maxApps: 2, maxTasksPerApp: 2, maxPagesPerApp: 1, recentWindowMs: 86_400_000,
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "selector-disposition-"));
  roots.push(root);
  const paths = taskReportPaths("may", "goal/report", hash);
  const payload = {
    version: 1, rubricVersion: TASK_OUTCOME_RUBRIC_VERSION,
    sourceRevision: "disposition-fixture", createdAt: Date.now(), disposition: "assessed",
    subject: { appId: "may", taskId: "goal/report", evidenceHash: hash },
    snapshot: { generation: 2, evidenceHash: hash },
    evaluator: { executionId: "review-execution" },
    judgment: { disposition: "assessed", summary: "Supported assessment", responsibility: "Assess one snapshot", delivery: "Report published", findings: [], verification: [] },
  };
  writeImmutable(join(root, paths.jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
  writeImmutable(join(root, paths.markdownPath), renderTaskReportMarkdown(payload)!);
  markTaskReportPublished(root, {
    appId: "may", taskId: "goal/report", evidenceHash: hash, executionId: "review-execution",
    jsonPath: paths.jsonPath, markdownPath: paths.markdownPath,
    jsonSha256: hashReport(join(root, paths.jsonPath)), markdownSha256: hashReport(join(root, paths.markdownPath)),
  });
  const review = {
    id: reviewId, parentId: "root", status: "idle", generation: 3, resourceVersion: 8,
    creator: { appId: "alex", taskId: selectorId }, agent: "evaluator", workflow: "task-outcome-review",
    outcome: "Assess one exact snapshot", acceptance: ["Publish its supported assessment"],
    input: { appId: "may", taskId: "goal/report", evidenceHash: hash, subjectGeneration: 2, reviewer: "evaluator" },
    acceptedAttempt: { id: "accepted-review", generation: 3, startedAt: "2026-11-08T00:00:00Z", finishedAt: "2026-11-08T00:01:00Z" },
    response: "Supported assessment published", conditions: [],
    currentObligations: { available: true, inputWaits: { items: [] as unknown[], maxItems: 100, truncated: false }, reviewAt: undefined as number | undefined },
    pendingEvents: { items: [] as unknown[], truncated: false },
    facts: ["review-disposition:assessed", "subject:may/goal/report", "subject-generation:2", `evidence-hash:${hash}`, "execution:review-execution", "reviewer:evaluator", `report:${paths.markdownPath}`, `report-facts:${paths.jsonPath}`],
  };
  const closes: TaskClosure[] = [];
  let samples = 0;
  const ctx = {
    signal: new AbortController().signal,
    reconciliation: { appId: "alex", taskId: selectorId, taskSnapshot: { live: [{ taskId: reviewId, agent: "evaluator", status: "idle" }], truncated: false } },
    read: { tasks: { get: async (id: string) => id === selectorId ? { facts: [] as string[] } : review } },
    closeTask: async (change: TaskClosure) => { closes.push(change); review.status = "closed"; return review; },
    call: async () => { throw new Error("Disposition must not invoke a model"); },
    events: { emit: async (): Promise<void> => { throw new Error("Do not commission another review during disposition"); } },
    done: (_summary: string, result: unknown) => result,
  };
  const run = (overrides: Partial<typeof config> = {}) => runTaskOutcomeSelector(
    ctx as unknown as WorkflowContext<{ reason?: string }>,
    async () => { samples++; throw new Error("Routine sampling must wait for retained review disposition"); },
    { ...config, ...overrides }, root, async (_ctx, cursor) => ({ candidate: null, cursor, facts: [] }),
  );
  return { root, review, ctx, run, closes, samples: () => samples };
}

test("the selector consumes its published finite review with exact creator/result guards and no model call", async () => {
  const f = fixture();
  const result = await f.run();
  expect(f.closes).toEqual([{
    appId: "alex", taskId: reviewId, expectedGeneration: 3, expectedResourceVersion: 8,
    afterResult: "accepted-review", reason: expect.stringContaining("published"),
  }]);
  expect(result).toMatchObject({ state: "converged", facts: expect.arrayContaining([`selector:review-closed:${reviewId}`]) });
  expect(f.samples()).toBe(0);
  await f.run();
  expect(f.closes).toHaveLength(1);
});

test.each(["waiting", "pending-input", "review-deadline", "foreign-creator", "older-generation", "missing-publication", "reusable-metric", "racing-close", "different-subject", "different-evidence", "different-execution", "conflicting-facts", "unavailable-obligations", "truncated-events", "snapshot-generation"])("retain %s review responsibility instead of inferring closure from idle", async scenario => {
  const f = fixture();
  if (scenario === "waiting") f.review.currentObligations.inputWaits.items.push({ id: "owed-result" });
  if (scenario === "pending-input") f.review.pendingEvents.items.push({ event: { type: "correction" } });
  if (scenario === "review-deadline") f.review.currentObligations.reviewAt = Date.now() + 60_000;
  if (scenario === "foreign-creator") f.review.creator.taskId = "another-creator";
  if (scenario === "older-generation") f.review.acceptedAttempt.generation = 2;
  if (scenario === "missing-publication") rmSync(f.root, { recursive: true, force: true });
  if (scenario === "reusable-metric") f.review.workflow = "metric-review";
  if (scenario === "racing-close") f.ctx.closeTask = async () => { throw new Error("Resource version changed"); };
  if (scenario === "different-subject") f.review.input.taskId = "goal/other";
  if (scenario === "different-evidence") f.review.input.evidenceHash = "d".repeat(64);
  if (scenario === "different-execution") f.review.facts = f.review.facts.map(value => value === "execution:review-execution" ? "execution:other" : value);
  if (scenario === "conflicting-facts") f.review.facts.push("subject:may/another-task");
  if (scenario === "unavailable-obligations") f.review.currentObligations.available = false;
  if (scenario === "truncated-events") f.review.pendingEvents.truncated = true;
  if (scenario === "snapshot-generation") {
    f.review.input.subjectGeneration = 3;
    f.review.facts = f.review.facts.map(value => value === "subject-generation:2" ? "subject-generation:3" : value);
  }
  const result = await f.run();
  expect(f.closes).toEqual([]);
  expect(f.samples()).toBe(0);
  expect(result).toMatchObject({ state: "converged", facts: expect.arrayContaining(["selector:requested-reviews-first:1"]) });
});

test("disabling routine sampling still consumes an already published responsibility", async () => {
  const f = fixture();
  await f.run({ enabled: false });
  expect(f.closes).toHaveLength(1);
  expect(f.samples()).toBe(0);
});

test("older Hosts without creator closure keep finite reviews in the backlog", async () => {
  const f = fixture();
  delete (f.ctx as Partial<typeof f.ctx>).closeTask;
  const result = await f.run();
  expect(f.closes).toHaveLength(0);
  expect(result.facts).toContain("selector:requested-reviews-first:1");
  expect(f.samples()).toBe(0);
});

test("modern finite review IDs preserve each reviewer's independent allowance", () => {
  const f = fixture();
  const ctx = f.ctx as unknown as WorkflowContext<{ reason?: string }>;
  expect(retainedRequestedReviewTaskIds(ctx, "evaluator")).toEqual([reviewId]);
  expect(retainedRequestedReviewTaskIds(ctx, "evaluator-deepseek")).toEqual([]);
});

test("idle reusable metric services leave the semantic backlog without closure or extra reads", async () => {
  const f = fixture();
  const ids = Array.from({ length: 12 }, (_, index) => `runtime/metric-review/evaluator/metric-${index}`);
  f.ctx.reconciliation.taskSnapshot.live = ids.map(taskId => ({ taskId, agent: "evaluator", status: "idle" }));
  const reads: string[] = [];
  f.ctx.read.tasks.get = async id => { reads.push(id); return { facts: [] }; };
  let metricScans = 0;
  let emitted = 0;
  f.ctx.events.emit = async () => { emitted++; };
  const result = await runTaskOutcomeSelector(
    f.ctx as unknown as WorkflowContext<{ reason?: string }>,
    async () => { throw new Error("No Task catalog needed when a metric is selected"); },
    config, f.root,
    async (_ctx, cursor) => {
      metricScans++;
      return { candidate: { metricId: "sample.failures", end: 1, alertId: 1, reviewer: "evaluator" }, cursor, facts: ["selector:metric-pass-verified"] };
    },
  );
  expect(metricScans).toBe(1);
  expect(emitted).toBe(1);
  expect(f.closes).toEqual([]);
  expect(reads).toEqual([selectorId]);
  expect(result.facts).not.toContain("selector:requested-reviews-first:12");
  expect(result.facts).toContain("selector:metric-pass-verified");
});

test.each(["pending", "running", "waiting", "attention", "unknown"])("a %s metric service still blocks routine sampling", async status => {
  const f = fixture();
  f.ctx.reconciliation.taskSnapshot.live = [{ taskId: "runtime/metric-review/evaluator/metric-one", agent: "evaluator", status }];
  const result = await f.run();
  expect(result.facts).toContain("selector:requested-reviews-first:1");
  expect(f.closes).toEqual([]);
  expect(f.samples()).toBe(0);
});

test("new work on an idle metric service reenters the backlog on the next snapshot", async () => {
  const f = fixture();
  const service = { taskId: "runtime/metric-review/evaluator/metric-one", agent: "evaluator", status: "idle" };
  f.ctx.reconciliation.taskSnapshot.live = [service];
  const ctx = f.ctx as unknown as WorkflowContext<{ reason?: string }>;
  expect(retainedRequestedReviewTaskIds(ctx)).toEqual([]);
  service.status = "pending";
  expect(retainedRequestedReviewTaskIds(ctx)).toEqual([service.taskId]);
  service.agent = "evaluator-deepseek";
  service.taskId = "runtime/metric-review/evaluator-deepseek/metric-one";
  expect(retainedRequestedReviewTaskIds(ctx)).toEqual([]);
  expect(retainedRequestedReviewTaskIds(ctx, "evaluator-deepseek")).toEqual([service.taskId]);
});

test("bounded disposition rotates past retained early records without resetting sampling cursors", async () => {
  const f = fixture();
  const taskIds = Array.from({ length: 6 }, (_, index) => `review/${index}`);
  f.ctx.reconciliation.taskSnapshot.live = taskIds.map(taskId => ({ taskId, agent: "evaluator", status: "idle" }));
  let facts: string[] = [];
  const reads: string[] = [];
  const cursor = "opaque-task-cursor-must-survive";
  facts = [`selector-state:${Buffer.from(JSON.stringify({version: 8, taskCursorByApp: { app: cursor }})).toString("base64url")}`];
  f.ctx.read.tasks.get = async id => {
    if (id === selectorId) return { facts };
    reads.push(id);
    return { ...f.review, id, status: id === taskIds[5] ? "idle" : "waiting" };
  };
  f.ctx.closeTask = async change => {
    f.closes.push(change);
    return { ...f.review, id: change.taskId, status: "closed" };
  };
  const first = await f.run();
  facts = first.facts as string[];
  expect(reads).toEqual(taskIds.slice(0, 4));
  expect(f.closes).toHaveLength(0);
  const second = await f.run();
  expect(reads.slice(4)).toEqual([taskIds[4], taskIds[5], taskIds[0], taskIds[1]]);
  expect(f.closes.map(change => change.taskId)).toEqual([taskIds[5]]);
  const stateFact = (second.facts as string[]).find(value => value.startsWith("selector-state:"))!;
  const state = JSON.parse(Buffer.from(stateFact.slice(15), "base64url").toString("utf8"));
  expect(state.taskCursorByApp.app).toBe(cursor);
  expect(f.samples()).toBe(0);
});
