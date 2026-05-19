import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../src/app/event-bus.js";
import { attachTelegramBot } from "../src/app/transport/telegram.js";
import { attachCommandRouter } from "../src/app/command-router.js";
import { getDb } from "../src/lib/requests.js";

function jsonResponse(result: unknown) {
  return {
    json: async () => ({ ok: true, result }),
  } as Response;
}

function sessionStart(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.start", source, owner: `agent:${data.agent}`, data };
}

function sessionEnd(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.end", source, owner: `agent:${data.agent}`, data };
}

async function waitFor(assertion: () => void, timeoutMs = 5000): Promise<void> {
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
                  text: "Project needs attention: projects/example",
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
    bus.emit(sessionStart({
      sessionId: activeSessionId,
      agent: "may",
      task: inputs[0],
      trigger: "chat",
      firedAt: Date.now(),
      kind: "chat",
    }) as any);
    activeSessionId = "";
    bus.emit(sessionEnd({
      sessionId: "s_test_reply",
      agent: "may",
      outcome: "done",
      summary: "Actual May answer with the requested details.",
      durationMs: 10,
      status: "done",
      task: inputs[0],
    }) as any);

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

    bus.emit(sessionStart({
      sessionId: activeSessionId,
      agent: "may",
      task: "live reply",
      trigger: "chat",
      firedAt: Date.now(),
      kind: "chat",
    }, "telegram") as any);
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
    const projectDir = join(projectRoot, "projects", "example-project");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "project.md"),
      "---\nid: example-project\nowner: scout\nstatus: pending-review\n---\n\n# Project\n",
      "utf-8",
    );

    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [700, "message.created", "may", null, "projects/example-project", JSON.stringify({ text: "Project needs review" }), Date.now()],
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
    const comments: any[] = [];
    const nudges: any[] = [];
    const inputs: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "project.comment.created") comments.push(event);
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
    const router = attachCommandRouter({
      bus,
      manager: {
        status: () => [],
        cancel: () => {},
        input: async () => ({} as any),
        steer: () => {},
        resumeSession: () => "",
      } as any,
      getChatSession: () => undefined,
      clearCancelLatch: () => {},
      projectRoot,
      reload: () => {},
      restart: () => {},
      shutdown: () => {},
    });

    await waitFor(() => {
      expect(comments).toHaveLength(1);
      expect(comments[0].owner).toBe("agent:scout");
      expect(comments[0].data.projectPath).toBe("projects/example-project");
      expect(nudges).toHaveLength(1);
      expect(nudges[0].owner).toBe("agent:scout");
      expect(nudges[0].data.projectPath).toBe("projects/example-project");
      expect(nudges[0].data.comment).toBe(true);
      expect(inputs).toHaveLength(0);
      expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("please revise the scoped plan");
      expect(sentMessages.some((m) => m.text.includes("Resuming the project now"))).toBe(true);
    });

    bot.close();
    router.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("turns a Telegram reply with stored session context into a steer event", async () => {
    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [900, "message.created", "may", "s_reply_target", null, JSON.stringify({ text: "Session needs input" }), Date.now()],
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
              update_id: 21,
              message: {
                message_id: 901,
                chat: { id: 12345 },
                text: "continue with the smaller plan",
                reply_to_message: {
                  message_id: 900,
                  text: "Session needs input",
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
        return jsonResponse({ message_id: 950 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const steers: any[] = [];
    const inputs: any[] = [];
    const replies: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "steer") steers.push(event);
      if (event.type === "input") inputs.push(event);
      if (event.type === "telegram.reply") replies.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: {} as any,
      getSessionId: () => "",
      interfaceAgent: "may",
    });

    await waitFor(() => {
      expect(steers).toHaveLength(1);
      expect(steers[0]).toMatchObject({
        type: "steer",
        sessionId: "s_reply_target",
        source: "telegram",
      });
      expect(String(steers[0].message)).toContain("continue with the smaller plan");
      expect(inputs).toHaveLength(0);
      expect(replies.some((event) => event.data?.enriched === true && event.data?.hasSessionCtx === true)).toBe(true);
      expect(sentMessages.some((m) => m.text.includes("Reply sent to session s_reply_target"))).toBe(true);
    });

    bot.close();
  });

  it("normalizes Telegram slash commands into daemon events", async () => {
    let getUpdatesCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            { update_id: 31, message: { message_id: 1001, chat: { id: 12345 }, text: "/cancel" } },
            { update_id: 32, message: { message_id: 1002, chat: { id: 12345 }, text: "/reload" } },
            { update_id: 33, message: { message_id: 1003, chat: { id: 12345 }, text: "/close" } },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") return jsonResponse({ message_id: 1100 });
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const events: any[] = [];
    bus.subscribe((event: any) => events.push(event));

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: {} as any,
      getSessionId: () => "s_active_telegram",
      interfaceAgent: "may",
    });

    await waitFor(() => {
      expect(events).toContainEqual({
        type: "session.cancel.requested",
        sessionId: "s_active_telegram",
        source: "telegram",
      });
      expect(events).toContainEqual({ type: "reload", source: "telegram" });
      expect(events).toContainEqual({ type: "shutdown", source: "telegram" });
      expect(events.some((event) => event.type === "input")).toBe(false);
    });

    bot.close();
  });
});
