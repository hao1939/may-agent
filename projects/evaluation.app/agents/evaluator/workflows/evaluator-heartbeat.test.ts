import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  admitTaskReconcileResult,
  type TaskReconciliationContext,
  type WorkflowContext,
} from "@may-agent/sdk";
import { execute, normalizeAgentResult } from "./evaluator-heartbeat.js";

type Input = { scope?: string };

function reconciliation(
  overrides: Partial<TaskReconciliationContext<Input>> = {},
): TaskReconciliationContext<Input> {
  const trigger = {
    type: "metric.breach",
    data: { metricId: "evaluation.delivery-rate", value: 0.4 },
    target: { appId: "evaluation", project: "evaluation" },
  };
  return {
    appId: "evaluation",
    taskId: "runtime/owner-review",
    generation: 4,
    resourceVersion: 8,
    agent: "evaluator",
    mode: "maintain",
    outcome: "Keep evaluation.app coherent.",
    acceptance: ["Typed revision-checked actions or a justified no-op."],
    input: { scope: "evaluation.app" },
    children: {
      live: [
        {
          taskId: "pipeline-health",
          parentId: "runtime/owner-review",
          generation: 3,
          outcome: "Keep pipeline health current.",
          evidence: [],
          input: {},
          conditions: [
            {
              id: "app-request:appdep_shared",
              type: "app.dependency.completed",
              subject: "id:appdep_shared",
              expected: { field: "status", equals: "done" },
              owner: "evaluator",
            },
          ],
          hasLiveChildren: false,
          status: "waiting",
        },
        {
          taskId: "finding-delivery",
          parentId: "runtime/owner-review",
          generation: 2,
          outcome: "Deliver current findings.",
          evidence: [],
          input: {},
          conditions: [],
          hasLiveChildren: false,
          status: "pending",
        },
      ],
      completed: [],
    },
    taskSnapshot: { live: [], truncated: false },
    events: {
      items: [
        {
          eventId: 41,
          observedAt: "2026-08-21T00:00:00.000Z",
          event: trigger,
        },
      ],
      throughEventId: 41,
      truncated: false,
    },
    trigger,
    ...overrides,
  };
}

