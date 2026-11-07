import { expect, test } from "bun:test";
import { checkMetricDecisionReuse } from "./metric-decision-reuse.js";
import { bindMetricReuseScope } from "../../../../../may.app/metric-decision-reuse.js";
import type { MetricEvidence } from "./metric-evidence.js";

const now = 10_000;
function fixture() {
  const basis: MetricEvidence = {
    available: true,
    metricId: "fixture",
    end: 1000,
    windowMs: 100,
    metric: { id: "fixture", status: "active" },
    responsibility: {
      appId: "sample",
      status: "resolved",
      declaredOwner: "sample",
      project: null,
    },
    freshness: "fresh",
    latest: { value: 100, measuredBy: "fixture-reader" },
  };
  const scope = bindMetricReuseScope(
    {
      concern: "Fixture bounded value",
      applicability: [{ field: "latest.value", lte: 120 }],
      reconsiderWhen: [],
    },
    basis,
  );
  const row = {
    appId: "sample",
    taskId: "decision",
    attemptId: "accepted-1",
    timestamp: 2000,
    decision: {
      version: 1,
      metricId: "fixture",
      alertId: 42,
      disposition: "no-change",
      reason: "Fixture scope still covers this concern",
      evidence: ["sample:1"],
      reuseScope: scope,
    },
  };
  const current = { ...basis, end: now, dispositions: [row] };
  const task = {
    appId: "sample",
    taskId: "decision",
    generation: 1,
    resourceVersion: 2,
    status: "idle",
    currentObligations: {
      available: true,
      inputWaits: { items: [], truncated: false },
    },
    pendingEvents: { items: [], truncated: false },
    conditions: [],
  };
  return { basis, current, task, row };
}

test("fresh latest accepted decision can cover a new episode without rereading unrelated Task history", async () => {
  const { basis, current, task } = fixture();
  const reads: unknown[] = [];
  const result = await checkMetricDecisionReuse(
    { ...basis, end: 5000, alerts: [{ alertId: 43 }] },
    async (...args) => {
      reads.push(args);
      return current;
    },
    async () => task,
    now,
  );
  expect(reads).toEqual([["fixture", now]]);
  expect(result).toMatchObject({
    reusable: true,
    currentEnd: now,
    decision: { attemptId: "accepted-1", alertId: 42 },
    tasks: [{ appId: "sample", taskId: "decision", resourceVersion: 2 }],
  });
});

test.each(["idle", "closed"])("explicit reusable scope survives a quiet %s owner disposition", async (status) => {
  const { basis, current, task } = fixture();
  expect((await checkMetricDecisionReuse(basis, async () => current,
    async () => ({ ...task, status }), now)).reusable).toBe(true);
  expect((await checkMetricDecisionReuse(basis, async () => current,
    async () => ({ ...task, status: "cancelled" }), now)).reusable).toBe(false);
});

test("latest no-scope decision supersedes old reuse across episodes; ambiguous acceptance never reuses", async () => {
  for (const mutation of [
    (e: any) => {
      e.dispositions.unshift({
        ...e.dispositions[0],
        timestamp: 3000,
        decision: {
          ...e.dispositions[0].decision,
          alertId: 43,
          reuseScope: undefined,
        },
      });
    },
    (e: any) => {
      e.dispositions.push(structuredClone(e.dispositions[0]));
    },
    (e: any) => {
      delete e.dispositions[0].attemptId;
    },
    (e: any) => {
      e.dispositions[0].timestamp = "2000";
    },
    (e: any) => {
      e.dispositions[0].appId = "unrelated";
    },
    (e: any) => {
      e.dispositions = [];
      e.relatedDispositions = [fixture().row];
    },
    (e: any) => {
      e.dispositions[0].decision.reuseScope.basis.end = 3000;
    },
  ]) {
    const { basis, current } = fixture();
    mutation(current);
    expect(
      (
        await checkMetricDecisionReuse(
          basis,
          async () => current,
          async () => {
            throw new Error("not needed");
          },
          now,
        )
      ).reusable,
    ).toBe(false);
  }
});

