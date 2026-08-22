/**
 * Telegram Bot UI — native Telegram bot integration for May.
 *
 * Uses the Telegram Bot API directly via fetch (no external dependencies).
 * Long-polling for incoming messages and rendering the shared Conversation.
 *
 * Configuration (env vars):
 *   TELEGRAM_BOT_TOKEN  — Bot token from @BotFather (required to enable)
 *   TELEGRAM_CHAT_ID    — Allowed chat ID(s), comma-separated (required for security)
 *
 * Features:
 *   - Incoming messages → May Conversation events
 *   - Unseen Conversation messages → Telegram messages
 *   - Long messages split at 4096 char Telegram limit
 *   - Task-focused /apps, /tasks, /task, /watch, and /cancel commands
 *   - Authentication: only accepts messages from allowed chat IDs
 */

import { setDefaultAutoSelectFamily } from "node:net";
import type { AppConversationMessage, AppWorkView } from "@may-agent/sdk";
import { EVENT_ROW_ID, type AgentEvent, type EventBus, type EventTrace } from "../event-bus.js";
import { getDb } from "../../lib/requests.js";
import { storeNotificationMessage } from "../../lib/db/notifications.js";
import { readAppConversationResource } from "../app-inbox-store.js";
import { createTelegramClient } from "./telegram-client.js";
import { normalizeEventOwner } from "../../../packages/control/src/event-envelope.js";
import { TASK_UPDATE_EVENT_TYPES, taskUpdateIdentity } from "../../../packages/control/src/task-wake.js";
import type { HumanAppView, HumanTaskService, HumanTaskView } from "../human-task-service.js";

// Force IPv4 for fetch — Node 22's undici tries IPv6 first which times out
// on some networks (e.g., when IPv6 to api.telegram.org is unreachable).
try {
  setDefaultAutoSelectFamily(false);
} catch {
  /* noop — bun may not support */
}

export interface TelegramBotOptions {
  persistDir?: string;
  bus: EventBus;
  interfaceAgent: string;
  humanTasks: HumanTaskService;
}

export interface TelegramBot {
  close: () => void;
}

/** One logical human conversation; provider chat/topic IDs are coordinates. */
export function primaryConversationId(agent: string): string {
  return `${agent.trim() || "may"}:primary`;
}

function workStateLabel(state: unknown): string {
  const labels: Record<string, string> = {
    queued: "Queued",
    working: "Working",
    analyzing: "Analyzing",
    waiting: "Waiting",
    ready: "Ready",
    done: "Done",
  };
  return typeof state === "string" ? (labels[state] ?? "Working") : "Working";
}

function renderTelegramWorkList(work: AppWorkView[], all: boolean): string {
  const title = all ? "All work (newest first):" : "Active work:";
  if (work.length === 0) return `${title} nothing.`;
  return [
    title,
    ...work.flatMap((item, index) => {
      const result = item.result?.response?.trim() || item.result?.summary?.trim();
      const baseline = item.startedAt ?? item.createdAt;
      const changed = item.changedAt > baseline ? ` · changed ${formatWorkAge(item.changedAt)}` : "";
      return [
        `${index + 1}. ${item.message} — ${workStateLabel(item.state)} · ${formatWorkAge(baseline)}${changed}`,
        ...(item.progress ? [`   ${item.progress}`] : []),
        ...(result ? [`   Result: ${result}`] : []),
      ];
    }),
  ].join("\n");
}

function renderTelegramWorkDetail(item: AppWorkView, index: number): string {
  const result = item.result?.response?.trim() || item.result?.summary?.trim();
  const executor = formatWorkRef(item.executor);
  const dependency = formatWorkRef(item.dependency);
  return [
    `Work ${index + 1}:`,
    `Request: ${item.message}`,
    `Status: ${workStateLabel(item.state)}`,
    ...(item.progress ? [`Progress: ${item.progress}`] : []),
    ...(result ? [`Result:\n${result}`] : []),
    `Created: ${formatWorkTime(item.createdAt)}`,
    ...(item.startedAt === undefined ? [] : [`Started: ${formatWorkTime(item.startedAt)}`]),
    `Changed: ${formatWorkTime(item.changedAt)}`,
    ...(executor ? [`Execution: ${executor}`] : []),
    ...(dependency ? [`Waiting on: ${dependency}`] : []),
  ].join("\n");
}

