import { expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  inspectMetricResponse,
  metricDecisionFact,
  respondToMetric,
} from "./metric-response.js";
import type { MetricEvidence } from "../../../../alex.app/agents/evaluator/workflows/lib/metric-evidence.js";

const link = { appId: "platform", taskId: "repair/admission" };
const decision = {
  disposition: "investigate" as const,
  reason: "The closed-task check rejects retained inputs",
  evidence: ["input:retained-example"],
  linkedTask: link,
  nextAction: "Verify the admission fix",
  nextReviewAt: Date.now() + 86_400_000,
};
function evidence(): MetricEvidence {
  return {
    available: true,
    metricId: "admission.failures",
    end: Date.now(),
    windowMs: 1000,
    metric: { id: "admission.failures", owner: "operator", status: "active" },
    responsibility: {
      appId: "platform",
      status: "resolved",
      declaredOwner: "operator",
      project: null,
    },
    alerts: [{ alertId: 42, createdAt: 1, resolvedAt: null }],
    dispositions: [
      {
        appId: "platform",
        taskId: "owner-review",
        attemptId: "accepted-review",
        timestamp: 2,
        decision: {
          version: 1,
          metricId: "admission.failures",
          alertId: 42,
          ...decision,
        },
      },
    ],
    freshness: "fresh",
    latest: { value: 3 },
  };
}

test("a direct owner's accepted decision is discovered by exact breach and its investigation is read", async () => {
  const reads: string[] = [];
  const handling = await inspectMetricResponse(
    evidence(),
    42,
    async (appId, taskId) => {
      reads.push(`${appId}/${taskId}`);
      return {
        appId,
        taskId,
        outcome: "Repair input admission",
        status: "waiting",
      };
    },
  );
  expect(reads).toEqual(["platform/repair/admission"]);
  expect(handling.prior).toMatchObject({
    attemptId: "accepted-review",
    decision: { linkedTask: link },
  });
  expect(handling.followThrough).toMatchObject({
    reviewAt: null,
    conditions: [],
  });
  expect(handling.prior.decision.nextReviewAt).toBe(decision.nextReviewAt);
  expect(handling.linkedTask).toMatchObject({
    outcome: "Repair input admission",
  });
});

test("recovery and Task closure remain evidence, while a new episode can discover related work", async () => {
  const current = evidence();
  current.alerts = [
    { alertId: 42, resolvedAt: 10 },
    { alertId: 43, resolvedAt: null },
  ];
  current.latest = { value: 0 };
  const closed = await inspectMetricResponse(current, 42, async () => ({
    ...link,
    terminal: true,
  }));
  expect(closed.prior.decision.disposition).toBe("investigate");
  expect(closed.linkedTask).toMatchObject({ terminal: true });
  const next = await inspectMetricResponse(current, 43, async () => {
    throw new Error("unrelated link must not be assumed");
  });
  expect(next.prior).toBeNull();
  expect(next.related[0].decision.linkedTask).toEqual(link);
  expect(next.key).not.toBe(closed.key);
});

test("unavailable linked work leaves handling incomplete and emits no replacement or accepted judgment", async () => {
  const emitted: unknown[] = [];
  const ctx = createTestAppWorkflowContext({
    input: { metricId: "admission.failures", alertId: 42 },
    emit: async (event) => {
      emitted.push(event);
    },
  });
  const result = await respondToMetric(
    ctx,
    async () => evidence(),
    async () => {
      throw new Error("owner unavailable");
    },
  );
  expect(result.output).toMatchObject({
    state: "incomplete",
    result: { disposition: "evidence-unavailable" },
  });
  expect(emitted).toEqual([]);
});

test("fact-only unresolved decisions are rejected with the complete follow-through path", async () => {
  const ctx = createTestAppWorkflowContext({
    input: { metricId: "admission.failures", alertId: 42, decision },
  });
  const result = await respondToMetric(
    ctx,
    async () => evidence(),
    async () => ({ ...link, status: "waiting" }),
  );
  const output = result.output as any;
  expect(output.state).toBe("incomplete");
  expect(output.summary).toContain("complete waiting Task result");
  expect(
    output.facts.some((fact: string) => fact.startsWith("metric-disposition:")),
  ).toBe(false);
  expect(() =>
    metricDecisionFact("admission.failures", 42, {
      ...decision,
      nextReviewAt: 1,
    }),
  ).toThrow("future review boundary");
  expect(() =>
    metricDecisionFact("admission.failures", 42, {
      ...decision,
      disposition: "recovered",
      evidence: [],
    }),
  ).toThrow("evidence references");
});

test("large evidence and a supported decision stay within the accepted result bound without clipping the decision", async () => {
  const largeDecision = {
    ...decision,
    disposition: "recovered" as const,
    reason: "Repeated failures: " + '"'.repeat(1300),
  };
  const ctx = createTestAppWorkflowContext({
    input: {
      metricId: "admission.failures",
      alertId: 42,
      decision: largeDecision,
    },
  });
  const result = await respondToMetric(
    ctx,
    async () => evidence(),
    async () => ({ ...link, outcome: "x".repeat(8000) }),
  );
  const output = result.output as any;
  expect(output.result.complete).toBe(false);
  expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThan(16_000);
  expect(
    JSON.parse(output.facts[0].slice("metric-disposition:".length)).reason,
  ).toBe(largeDecision.reason);
});

test("unrelated App claims and truncated history do not establish that this breach is handled", async () => {
  const current = evidence();
  (current.dispositions as any[])[0].appId = "unrelated";
  current.dispositionsTruncated = true;
  const handling = await inspectMetricResponse(current, 42);
  expect(handling.prior).toBeNull();
  expect(handling.historyTruncated).toBe(true);
  await expect(inspectMetricResponse(current, 999)).rejects.toThrow(
    "exact metric breach is unavailable",
  );
});