test("current and requested evidence both must fit; unreadable current evidence is no suppression", async () => {
  const { basis, current, task } = fixture();
  for (const [pinned, fresh] of [
    [
      { ...basis, latest: { value: 121, measuredBy: "fixture-reader" } },
      current,
    ],
    [
      basis,
      { ...current, latest: { value: 121, measuredBy: "fixture-reader" } },
    ],
    [basis, { ...current, end: 9999 }],
  ] as const)
    expect(
      (
        await checkMetricDecisionReuse(
          pinned,
          async () => fresh,
          async () => task,
          now,
        )
      ).reusable,
    ).toBe(false);
  expect(
    (
      await checkMetricDecisionReuse(
        basis,
        async () => {
          throw new Error("offline");
        },
        async () => task,
        now,
      )
    ).reusable,
  ).toBe(false);
});

test("bounded history permits older omissions but never an ambiguous latest owner decision", async () => {
  const { basis, current, task } = fixture();
  (current as any).dispositionsTruncated = true;
  expect(
    (
      await checkMetricDecisionReuse(
        basis,
        async () => current,
        async () => task,
        now,
      )
    ).reusable,
  ).toBe(false);
  current.dispositions.push({ ...current.dispositions[0], timestamp: 1500 });
  expect(
    (
      await checkMetricDecisionReuse(
        basis,
        async () => current,
        async () => task,
        now,
      )
    ).reusable,
  ).toBe(true);
});

test("current owner and linked Task obligations control reconsideration, without a timer on the decision", async () => {
  const { basis, current, task } = fixture();
  const waiting = {
    ...task,
    status: "waiting",
    conditions: [
      {
        id: "repair",
        observation: {
          state: "false",
          generation: 1,
          observedGeneration: 1,
          reviewAt: now + 1,
        },
      },
    ],
    currentObligations: { ...task.currentObligations, reviewAt: now + 1 },
  };
  expect(
    (
      await checkMetricDecisionReuse(
        basis,
        async () => current,
        async () => waiting,
        now,
      )
    ).reusable,
  ).toBe(true);
  const edits: Array<(t: any) => void> = [
    (t) => {
      t.status = "running";
    },
    (t) => {
      t.currentObligations.reviewAt = now;
    },
    (t) => {
      t.currentObligations.inputWaits.items = [{ reviewAt: now }];
    },
    (t) => {
      t.currentObligations.inputWaits.items = [{ pending: true }];
    },
    (t) => {
      t.currentObligations.inputWaits.truncated = true;
    },
    (t) => {
      delete t.currentObligations;
    },
    (t) => {
      t.pendingEvents.items = [{ type: "repair.finished" }];
    },
    (t) => {
      t.pendingEvents.truncated = true;
    },
    (t) => {
      delete t.conditions;
    },
    (t) => {
      t.conditions[0].observation.state = "true";
    },
    (t) => {
      t.conditions[0].observation.state = "unknown";
    },
    (t) => {
      t.conditions[0].observation.generation = 2;
    },
    (t) => {
      t.conditions[0].observation.reviewAt = now;
    },
    (t) => {
      t.taskId = "wrong";
    },
  ];
  for (const edit of edits) {
    const changed = structuredClone(waiting);
    edit(changed);
    expect(
      (
        await checkMetricDecisionReuse(
          basis,
          async () => current,
          async () => changed,
          now,
        )
      ).reusable,
    ).toBe(false);
  }
  (current.dispositions[0].decision as any).linkedTask = {
    appId: "may",
    taskId: "repair",
  };
  const reads: string[] = [];
  const result = await checkMetricDecisionReuse(
    basis,
    async () => current,
    async (appId, taskId) => {
      reads.push(`${appId}/${taskId}`);
      if (appId === "may") throw new Error("missing linked Task");
      return task;
    },
    now,
  );
  expect(reads).toEqual(["sample/decision", "may/repair"]);
  expect(result.reusable).toBe(false);
});
