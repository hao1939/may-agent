import { afterEach, expect, test } from "bun:test";
import type { Condition } from "@may-agent/sdk";
import {
  fixture,
  executeReview,
  handoffDecision,
  until,
} from "./metric-follow-through.fixture.js";
import { type MetricReview } from "../metric-follow-through.js";
import { inspectMetricResponse } from "../agents/may/workflows/metric-response.js";

const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
afterEach(async () => {
  for (const f of fixtures.splice(0)) await f.close();
});
async function setup(judge: (prompt: string) => Promise<MetricReview>) {
  const f = await fixture((attempt) => executeReview(attempt, judge));
  fixtures.push(f);
  return f;
}
function repairCondition(reviewAfterMs?: number): Condition {
  return {
    id: "repair-result",
    type: "repair.finished",
    subject: "request:verification",
    expected: { done: true },
    owner: "app:may",
    ...(reviewAfterMs === undefined ? {} : { reviewAfterMs }),
  };
}
function investigate(
  subject: { metricId: string; alertId: number },
  condition: Condition,
): MetricReview {
  return {
    task: {
      state: "waiting",
      summary: "Review recovery evidence",
      facts: [],
      conditions: [
        {
          ...condition,
          owner: condition.owner!,
        },
      ],
    },
    decisions: [
      {
        ...subject,
        disposition: "investigate",
        reason: "A repair result is owed",
        evidence: [`metric:${subject.metricId}`],
        nextAction: "Review the repair result",
      },
    ],
  };
}

test("Conversation saves one breach decision; samples stay quiet and the repair result returns to its Request", async () => {
  let calls = 0;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await setup(async (prompt) => {
    calls++;
    expect(prompt).toContain("repair.finished");
    await hold;
    return {
      task: {
        state: "converged",
        summary: "Fresh evidence reviewed",
        facts: ["Inspected recovery"],
      },
      decisions: [
        {
          ...f.subject,
          disposition: "recovered",
          reason: "Fresh sample and original requirement verified",
          evidence: ["sample:fresh"],
        },
      ],
    };
  });
  try {
    const plan = investigate(f.subject, repairCondition());
    await f.handoff(handoffDecision(plan));
    await until(
      () => f.get("goal/poc-message")?.status === "waiting",
      "breach decision retained",
    );
    for (const value of [3, 4, 4, 2, 0, 0]) {
      f.record(value);
      await f.poll();
    }
    expect(calls).toBe(0);
    expect(f.attempts).toHaveLength(1);
    f.publishRepair();
    await until(() => calls === 1, "repair result wakes owner");
    expect(f.decisions()).toHaveLength(1);
    expect(f.decisions()[0].decision).toMatchObject({
      disposition: "investigate",
      linkedTask: { appId: "may", taskId: "goal/poc-message" },
      followThrough: "task",
    });
    expect(f.decisions()[0].decision.nextReviewAt).toBeUndefined();
    expect(f.get("goal/poc-message")!.conditions).toHaveLength(1);
    release();
    await until(
      () => f.conversationReturns === 1,
      "automatic return to Conversation",
    );
    expect(f.request()).toMatchObject({
      status: "open",
      taskRefs: [{ appId: "may", taskId: "goal/poc-message" }],
    });
    expect(f.attempts.map((a) => a.taskId)).toEqual([
      "goal/poc-message",
      "goal/poc-message",
    ]);
    expect(f.decisions()).toHaveLength(2);
  } finally {
    release();
  }
});

test("fresh and stale samples stay quiet across restart; the retained repair result wakes its owner", async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return {
      task: {
        state: "converged",
        summary: "Reviewed",
        facts: ["fresh evidence"],
      },
      decisions: [],
    };
  });
  await f.attach("investigation", {
    context: { metricResponse: investigate(f.subject, repairCondition()) },
  });
  await until(
    () => f.get("investigation")?.status === "waiting",
    "initial accepted wait",
  );
  const condition = structuredClone(f.get("investigation")!.conditions[0]);
  await f.poll();
  f.record(0, Date.now() - 86_400_000);
  await f.poll();
  expect(calls).toBe(0);
  await f.restart();
  expect(calls).toBe(0);
  expect(f.get("investigation")!.conditions[0]).toEqual(condition);
  expect(f.decisions()).toHaveLength(1);
  f.record(0);
  await f.poll();
  expect(calls).toBe(0);
  f.publishRepair();
  await until(() => calls === 1, "repair result after restart");
});