export function renderTelegramApps(apps: HumanAppView[]): string {
  if (apps.length === 0) return "No Apps found.";
  return [
    "Apps:",
    ...apps.map((app) => {
      const states = [
        `${app.activeTasks} active`,
        ...(app.runningTasks ? [`${app.runningTasks} running`] : []),
        ...(app.waitingTasks ? [`${app.waitingTasks} waiting`] : []),
        ...(app.attentionTasks ? [`${app.attentionTasks} attention`] : []),
      ];
      return `• ${app.id} — ${states.join(" · ")}`;
    }),
  ].join("\n");
}

export function renderTelegramTasks(tasks: HumanTaskView[], includeDone: boolean, hasMore = false): string {
  if (tasks.length === 0) return includeDone ? "No active or recent Tasks." : "No active Tasks.";
  return [
    includeDone ? "Tasks (active and recent):" : "Active Tasks:",
    ...tasks.flatMap((task) => {
      const result = task.response?.trim() || task.summary?.trim();
      return [
        `• ${task.ref} · ${task.appId} · ${task.status}\n  ${task.outcome}`,
        ...(task.terminal && result ? [`  ${result}`] : []),
      ];
    }),
    ...(hasMore ? ["More Tasks are available; use /tasks more for the next page."] : []),
  ].join("\n");
}

export function renderTelegramTask(task: HumanTaskView): string {
  const result = task.response?.trim() || task.summary?.trim();
  return [
    `Task ${task.ref}`,
    `App: ${task.appId}`,
    `ID: ${task.taskId}`,
    `Status: ${task.status}`,
    `Outcome: ${task.outcome}`,
    `Updated: ${formatWorkTime(task.updatedAt)}`,
    ...(result ? [task.terminal ? `Result:\n${result}` : `Progress:\n${result}`] : []),
  ].join("\n");
}

