import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  matchesEventSelector,
  type AppEvent,
  type AppTaskInput,
} from "@may-agent/sdk";
import { Check } from "typebox/value";
import app, { evaluationHumanDecisionInput, taskForMayInput } from "./app.ts";

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
      intent: { id: "decision/evaluation-session-1-rollout" },
    });
  });

  test("accepts ordinary human messages through the same App schema", () => {
    expect(
      Check(app.inputSchema, {
        kind: "message",
        data: { message: "Review the latest state" },
      }),
    ).toBeTrue();
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