test("repair publication recovery retains the independent approval and ignores new samples", async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return {
      task: {
        state: "waiting",
        summary: "Approval remains owed",
        facts: ["Metric recovered; implementation approval remains"],
      },
      decisions: [
        {
          ...f.subject,
          disposition: "investigate",
          reason: "Metric recovered; applying the repair still needs approval",
          evidence: ["sample:fresh"],
          nextAction: "Await the existing approval before applying the repair",
        },
      ],
    };
  });
  const plan = investigate(f.subject, repairCondition());
  if (plan.task.state !== "waiting") throw new Error("waiting plan");
  plan.task.conditions!.push({
    id: "approval",
    type: "approval.granted",
    subject: "decision:implementation",
    expected: { approved: true },
    owner: "human",
    reviewAfterMs: 3_600_000,
  });
  await f.attach("investigation", { context: { metricResponse: plan } });
  await until(
    () => f.get("investigation")?.status === "waiting",
    "accepted wait",
  );
  f.publicationFails = true;
  expect(() => f.publishRepair()).toThrow("Fixture publication unavailable");
  f.record(0);
  await f.poll();
  expect(calls).toBe(0);
  f.publicationFails = false;
  f.publishRepair();
  await until(
    () => calls === 1 && f.get("investigation")?.status === "waiting",
    "retried publication reviewed",
  );
  expect(
    f.get("investigation")!.conditions.find((c) => c.id === "approval")!
      .observation!.state,
  ).toBe("unknown");
  expect(f.decisions()).toHaveLength(2);
  expect(f.decisions()[1].decision.disposition).toBe("investigate");
  expect(f.attempts).toHaveLength(2);
});

test("Host accepts an investigation's ordinary waits and rejects settling without one", async () => {
  const f = await setup(async () => {
    throw new Error("Handed-off decisions need no additional model call");
  });
  const approval = {
    id: "approval",
    type: "approval.granted",
    subject: "decision:implementation",
    expected: { approved: true },
    owner: "human",
    reviewAfterMs: 3_600_000,
  };
  const plan: MetricReview = {
    task: {
      state: "waiting",
      summary: "Await the repair decision",
      facts: [],
      conditions: [approval],
    },
    decisions: [
      {
        ...f.subject,
        disposition: "investigate",
        reason: "Repair is ready for review",
        evidence: ["proposal:repair"],
        nextAction: "Await approval",
      },
    ],
  };
  await f.attach("owner", { context: { metricResponse: plan } });
  await until(
    () => f.get("owner")?.status === "waiting",
    "ordinary approval accepted",
  );
  expect(f.decisions()).toHaveLength(1);
  expect(f.get("owner")!.conditions[0].observation!.state).toBe("unknown");

  const external = structuredClone(plan);
  if (external.task.state !== "waiting") throw new Error("waiting plan");
  external.task.conditions = [
    {
      ...approval,
      id: "external-ready",
      owner: "app:source",
      type: "source.ready",
      subject: "source:repair",
    },
  ];
  await f.attach("external", { context: { metricResponse: external } });
  await until(
    () => f.get("external")?.status === "waiting",
    "ordinary external wait accepted",
  );
  expect(f.decisions()).toHaveLength(2);

  const missing = structuredClone(plan);
  if (missing.task.state !== "waiting") throw new Error("waiting plan");
  delete missing.task.conditions;
  await f.attach("missing-wait", { context: { metricResponse: missing } });
  await until(
    () =>
      !!f.db
        .prepare(
          "SELECT 1 FROM app_task_attempts WHERE task_id = ? AND state = 'failed' AND json_extract(attempt_json, '$.summary') LIKE '%requires at least one exact Condition%'",
        )
        .get("missing-wait"),
    "Host rejects a wait without a return route",
  );
  expect(f.decisions()).toHaveLength(2);

  missing.task.facts = [
    "Proposed retiring the last Condition without a replacement",
  ];
  missing.task.actions = [
    {
      kind: "retire-condition",
      conditionId: approval.id,
      expectedConditionGeneration: 1,
      reason: "Superseded",
    },
  ];
  await f.handoff(handoffDecision(missing, { appId: "may", taskId: "owner" }));
  await until(
    () =>
      !!f.db
        .prepare(
          "SELECT 1 FROM app_task_attempts WHERE task_id = ? AND state = 'failed' AND json_extract(attempt_json, '$.summary') LIKE '%requires at least one exact Condition%'",
        )
        .get("owner"),
    "Host rejects removing the last return route",
  );
  expect(f.get("owner")!.conditions[0].observation!.state).toBe("unknown");
  expect(f.decisions()).toHaveLength(2);
});

