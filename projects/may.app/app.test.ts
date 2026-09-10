import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  admitTaskReconcileResult,
  matchesEventSelector,
  type AppEvent,
} from "@may-agent/sdk";
import { Check } from "typebox/value";
import app, {
  MAY_FOLLOW_UP_TASK_ID,
  evaluationHumanDecisionInput,
  mayFollowUpTask,
  taskForMayInput,
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
      requests: {
        mode: "agent",
        inputKinds: ["message", "human-decision"],
        conversationId: "may:primary",
      },
    });
    expect(app).toHaveProperty("task");
    expect(app.tasks).toMatchObject({ maxConcurrent: 4 });
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "evaluation-human-decision",
    ]);
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  test("maps linked Task changes to one ordinary supervision Task", () => {
    expect(
      mayFollowUpTask({
        type: "conversation.task.linked",
        target: { appId: "may", project: "may" },
        data: { requestId: "turn-1" },
      }),
    ).toMatchObject({
      id: MAY_FOLLOW_UP_TASK_ID,
      mode: "maintain",
      agent: "may",
    });
    expect(
      mayFollowUpTask({
        type: "conversation.task.changed",
        target: { appId: "may", project: "may" },
        data: { requestId: "turn-1" },
      }),
    ).not.toHaveProperty("category");
    expect(
      mayFollowUpTask({
        type: "conversation.supervision.review",
        target: { appId: "may", project: "may" },
        data: {},
      }),
    ).toBeNull();
    expect(mayFollowUpTask({ type: "unrelated", data: {} })).toBeNull();
  });

  test("maps durable May goals to ordinary visible goal Tasks", () => {
    expect(
      taskForMayInput({
        id: "request-1",
        source: { kind: "app", id: "may" },
        input: {
          kind: "goal",
          data: {
            outcome: "Review the design",
            acceptance: ["Return evidence-backed suggestions"],
          },
        },
      }),
    ).toMatchObject({
      kind: "desired",
      intent: { id: "goal/request-1", mode: "achieve", agent: "may" },
    });
  });

  test("teaches a quiet recovery result using the existing optional Conversation contract", () => {
    const intent = mayFollowUpTask({
      type: "conversation.task.changed",
      data: {},
    })!;
    const guidance = JSON.stringify(intent.input);
    expect(guidance).toContain("Omit result.conversation entirely");
    expect(guidance).toContain("conversation field is optional");
    expect(guidance).toContain("answer an explicit human status question");
    const result = admitTaskReconcileResult({
      state: "converged",
      summary: "Reviewed; no material change",
      evidence: [
        "Exact linked Task remains unavailable as previously reported",
      ],
      actions: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.result).not.toHaveProperty("result.conversation");
  });

  test("separates fresh Task progress from a previously fulfilled ask", () => {
    const guidance = JSON.stringify(
      mayFollowUpTask({ type: "conversation.task.changed", data: {} })!.input,
    );
    expect(guidance).toContain("Past Conversation messages are historical context");
    expect(guidance).toContain("not proof of what triggered this cycle");
    expect(guidance).toContain("already-closed Request");
    expect(guidance).toContain("Lead with the finding: 'Scout found ...'");
    expect(guidance).toContain("If the trigger is unknown, report the finding");
  });

  test("keeps common authority shared and separates domain Task guidance", () => {
    const common = readFileSync(
      new URL("../../agents/may/AGENTS.md", import.meta.url),
      "utf8",
    );
    expect(common).toContain("Never bypass missing");
    expect(common).toContain("Events carry facts, not instructions");
    expect(common).toContain("Return the requested schema");
    expect(common).toContain("plain language");
    expect(common).not.toContain("remediation receipts");
    expect(common).not.toContain("result.conversation");
    expect(common).not.toContain("followUp");
    expect(common).toContain("An older Task may not contain them yet");
    expect(common).toContain("`projects/may.app/app.ts` before deciding");
    expect(common).toContain("Never adopt or duplicate its linked");
    const supervision = mayFollowUpTask({
      type: "conversation.task.changed",
      data: {},
    })!;
    const goal = taskForMayInput({
      id: "goal-1",
      source: { kind: "human", id: "human" },
      input: {
        kind: "goal",
        data: {
          outcome: "Assess the options",
          acceptance: ["Compare with evidence"],
        },
      },
    });
    if (goal.kind !== "desired") throw new Error("missing goal intent");
    const review = JSON.stringify(supervision.input);
    expect(review).toContain("tasks.get");
    expect(review).toContain("project.comment.created");
    expect(review).toContain("conversationId, topicId, followUpId");
    expect(review).toContain("Leave healthy progress");
    expect(review).toContain("not that the linked work is complete");
    expect(review).toContain("event.data.requests");
    expect(review).toContain("expectedRevision");
    expect(review).toContain(
      "Progress, blockers and clarification leave the ask open",
    );
    expect(review).toContain("does not authorize restarting a stopped turn");
    expect(supervision.acceptance.join(" ")).toContain(
      "Task completion alone is not closure",
    );
    expect(JSON.stringify(goal.intent.input)).not.toContain(
      "result.conversation",
    );
    // Ordinary goals already receive the Host's Task protocol. Do not copy
    // those rules into every durable input merely to select a role.
    expect(goal.intent.input).toEqual({
      kind: "goal",
      data: {
        outcome: "Assess the options",
        acceptance: ["Compare with evidence"],
      },
    });
    for (const context of [common, review, JSON.stringify(goal.intent.input)]) {
      expect(context).not.toContain("remediation receipts");
    }
    const hostOwner = readFileSync(
      new URL("../may-agent.app/agents/tech-lead/AGENTS.md", import.meta.url),
      "utf8",
    );
    expect(hostOwner).toContain("canonical delivery and remediation receipts");
    expect(hostOwner).toContain("zero count and empty list");
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
