import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../../lib/db/connection.js";
import { getDb } from "../../lib/db/connection.js";
import {
  getLatestInboundNotificationMessage,
  getRecentTelegramConversationMessages,
  getTelegramConversationView,
  storeNotificationMessage,
} from "../../lib/db/notifications.js";
import { createTelegramClient, splitTelegramMessage } from "./telegram-client.js";

describe("telegram client", () => {
  it("recovers the latest inbound Telegram anchor for a request trace", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-inbound-trace-"));
    try {
      for (const [telegramMsgId, sentAt, traceId] of [
        [500, 1, "trace-a"],
        [501, 2, "trace-b"],
        [502, 3, "trace-a"],
      ] as const) {
        storeNotificationMessage(persistDir, {
          telegram_msg_id: telegramMsgId,
          event_type: "human.input.received",
          agent: "may",
          session_id: null,
          project_id: null,
          data: JSON.stringify({ direction: "inbound", traceId }),
          sent_at: sentAt,
        });
      }

      expect(getLatestInboundNotificationMessage(persistDir, "trace-a")?.telegram_msg_id).toBe(502);
      expect(getLatestInboundNotificationMessage(persistDir, "trace-b")?.telegram_msg_id).toBe(501);
      expect(getLatestInboundNotificationMessage(persistDir, "trace-missing")).toBeNull();
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("reads a bounded Telegram conversation window in message order", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-conversation-window-"));
    const conversationId = "telegram:chat:123:topic:0:agent:may";
    try {
      for (const [telegramMsgId, direction, text, sentAt] of [
        [600, "inbound", "Review Gym", 1],
        [601, "outbound", "Gym is active", 2],
        [602, "inbound", "What about AKS?", 3],
      ] as const) {
        storeNotificationMessage(persistDir, {
          telegram_msg_id: telegramMsgId,
          event_type: direction === "inbound" ? "human.input.received" : "response",
          agent: direction === "inbound" ? "may" : "may",
          session_id: null,
          project_id: null,
          data: JSON.stringify({ direction, conversationId, text, traceId: `trace-${telegramMsgId}` }),
          sent_at: sentAt,
        });
      }

      expect(getRecentTelegramConversationMessages(persistDir, conversationId, 2)).toEqual([
        expect.objectContaining({ telegramMsgId: 601, direction: "outbound", text: "Gym is active" }),
        expect.objectContaining({ telegramMsgId: 602, direction: "inbound", text: "What about AKS?" }),
      ]);
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("assembles an exact focused request from existing trace and message data", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-conversation-view-"));
    const conversationId = "telegram:chat:123:topic:0:agent:may";
    try {
      storeNotificationMessage(persistDir, {
        telegram_msg_id: 610,
        event_type: "human.input.received",
        agent: "may",
        session_id: null,
        project_id: "gym",
        data: JSON.stringify({
          direction: "inbound",
          conversationId,
          text: "What happened to the Gym run?",
          traceId: "trace-gym-1",
          taskId: "learning/gym-run",
        }),
        sent_at: 1,
      });
      const db = getDb(persistDir);
      db.run(
        `INSERT INTO events (event_type, source, owner, data, project_id, task_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "project.owner.result",
          "gym",
          "agent:may",
          JSON.stringify({ status: "waiting", summary: "Provider connection failed; no model output." }),
          "gym",
          "learning/gym-run",
          2,
        ],
      );
      const eventId = Number((db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id);
      db.run("UPDATE event_traces SET trace_id = ? WHERE event_id = ?", ["trace-gym-1", eventId]);

      expect(
        getTelegramConversationView(persistDir, {
          conversationId,
          traceId: "trace-gym-1",
          taskId: "learning/gym-run",
          projectId: "gym",
        }),
      ).toMatchObject({
        focus: {
          traceId: "trace-gym-1",
          taskId: "learning/gym-run",
          projectId: "gym",
          owner: "agent:may",
          status: "waiting",
          events: [
            expect.objectContaining({
              eventId,
              type: "project.owner.result",
              summary: "Provider connection failed; no model output.",
            }),
          ],
        },
        recentMessages: [expect.objectContaining({ telegramMsgId: 610 })],
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("splits long messages without dropping content", () => {
    const chunks = splitTelegramMessage(["one", "two", "three"].join("\n"), 8);
    expect(chunks).toEqual(["one\ntwo", "three"]);
  });

  it("can send a bot message as a reply to keep the Telegram conversation chain", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-"));
    const bodies: Record<string, unknown>[] = [];
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(JSON.stringify({ ok: true, result: { message_id: 321 } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      const msgId = await client.sendMessage("chat-1", "Received. May is handling it.", undefined, {
        eventType: "telegram.reply",
        agent: "may",
        data: JSON.stringify({ conversationId: "tg_focus_1" }),
        replyToMessageId: 123,
      });

      expect(msgId).toBe(321);
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({
        chat_id: "chat-1",
        text: "Received. May is handling it.",
        reply_parameters: {
          message_id: 123,
          allow_sending_without_reply: true,
        },
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("stores approval notification context for reply enrichment", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-approval-"));
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async () => {
          return new Response(JSON.stringify({ ok: true, result: { message_id: 654 } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      await client.sendMessage("chat-1", "📋 Approval packet dispatch", undefined, {
        eventType: "message.created",
        agent: "aks-explorer",
        projectId: "projects/alpha-project.app",
        data: JSON.stringify({
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
          packetPath: "evidence/archive/example-approval.md",
          conversationId: "approval:approval-123",
          originalIssue: {
            eventType: "project.approval.requested",
            approvalId: "approval-123",
            waitId: "wait-123",
          },
          expectedResponse: {
            type: "project.approval.submitted",
            approvalId: "approval-123",
            waitId: "wait-123",
          },
        }),
      });

      const { getNotificationMessage } = await import("../../lib/db/notifications.js");
      const row = getNotificationMessage(persistDir, 654);
      expect(row).toMatchObject({
        event_type: "message.created",
        agent: "aks-explorer",
        project_id: "projects/alpha-project.app",
      });
      expect(JSON.parse(String(row?.data))).toMatchObject({
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
        packetPath: "evidence/archive/example-approval.md",
        conversationId: "approval:approval-123",
        originalIssue: {
          eventType: "project.approval.requested",
          approvalId: "approval-123",
          waitId: "wait-123",
        },
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-123",
          waitId: "wait-123",
        },
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("stores reply context for every chunk of a long message", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-chunks-"));
    let nextMessageId = 700;
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async () => {
          return new Response(JSON.stringify({ ok: true, result: { message_id: nextMessageId++ } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      await client.sendMessage("chat-1", `${"a".repeat(4090)}\n${"b".repeat(40)}`, undefined, {
        eventType: "message.created",
        agent: "may",
        data: JSON.stringify({ conversationId: "approval:chunked" }),
      });

      const { getNotificationMessage } = await import("../../lib/db/notifications.js");
      expect(JSON.parse(String(getNotificationMessage(persistDir, 700)?.data))).toMatchObject({
        conversationId: "approval:chunked",
      });
      expect(JSON.parse(String(getNotificationMessage(persistDir, 701)?.data))).toMatchObject({
        conversationId: "approval:chunked",
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("does not report a multipart send as delivered when any chunk is uncertain", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-partial-"));
    let attempt = 0;
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async () => {
          attempt += 1;
          if (attempt === 2) throw new Error("connection ended before a response");
          return new Response(JSON.stringify({ ok: true, result: { message_id: 800 } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      await expect(client.sendMessage("chat-1", "a".repeat(5_000))).resolves.toBeUndefined();
      expect(attempt).toBe(2);
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
