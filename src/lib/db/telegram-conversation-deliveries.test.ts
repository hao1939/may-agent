import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "./connection.js";
import {
  claimConversationDelivery,
  conversationDeliveryId,
  readConversationDelivery,
  retainUncertainConversationDelivery,
  settleConversationDelivery,
} from "./telegram-conversation-deliveries.js";

test("separate connections cannot acquire or reassign an in-flight delivery", () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-delivery-claim-"));
  const first = join(root, "state");
  const second = join(root, "alias");
  mkdirSync(first);
  symlinkSync(first, second);
  const delivery = {
    appId: "sample",
    conversationId: "discussion",
    messageId: "answer",
    chatId: "123",
    text: "Complete.",
  };
  try {
    expect(claimConversationDelivery(first, delivery)).toBe(true);
    expect(claimConversationDelivery(second, delivery)).toBe(false);
    retainUncertainConversationDelivery(second, delivery);
    expect(readConversationDelivery(second, conversationDeliveryId(delivery))?.state).toBe("sending");
    settleConversationDelivery(first, conversationDeliveryId(delivery), { state: "delivered", externalMessageId: 7 });
    expect(claimConversationDelivery(second, delivery)).toBe(false);
    expect(readConversationDelivery(second, conversationDeliveryId(delivery))).toMatchObject({
      state: "delivered",
      external_message_id: 7,
    });
    expect(() => settleConversationDelivery(second, conversationDeliveryId(delivery), { state: "failed" })).toThrow(
      "sending claim",
    );
  } finally {
    closeDb(first);
    closeDb(second);
    rmSync(root, { recursive: true, force: true });
  }
});

test("a receipt does not suppress a different destination, thread or rendered answer", () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-delivery-scope-"));
  const delivery = {
    appId: "sample",
    conversationId: "discussion",
    messageId: "answer",
    chatId: "123",
    text: "Complete.",
  };
  try {
    expect(claimConversationDelivery(root, delivery)).toBe(true);
    settleConversationDelivery(root, conversationDeliveryId(delivery), { state: "delivered", externalMessageId: 7 });
    for (const changed of [{ chatId: "456" }, { threadId: 9 }, { text: "Corrected answer." }]) {
      expect(claimConversationDelivery(root, { ...delivery, ...changed })).toBe(true);
    }
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