function formatWorkTime(value: number): string {
  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function formatWorkAge(value: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - value) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function formatWorkRef(ref: AppWorkView["executor"]): string | undefined {
  return ref ? `${ref.kind}:${ref.id}` : undefined;
}

function renderTelegramConversationMessage(message: AppConversationMessage): string {
  const channel = message.metadata?.channel?.trim() || "another surface";
  if (channel === "telegram" && message.author.kind === "agent") return message.text;
  const surface = channel === "may-console" ? "Console" : channel;
  const speaker =
    message.author.kind === "human"
      ? "You"
      : message.author.kind === "agent"
        ? "May"
        : message.author.kind === "command"
          ? "View"
          : "Tool";
  return `${surface} · ${speaker}\n${message.text}`;
}

export function telegramMayInputEvent(input: {
  message: string;
  chatId: string;
  messageId: number;
  conversationId: string;
  topicId?: string | number;
  replyToMessageId?: number;
  context?: Record<string, unknown>;
  trace?: EventTrace;
}): AgentEvent {
  const sourceId = `telegram:${input.chatId}:${input.messageId}`;
  return {
    type: "conversation.message.created",
    source: "telegram",
    owner: "app:may",
    data: {
      appId: "may",
      conversationId: input.conversationId,
      author: { kind: "human", id: sourceId },
      text: input.message,
      ...(input.context ? { context: input.context } : {}),
      ...(input.replyToMessageId === undefined
        ? {}
        : { replyTo: `telegram:${input.chatId}:${input.replyToMessageId}` }),
      metadata: {
        channel: "telegram",
        channelTargetId: input.chatId,
        ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
        channelMessageId: input.messageId,
      },
      idempotencyKey: sourceId,
    },
    ...(input.trace ? { trace: input.trace } : {}),
  };
}

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus } = opts;

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const allowedChatIds = (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const pendingChatId: string | null = allowedChatIds[0] || null;
  const persistDir = opts.persistDir ?? ".state";

  if (!token) {
    bus.emit({ type: "info", message: "[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled" });
    return { close: () => {} };
  }

  if (allowedChatIds.length === 0) {
    bus.emit({
      type: "info",
      message: "[telegram] TELEGRAM_CHAT_ID not set — bot disabled (security: must specify allowed chat IDs)",
    });
    return { close: () => {} };
  }

  bus.emit({ type: "info", message: `[telegram] Bot enabled (${allowedChatIds.length} allowed chat(s))` });
  let running = true;
  let offset = 0;
  const telegramClient = createTelegramClient({
    token,
    persistDir: opts.persistDir ?? ".state",
    emitInfo: (message) => bus.emit({ type: "info", message }),
  });
  const { apiCall, sendMessage } = telegramClient;
  const lastWorkBySurface = new Map<string, AppWorkView[]>();
  const watchedTasks = new Map<
    string,
    { appId: string; taskId: string; ref: string; chatId: string; topicId?: number }
  >();
  const nextTaskPageBySurface = new Map<string, { appId?: string; includeDone: boolean; cursor: string }>();
  const pendingReloads = new Map<
    string,
    { chatId: string; topicId?: number; conversationId: string; command: string }
  >();
  const watchReads = new Set<string>();
  const dirtyWatches = new Set<string>();
  const surfaceKey = (chatId: string, topicId?: number) => `${chatId}:${topicId ?? 0}`;
  const sharedConversationId = primaryConversationId(opts.interfaceAgent);
  const renderedConversationMessages = new Set<string>();
  const rememberRenderedConversationMessage = (messageId: string): void => {
    renderedConversationMessages.add(messageId);
    // Conversation reads contain at most 200 messages. Keeping more than two
    // windows prevents replay without letting an append-only Conversation grow
    // this adapter's heap forever.
    while (renderedConversationMessages.size > 512) {
      const oldest = renderedConversationMessages.values().next().value;
      if (typeof oldest !== "string") break;
      renderedConversationMessages.delete(oldest);
    }
  };
  try {
    for (const message of readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
      limit: 200,
      includeWork: false,
    }).messages) {
      rememberRenderedConversationMessage(message.id);
    }
  } catch {
    // The Conversation may not be available until App runtime startup finishes.
  }
  let conversationSyncRunning = false;
  let conversationSyncDirty = false;
  let conversationSyncScheduled = false;

  async function syncConversation(): Promise<void> {
    const messages = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
      limit: 200,
      includeWork: false,
    }).messages;
    for (const message of messages) {
      if (renderedConversationMessages.has(message.id)) continue;
      if (message.metadata?.channel === "telegram" && message.author.kind !== "agent") {
        rememberRenderedConversationMessage(message.id);
        continue;
      }
      const targetChatId = message.metadata?.channelTargetId ?? pendingChatId;
      if (!targetChatId) return;
      const threadId = message.metadata?.channelThreadId;
      const delivered = await sendMessage(targetChatId, renderTelegramConversationMessage(message), undefined, {
        eventType: "conversation.mirror",
        agent: message.author.kind === "agent" ? opts.interfaceAgent : message.author.id,
        ...(threadId && /^[1-9]\d*$/.test(threadId) ? { messageThreadId: Number(threadId) } : {}),
        ...(message.metadata?.channelMessageId ? { replyToMessageId: message.metadata.channelMessageId } : {}),
        data: JSON.stringify({
          direction: "mirror",
          conversationId: sharedConversationId,
          conversationMessageId: message.id,
          sourceChannel: message.metadata?.channel,
          text: message.text.slice(0, 500),
        }),
      });
      if (!delivered) return;
      rememberRenderedConversationMessage(message.id);
    }
  }

  function queueConversationSync(): void {
    if (!running) return;
    if (conversationSyncRunning) {
      conversationSyncDirty = true;
      return;
    }
    if (conversationSyncScheduled) return;
    conversationSyncScheduled = true;
    // EventBus listeners drain a bounded FIFO asynchronously. Defer the read
    // by one turn so a burst of wake-only events collapses before touching the
    // Conversation resource. An update observed during I/O still requests one
    // dirty retry below.
    setImmediate(() => {
      conversationSyncScheduled = false;
      if (!running) return;
      if (conversationSyncRunning) {
        conversationSyncDirty = true;
        return;
      }
      conversationSyncRunning = true;
      void syncConversation()
        .catch((error) => {
          bus.emit({
            type: "info",
            message: `[telegram] Conversation sync failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        })
        .finally(() => {
          conversationSyncRunning = false;
          if (conversationSyncDirty) {
            conversationSyncDirty = false;
            queueConversationSync();
          }
        });
    });
  }

  async function refreshWatch(surface: string): Promise<void> {
    const watched = watchedTasks.get(surface);
    if (!watched) return;
    if (watchReads.has(surface)) {
      dirtyWatches.add(surface);
      return;
    }
    watchReads.add(surface);
    try {
      const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
      if (!task) {
        watchedTasks.delete(surface);
        await sendMessage(watched.chatId, `Task ${watched.ref} is no longer available; watch ended.`, undefined, {
          messageThreadId: watched.topicId,
        });
        return;
      }
      await sendMessage(watched.chatId, renderTelegramTask(task), undefined, {
        eventType: "task.watch",
        agent: opts.interfaceAgent,
        messageThreadId: watched.topicId,
      });
      if (task.terminal) watchedTasks.delete(surface);
    } finally {
      watchReads.delete(surface);
      if (dirtyWatches.delete(surface) && watchedTasks.has(surface)) void refreshWatch(surface);
    }
  }

  const unsubscribeConversation = bus.listen(
    (event: any) => {
      const data = event && typeof event.data === "object" && event.data ? event.data : {};
      if (event.type === "runtime.reload.finished") {
        const requestId = typeof data.requestId === "string" ? data.requestId : "";
        const pending = pendingReloads.get(requestId);
        if (!pending) return;
        pendingReloads.delete(requestId);
        void sendMessage(pending.chatId, String(data.summary || "[reload] Finished"), undefined, {
          eventType: "runtime.reload.finished",
          agent: opts.interfaceAgent,
          messageThreadId: pending.topicId,
        }).then((messageId) => {
          if (!messageId) return;
          recordConversationMessage({
            conversationId: pending.conversationId,
            text: String(data.summary || "[reload] Finished"),
            command: pending.command,
            messageId,
            chatId: pending.chatId,
            topicId: pending.topicId,
          });
        });
        return;
      }
      if (event.type === "conversation.updated") {
        if (data.appId === opts.interfaceAgent && data.conversationId === sharedConversationId) queueConversationSync();
        return;
      }
      const wake = taskUpdateIdentity(event);
      if (!wake) return;
      for (const [surface, watched] of watchedTasks) {
        if (watched.appId === wake.appId && watched.taskId === wake.taskId) void refreshWatch(surface);
      }
    },
    {
      label: "telegram-conversation",
      types: ["conversation.updated", "runtime.reload.finished", ...TASK_UPDATE_EVENT_TYPES],
    },
  );

  function recordConversationMessage(input: {
    conversationId: string;
    text: string;
    command: string;
    messageId: number;
    topicId?: number;
    chatId?: string;
    transient?: boolean;
    requestIds?: string[];
    taskRefs?: Array<{ appId: string; taskId: string }>;
  }): void {
    bus.emit({
      type: "conversation.message.created",
      source: "telegram",
      owner: `app:${opts.interfaceAgent}`,
      data: {
        appId: opts.interfaceAgent,
        conversationId: input.conversationId,
        author: { kind: "command", id: "telegram" },
        text: input.text,
        ...(input.transient ? { transient: true } : {}),
        metadata: {
          channel: "telegram",
          ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
          channelMessageId: input.messageId,
          command: input.command,
          ...(input.requestIds?.length ? { requestIds: input.requestIds } : {}),
          ...(input.taskRefs?.length ? { taskRefs: input.taskRefs } : {}),
        },
        idempotencyKey: `telegram:${input.chatId ?? "unknown"}:conversation:${input.messageId}:${input.command}`,
      },
    });
  }

  function emitChatStart(
    message: string,
    channelMessageId?: number,
    context?: Record<string, unknown>,
    chatId?: string,
    topicId?: string | number,
    conversationId?: string,
    replyToMsgId?: number,
  ): void {
    if (!channelMessageId || !chatId || !conversationId) return;
    const received = bus.emit(
      telegramMayInputEvent({
        message,
        chatId,
        messageId: channelMessageId,
        conversationId,
        topicId,
        replyToMessageId: replyToMsgId,
        context: {
          ...(context ?? {}),
        },
      }),
    );

    const rowId = received[EVENT_ROW_ID];
    try {
      storeNotificationMessage(persistDir, {
        telegram_msg_id: channelMessageId,
        event_type: "conversation.message.created",
        agent: opts.interfaceAgent,
        session_id: null,
        project_id: null,
        data: JSON.stringify({
          direction: "inbound",
          conversationId,
          chatId,
          topicId: topicId ?? 0,
          replyToMsgId,
          traceId: rowId ? `event:${rowId}` : undefined,
          sourceEventId: rowId,
          text: message.slice(0, 500),
        }),
      });
    } catch {
      /* best-effort transport index; canonical input is already durable */
    }
  }

  // ── Incoming message handling ────────────────────────────────────

  function isAllowed(chatId: number): boolean {
    return allowedChatIds.includes(String(chatId));
  }

  async function handleMessage(msg: any): Promise<void> {
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!chatId || !text) return;

    if (!isAllowed(chatId)) {
      bus.emit({ type: "info", message: `[telegram] Rejected message from unauthorized chat ${chatId}` });
      await sendMessage(String(chatId), "⛔ Unauthorized. This bot is private.");
      return;
    }

    const chatIdStr = String(chatId);
    const topicId = msg.message_thread_id as number | undefined;
    const conversationId = primaryConversationId(opts.interfaceAgent);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    // Keep the human text authoritative. A reply contributes only its provider
    // anchor and bounded quoted text; Conversation and Task resources own the
    // semantic context.
    let inputContext: Record<string, unknown> | undefined;
    const replyToMsg = msg.reply_to_message;
    const replyToMsgId = replyToMsg?.message_id;
    if (replyToMsgId) {
      const quotedText = telegramMessageText(replyToMsg).slice(0, 2_000);
      inputContext = {
        reply: {
          channel: "telegram",
          messageId: replyToMsgId,
          ...(quotedText ? { quotedText } : {}),
        },
      };
    }

    if (await handleTelegramCommand(text, chatIdStr, msg, conversationId, topicId, replyToMsgId)) {
      return;
    }

    // Every ordinary turn becomes one durable May request.
    const focusedTask = watchedTasks.get(surfaceKey(chatIdStr, topicId));
    if (focusedTask) {
      inputContext = {
        ...(inputContext ?? {}),
        focusedTask: { appId: focusedTask.appId, taskId: focusedTask.taskId },
      };
    }
    emitChatStart(text, msg.message_id, inputContext, chatIdStr, topicId, conversationId, replyToMsgId);
  }

  async function handleTelegramCommand(
    text: string,
    chatIdStr: string,
    msg: any,
    conversationId: string,
    topicId?: number,
    replyToMsgId?: number,
  ): Promise<boolean> {
    if (!text.startsWith("/")) return false;

    const [cmd = "", ...rest] = text.split(/\s+/);
    const command = cmd.split("@")[0];
    const surface = surfaceKey(chatIdStr, topicId);

    const deliverCommandView = async (
      rendered: string,
      taskRefs: Array<{ appId: string; taskId: string }> = [],
    ): Promise<void> => {
      const deliveredMessageId = await sendMessage(chatIdStr, rendered, undefined, {
        eventType: "telegram.reply",
        agent: opts.interfaceAgent,
        data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
        replyToMessageId: msg.message_id,
        messageThreadId: topicId,
      });
      if (deliveredMessageId) {
        recordConversationMessage({
          conversationId,
          text: rendered,
          command: text,
          messageId: deliveredMessageId,
          chatId: chatIdStr,
          topicId,
          taskRefs,
        });
      }
    };

    if (command === "/apps") {
      if (rest.length > 1) await deliverCommandView("Use: /apps [app]");
      else await deliverCommandView(renderTelegramApps(opts.humanTasks.listApps(rest[0])));
      return true;
    }

    if (command === "/tasks") {
      const more = rest.length === 1 && rest[0].toLowerCase() === "more";
      const prior = more ? nextTaskPageBySurface.get(surface) : undefined;
      if (more && !prior) {
        await deliverCommandView("No next page. Use /tasks first.");
        return true;
      }
      const includeDone = prior?.includeDone ?? rest.some((part) => part.toLowerCase() === "all");
      const appIds = more ? [] : rest.filter((part) => part.toLowerCase() !== "all");
      if (appIds.length > 1) {
        await deliverCommandView("Use: /tasks [app] [all], or /tasks more");
        return true;
      }
      const appId = prior?.appId ?? appIds[0];
      const page = opts.humanTasks.listTasks({
        ...(appId ? { appId } : {}),
        includeDone,
        limit: 30,
        ...(prior?.cursor ? { cursor: prior.cursor } : {}),
      });
      if (page.nextCursor) {
        nextTaskPageBySurface.set(surface, { ...(appId ? { appId } : {}), includeDone, cursor: page.nextCursor });
      } else {
        nextTaskPageBySurface.delete(surface);
      }
      await deliverCommandView(
        renderTelegramTasks(page.items, includeDone, Boolean(page.nextCursor)),
        page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
      );
      return true;
    }

    if (command === "/task") {
      if (rest.length !== 1) {
        await deliverCommandView("Use: /task <ref>");
        return true;
      }
      const task = opts.humanTasks.getTask({ ref: rest[0] });
      await deliverCommandView(
        task ? renderTelegramTask(task) : `Task ${rest[0]} was not found.`,
        task ? [{ appId: task.appId, taskId: task.taskId }] : [],
      );
      return true;
    }

    if (command === "/watch") {
      if (rest.length > 1) {
        await deliverCommandView("Use: /watch [ref]");
        return true;
      }
      if (rest.length === 0) {
        const watched = watchedTasks.get(surface);
        if (!watched) await deliverCommandView("No Task is watched. Use /watch <ref>.");
        else {
          const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
          await deliverCommandView(
            task ? renderTelegramTask(task) : `Task ${watched.ref} was not found; watch ended.`,
            task ? [{ appId: task.appId, taskId: task.taskId }] : [],
          );
          if (!task || task.terminal) watchedTasks.delete(surface);
        }
        return true;
      }
      const task = opts.humanTasks.getTask({ ref: rest[0] });
      if (!task) {
        await deliverCommandView(`Task ${rest[0]} was not found.`);
      } else if (task.terminal) {
        watchedTasks.delete(surface);
        await deliverCommandView(`${renderTelegramTask(task)}\n\nThis Task is terminal, so it was not watched.`, [
          { appId: task.appId, taskId: task.taskId },
        ]);
      } else {
        watchedTasks.set(surface, {
          appId: task.appId,
          taskId: task.taskId,
          ref: task.ref,
          chatId: chatIdStr,
          ...(topicId === undefined ? {} : { topicId }),
        });
        await deliverCommandView(
          `${renderTelegramTask(task)}\n\nWatching ${task.ref}. Replies are Task feedback through May.`,
          [{ appId: task.appId, taskId: task.taskId }],
        );
      }
      return true;
    }

    if (command === "/unwatch") {
      if (rest.length > 0) await deliverCommandView("Use: /unwatch");
      else if (watchedTasks.delete(surface)) await deliverCommandView("Stopped watching. The Task is unchanged.");
      else await deliverCommandView("No Task is watched.");
      return true;
    }

    if (command === "/cancel") {
      if (rest.length > 1) {
        await deliverCommandView("Use: /cancel [ref]");
        return true;
      }
      const watched = watchedTasks.get(surface);
      if (!rest[0] && !watched) {
        await deliverCommandView("Use: /cancel <ref>, or watch a Task first.");
        return true;
      }
      try {
        const task = opts.humanTasks.cancelTask(
          rest[0]
            ? { ref: rest[0], reason: "human requested cancellation from Telegram" }
            : {
                appId: watched!.appId,
                taskId: watched!.taskId,
                reason: "human requested cancellation from Telegram",
              },
        );
        watchedTasks.delete(surface);
        await deliverCommandView(renderTelegramTask(task), [{ appId: task.appId, taskId: task.taskId }]);
      } catch (error) {
        await deliverCommandView(`[cancel] ${error instanceof Error ? error.message : String(error)}`);
      }
      return true;
    }

    if (command === "/work") {
      const argument = rest.join(" ").trim().toLowerCase();
      let rendered: string;
      let renderedRequestIds: string[] = [];
      if (!argument || argument === "all") {
        const all = argument === "all";
        const work =
          readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
            limit: all ? 100 : 50,
            allWork: all,
          }).work ?? [];
        lastWorkBySurface.set(surface, work);
        renderedRequestIds = work.map((item) => item.requestId);
        rendered = renderTelegramWorkList(work, all);
      } else if (/^[1-9]\d*$/.test(argument)) {
        const index = Number(argument) - 1;
        const selected = lastWorkBySurface.get(surface)?.[index];
        if (!selected) {
          rendered = `No work item ${argument}. Use /work or /work all to refresh the list.`;
        } else {
          const refreshed = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
            limit: 1,
            allWork: true,
            workRequestId: selected.requestId,
          }).work?.[0];
          rendered = refreshed
            ? renderTelegramWorkDetail(refreshed, index)
            : `Work ${argument} was not found. Use /work all to refresh the list.`;
          if (refreshed) renderedRequestIds = [refreshed.requestId];
        }
      } else {
        rendered = "Use: /work, /work all, or /work <number>";
      }
      const deliveredMessageId = await sendMessage(chatIdStr, rendered, undefined, {
        eventType: "telegram.reply",
        agent: opts.interfaceAgent,
        data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
        replyToMessageId: msg.message_id,
        messageThreadId: topicId,
      });
      if (deliveredMessageId) {
        recordConversationMessage({
          conversationId,
          text: rendered,
          command: text,
          messageId: deliveredMessageId,
          chatId: chatIdStr,
          topicId,
          requestIds: renderedRequestIds,
        });
      }
      return true;
    }

    if (command === "/start" || command === "/help") {
      await sendMessage(
        chatIdStr,
        "🤖 *May Agent Bot*\n\n" +
          "Send any message to interact with May.\n\n" +
          "*Commands:*\n" +
          "/apps \[app\] — Show Apps and active Task counts\n" +
          "/tasks \[app\] \[all\], /tasks more — Show Tasks\n" +
          "/task <ref> — Show one Task\n" +
          "/watch \[ref\] — Watch or show one Task\n" +
          "/unwatch — Stop watching without changing the Task\n" +
          "/cancel \[ref\] — Cancel a Task\n" +
          "/reload — Reload agent configs\n" +
          "/help — Show this message",
        "Markdown",
        { messageThreadId: topicId },
      );
      return true;
    }

    if (command === "/reload") {
      const requestId = `telegram:${chatIdStr}:${msg.message_id}:reload`;
      pendingReloads.set(requestId, {
        chatId: chatIdStr,
        ...(topicId === undefined ? {} : { topicId }),
        conversationId,
        command: text,
      });
      bus.emit({
        type: "runtime.reload.requested",
        source: "telegram",
        owner: normalizeEventOwner(opts.interfaceAgent),
        data: { requestId },
      } as any);
      return true;
    }

    if (command === "/close") {
      bus.emit({
        type: "runtime.shutdown.requested",
        source: "telegram",
        owner: normalizeEventOwner(opts.interfaceAgent),
        urgency: "high",
        data: {},
      } as any);
      return true;
    }

    await sendMessage(chatIdStr, `Unknown command: ${command}. Use /help to see available commands.`, undefined, {
      eventType: "telegram.reply",
      agent: opts.interfaceAgent,
      data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
      replyToMessageId: msg.message_id,
      messageThreadId: topicId,
    });
    return true;
  }

  function telegramMessageText(message: any): string {
    const text = message?.text ?? message?.caption ?? "";
    return typeof text === "string" ? text.trim() : "";
  }

  // ── Long-polling loop ───────────────────────────────────────────

  async function pollLoop(): Promise<void> {
    bus.emit({
      type: "info",
      message: `[telegram] Bot started (polling). Allowed chats: ${allowedChatIds.join(", ")}`,
    });

    // Verify token
    try {
      const me = await apiCall("getMe");
      bus.emit({ type: "info", message: `[telegram] Bot: @${me.username} (${me.first_name})` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[telegram] Failed to connect: ${msg}` });
      return;
    }

    while (running) {
      try {
        const updates = await apiCall("getUpdates", {
          offset,
          timeout: 30,
          allowed_updates: ["message"],
        });

        if (Array.isArray(updates)) {
          for (const update of updates) {
            offset = update.update_id + 1;
            if (update.message) {
              // Fire and forget — don't let one bad message block polling
              handleMessage(update.message).catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                bus.emit({ type: "info", message: `[telegram] Message handler error: ${msg}` });
              });
            }
          }
        }
      } catch (err) {
        if (!running) break;
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[telegram] Poll error: ${msg}` });
        // Back off on error
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  // Start polling in background
  pollLoop().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[telegram] Poll loop crashed: ${msg}` });
  });

  // ── Cleanup ─────────────────────────────────────────────────────

  return {
    close: () => {
      running = false;
      unsubscribeConversation();
    },
  };
}