test("a later episode joins the selected investigation and saves its new decision once", async () => {
  const f = await setup(async () => {
    throw new Error("No additional agent turn for a handed-off decision");
  });
  const condition = repairCondition();
  await f.attach("shared-investigation", {
    context: { metricResponse: investigate(f.subject, condition) },
  });
  await until(
    () => f.get("shared-investigation")?.status === "waiting",
    "first episode saved",
  );
  f.record(0);
  const nextAlert = f.record(3)!.alertId!;
  expect(nextAlert).not.toBe(f.subject.alertId);
  await f.handoff(
    handoffDecision(
      investigate({ ...f.subject, alertId: nextAlert }, condition),
      {
        appId: "may",
        taskId: "shared-investigation",
      },
    ),
  );
  await until(() => f.decisions().length === 2, "next episode saved");
  expect(f.get("goal/poc-message")).toBeNull();
  expect(f.get("shared-investigation")!.conditions).toHaveLength(1);
  expect(
    f
      .decisions()
      .map((d) => d.decision.alertId)
      .sort(),
  ).toEqual([f.subject.alertId, nextAlert].sort());
});

test("missing selected work and invalid Conditions never leave accepted metric dispositions", async () => {
  const f = await setup(async () => {
    throw new Error("invalid work must not ask another agent");
  });
  const plan = investigate(f.subject, repairCondition());
  await f.handoff(handoffDecision(plan, { appId: "may", taskId: "missing" }));
  await until(
    () =>
      !!f.db
        .prepare(
          "SELECT 1 FROM app_task_attempts WHERE json_extract(attempt_json,'$.state')='failed'",
        )
        .get(),
    "handoff rejected",
  );
  expect(f.request()).toBeNull();
  expect(f.decisions()).toHaveLength(0);
  if (plan.task.state !== "waiting") throw new Error("waiting plan");
  plan.task.conditions![0].reviewAfterMs = 1;
  await expect(
    f.attach("invalid", { context: { metricResponse: plan } }),
  ).rejects.toThrow("reviewAfterMs must be an integer of at least 60000");
  expect(f.decisions()).toHaveLength(0);
});

test("an explicit Task review runs once and preserves the repair wait", async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return {
      task: {
        state: "waiting",
        summary: "Repair still pending; keep its existing wait",
        facts: ["Rechecked repair status"],
      },
      decisions: [
        {
          ...f.subject,
          disposition: "investigate",
          reason: "Repair remains owed",
          evidence: ["repair:pending"],
          nextAction: "Review the outstanding repair",
        },
      ],
    };
  });
  const plan = investigate(f.subject, repairCondition());
  if (plan.task.state !== "waiting") throw new Error("waiting plan");
  plan.task.reviewAt = Date.now() + 500;
  await f.attach("investigation", { context: { metricResponse: plan } });
  await until(() => f.get("investigation")?.status === "waiting", "first wait");
  const condition = structuredClone(f.get("investigation")!.conditions[0]);
  await until(
    () => calls === 1 && f.get("investigation")?.status === "waiting",
    "explicit Task review",
  );
  const handling = await inspectMetricResponse(
    f.evidence(),
    f.subject.alertId,
    async (appId, taskId) => ({ ...f.get(taskId)!, appId }),
  );
  expect(handling.followThrough!.reviewAt).toBeNull();
  expect(handling.followThrough!.conditions[0].reviewAt).toBeNull();
  expect(f.get("investigation")!.conditions[0]).toEqual(condition);
  expect(f.get("investigation")!.conditions).toHaveLength(1);
  expect(f.attempts).toHaveLength(2);
});

