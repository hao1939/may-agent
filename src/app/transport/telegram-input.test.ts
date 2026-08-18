import { describe, expect, it } from "bun:test";
import { telegramMayInputEvent } from "./telegram.js";

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
});
