import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../../src/app/event-bus.js";
import { createAppInboxItem } from "../../src/app/app-inbox-store.js";
import { attachTelegramBot } from "../../src/app/transport/telegram.js";
import { getDb } from "../../src/lib/requests.js";

function jsonResponse(result: unknown) {
  return {
    json: async () => ({ ok: true, result }),
  } as Response;
}

function sessionStart(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.start", source, owner: `agent:${data.agent}`, data };
}

function attentionReviewManager() {
  return {
    async callAgent(_agent: string, prompt: string) {
      const marker = "Candidate:\n";
      const candidate = JSON.parse(prompt.slice(prompt.lastIndexOf(marker) + marker.length)) as { content: string };
      return {
        status: "done",
        sessionId: "attention-review",
        structuredResult: {
          disposition: "deliver",
          understoodIntent: "Deliver the useful test notification.",
          reason: "The e2e fixture admits this notification.",
          nextAction: "Deliver the reviewed text.",
          evidence: ["E2E admission fixture."],
          deliveredMessage: candidate.content,
        },
      };
    },
  } as any;
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

  it("admits one durable May request for a quoted Telegram reply", async () => {
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;

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
    const conversationMessages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") conversationMessages.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });

    await waitFor(() => {
      expect(conversationMessages).toHaveLength(1);
      expect(conversationMessages[0]).toMatchObject({
        source: "telegram",
        owner: "app:may",
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "human", id: "telegram:12345:200" },
          replyTo: "telegram:12345:100",
          metadata: { channel: "telegram", channelMessageId: 200 },
          context: {
            telegramReply: {
              replyToMsgId: 100,
              conversationId: "may:primary",
              fallback: "telegram-quote",
            },
          },
        },
      });
      const input = String(conversationMessages[0].data?.text);
      expect(input).toContain("[User replying to Telegram message]");
      expect(input).toContain("Project needs attention");
      expect(input).toContain("User says: show details");
    });
    expect(sentMessages).toHaveLength(0);

    bot.close();
  });

  it("renders Telegram work from the shared Conversation and records what the human saw", async () => {
    createAppInboxItem(getDb(persistDir), {
      id: "work-1",
      appId: "may",
      source: { kind: "human", id: "telegram:12345:100" },
      input: { kind: "message", data: { message: "Review the design" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "telegram",
      now: 1,
    });
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount += 1;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            { update_id: 1, message: { message_id: 200, chat: { id: 12345 }, text: "/work" } },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const messages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") messages.push(event);
    });
    const bot = attachTelegramBot({ persistDir, bus, manager: attentionReviewManager(), interfaceAgent: "may" });

    await waitFor(() => {
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]?.text).toContain("Active work:");
      expect(sentMessages[0]?.text).toContain("Review the design — Queued");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "command", id: "telegram" },
          metadata: { channel: "telegram", channelMessageId: 300, command: "/work" },
        },
      });
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
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse([]);
      }
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
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });

    bus.emit(
      sessionStart(
        {
          sessionId: activeSessionId,
          agent: "may",
          task: "live reply",
          trigger: "chat",
          firedAt: Date.now(),
          kind: "chat",
        },
        "telegram",
      ) as any,
    );
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
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse([]);
      }
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
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });

    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        from: "may",
        to: "human",
        content: "Metric alert triage needs attention for capability.session-trace-completeness.",
      },
    });

    await waitFor(() => {
      expect(sentMessages.some((m) => m.text.includes("Metric alert triage needs attention"))).toBe(true);
    });

    bot.close();
  });

  it("forwards approval packets addressed to human:operator and preserves reply context for approval closure", async () => {
    const sentMessages: Array<{ chat_id: string; text: string; reply_parameters?: Record<string, unknown> }> = [];
    let approvalPacketTelegramMsgId: number | null = null;
    let approvalReplyDelivered = false;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        if (!approvalReplyDelivered && approvalPacketTelegramMsgId) {
          approvalReplyDelivered = true;
          return jsonResponse([
            {
              update_id: 9,
              message: {
                message_id: 511,
                chat: { id: 12345 },
                text: "approve",
                reply_to_message: {
                  message_id: approvalPacketTelegramMsgId,
                  text: "📋 Alpha Project approval packet dispatch",
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
        const messageId = 500 + sentMessages.length;
        if (
          approvalPacketTelegramMsgId === null &&
          String(body.text || "").includes("Alpha Project approval packet dispatch")
        ) {
          approvalPacketTelegramMsgId = messageId;
        }
        return jsonResponse({ message_id: messageId });
      }

      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const appInputs: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") appInputs.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });

    bus.emit({
      type: "message.created",
      source: "agent:aks-explorer",
      owner: "human:operator",
      data: {
        from: "aks-explorer",
        to: "human:operator",
        content: "Alpha Project approval packet dispatch",
        projectPath: "projects/alpha-project.app",
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
        packetPath: "evidence/archive/example-approval.md",
        requestedAction: "Approve one bounded replay",
        reason: "Need exact owner decision",
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
        },
      },
    } as any);

    await waitFor(() => {
      expect(sentMessages.some((m) => m.text.includes("Alpha Project approval packet dispatch"))).toBe(true);
    });

    await waitFor(() => {
      expect(appInputs).toHaveLength(1);
      const inputText = String(appInputs[0].data?.text ?? "");
      expect(inputText).toBe("approve");
      expect(inputText).not.toContain("Conversation: approval:approval-123");
      expect(inputText).not.toContain("Approval id:");
      expect(appInputs[0].data?.conversationId).toBe("may:primary");
      expect(appInputs[0].data?.context?.telegramReply).toMatchObject({
        conversationId: "may:primary",
        requestConversationId: "approval:approval-123",
        expectedClosure: ["project.approval.submitted"],
      });
      expect(appInputs[0].data?.context?.suggestedTarget).toMatchObject({
        agent: "may",
        projectPath: "projects/alpha-project.app",
      });
      expect(sentMessages).toHaveLength(1);
    });

    bot.close();
  });

  it("keeps approval replies as May requests for interpretation", async () => {
    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        650,
        "message.created",
        "aks-explorer",
        "s_approval_source",
        "projects/alpha-project.app",
        JSON.stringify({
          text: "Alpha Project approval packet dispatch",
          conversationId: "approval:approval-650",
          originalIssue: {
            eventType: "project.approval.requested",
            approvalKind: "approval-packet-dispatch",
            approvalId: "approval-650",
            waitId: "wait-650",
            pathId: "path.network.example",
            packetPath: "evidence/archive/example-approval.md",
            requestedAction: "Approve one bounded replay",
            reason: "Need exact owner decision",
          },
          expectedClosure: ["project.approval.submitted"],
        }),
        Date.now(),
      ],
    );

    const sentMessages: Array<{ chat_id: string; text: string; reply_parameters?: Record<string, unknown> }> = [];
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
              update_id: 9,
              message: {
                message_id: 651,
                chat: { id: 12345 },
                text: "approve",
                reply_to_message: {
                  message_id: 650,
                  text: "Alpha Project approval packet dispatch",
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
        return jsonResponse({ message_id: 700 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const steers: any[] = [];
    const chatStarts: any[] = [];
    const appInputs: any[] = [];
    const comments: any[] = [];
    const approvals: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "session.steer.requested") steers.push(event);
      if (event.type === "chat.start.requested") chatStarts.push(event);
      if (event.type === "conversation.message.created") appInputs.push(event);
      if (event.type === "project.comment.created") comments.push(event);
      if (event.type === "project.approval.submitted") approvals.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });
    await waitFor(() => {
      expect(appInputs).toHaveLength(1);
      expect(String(appInputs[0].data?.text)).toBe("approve");
      expect(appInputs[0].data?.conversationId).toBe("may:primary");
      expect(appInputs[0].data?.context?.suggestedTarget).toMatchObject({
        agent: "may",
        projectPath: "projects/alpha-project.app",
      });
      expect(appInputs[0].data?.context?.telegramReply).toMatchObject({
        requestConversationId: "approval:approval-650",
        expectedClosure: ["project.approval.submitted"],
        sessionId: "s_approval_source",
      });
      expect(steers).toHaveLength(0);
      expect(chatStarts).toHaveLength(0);
      expect(comments).toHaveLength(0);
      expect(approvals).toHaveLength(0);
      expect(sentMessages).toHaveLength(0);
    });

    bot.close();
  });

  it("enriches a project notification reply and sends it to May", async () => {
    const projectRoot = mkdtempSync(resolve(tmpdir(), "telegram-project-root-"));

    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        700,
        "message.created",
        "may",
        null,
        "projects/example-project",
        JSON.stringify({
          text: "Project needs review",
          conversationId: "tg_project_review_1",
          conversation: {
            originalIssue: {
              eventType: "project.review.requested",
              projectPath: "projects/example-project",
              taskId: "review-plan",
            },
            lastHandledBy: { agent: "may", sessionId: "s_project_review" },
          },
        }),
        Date.now(),
      ],
    );
    const sentMessages: Array<{ chat_id: string; text: string; reply_parameters?: Record<string, unknown> }> = [];
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
    const chatStarts: any[] = [];
    const appInputs: any[] = [];
    const comments: any[] = [];
    const steers: any[] = [];
    let activeChatSessionId = "";
    bus.subscribe((event: any) => {
      if (event.type === "chat.start.requested") chatStarts.push(event);
      if (event.type === "conversation.message.created") appInputs.push(event);
      if (event.type === "project.comment.created") comments.push(event);
      if (event.type === "session.steer.requested") steers.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      projectRoot,
      bus,
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });
    await waitFor(() => {
      expect(chatStarts).toHaveLength(0);
      expect(appInputs).toHaveLength(1);
      const appMessage = String(appInputs[0].data?.text);
      expect(appMessage).toBe("please revise the scoped plan");
      expect(appInputs[0].data?.conversationId).toBe("may:primary");
      expect(appInputs[0].data?.context?.telegramReply).toMatchObject({
        conversationId: "may:primary",
        requestConversationId: "tg_project_review_1",
        taskId: "review-plan",
        projectId: "projects/example-project",
        originalIssue: { eventType: "project.review.requested" },
        notification: { text: "Project needs review" },
      });
      expect(comments).toHaveLength(0);
      expect(steers).toHaveLength(0);
      expect(sentMessages).toHaveLength(0);
    });

    activeChatSessionId = "s_canonical_may";
    bus.emit(
      sessionStart(
        {
          sessionId: activeChatSessionId,
          agent: "may",
          task: String(appInputs[0].data?.text),
          trigger: "chat",
          firedAt: Date.now(),
          kind: "chat",
          channelMessageId: 701,
          conversationId: "may:primary",
        },
        "telegram",
      ) as any,
    );
    bus.emit({
      type: "text",
      sessionId: activeChatSessionId,
      agent: "may",
      text: "I updated the scoped plan with your feedback.",
    } as any);

    await waitFor(() => {
      expect(
        sentMessages.some(
          (m) => m.text.includes("updated the scoped plan") && (m.reply_parameters as any)?.message_id === 701,
        ),
      ).toBe(true);
    });

    bot.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("enriches a Telegram reply with stored session context and sends it to May", async () => {
    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        900,
        "message.created",
        "may",
        "s_reply_target",
        null,
        JSON.stringify({
          text: "Session needs input",
          conversationId: "tg_session_input_1",
          conversation: {
            originalIssue: { eventType: "session.blocked", sourceSessionId: "s_reply_target" },
            lastHandledBy: { agent: "may", sessionId: "s_reply_target" },
          },
        }),
        Date.now(),
      ],
    );
    const sessionDir = join(persistDir, "sessions", "s_reply_target");
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      join(sessionDir, "session-compact.jsonl"),
      [
        JSON.stringify({ role: "system", content: [{ type: "text", text: "Original session summary" }] }),
        JSON.stringify({ role: "assistant", content: [{ type: "text", text: "Waiting for human direction" }] }),
      ].join("\n"),
    );

    const sentMessages: Array<{ chat_id: string; text: string; reply_parameters?: Record<string, unknown> }> = [];
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
    const chatStarts: any[] = [];
    const appInputs: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "session.steer.requested") steers.push(event);
      if (event.type === "chat.start.requested") chatStarts.push(event);
      if (event.type === "conversation.message.created") appInputs.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });
    await waitFor(() => {
      expect(steers).toHaveLength(0);
      expect(chatStarts).toHaveLength(0);
      expect(appInputs).toHaveLength(1);
      const appMessage = String(appInputs[0].data?.text);
      expect(appMessage).toBe("continue with the smaller plan");
      expect(appInputs[0].data?.conversationId).toBe("may:primary");
      expect(appInputs[0].data?.context?.telegramReply).toMatchObject({
        conversationId: "may:primary",
        requestConversationId: "tg_session_input_1",
        sessionId: "s_reply_target",
        originalIssue: { eventType: "session.blocked", sourceSessionId: "s_reply_target" },
        notification: { text: "Session needs input" },
      });
      expect(sentMessages).toHaveLength(0);
    });

    bot.close();
  });

  it("routes escalation notification replies through May instead of steering the source session", async () => {
    const db = getDb(persistDir);
    db.run(
      "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        1200,
        "message.created",
        "evaluator",
        "s_escalation_source",
        "projects/alpha-project.app",
        JSON.stringify({
          text: "Approval return path needs a human decision.",
          conversationId: "escalation:esc_1",
          originalIssue: {
            eventType: "escalation.created",
            escalationId: "esc_1",
            sourceSessionId: "s_escalation_source",
            projectPath: "projects/alpha-project.app",
            reason: "Approval return path is not visibly closing.",
            requestedAction: "Approve retry or dismiss the escalation.",
          },
          expectedClosure: ["escalation.resolved", "escalation.dismissed"],
        }),
        Date.now(),
      ],
    );

    const sentMessages: Array<{ chat_id: string; text: string; reply_parameters?: Record<string, unknown> }> = [];
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
              update_id: 41,
              message: {
                message_id: 1201,
                chat: { id: 12345 },
                text: "approve retry",
                reply_to_message: {
                  message_id: 1200,
                  text: "Approval return path needs a human decision.",
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
        return jsonResponse({ message_id: 1250 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const chatStarts: any[] = [];
    const appInputs: any[] = [];
    const steers: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "chat.start.requested") chatStarts.push(event);
      if (event.type === "conversation.message.created") appInputs.push(event);
      if (event.type === "session.steer.requested") steers.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });
    await waitFor(() => {
      expect(steers).toHaveLength(0);
      expect(chatStarts).toHaveLength(0);
      expect(appInputs).toHaveLength(1);
      const appMessage = String(appInputs[0].data?.text);
      expect(appMessage).toBe("approve retry");
      expect(appInputs[0].data?.conversationId).toBe("may:primary");
      expect(appInputs[0].data?.context?.telegramReply).toMatchObject({
        requestConversationId: "escalation:esc_1",
        sessionId: "s_escalation_source",
        expectedClosure: ["escalation.resolved", "escalation.dismissed"],
        originalIssue: {
          eventType: "escalation.created",
          escalationId: "esc_1",
          sourceSessionId: "s_escalation_source",
        },
      });
      expect(sentMessages).toHaveLength(0);
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
            {
              update_id: 31,
              message: { message_id: 1001, chat: { id: 12345 }, text: "/cancel s_active_telegram" },
            },
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
      manager: attentionReviewManager(),
      interfaceAgent: "may",
    });

    await waitFor(() => {
      expect(events).toContainEqual({
        type: "session.cancel.requested",
        source: "telegram",
        owner: "agent:may",
        urgency: "high",
        data: { sessionId: "s_active_telegram" },
      });
      expect(events).toContainEqual({
        type: "runtime.reload.requested",
        source: "telegram",
        owner: "agent:may",
        data: {},
      });
      expect(events).toContainEqual({
        type: "runtime.shutdown.requested",
        source: "telegram",
        owner: "agent:may",
        urgency: "high",
        data: {},
      });
      expect(events.some((event) => event.type === "input")).toBe(false);
    });

    bot.close();
  });
});