describe("evaluator heartbeat", () => {
  test("requires canonical reconciliation context", async () => {
    let called = false;
    const ctx = createTestAppWorkflowContext({
      input: { scope: "evaluation.app" },
      callAgent: async () => {
        called = true;
        throw new Error("unexpected");
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary:
        "evaluator-heartbeat requires canonical task reconciliation context",
    });
    expect(called).toBe(false);
  });

  test("passes only bounded reconciliation facts and the exact trigger", async () => {
    const tasks: string[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { scope: "evaluation.app" },
      reconciliation: reconciliation(),
      callAgent: async (_agent, task) => {
        tasks.push(task);
        return {
          id: "s_owner",
          kind: "agent",
          status: "done",
          summary: "no change",
          output: {
            state: "converged",
            summary: "Existing desired state covers the signal.",
            facts: ["metric.breach inspected"],
            actions: [],
          },
        };
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        summary: "Existing desired state covers the signal.",
        actions: [],
      },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toContain('"type": "metric.breach"');
    expect(tasks[0]).toContain('"taskId": "pipeline-health"');
    expect(tasks[0]).toContain(
      "Every Condition subject must use the canonical typed-subject form <type>:<id>",
    );
    expect(tasks[0]).toContain("session:s_123");
    expect(tasks[0]).not.toContain("SELECT ");
    expect(tasks[0]).not.toContain("task-tree.json");
  });

  test("rejects the prior untyped Condition and admits the corrected aggregate without runtime mutations", () => {
    const prior = normalizeAgentResult(
      {
        state: "waiting",
        summary: "Wait for the aftermath session.",
        facts: ["aggregate review"],
        conditions: [
          {
            id: "aftermath-finished",
            type: "session.completed",
            subject: "s_123",
            expected: { status: "completed" },
          },
        ],
      },
      reconciliation(),
    );

    expect(prior).toMatchObject({ state: "converged", actions: [] });
    expect(prior.facts).toContain(
      "owner-result-rejected:conditions[0].subject must be a typed subject",
    );

    const corrected = normalizeAgentResult(
      {
        state: "waiting",
        summary: "Wait for the aftermath session.",
        facts: ["aggregate review"],
        conditions: [
          {
            id: "aftermath-finished",
            type: "session.completed",
            subject: "session:s_123",
            expected: { status: "completed" },
          },
        ],
        actions: [
          {
            kind: "close-task",
            taskId: "runtime/session-aftermath/s_123",
            expectedGeneration: 1,
            summary: "Forbidden direct runtime mutation.",
          },
        ],
      },
      reconciliation(),
    );

    expect(corrected).toMatchObject({
      state: "waiting",
      conditions: [
        {
          id: "aftermath-finished",
          type: "session.completed",
          subject: "session:s_123",
          expected: { status: "completed" },
        },
      ],
      actions: [],
    });
    expect(corrected.facts.join("\n")).toContain(
      "cannot mutate reconciler-owned task runtime/session-aftermath/s_123",
    );
    expect(
      admitTaskReconcileResult(corrected, {
        allowNeedsAgent: false,
        defaultParentId: "runtime/owner-review",
      }),
    ).toMatchObject({ ok: true, result: { state: "waiting" } });
  });

  test("reuses a dependency Condition identity only for an unchanged specification", () => {
    const unchanged = {
      state: "waiting" as const,
      summary: "Wait for the shared dependency.",
      facts: ["dependency remains open"],
      conditions: [
        {
          id: "app-request:appdep_shared",
          type: "app.dependency.completed",
          subject: "id:appdep_shared",
          expected: { equals: "done", field: "status" },
          owner: "evaluator",
        },
      ],
    };

    const first = normalizeAgentResult(unchanged, reconciliation());
    const repeated = normalizeAgentResult(unchanged, reconciliation());

    expect(first.conditions?.[0]?.id).toBe("app-request:appdep_shared");
    expect(repeated.conditions?.[0]?.id).toBe(first.conditions?.[0]?.id);
    expect(first.facts).not.toContainEqual(
      expect.stringContaining("condition-identity-remapped:"),
    );
  });

  test("allocates a distinct stable dependency Condition identity when its specification changes", () => {
    const changed = {
      state: "waiting" as const,
      summary: "Wait for a different dependency outcome.",
      facts: ["dependency specification changed"],
      conditions: [
        {
          id: "app-request:appdep_shared",
          type: "app.dependency.completed",
          subject: "id:appdep_shared",
          expected: { field: "status", equals: "converged" },
          owner: "evaluator",
        },
      ],
    };

    const first = normalizeAgentResult(changed, reconciliation());
    const repeated = normalizeAgentResult(changed, reconciliation());
    const changedId = first.conditions?.[0]?.id;

    expect(changedId).toStartWith("app-request:appdep_shared:spec-");
    expect(changedId).not.toBe("app-request:appdep_shared");
    expect(repeated.conditions?.[0]?.id).toBe(changedId);
    expect(first.facts).toContain(
      `condition-identity-remapped:app-request:appdep_shared->${changedId}`,
    );
  });

  test("rejects malformed output as a visible no-op without self-waking the reviewed task", async () => {
    const events: Array<{
      type: string;
      localKey?: string;
      target?: { appId?: string; taskId?: string };
    }> = [];
    const ctx = createTestAppWorkflowContext({
      input: { scope: "evaluation.app" },
      reconciliation: reconciliation(),
      callAgent: async () => ({
        id: "s_owner",
        kind: "agent",
        status: "done",
        summary: "invalid",
        output: { state: "waiting", summary: "wait", facts: [] },
      }),
      emit: async (event) => {
        events.push(
          event as {
            type: string;
            localKey?: string;
            target?: { appId?: string; taskId?: string };
          },
        );
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [],
      },
    });
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.owner_review_started",
      "evaluation.owner_reviewed",
    ]);
    expect(events.every((event) => event.target?.appId === "evaluation")).toBe(
      true,
    );
    expect(events.every((event) => event.target?.taskId === undefined)).toBe(
      true,
    );
    expect(events.map((event) => event.localKey)).toEqual([
      "event-41:owner-review-started",
      "event-41:owner-reviewed",
    ]);
  });

  test("keeps valid direct-child mutations and filters stale or runtime actions", () => {
    const result = normalizeAgentResult(
      {
        state: "converged",
        summary: "Reviewed child state.",
        facts: ["bounded packet"],
        actions: [
          {
            kind: "update-task",
            taskId: "pipeline-health",
            expectedGeneration: 3,
            outcome: "Keep current pipeline evidence.",
          },
          {
            kind: "update-task",
            taskId: "finding-delivery",
            expectedGeneration: 2,
            outcome: "Invalid because pending.",
          },
          {
            kind: "close-task",
            taskId: "runtime/deep-eval-scan",
            expectedGeneration: 1,
            summary: "Invalid runtime mutation.",
          },
          {
            kind: "create-task",
            id: "new-audit",
            parentId: "runtime/owner-review",
            outcome: "Audit one concrete evaluator-local issue.",
            acceptance: ["Evidence is recorded."],
            mode: "achieve",
            outputs: [],
            priority: "P2",
          },
        ],
      },
      reconciliation(),
    );

    expect(result.actions).toEqual([
      expect.objectContaining({
        kind: "update-task",
        taskId: "pipeline-health",
        expectedGeneration: 3,
      }),
      expect.objectContaining({
        kind: "create-task",
        id: "new-audit",
        parentId: "runtime/owner-review",
      }),
    ]);
    expect(result.summary).toContain("Filtered 2");
    expect(result.facts.join("\n")).toContain(
      "requires waiting or attention, not pending",
    );
    expect(result.facts.join("\n")).toContain(
      "cannot mutate reconciler-owned task runtime/deep-eval-scan",
    );
  });

  test("records execution failure and preserves desired state", async () => {
    const events: Array<{ type: string; localKey?: string }> = [];
    const ctx: WorkflowContext<Input> = createTestAppWorkflowContext({
      input: { scope: "evaluation.app" },
      reconciliation: reconciliation(),
      callAgent: async () => ({
        id: "s_owner",
        kind: "agent",
        status: "interrupted",
        summary: "runtime restarted",
      }),
      emit: async (event) => {
        events.push(event as { type: string; localKey?: string });
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [],
        evidence: [
          "execution:s_owner",
          "execution-status:interrupted",
          "execution-summary:runtime restarted",
        ],
      },
    });
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.owner_review_started",
      "evaluation.owner_review_failed",
      "evaluation.owner_reviewed",
    ]);
    expect(events.map((event) => event.localKey)).toEqual([
      "event-41:owner-review-started",
      "event-41:owner-review-failed",
      "event-41:owner-reviewed",
    ]);
  });

  test("keeps durable failure events identical across retries of one wake", async () => {
    async function eventsFor(executionId: string) {
      const events: unknown[] = [];
      await execute(
        createTestAppWorkflowContext({
          input: { scope: "evaluation.app" },
          reconciliation: reconciliation(),
          callAgent: async () => ({
            id: executionId,
            kind: "agent",
            status: "interrupted",
            summary: `attempt ${executionId} restarted`,
          }),
          emit: async (event) => {
            events.push(event);
          },
        }),
      );
      return events;
    }

    expect(await eventsFor("s_first")).toEqual(await eventsFor("s_retry"));
  });
});
