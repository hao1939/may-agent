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
  disposition: "investigate" as const,
  reason: "A repair is pending",
  evidence: ["metric:test.metric"],
  nextAction: "Judge the repair result",
};
const metricCondition = observationCondition(
  { ...createMetricEvidenceObserver(), appId: "may" },
  {
    observerId: "metric-evidence",
    id: "metric-state",
    resource: decision.metricId,
    expected: { field: "value", equals: 0, freshness: "fresh" },
  },
);
const condition = {
  id: "repair-result",
  type: "repair.finished",
  subject: "request:verification",
  expected: { done: true },
  owner: "app:may",
  reviewAfterMs: 3_600_000,
};
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

test("completed Conversation metric review retains the judgment without commissioning work", async () => {
  for (const disposition of ["no-change", "recovered"] as const) {
    const complete: MetricReview = {
      task: {
        state: "converged",
        summary: "Review is complete",
        facts: ["publication:checked"],
      },
      decisions: [{ ...decision, disposition }],
    };
    const conversation = { response: "No further action is needed." };
    const result = await respondToMetric(
      createTestAppWorkflowContext({
        input: { review: complete, conversation },
      }),
      async () => ({
        available: true,
        metricId: decision.metricId,
        alerts: [],
        dispositions: [],
      }),
    );
    const output = result.output as ReturnType<typeof metricReviewHandoff>;
    expect(output).toMatchObject({
      summary: "Review is complete",
      response: conversation.response,
    });
    expect(output.followUp).toBeUndefined();
    expect(output.facts?.[0]).toBe("publication:checked");
    expect(
      JSON.parse(output.facts![1]!.slice("metric-disposition:".length)),
    ).toMatchObject({ version: 1, metricId: decision.metricId, disposition });
    expect(output.facts![1]).not.toContain("linkedTask");
    expect(
      metricReviewHandoff(
        { ...complete, task: { ...complete.task, response: "Reviewed" } },
        {},
      ).response,
    ).toBe("Reviewed");
    expect(() =>
      metricReviewHandoff(
        { ...complete, task: { ...complete.task, response: "Reviewed" } },
        conversation,
      ),
    ).toThrow("Use one response");
    expect(() =>
      metricReviewHandoff(complete, {
        task: { appId: "may", taskId: "conversation" },
      }),
    ).toThrow("without Task effects");
    expect(() =>
      metricReviewHandoff(
        {
          ...complete,
          task: {
            ...complete.task,
            requests: [
              { id: "work", appId: "may", input: { kind: "goal", data: {} } },
            ],
          },
        },
        {},
      ),
    ).toThrow("without Task effects");
    expect(() =>
      metricReviewHandoff({ ...complete, decisions: [decision] }, {}),
    ).toThrow("without Task effects");
  }
});

