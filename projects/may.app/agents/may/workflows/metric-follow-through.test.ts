import { expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./metric-follow-through.js";

test("metric-follow-through blocks when invoked outside a Task reconciliation context", async () => {
  const ctx = createTestAppWorkflowContext({
    workflow: "metric-follow-through",
    input: {},
  });
  const result = await execute(ctx);
  expect(result).toMatchObject({
    status: "blocked",
    summary: "Metric follow-through requires an ordinary owning Task",
  });
});

test("metric-follow-through composes May's metric review decision and binds reuseScope observations", async () => {
  const observation = {
    metricId: "may.failed-task-attempts-24h",
    alertId: 17,
    measuredAt: 1794830000000,
    value: 3,
    sampleSize: 10,
  } as any;
  const ctx = createTestAppWorkflowContext({
    workflow: "metric-follow-through",
    input: {},
    reconciliation: {
      appId: "may",
      taskId: "metric/may.failed-task-attempts-24h",
      agent: "may",
      task: {
        id: "metric/may.failed-task-attempts-24h",
        generation: 1,
        outcome: "Review metric breach",
        acceptance: ["Return an evidence-backed disposition."],
        conditions: [],
      },
      waits: [],
    } as any,
    call: async () => ({
      id: "call-may-1",
      status: "done" as const,
      summary: "Settled metric breach as no-change with bounded reuse scope",
      output: {
        task: {
          state: "converged",
          summary: "Settled metric breach as no-change",
          facts: ["reviewed:may.failed-task-attempts-24h"],
          requests: [],
        },
        decisions: [
          {
            metricId: "may.failed-task-attempts-24h",
            alertId: 17,
            disposition: "no-change",
            reason: "Transient single-task retry burst already recovered",
            evidence: ["alert:17", "sample:1794830000000"],
          },
        ],
      },
    }),
  });

  const result = await execute(ctx, async () => observation);
  expect(result.status).toBe("done");
  expect(result.summary).toBe("Settled metric breach as no-change");
  expect(result.output).toMatchObject({
    state: "converged",
    summary: "Settled metric breach as no-change",
  });
});

test("metric-follow-through returns an incomplete Task result when proposed review fails contract validation", async () => {
  const ctx = createTestAppWorkflowContext({
    workflow: "metric-follow-through",
    input: {},
    reconciliation: {
      appId: "may",
      taskId: "metric/may.failed-task-attempts-24h",
      agent: "may",
      task: {
        id: "metric/may.failed-task-attempts-24h",
        generation: 1,
        outcome: "Review metric breach",
        acceptance: ["Return an evidence-backed disposition."],
        conditions: [],
      },
      waits: [],
    } as any,
    call: async () => ({
      id: "call-may-invalid",
      status: "done" as const,
      summary: "Malformed review",
      output: {
        task: {
          state: "converged",
          summary: "Invalidunresolved",
          facts: [],
        },
        decisions: [
          {
            metricId: "may.failed-task-attempts-24h",
            alertId: 17,
            disposition: "investigate",
            reason: "Missing waiting state and nextAction",
            evidence: ["alert:17"],
          },
        ],
      },
    }),
  });

  const result = await execute(ctx);
  expect(result.status).toBe("done");
  expect(result.output).toMatchObject({
    state: "incomplete",
    summary: expect.stringContaining("An unresolved metric requires a waiting result and nextAction"),
  });
});
