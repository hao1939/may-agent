import { expect, test } from "bun:test";
import { conversationNoticeEvent } from "./app-input-event.js";
import { telegramConversationInputEvent } from "./transport/telegram.js";

test("human input and notices use an exact destination independent of the agent name", () => {
  const notice = conversationNoticeEvent({
    appId: "support",
    conversationId: "retained-room",
    source: "workflow",
    authorId: "helper",
    text: "Progress",
  });
  expect(notice).toMatchObject({
    owner: "app:support",
    data: { appId: "support", conversationId: "retained-room", author: { id: "helper" } },
  });
  const message = telegramConversationInputEvent({
    appId: "support",
    conversationId: "retained-room",
    message: "Next",
    chatId: "42",
    messageId: 1,
  });
  expect(message).toMatchObject({ target: { appId: "support" }, data: { conversationId: "retained-room" } });
  expect(() =>
    conversationNoticeEvent({
      appId: "",
      conversationId: "",
      source: "workflow",
      authorId: "helper",
      text: "Progress",
    }),
  ).toThrow("destination");
});
