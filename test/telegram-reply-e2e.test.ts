import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../src/app/event-bus.js";
import { attachTelegramBot } from "../src/app/ui/telegram.js";
import { getDb } from "../src/lib/requests.js";

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

  it("forwards proactive may-to-human messages without an active chat turn", async () => {
    const sentMessages: Array<{ chat_id: string; text: string }> = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") return jsonResponse([]);
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 500 + sentMessages.length });
      }

      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: {} as any,
      getSessionId: () => "",
      interfaceAgent: "may",
    });

    bus.emit({
      type: "message.created",
      from: "may",
      to: "human",
      content: "Metric alert triage needs attention for capability.session-trace-completeness.",
    } as any);

    await waitFor(() => {
      expect(sentMessages.some((m) => m.text.includes("Metric alert triage needs attention"))).toBe(true);
    });

    bot.close();
  });

  it("turns a Telegram reply to a project notification into a project comment nudge", async () => {
    const projectRoot = mkdtempSync(resolve(tmpdir(), "telegram-project-root-"));
    const projectDir = join(projectRoot, "agents", "shared", "projects", "example-project");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "project.md"),
      "---\nid: example-project\nowner: scout\nstatus: pending-review\n---\n\n# Project\n",
      "utf-8",
    );

    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [700, "message.created", "may", null, "agents/shared/projects/example-project", JSON.stringify({ text: "Project needs review" }), Date.now()],
    );

    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 11,
              message: {
                message_id: 701,
                chat: { id: 12345 },
                text: "please revise the scoped plan",
                reply_to_message: {
                  message_id: 700,
                  text: "Project needs review",
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
        return jsonResponse({ message_id: 800 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const nudges: any[] = [];
    const inputs: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "project.nudge") nudges.push(event);
      if (event.type === "input") inputs.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      projectRoot,
      bus,
      manager: {} as any,
      getSessionId: () => "",
      interfaceAgent: "may",
    });

    await waitFor(() => {
      expect(nudges).toHaveLength(1);
      expect(nudges[0].projectPath).toBe("agents/shared/projects/example-project");
      expect(nudges[0].comment).toBe(true);
      expect(inputs).toHaveLength(0);
      expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("please revise the scoped plan");
      expect(sentMessages.some((m) => m.text.includes("Resuming the project now"))).toBe(true);
    });

    bot.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });
});