test("May's real input mapper selects the workflow only for an explicit metric plan, and exposes the observer", () => {
  const handoff = metricReviewHandoff(review(), { topic: { kind: "none" } });
  expect(handoff.response).toBeUndefined();
  expect(
    metricReviewHandoff(review(), {
      topic: { kind: "none" },
      response: "The repair needs a decision.",
    }).response,
  ).toBe("The repair needs a decision.");
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

test("a request Condition carries repair follow-through without a metric observation", () => {
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
  expect(metricReviewResult(reconciliation(), result)).toMatchObject({
    state: "waiting",
    conditions: [{ requestId: "review" }],
  });
});

test("fabricated owners and dispositions cannot be accepted as metric handling", () => {
  const rec = reconciliation();
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

test("the recorded reviewAt-only counterexample passes composition, helper, and production workflow", async () => {
  const recordedReviewAt = 1_791_058_700_000;
  const timed: MetricReview = {
    task: {
      state: "waiting",
      summary: "Recheck actual outstanding work after backoff",
      facts: ["accepted-attempt:r_1_1ced50ef-413b-480d-83ab-d07d5e8f323c"],
      reviewAt: recordedReviewAt,
    },
    decisions: [
      {
        ...decision,
        reason: "Post-backoff verification remains",
        nextAction: "Deliberately reconsider the outstanding verification",
      },
    ],
  };
  expect(metricReviewResult(reconciliation(), timed)).toMatchObject({
    state: "waiting",
    reviewAt: recordedReviewAt,
  });

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
      input: { review: timed },
      reconciliation: { ...reconciliation(), input: { review: timed } },
    }),
    read,
  );
  expect(direct.output).toMatchObject({
    state: "waiting",
    reviewAt: recordedReviewAt,
  });

  let prompt = "";
  const workflow = await execute(
    createTestAppWorkflowContext({
      reconciliation: reconciliation(),
      callAgent: (async (_agent: string, value: string) => {
        prompt = value;
        return {
          id: "recorded-timed-review",
          kind: "agent",
          status: "done",
          summary: timed.task.summary,
          output: timed,
        };
      }) as never,
    }),
  );
  expect(prompt).toContain("one-time reviewAt");
  expect(prompt).toContain("not a periodic sample-reading timer");
  expect(workflow.output).toMatchObject({
    state: "waiting",
    reviewAt: recordedReviewAt,
  });
  expect(workflow.output).not.toHaveProperty("conditions");
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

test("sample Conditions are rejected before a direct result or Conversation handoff is accepted", () => {
  for (const expected of [
    { field: "measuredAt", gt: 10, freshness: "fresh" },
    { field: "sampleId", gt: 10 },
    { field: "value", equals: 0, freshness: "fresh" },
  ]) {
    const plan = review();
    plan.task.conditions = [{ ...metricCondition, expected }];
    expect(() => metricReviewResult(reconciliation(), plan)).toThrow(
      "not a new sample",
    );
    expect(() =>
      metricReviewHandoff(plan, { topic: { kind: "none" } }),
    ).toThrow("not a new sample");
  }
});

test("omission cannot retain old sample waits; explicit retirement preserves the repair wait", () => {
  const rec = reconciliation();
  rec.task.conditions = [metricCondition, condition];
  const plan = review();
  plan.task.conditions = undefined;
  expect(() => metricReviewResult(rec, plan)).toThrow("Retire retained");
  plan.task.actions = [
    {
      kind: "retire-condition",
      conditionId: metricCondition.id,
      expectedConditionGeneration: 1,
      reason: "Breach policy replaces passive sample monitoring",
    },
  ];
  expect(metricReviewResult(rec, plan)).toMatchObject({
    state: "waiting",
    actions: plan.task.actions,
  });
  expect(rec.task.conditions).toHaveLength(2); // composition never mutates retained work
});

test("an older sample-driven handoff asks for one current judgment instead of replaying its wait", async () => {
  const rec = reconciliation();
  const legacy = review();
  legacy.task.conditions = [metricCondition];
  legacy.decisions[0].disposition = "observe";
  rec.task.acceptedAttempt = undefined;
  rec.input = { kind: "goal", data: { context: { metricResponse: legacy } } };
  let calls = 0;
  const result = await execute(
    createTestAppWorkflowContext({
      input: rec.input,
      reconciliation: rec,
      callAgent: (async (_agent: string, prompt: string) => {
        calls++;
        expect(prompt).toContain(
          "Retire every obsolete retained may.metric.state Condition",
        );
        expect(prompt).toContain(
          "Metric recovery alone never fulfills original work",
        );
        return {
          id: "current-judgment",
          kind: "agent",
          status: "done",
          summary: "Monitoring needs no open work",
          output: {
            task: {
              state: "converged",
              summary: "No intervention warranted",
              facts: ["Existing breach reviewed"],
            },
            decisions: [
              { ...decision, disposition: "no-change", nextAction: undefined },
            ],
          },
        };
      }) as never,
    }),
  );
  expect(calls).toBe(1);
  expect(result.output).toMatchObject({ state: "converged" });
  expect(result.output).not.toHaveProperty("conditions");
});

test("an unchanged unsupported saved plan is current context, never a replayed judgment", async () => {
  const rec = reconciliation();
  const saved = review();
  delete saved.task.conditions;
  expect(saved.task).not.toHaveProperty("conditions");
  expect(saved.task).not.toHaveProperty("continue");
  expect(saved.task).not.toHaveProperty("reviewAt");
  rec.input = { kind: "goal", data: { context: { metricResponse: saved } } };
  rec.events.items = [
    {
      observedAt: "2026-01-02",
      event: {
        type: "app.task.requested",
        source: "system",
        data: { request: { input: rec.input } },
      },
    },
  ];
  let calls = 0;
  const run = () =>
    execute(
      createTestAppWorkflowContext({
        input: rec.input,
        reconciliation: rec,
        callAgent: (async (_agent: string, prompt: string) => {
          calls++;
          expect(prompt).toContain("A repair is pending");
          expect(prompt).toContain("All requirements fulfilled");
          return {
            id: `judgment-${calls}`,
            kind: "agent",
            status: "done",
            summary: "Current owner judgment",
            output:
              calls === 1
                ? {
                    task: {
                      state: "waiting",
                      continue: true,
                      summary: "Inspect another bounded evidence slice",
                      facts: ["owner-call:1"],
                    },
                    decisions: [],
                  }
                : {
                    task: {
                      state: "converged",
                      summary: "Current evidence does not warrant intervention",
                      facts: ["owner-call:2", "evidence:current-review"],
                    },
                    decisions: [
                      {
                        ...decision,
                        disposition: "no-change",
                        reason: "Current evidence was inspected",
                        nextAction: undefined,
                      },
                    ],
                  },
          };
        }) as never,
      }),
    );
  expect((await run()).output).toMatchObject({
    state: "waiting",
    continue: true,
    summary: "Inspect another bounded evidence slice",
  });
  expect((await run()).output).toMatchObject({
    state: "converged",
    summary: "Current evidence does not warrant intervention",
  });
  expect(calls).toBe(2);
});

test("initial eventless handoff still reaches the owner and preserves a genuine wait", async () => {
  const rec = reconciliation();
  rec.task.acceptedAttempt = undefined;
  rec.input = { kind: "goal", data: { context: { metricResponse: review() } } };
  let calls = 0;
  const result = await execute(
    createTestAppWorkflowContext({
      input: rec.input,
      reconciliation: rec,
      callAgent: (async () => {
        calls++;
        return {
          id: "initial-judgment",
          kind: "agent",
          status: "done",
          summary: "Keep repair wait",
          output: review(),
        };
      }) as never,
    }),
  );
  expect(calls).toBe(1);
  expect(result.output).toMatchObject({
    state: "waiting",
    conditions: [{ id: "repair-result" }],
  });
});

test("owner failure blocks and invalid output retains an incomplete result", async () => {
  for (const response of [
    {
      id: "failed-owner",
      kind: "agent",
      status: "error",
      summary: "Owner unavailable",
      facts: ["attempt:failed-owner"],
    },
    {
      id: "invalid-owner",
      kind: "agent",
      status: "done",
      summary: "Invalid owner output",
      output: { task: { state: "converged", summary: "Missing decisions" } },
    },
  ]) {
    const result = await execute(
      createTestAppWorkflowContext({
        reconciliation: reconciliation(),
        callAgent: (async () => response) as never,
      }),
    );
    if (response.status === "error") {
      expect(result.status).toBe("blocked");
      expect(result.summary).toBe("Owner unavailable");
    } else {
      expect(result.output).toMatchObject({ state: "incomplete" });
    }
  }
});
