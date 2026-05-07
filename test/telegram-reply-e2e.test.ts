import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../src/app/event-bus.js";
import { attachTelegramBot } from "../src/app/ui/telegram.js";

function jsonResponse(result: unknown) {
  return {
    json: async () => ({ ok: true, result }),
  } as Response;
}

async function waitFor(assertion: () => void, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastErr;
}

describe("telegram reply e2e", () => {
  let persistDir: string;
  let oldToken: string | undefined;
  let oldChatId: string | undefined;

  beforeEach(() => {
    persistDir = mkdtempSync(resolve(tmpdir(), "telegram-e2e-"));
    oldToken = process.env.TELEGRAM_BOT_TOKEN;
    oldChatId = process.env.TELEGRAM_CHAT_ID;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
  });

  afterEach(() => {
    if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = oldChatId;
    vi.restoreAllMocks();
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("routes a Telegram reply and sends session.end summary when no text stream arrived", async () => {
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;
    let activeSessionId = "";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") {
        return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      }

      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 1,
              message: {
                message_id: 200,
                chat: { id: 12345 },
                text: "show details",
                reply_to_message: {
                  message_id: 100,
                  text: "Project needs attention: shared/projects/example",
                },
              },
            },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }

      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 + sentMessages.length });
      }

      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const inputs: string[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "input") inputs.push(String(event.message ?? ""));
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: {} as any,
      getSessionId: () => activeSessionId,
      interfaceAgent: "may",
    });

    await waitFor(() => {
      expect(inputs).toHaveLength(1);
      expect(inputs[0]).toContain("[User replying to Telegram message]");
      expect(inputs[0]).toContain("Project needs attention");
      expect(inputs[0]).toContain("User says: show details");
    });

    activeSessionId = "s_test_reply";
    bus.emit({
      type: "session.start",
      sessionId: activeSessionId,
      agent: "may",
      task: inputs[0],
      trigger: "chat",
      firedAt: Date.now(),
      kind: "chat",
    });
    activeSessionId = "";
    bus.emit({
      type: "session.end",
      sessionId: "s_test_reply",
      agent: "may",
      outcome: "done",
      summary: "Actual May answer with the requested details.",
      durationMs: 10,
      status: "done",
      task: inputs[0],
    });

    await waitFor(() => {
      expect(sentMessages.some((m) => m.text.includes("Actual May answer"))).toBe(true);
      expect(sentMessages.some((m) => m.text.includes("Couldn't generate a response"))).toBe(false);
    });

    bot.close();
  });

  it("sends root assistant text without waiting for session.end", async () => {
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let activeSessionId = "s_live_reply";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") return jsonResponse([]);
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 400 + sentMessages.length });
      }

      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: {} as any,
      getSessionId: () => activeSessionId,
      interfaceAgent: "may",
    });

    bus.emit({
      type: "session.start",
      sessionId: activeSessionId,
      agent: "may",
      task: "live reply",
      trigger: "chat",
      firedAt: Date.now(),
      kind: "chat",
      source: "telegram",
    });
    activeSessionId = "";
    bus.emit({
      type: "text",
      sessionId: "s_live_reply",
      agent: "may",
      text: "I received this and started checking it.",
    });

    await waitFor(() => {
      expect(sentMessages.some((m) => m.text.includes("started checking"))).toBe(true);
    });

    bot.close();
  });
});
