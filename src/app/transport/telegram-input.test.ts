import { describe, expect, it } from "bun:test";
import { renderTelegramApps, renderTelegramTask, renderTelegramTasks, telegramMayInputEvent } from "./telegram.js";

describe("Telegram May input", () => {
  it("maps one Telegram turn to one durable May request with exact reply identity", () => {
    expect(
      telegramMayInputEvent({
        message: "Please inspect this",
        chatId: "123",
        messageId: 502,
        topicId: 7,
        conversationId: "telegram:chat:123:topic:7:agent:may",
        replyToMessageId: 499,
        context: { quotedText: "Earlier question" },
        trace: { traceId: "telegram:502", parentEventId: 41 },
      }),
    ).toEqual({
      type: "conversation.message.created",
      source: "telegram",
      owner: "app:may",
      data: {
        appId: "may",
        conversationId: "telegram:chat:123:topic:7:agent:may",
        author: { kind: "human", id: "telegram:123:502" },
        text: "Please inspect this",
        context: { quotedText: "Earlier question" },
        replyTo: "telegram:123:499",
        metadata: { channel: "telegram", channelTargetId: "123", channelThreadId: "7", channelMessageId: 502 },
        idempotencyKey: "telegram:123:502",
      },
      trace: { traceId: "telegram:502", parentEventId: 41 },
    });
  });

  it("renders the same Task resources with Telegram-friendly cards", () => {
    const task = {
      appId: "evaluation",
      taskId: "review/docs",
      ref: "8f12ac90",
      status: "running" as const,
      generation: 1,
      resourceVersion: 2,
      outcome: "Review the docs",
      summary: "Reviewing current behavior",
      updatedAt: Date.UTC(2026, 7, 22, 1, 2, 3),
      terminal: false,
      cancellable: true,
    };
    expect(renderTelegramApps([
      {
        id: "evaluation",
        owner: "evaluator",
        activeTasks: 1,
        attentionTasks: 0,
        runningTasks: 1,
        waitingTasks: 0,
      },
    ])).toContain("evaluation — 1 active · 1 running");
    expect(renderTelegramTasks([task], false)).toContain("8f12ac90 · evaluation · running");
    expect(renderTelegramTask(task)).toContain("Progress:\nReviewing current behavior");
  });
});
