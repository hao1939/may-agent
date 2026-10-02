import { expect, test } from "bun:test";
import {
  observationCondition,
  type TaskDetail,
  type TaskReconciliationContext,
} from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  metricReviewHandoff,
  metricReviewResult,
  type MetricReview,
} from "./metric-follow-through.js";
import app, { taskForMayInput } from "./app.js";
import { createMetricEvidenceObserver } from "./watchers/metric-evidence.js";
import { respondToMetric } from "./agents/may/workflows/metric-response.js";
import { execute } from "./agents/may/workflows/metric-follow-through.js";

const decision = {
  metricId: "test.metric",
  alertId: null,
  disposition: "observe" as const,
  reason: "Review fresh evidence",
  evidence: ["metric:test.metric"],
  nextAction: "Judge recovery",
};
const condition = observationCondition(
  { ...createMetricEvidenceObserver(), appId: "may" },
  {
    observerId: "metric-evidence",
    id: "metric-state",
    resource: decision.metricId,
    expected: { field: "value", equals: 0, freshness: "fresh" },
  },
);
function review(): MetricReview {
  return {
    task: {
      state: "waiting",
      summary: "Wait for evidence",
      facts: [],
      conditions: [
        {
          ...condition,
          owner: condition.owner!,
          reviewAfterMs: condition.reviewAfterMs!,
        },
      ],
    },
    decisions: [decision],
  };
}
function reconciliation(): TaskReconciliationContext {
  return {
    appId: "may",
    taskId: "investigation",
    task: {
      id: "investigation",
      parentId: "may",
      status: "waiting",
      generation: 1,
      outcome: "Handle the full requirement",
      acceptance: ["All requirements fulfilled"],
      acceptedEvidence: { available: false, maxPageSize: 8 },
      conditions: [],
      input: {},
      acceptedAttempt: {
        id: "previous",
        generation: 1,
        startedAt: "2026-01-01",
      },
    } as TaskDetail,
    generation: 1,
    resourceVersion: 2,
    agent: "may",
    owner: "may",
    outcome: "Handle the full requirement",
    acceptance: ["All requirements fulfilled"],
    input: {},
    children: { live: [], completed: [] },
    waits: { open: [], note: "No waits" },
    taskSnapshot: { live: [], truncated: false },
    events: { items: [], truncated: false },
  };
}

test("May's real input mapper selects the workflow only for an explicit metric plan, and exposes the observer", () => {
  const handoff = metricReviewHandoff(review(), { topic: { kind: "none" } });
  expect(handoff.response).toBeUndefined();
  expect(
    metricReviewHandoff(review(), {
      topic: { kind: "none" },
      response: "The requested measurement needs another sample.",
    }).response,
  ).toBe("The requested measurement needs another sample.");
  const admitted = taskForMayInput({
    id: "input",
    source: { kind: "human", id: "tester" },
    input: handoff.followUp!.input,
  });
  expect(admitted).toMatchObject({
    kind: "desired",
    intent: {
      id: "goal/input",
      workflow: "metric-follow-through",
      agent: "may",
    },
  });
  const ordinary = taskForMayInput({
    id: "input",
    source: { kind: "human", id: "tester" },
    input: {
      kind: "goal",
      data: { outcome: "Ordinary work", acceptance: ["Verified"] },
    },
  });
  expect(
    ordinary.kind === "desired" && ordinary.intent.workflow,
  ).toBeUndefined();
  expect(app.observers?.some((o) => o.id === "metric-evidence")).toBe(true);
});

test("a request Condition does not replace a metric observation", () => {
  const result = review();
  result.task = {
    state: "waiting",
    summary: "Asked for a review",
    facts: [],
    requests: [
      {
        id: "review",
        appId: "evaluation",
        input: { kind: "review", data: {} },
      },
    ],
    conditions: [{ requestId: "review" }],
  };
  expect(() => metricReviewResult(reconciliation(), result)).toThrow(
    "Observe requires a saved or returned Condition for this metric",
  );
});

