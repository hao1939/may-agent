import { describe, expect, test } from "bun:test";
import {
  buildHumanConversationMessageEvent,
  humanCurrentTaskText,
  humanTaskStatusLabel,
  primaryConversationId,
  representedTaskIdentities,
  resolveConversationTopic,
  topicReference,
} from "./human-surface.js";

describe("shared human surface contract", () => {
  test("primaryConversationId normalizes agent names", () => {
    expect(primaryConversationId("may")).toBe("may:primary");
    expect(primaryConversationId("  ")).toBe("host:primary");
  });

  test("topicReference and resolveConversationTopic resolve exact IDs and short prefixes", () => {
    const topics = [
      { id: "topic_8f12ac9099", title: "Release", openedBy: "agent", originMessageId: "m1", taskRefs: [] },
      { id: "topic_99ab12cd00", title: "Audit", openedBy: "human", originMessageId: "m2", taskRefs: [] },
    ];
    expect(topicReference(topics[0])).toBe("8f12ac90");
    expect(resolveConversationTopic(topics, "8f12ac90")).toEqual(topics[0]);
    expect(resolveConversationTopic(topics, "topic_8f12ac9099")).toEqual(topics[0]);
    expect(resolveConversationTopic(topics, "unknown")).toBeUndefined();
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
      topicId: "topic_8f12ac90",
      focusedApp: "alex",
      focusedTask: { appId: "alex", taskId: "work/1" },
    });
    expect(event).toEqual({
      type: "conversation.message.created",
      target: { appId: "may" },
      data: {
        conversationId: "may:primary",
        author: { kind: "human", id: "web-ui:msg-1" },
        text: "Check the benchmark result",
        context: {
          focusedApp: "alex",
          focusedTask: { appId: "alex", taskId: "work/1" },
        },
        metadata: {
          channel: "web-ui",
          topicId: "topic_8f12ac90",
        },
      },
      idempotencyKey: "web-ui:msg-1",
    });
  });
});
