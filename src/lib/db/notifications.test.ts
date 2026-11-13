import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "./connection.js";
import { getNotificationMessage, hasCompletedHumanActionDelivery, storeNotificationMessage } from "./notifications.js";

test("message links stay chat-scoped and survive reopen", () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-message-links-"));
  try {
    for (const chatId of ["123", "456"]) {
      storeNotificationMessage(root, {
        chat_id: chatId,
        telegram_msg_id: 55,
        event_type: "conversation.mirror",
        agent: "may",
        session_id: null,
        project_id: null,
        data: JSON.stringify({ conversationMessageId: `answer-${chatId}` }),
      });
    }
    closeDb(root);
    for (const chatId of ["123", "456"]) {
      expect(JSON.parse(getNotificationMessage(root, chatId, 55)!.data!)).toEqual({
        conversationMessageId: `answer-${chatId}`,
      });
    }
    expect(getNotificationMessage(root, "789", 55)).toBeNull();
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("completed human-action delivery is exact and destination scoped", () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-action-delivery-"));
  const action = { appId: "may", taskId: "goal/example", signature: "condition-v1" };
  try {
    storeNotificationMessage(root, {
      chat_id: "123",
      telegram_msg_id: 70,
      event_type: "task.human-action",
      agent: "may",
      session_id: null,
      project_id: null,
      data: JSON.stringify({
        taskRefs: [{ appId: action.appId, taskId: action.taskId }],
        channelThreadId: "9",
        completedHumanAction: { version: 1, ...action },
      }),
    });
    expect(hasCompletedHumanActionDelivery(root, "123", 9, action)).toBe(true);
    expect(hasCompletedHumanActionDelivery(root, "123", 10, action)).toBe(false);
    expect(hasCompletedHumanActionDelivery(root, "456", 9, action)).toBe(false);
    expect(hasCompletedHumanActionDelivery(root, "123", 9, { ...action, taskId: "goal/new" })).toBe(false);
    expect(hasCompletedHumanActionDelivery(root, "123", 9, { ...action, signature: "condition-v2" })).toBe(false);

    storeNotificationMessage(root, {
      chat_id: "123",
      telegram_msg_id: 71,
      event_type: "task.human-action",
      agent: "may",
      session_id: null,
      project_id: null,
      data: JSON.stringify({
        taskRefs: [{ appId: action.appId, taskId: action.taskId }],
        channelThreadId: "9",
        humanCondition: { taskGeneration: 3, conditionId: "operator", conditionGeneration: 2 },
        approvalAnchor: { approvalId: "unchanged" },
      }),
    });
    expect(
      hasCompletedHumanActionDelivery(root, "123", 9, {
        ...action,
        signature: "changed-action-set",
      }),
    ).toBe(false);

    for (let id = 72; id < 97; id += 1) {
      storeNotificationMessage(root, {
        chat_id: "123",
        telegram_msg_id: id,
        event_type: "task.watch",
        agent: "may",
        session_id: null,
        project_id: null,
        data: JSON.stringify({
          taskRefs: [{ appId: "may", taskId: `goal/distractor-${id}` }],
          channelThreadId: "9",
          completedHumanAction: {
            version: 1,
            appId: "may",
            taskId: `goal/distractor-${id}`,
            signature: `distractor-${id}`,
          },
        }),
      });
    }
    expect(hasCompletedHumanActionDelivery(root, "123", 9, action)).toBe(true);

    const second = { appId: "scout-knowledge-lib", taskId: "goal/second", signature: "second-v1" };
    storeNotificationMessage(root, {
      chat_id: "123",
      telegram_msg_id: 97,
      event_type: "task.human-action",
      agent: "may",
      session_id: null,
      project_id: null,
      data: JSON.stringify({
        taskRefs: [
          { appId: action.appId, taskId: action.taskId },
          { appId: second.appId, taskId: second.taskId },
        ],
        channelThreadId: "9",
        completedHumanAction: { version: 1, ...second },
      }),
    });
    expect(hasCompletedHumanActionDelivery(root, "123", 9, second)).toBe(true);

    const third = { appId: "may", taskId: "goal/third", signature: "third-v1" };
    storeNotificationMessage(root, {
      chat_id: "123",
      telegram_msg_id: 98,
      event_type: "task.human-action",
      agent: "may",
      session_id: null,
      project_id: null,
      data: JSON.stringify({
        taskRefs: [
          { appId: action.appId, taskId: action.taskId },
          { appId: third.appId, taskId: third.taskId },
        ],
        channelThreadId: "9",
        completedHumanActions: [
          { version: 1, ...action },
          { version: 1, ...third },
        ],
      }),
    });
    expect(hasCompletedHumanActionDelivery(root, "123", 9, third)).toBe(true);
    expect(hasCompletedHumanActionDelivery(root, "123", 10, third)).toBe(false);
    expect(hasCompletedHumanActionDelivery(root, "123", 9, { ...third, signature: "third-v2" })).toBe(false);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
