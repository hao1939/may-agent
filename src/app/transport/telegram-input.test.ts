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
      type: "app.input.requested",
      source: "telegram",
      owner: "app:may",
      data: {
        appId: "may",
        input: {
          kind: "message",
          data: { message: "Please inspect this", context: { quotedText: "Earlier question" } },
        },
        source: { kind: "human", id: "telegram:123:502" },
        conversationId: "telegram:chat:123:topic:7:agent:may",
        conversationSequence: 502,
        channel: "telegram",
        channelThreadId: "7",
        channelMessageId: 502,
        replyToSourceId: "telegram:123:499",
        idempotencyKey: "telegram:123:502",
      },
      trace: { traceId: "telegram:502", parentEventId: 41 },
    });
  });
});