test("an investigation commissions ordinary dependent work and its result wakes the same owner", async () => {
  let childCalls = 0,
    ownerCalls = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await setup(async (prompt) => {
    const context = JSON.parse(prompt.split("\n").at(-1)!);
    if (context.outcome === "Investigate retained admissions") {
      childCalls++;
      await held;
      return {
        task: {
          state: "converged",
          summary: "Root cause verified",
          facts: ["code:admission-boundary"],
        },
        decisions: [],
      };
    }
    ownerCalls++;
    expect(context.events.items.length).toBeGreaterThan(0);
    return {
      task: {
        state: "waiting",
        summary: "Judge the repair option next",
        facts: ["Dependency result inspected"],
        reviewAt: Date.now() + 3_600_000,
      },
      decisions: [
        {
          ...f.subject,
          disposition: "investigate",
          reason: "Verified root cause needs a scoped option",
          evidence: ["dependency:diagnosis"],
          nextAction: "Review the candidate",
        },
      ],
    };
  });
  try {
    // Retained reviews may still contain the SDK's supported dependencies spelling.
    const plan = {
      task: {
        state: "waiting",
        summary: "Commission diagnosis",
        facts: [],
        dependencies: [
          {
            id: "diagnosis",
            appId: "may",
            input: {
              kind: "goal",
              data: {
                outcome: "Investigate retained admissions",
                acceptance: ["Return root cause with evidence"],
              },
            },
          },
        ],
      },
      decisions: [
        {
          ...f.subject,
          disposition: "investigate",
          reason: "Repeated admissions need diagnosis",
          evidence: ["metric:admission"],
          nextAction: "Review diagnosis",
        },
      ],
    };
    await f.attach("owner", { context: { metricResponse: plan } });
    await until(
      () => childCalls === 1 && f.get("owner")?.status === "waiting",
      "dependent work admitted",
    );
    expect(
      f
        .get("owner")!
        .conditions.some((c) => c.type === "app.dependency.updated"),
    ).toBe(true);
    expect(f.decisions()[0].decision.linkedTask).toEqual({
      appId: "may",
      taskId: "owner",
    });
    release();
    await until(
      () => ownerCalls === 1 && f.get("owner")?.status === "waiting",
      "dependency result reviewed",
    );
    expect(childCalls).toBe(1);
    expect(f.decisions()).toHaveLength(2);
  } finally {
    release();
  }
});

test("owner closure stops follow-through; late repair results stay history", async () => {
  const f = await setup(async () => {
    throw new Error("Closed work must not wake");
  });
  await f.attach("investigation", {
    context: { metricResponse: investigate(f.subject, repairCondition()) },
  });
  await until(
    () => f.get("investigation")?.status === "waiting",
    "initial repair wait",
  );
  const current = f.get("investigation")!;
  f.tasks.cancel({
    appId: "may",
    taskId: current.id,
    expectedGeneration: current.generation,
    expectedResourceVersion: current.resourceVersion!,
    reason: "Owner withdrew follow-through",
    decision: "human",
  });
  f.record(0);
  f.publishRepair();
  await f.poll();
  expect(f.get("investigation")!.closed).toBe(true);
  expect(f.attempts).toHaveLength(1);
  expect(f.reads).toBe(0);
  expect(f.decisions()[0].decision.disposition).toBe("investigate");
});