test("a missing wait or fabricated owner cannot be accepted as metric handling", () => {
  const rec = reconciliation();
  const plan = review();
  plan.task = { state: "waiting", summary: "Review later", facts: [] };
  expect(() => metricReviewResult(rec, plan)).toThrow("Condition");
  expect(() =>
    metricReviewResult(rec, {
      ...review(),
      decisions: [
        { ...decision, linkedTask: { appId: "other", taskId: "fake" } },
      ],
    }),
  ).toThrow("Metric review requires");
  expect(() =>
    metricReviewResult(rec, {
      ...review(),
      task: { ...review().task, facts: ["metric-disposition:fake"] },
    }),
  ).toThrow("Return metric judgments in decisions");
  const composed = metricReviewResult(rec, review());
  expect(composed.facts[0]).toContain(
    '"linkedTask":{"appId":"may","taskId":"investigation"}',
  );
});

test("the direct helper and report Conversation use the same complete result composition", async () => {
  const read = async () => ({
    available: true as const,
    metricId: decision.metricId,
    end: Date.now(),
    windowMs: 1000,
    metric: { id: decision.metricId, status: "active" },
    dispositions: [],
    freshness: "fresh",
    latest: { value: 3 },
  });
  const direct = await respondToMetric(
    createTestAppWorkflowContext({
      input: { review: review() },
      reconciliation: { ...reconciliation(), input: { review: review() } },
    }),
    read,
  );
  expect(direct.output).toEqual(metricReviewResult(reconciliation(), review()));
  const recomposed = metricReviewResult(reconciliation(), {
    task: direct.output,
    decisions: review().decisions,
  });
  expect(direct.output).toEqual(recomposed);
  expect(recomposed.facts).toHaveLength(1);
  expect(() =>
    metricReviewResult(reconciliation(), {
      task: direct.output,
      decisions: [{ ...decision, reason: "A different judgment" }],
    }),
  ).toThrow("Return metric judgments in decisions");
  expect(() =>
    metricReviewResult(
      { ...reconciliation(), taskId: "another-task" },
      {
        task: direct.output,
        decisions: review().decisions,
      },
    ),
  ).toThrow("Return metric judgments in decisions");
  const conversation = { topic: { kind: "none" as const } };
  const prepared = await respondToMetric(
    createTestAppWorkflowContext({ input: { review: review(), conversation } }),
    read,
  );
  expect(prepared.output).toEqual(metricReviewHandoff(review(), conversation));
  expect(prepared.output).not.toHaveProperty("facts");
});

test("mixed new input reaches judgment with the original requirements and existing waits", async () => {
  const rec = reconciliation();
  rec.input = { kind: "goal", data: { context: { metricResponse: review() } } };
  rec.events.items = [
    {
      observedAt: "2026-01-02",
      event: {
        type: "app.task.requested",
        source: "human",
        data: { request: { input: rec.input } },
      },
    },
    {
      observedAt: "2026-01-02",
      event: {
        type: "app.task.requested",
        source: "human",
        data: {
          request: {
            input: { kind: "goal", data: { outcome: "Also verify Linux" } },
          },
        },
      },
    },
  ];
  let calls = 0;
  const result = await execute(
    createTestAppWorkflowContext({
      input: rec.input,
      reconciliation: rec,
      callAgent: (async (_agent: string, prompt: string) => {
        calls++;
        expect(prompt).toContain("Also verify Linux");
        expect(prompt).toContain("All requirements fulfilled");
        return {
          id: "judgment",
          kind: "agent",
          status: "done",
          summary: "Review requirements",
          output: {
            task: {
              state: "waiting",
              continue: true,
              summary: "Verify Linux next",
              facts: ["New requirement remains"],
            },
            decisions: [],
          },
        };
      }) as never,
    }),
  );
  expect(calls).toBe(1);
  expect(result.output).toMatchObject({ state: "waiting", continue: true });
});
