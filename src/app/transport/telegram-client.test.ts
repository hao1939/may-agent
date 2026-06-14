import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../../lib/db/connection.js";
import { createTelegramClient, splitTelegramMessage } from "./telegram-client.js";

describe("telegram client", () => {
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
});