test("one owner decision retires a retained sample wait, preserves approval, and stops sample wakeups across restart", async () => {
  let calls = 0;
  let seedLegacyWait = true;
  let sample: Condition;
  const approval: Condition = {
    id: "approval",
    type: "approval.granted",
    subject: "decision:implementation",
    expected: { approved: true },
    owner: "human",
    reviewAfterMs: 3_600_000,
  };
  const f = await fixture(async (attempt) => {
    if (seedLegacyWait) {
      seedLegacyWait = false;
      // A real accepted result from the old policy, before adopting the new workflow.
      return {
        state: "waiting",
        summary: "Legacy sample monitor with independent approval",
        facts: [],
        conditions: [sample, approval],
      };
    }
    return executeReview(attempt, async (prompt) => {
      calls++;
      expect(prompt).toContain(
        "Retire every obsolete retained may.metric.state Condition",
      );
      if (calls === 1)
        return {
          task: {
            state: "waiting",
            summary: "Approval is the remaining work",
            facts: ["Retired passive metric monitoring"],
            actions: [
              {
                kind: "retire-condition",
                conditionId: sample.id,
                expectedConditionGeneration: 1,
                reason: "New samples are evidence, not investigation triggers",
              },
            ],
          },
          decisions: [
            {
              ...f.subject,
              disposition: "investigate",
              reason: "Repair approval remains owed",
              evidence: ["proposal:repair"],
              nextAction: "Await approval",
            },
          ],
        };
      return {
        task: {
          state: "converged",
          summary: "Approval judged",
          facts: ["Independent decision received"],
        },
        decisions: [],
      };
    });
  });
  fixtures.push(f);
  sample = await f.condition(3_600_000, {
    field: "measuredAt",
    gt: Date.now(),
    freshness: "fresh",
  });
  await f.attach("legacy-monitor");
  await until(
    () => f.get("legacy-monitor")?.status === "waiting",
    "old wait saved",
  );
  f.record(3);
  await f.poll();
  await until(
    () => calls === 1 && f.get("legacy-monitor")?.status === "waiting",
    "owner replaces old wait",
  );
  expect(f.get("legacy-monitor")!.conditions.map((c) => c.id)).toEqual([
    "approval",
  ]);
  for (const value of [4, 5, 0, 0]) {
    f.record(value);
    await f.poll();
  }
  await f.restart();
  f.record(0);
  await f.poll();
  expect(calls).toBe(1);
  expect(f.attempts).toHaveLength(2);
  f.publishApproval();
  await until(
    () => calls === 2 && f.get("legacy-monitor")?.status === "done",
    "original approval still returns",
  );
});

test("a recovery status change updates the exact existing investigation; ordinary samples and other episodes do not", async () => {
  let calls = 0;
  const f = await setup(async (prompt) => {
    calls++;
    expect(prompt).toContain("metric.recovered");
    return {
      task: {
        state: "waiting",
        summary: "Metric recovered; approval remains",
        facts: ["Reviewed status change"],
      },
      decisions: [
        {
          ...f.subject,
          disposition: "no-change",
          reason: "Recovery does not authorize applying the candidate",
          evidence: ["event:metric.recovered"],
        },
      ],
    };
  });
  const plan = investigate(f.subject, {
    id: "episode-recovered",
    type: "metric.recovered",
    subject: `metric:${f.subject.metricId}`,
    expected: { alertId: f.subject.alertId },
    owner: "app:may",
    reviewAfterMs: 3_600_000,
  });
  plan.task.conditions!.push({
    id: "approval",
    type: "approval.granted",
    subject: "decision:implementation",
    expected: { approved: true },
    owner: "human",
    reviewAfterMs: 3_600_000,
  });
  await f.attach("status-owner", { context: { metricResponse: plan } });
  await until(
    () => f.get("status-owner")?.status === "waiting",
    "status wait saved",
  );
  for (const value of [4, 5, 3, 0]) {
    f.record(value);
    await f.poll();
  }
  f.publishRecovery(f.subject.alertId + 1);
  await f.poll();
  expect(calls).toBe(0);
  f.publishRecovery();
  await until(
    () => calls === 1 && f.get("status-owner")?.status === "waiting",
    "exact status change reviewed",
  );
  expect(
    f.get("status-owner")!.conditions.find((c) => c.id === "approval")!
      .observation!.state,
  ).toBe("unknown");
  f.record(0);
  await f.poll();
  expect(calls).toBe(1);
});
