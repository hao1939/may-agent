import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { getNotificationMessage } from "../../src/lib/db/notifications.js";
import { closeDb } from "../../src/lib/db/connection.js";
import { createTelegramClient, splitTelegramMessage } from "../../src/app/transport/telegram-client.js";

function response(ok: boolean, result: unknown, description?: string): Response {
  return {
    json: async () => ({ ok, result, description, ...(!ok ? { error_code: 400 } : {}) }),
  } as Response;
}

describe("telegram client", () => {
  it("splits long messages on readable boundaries", () => {
    expect(splitTelegramMessage("short", 10)).toEqual(["short"]);
    expect(splitTelegramMessage("hello world again", 12)).toEqual(["hello world", "again"]);
  });

  it("retries markdown sends without parse mode and stores reply context", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-"));
    const calls: Array<Record<string, unknown>> = [];
    const info: string[] = [];
    let nextMessageId = 700;
    const fetchImpl = async (_url: string | URL, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push(body);
      if (body.parse_mode) return response(false, null, "Bad Request: can't parse entities");
      return response(true, { message_id: nextMessageId++ });
    };

    try {
      const client = createTelegramClient({
        token: "test-token",
        persistDir,
        emitInfo: (message) => info.push(message),
        fetchImpl: fetchImpl as typeof fetch,
      });

      const msgId = await client.sendMessage("12345", "hello", "Markdown", {
        eventType: "message.created",
        agent: "may",
        sessionId: "s_1",
        data: JSON.stringify({ text: "hello" }),
      });

      expect(msgId).toBe(700);
      expect(calls).toEqual([
        { chat_id: "12345", text: "hello", parse_mode: "Markdown" },
        { chat_id: "12345", text: "hello" },
      ]);
      expect(info).toEqual([]);
      expect(getNotificationMessage(persistDir, "12345", 700)).toMatchObject({
        event_type: "message.created",
        agent: "may",
        session_id: "s_1",
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
