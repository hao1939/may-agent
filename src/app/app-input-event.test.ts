import { expect, test } from "bun:test";
import { telegramConversationInputEvent } from "./transport/telegram.js";

test("human input uses an exact destination independent of the agent name", () => {
  const message = telegramConversationInputEvent({
    appId: "support",
    conversationId: "retained-room",
    message: "Next",
    chatId: "42",
    messageId: 1,
  });
  expect(message).toMatchObject({ target: { appId: "support" }, data: { conversationId: "retained-room" } });
});
