import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db.js";
import { closeDb, getDb } from "./connection.js";
import { getNotificationMessage, storeNotificationMessage } from "./notifications.js";

test("message links migrate without guessing legacy chats and survive reopen", () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-message-links-"));
  const legacy = openDatabase(join(root, "may.db"));
  legacy.exec(`CREATE TABLE notification_messages (
    telegram_msg_id INTEGER PRIMARY KEY, event_type TEXT, agent TEXT,
    session_id TEXT, project_id TEXT, data TEXT, sent_at INTEGER
  )`);
  const payloads = [
    { chatId: "123", conversationMessageId: "inbound" },
    { channelTargetId: "456", conversationMessageId: "outbound" },
    { conversationMessageId: "unknown" },
    "malformed legacy data",
    { chatId: "123", channelTargetId: "456", conversationMessageId: "ambiguous" },
  ];
  for (const [i, payload] of payloads.entries())
    legacy.run("INSERT INTO notification_messages (telegram_msg_id, data) VALUES (?, ?)", [
      i + 1,
      typeof payload === "string" ? payload : JSON.stringify(payload),
    ]);
  legacy.close();
  try {
    expect(JSON.parse(getNotificationMessage(root, "123", 1)!.data!)).toEqual(payloads[0]);
    expect(JSON.parse(getNotificationMessage(root, "456", 2)!.data!)).toEqual(payloads[1]);
    for (const id of [3, 4, 5]) {
      expect(getNotificationMessage(root, "123", id)).toBeNull();
      expect(getNotificationMessage(root, "456", id)).toBeNull();
      expect(getNotificationMessage(root, "", id)).toBeNull();
    }
    expect(getDb(root).prepare("SELECT COUNT(*) AS count FROM notification_messages").get()).toEqual({ count: 5 });
    for (const chatId of ["123", "456"])
      storeNotificationMessage(root, {
        chat_id: chatId,
        telegram_msg_id: 55,
        event_type: "conversation.mirror",
        agent: "may",
        session_id: null,
        project_id: null,
        data: JSON.stringify({ conversationMessageId: `answer-${chatId}` }),
      });
    closeDb(root);
    for (const chatId of ["123", "456"]) {
      expect(JSON.parse(getNotificationMessage(root, chatId, 55)!.data!)).toEqual({
        conversationMessageId: `answer-${chatId}`,
      });
    }
    expect(getDb(root).prepare("SELECT COUNT(*) AS count FROM notification_messages").get()).toEqual({ count: 7 });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
