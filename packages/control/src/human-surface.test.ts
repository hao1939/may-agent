import { describe, expect, test } from "bun:test";
import {
  buildHumanConversationMessageEvent,
  humanCurrentTaskText,
  humanTaskStatusLabel,
  primaryConversationId,
  representedTaskIdentities,
} from "./human-surface.js";

describe("shared human surface contract", () => {
  test("primaryConversationId normalizes agent names", () => {
    expect(primaryConversationId("may")).toBe("may:primary");
    expect(primaryConversationId("  ")).toBe("host:primary");
  });

  test("humanTaskStatusLabel and humanCurrentTaskText share canonical status and progress semantics", () => {
    expect(humanTaskStatusLabel({ status: "pending" })).toBe("queued");
    expect(humanTaskStatusLabel({ status: "running" })).toBe("working");
    expect(humanTaskStatusLabel({ status: "attention", humanAction: { requestedAction: "Approve" } })).toBe("needs you");
    expect(humanTaskStatusLabel({ status: "attention" })).toBe("needs review");
    expect(
      humanCurrentTaskText({
        status: "running",
        terminal: false,
        progress: { stage: "step", message: "Running tests", updatedAt: 10 },
        summary: "Earlier summary",
      }),
    ).toBe("Running tests");
    expect(
      humanCurrentTaskText({
        status: "done",
        terminal: true,
        progress: { stage: "step", message: "Running tests", updatedAt: 10 },
        response: "Final answer",
      }),
    ).toBe("Final answer");
  });

  test("representedTaskIdentities collects the Task, requestedBy, and Task waits", () => {
    expect(
      representedTaskIdentities({
        appId: "alex",
        taskId: "work/1",
        requestedBy: { appId: "may", taskId: "conv", ref: "11111111", status: "running", outcome: "Ask" },
        waitingOn: [
          { kind: "task", appId: "gym", taskId: "bench/1", ref: "22222222", status: "running", outcome: "Bench" },
          { kind: "condition", type: "pr.merged", subject: "pr:1" },
        ],
      }),
    ).toEqual([
      { appId: "alex", taskId: "work/1" },
      { appId: "may", taskId: "conv" },
      { appId: "gym", taskId: "bench/1" },
    ]);
  });

  test("buildHumanConversationMessageEvent constructs canonical conversation.message.created envelopes", () => {
    const event = buildHumanConversationMessageEvent({
      appId: "may",
      conversationId: "may:primary",
      authorId: "web-ui:msg-1",
      text: "Check the benchmark result",
      channel: "web-ui",
    });
    expect(event).toEqual({
      type: "conversation.message.created",
      target: { appId: "may" },
      data: {
        conversationId: "may:primary",
        author: { kind: "human", id: "web-ui:msg-1" },
        text: "Check the benchmark result",
        metadata: {
          channel: "web-ui",
        },
      },
      idempotencyKey: "web-ui:msg-1",
    });
  });
});
