import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  matchesEventSelector,
  type AppEvent,
  type AppTaskInput,
} from "@may-agent/sdk";
import { Check } from "typebox/value";
import app, {
  evaluationHumanDecisionInput,
  taskForMayInput,
  validateMayAction,
  validateMayCondition,
} from "./app.ts";

function decisionEvent(
  overrides: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return {
    type: "evaluation.human_decision.requested",
    data: {
      sourceSessionId: "session-1",
      targetAppId: "aks-rp-e2e",
      verdict: "needs-human",
      requestedHumanAction: "approve production rollout",
      message: "Please approve the production rollout.",
      dedupeKey: "evaluation:session-1:rollout",
      evidence: ["evaluation:session-1"],
    },
    target: { appId: "may", project: "may" },
    ...overrides,
  };
}

describe("canonical May conversation App", () => {
  test("owns one manifest for human input and addressed decision events", () => {
    expect(app).toMatchObject({
      id: "may",
      version: 1,
      agent: "may",
      tasks: { maxConcurrent: 8 },
    });
    expect(app.task).toBe(taskForMayInput);
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "evaluation-human-decision",
    ]);
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  test("resolves conversation and decision input to stable May-owned tasks", () => {
    const admitted = (
      input: AppTaskInput["input"],
      id: string,
    ): AppTaskInput => ({
      id,
      source: { kind: "human", id: "operator" },
      input,
    });
    expect(
      taskForMayInput(
        admitted(
          { kind: "message", data: { message: "Review the latest state" } },
          "conversation-request-1",
        ),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "conversation/conversation-request-1",
        parentId: "may",
        agent: "may",
        category: "conversation",
        outcome: "Review the latest state",
      },
    });
    expect(
      taskForMayInput(
        admitted(
          {
            kind: "human-decision",
            data: {
              message: "Approve rollout",
              dedupeKey: "evaluation:session-1:rollout",
            },
          },
          "request-2",
        ),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "decision/evaluation-session-1-rollout",
        outcome: "Handle the human decision: Approve rollout",
      },
    });
  });

  test("keeps task outcomes concise and human-readable", () => {
    const attachment = taskForMayInput({
      id: "long-request",
      source: { kind: "human", id: "operator" },
      input: { kind: "message", data: { message: `  Review\n${"the current state ".repeat(30)}` } },
    });
    expect(attachment.kind).toBe("desired");
    if (attachment.kind !== "desired") return;
    expect(attachment.intent.outcome).not.toContain("\n");
    expect(attachment.intent.outcome.length).toBeLessThanOrEqual(240);
    expect(attachment.intent.outcome).toStartWith("Review the current state");
  });

  test("accepts ordinary human messages through the same App schema", () => {
    expect(
      Check(app.inputSchema, {
        kind: "message",
        data: { message: "Review the latest state" },
      }),
    ).toBeTrue();
  });

  test("admits canonical approval waits and rejects invented event types", () => {
    const condition = {
      id: "approval",
      subject: "id:rollout-1",
      expected: { field: "decision", equals: "approve" },
    };
    expect(
      validateMayCondition({
        ...condition,
        type: "project.approval.submitted",
      }),
    ).toBeNull();
    expect(
      validateMayCondition({ ...condition, type: "human-decision" }),
    ).toContain("not an observable May approval event");
  });

  test("keeps May as deputy instead of a second durable task planner", () => {
    expect(
      validateMayAction({
        kind: "create-task",
        id: "hidden-work",
        parentId: "may",
        outcome: "Do hidden work",
        mode: "achieve",
        outputs: [],
        acceptance: ["Done"],
        priority: "P1",
      }),
    ).toContain("answer, clarify, or use a typed accountable-App dependency");
  });

  test("translates Evaluation decisions without losing their dedupe lineage", () => {
    const subscription = app.subscriptions?.[0];
    if (!subscription)
      throw new Error("missing Evaluation decision subscription");
    const event = decisionEvent();
    expect(matchesEventSelector(subscription.event, event)).toBeTrue();
    const input = evaluationHumanDecisionInput(event);
    expect(input).toEqual({ kind: "human-decision", data: event.data });
    expect(Check(app.inputSchema, input)).toBeTrue();
  });

  test("does not claim a decision addressed to another project", () => {
    const subscription = app.subscriptions?.[0];
    if (!subscription)
      throw new Error("missing Evaluation decision subscription");
    expect(
      matchesEventSelector(
        subscription.event,
        decisionEvent({ target: { appId: "other", project: "other" } }),
      ),
    ).toBeFalse();
  });

  test("rejects malformed decision obligations instead of hiding them as null", () => {
    expect(() =>
      evaluationHumanDecisionInput(
        decisionEvent({ data: { dedupeKey: "evaluation:broken" } }),
      ),
    ).toThrow("requires non-empty message");
  });
});
