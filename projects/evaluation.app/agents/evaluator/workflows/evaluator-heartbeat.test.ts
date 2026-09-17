import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import type { TaskReconciliationContext } from "@may-agent/sdk";
import { execute, normalizeAgentResult } from "./evaluator-heartbeat.js";

type Input = { scope?: string };
function reconciliation(): TaskReconciliationContext<Input> {
  return {
    appId: "evaluation",
    taskId: "runtime/owner-review",
    generation: 4,
    resourceVersion: 8,
    agent: "evaluator",
    outcome: "Keep evaluation.app coherent.",
    acceptance: ["Return a safe no-op or unblock an exact child."],
    input: { scope: "evaluation.app" },
    children: {
      live: [
        {
          taskId: "child",
          parentId: "runtime/owner-review",
          generation: 2,
          outcome: "Retry safely",
          input: {},
          conditions: [],
          hasLiveChildren: false,
          status: "waiting",
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
          event: {
            type: "evaluation.tick",
            data: {},
            target: { appId: "evaluation" },
          },
        },
      ],
      throughEventId: 41,
      truncated: false,
    },
  } as TaskReconciliationContext<Input>;
}

describe("evaluator heartbeat", () => {
  test("requires canonical reconciliation context", async () => {
    let called = false;
    const ctx = createTestAppWorkflowContext({
      input: {},
      callAgent: async () => {
        called = true;
        throw new Error("unexpected");
      },
    });
    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary: "evaluator-heartbeat requires canonical reconciliation context",
    });
    expect(called).toBeFalse();
  });

  test("admits a current no-op result using facts", () => {
    expect(
      normalizeAgentResult(
        {
          state: "converged",
          summary: "No change.",
          facts: ["bounded packet"],
          actions: [],
        },
        reconciliation(),
      ),
    ).toEqual({
      state: "converged",
      summary: "No change.",
      facts: ["bounded packet"],
      actions: [],
    });
  });

  test("filters stale and runtime unblock actions", () => {
    const result = normalizeAgentResult(
      {
        state: "converged",
        summary: "retry",
        facts: [],
        actions: [
          {
            kind: "unblock-task",
            taskId: "child",
            expectedGeneration: 1,
            reason: "stale",
          },
          {
            kind: "unblock-task",
            taskId: "runtime/other",
            expectedGeneration: 2,
            reason: "owned",
          },
        ],
      },
      reconciliation(),
    );
    expect(result).toMatchObject({
      state: "converged",
      actions: [],
      facts: ["owner-actions:filtered"],
    });
  });

  test("passes one bounded packet and records a failed execution", async () => {
    const prompts: string[] = [];
    const events: Array<{ type: string }> = [];
    const ctx = createTestAppWorkflowContext({
      input: { scope: "evaluation.app" },
      reconciliation: reconciliation(),
      callAgent: async (_agent, prompt) => {
        prompts.push(prompt);
        return {
          id: "s_owner",
          kind: "agent",
          status: "interrupted",
          summary: "restart",
        };
      },
      emit: async (event) => {
        events.push(event as { type: string });
      },
    });
    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: ["execution:s_owner", "execution-status:interrupted"],
        actions: [],
      },
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('"taskId":"runtime/owner-review"');
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.owner_review_started",
      "evaluation.owner_review_failed",
    ]);
  });
});
