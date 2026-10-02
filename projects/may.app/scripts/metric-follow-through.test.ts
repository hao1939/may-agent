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
function observe(
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
          reviewAfterMs: condition.reviewAfterMs!,
        },
      ],
    },
    decisions: [
      {
        ...subject,
        disposition: "observe",
        reason: "Existing recovery needs verification",
        evidence: [`metric:${subject.metricId}`],
        nextAction: "Review fresh evidence",
      },
    ],
  };
}

test("Conversation saves the complete decision without another agent turn, then fresh evidence wakes judgment and returns to its Request", async () => {
  let calls = 0;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await setup(async (prompt) => {
    calls++;
    expect(prompt).toContain("may.metric.state");
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
    const plan = observe(f.subject, await f.condition());
    f.record(0); // Already recovered before saving the Condition.
    await f.handoff(handoffDecision(plan));
    await until(() => calls === 1, "fresh state wakes owner");
    expect(f.decisions()).toHaveLength(1);
    expect(f.decisions()[0].decision).toMatchObject({
      disposition: "observe",
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

test("unmatched and stale samples stay quiet; restart retains the Condition and does not replay the decision", async () => {
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
    context: { metricResponse: observe(f.subject, await f.condition()) },
  });
  await until(
    () => f.get("investigation")?.status === "waiting",
    "initial accepted wait",
  );
  const deadline = f.get("investigation")!.conditions[0].observation!.reviewAt;
  await f.poll();
  f.record(0, Date.now() - 86_400_000);
  await f.poll();
  expect(calls).toBe(0);
  await f.restart();
  expect(calls).toBe(0);
  expect(f.get("investigation")!.conditions[0].observation!.reviewAt).toBe(
    deadline,
  );
  expect(f.decisions()).toHaveLength(1);
  f.record(0);
  await f.poll();
  await until(() => calls === 1, "fresh recovery after restart");
});

test("publication retries unchanged evidence; investigation retains an independent approval after the metric wait resolves", async () => {
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
  const plan = observe(f.subject, await f.condition());
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
  f.record(0);
  await f.poll();
  expect(calls).toBe(0);
  f.publicationFails = false;
  await f.poll();
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
  const condition = await f.condition();
  await f.attach("shared-investigation", {
    context: { metricResponse: observe(f.subject, condition) },
  });
  await until(
    () => f.get("shared-investigation")?.status === "waiting",
    "first episode saved",
  );
  f.record(0);
  const nextAlert = f.record(3)!.alertId!;
  expect(nextAlert).not.toBe(f.subject.alertId);
  await f.handoff(
    handoffDecision(observe({ ...f.subject, alertId: nextAlert }, condition), {
      appId: "may",
      taskId: "shared-investigation",
    }),
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
  const plan = observe(f.subject, await f.condition());
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

test("real review checkpoint wakes a failed observer's owner, keeps the Condition, and exposes its renewed deadline", async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return {
      task: {
        state: "waiting",
        summary: "Observer unavailable; keep its existing wait",
        facts: ["Rechecked observer failure"],
      },
      decisions: [
        {
          ...f.subject,
          disposition: "observe",
          reason: "Still needs fresh evidence",
          evidence: ["observer:failure"],
          nextAction: "Review source recovery",
        },
      ],
    };
  });
  f.readFails = true;
  await f.attach("investigation", {
    context: { metricResponse: observe(f.subject, await f.condition(60_000)) },
  });
  await until(() => f.get("investigation")?.status === "waiting", "first wait");
  const first = f.get("investigation")!.conditions[0].observation!.reviewAt!;
  await until(
    () => calls === 1 && f.get("investigation")?.status === "waiting",
    "actual checkpoint",
    70_000,
  );
  const handling = await inspectMetricResponse(
    f.evidence(),
    f.subject.alertId,
    async (appId, taskId) => ({ ...f.get(taskId)!, appId }),
  );
  expect(handling.followThrough!.conditions[0].reviewAt).toBeGreaterThan(first);
  expect(f.get("investigation")!.conditions).toHaveLength(1);
  expect(f.attempts).toHaveLength(2);
}, 80_000);

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

test("owner closure stops metric demand; late recovery stays history", async () => {
  const f = await setup(async () => {
    throw new Error("Closed work must not wake");
  });
  await f.attach("investigation", {
    context: { metricResponse: observe(f.subject, await f.condition()) },
  });
  await until(() => f.reads === 1, "initial observation");
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
  await f.poll();
  expect(f.get("investigation")!.closed).toBe(true);
  expect(f.attempts).toHaveLength(1);
  expect(f.reads).toBe(1);
  expect(f.decisions()[0].decision.disposition).toBe("observe");
});
