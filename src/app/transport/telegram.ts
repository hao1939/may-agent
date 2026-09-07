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
import type { AppConversationMessage, AppConversationTopic } from "@may-agent/sdk";
import type { EventInput, EventReceipt } from "../event-interface.js";
import { type EventBus } from "../event-bus.js";
import { getDb } from "../../lib/requests.js";
import { getNotificationMessage, storeNotificationMessage } from "../../lib/db/notifications.js";
import { readAppConversationResource } from "../app-inbox-store.js";
import { createTelegramClient } from "./telegram-client.js";
import {
  isTaskDerivedViewWake,
  TASK_UPDATE_EVENT_TYPES,
  taskUpdateIdentity,
} from "../../../packages/control/src/task-wake.js";
import type { HumanAppView, HumanTaskService, HumanTaskView } from "../human-task-service.js";
import { taskCancelRequestedEvent } from "../task-control-events.js";

const TASK_PAGE_SIZE = 10;
const TODO_PAGE_SIZE = 50;

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
  humanTasks: Pick<HumanTaskService, "getTask" | "listApps" | "listTasks">;
  publishEvent: (input: EventInput) => EventReceipt;
}

export interface TelegramBot {
  close: () => void;
}

/** One logical human conversation; provider chat/topic IDs are coordinates. */
export function primaryConversationId(agent: string): string {
  return `${agent.trim() || "may"}:primary`;
}

export function renderTelegramApps(apps: HumanAppView[], selectedApp?: string): string {
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
      return `• ${app.id === selectedApp ? "✓ " : ""}${app.id} — ${states.join(" · ")}`;
    }),
  ].join("\n");
}

function topicReference(topic: AppConversationTopic): string {
  const value = topic.id.startsWith("topic_") ? topic.id.slice("topic_".length) : topic.id;
  return value.slice(0, 8) || "????????";
}

function resolveConversationTopic(topics: AppConversationTopic[], ref: string): AppConversationTopic | undefined {
  const normalized = ref.trim().toLowerCase();
  const matches = topics.filter((topic) => {
    const id = topic.id.toLowerCase();
    return id === normalized || id === `topic_${normalized}` || topicReference(topic).toLowerCase() === normalized;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function renderTelegramTopics(
  topics: AppConversationTopic[],
  selectedTopicId?: string,
  options: { older?: boolean; hasMore?: boolean } = {},
): string {
  if (topics.length === 0) return options.older ? "No older Topics." : "No recent Topics.";
  return [
    options.older ? "Older Topics:" : "Recent Topics:",
    ...topics.map(
      (topic) =>
        `• ${topic.id === selectedTopicId ? "✓ " : ""}${topicReference(topic)} · ${topic.title}${
          topic.taskRefs.length ? ` · ${topic.taskRefs.length} Task${topic.taskRefs.length === 1 ? "" : "s"}` : ""
        }`,
    ),
    ...(options.hasMore ? ["More Topics are available; use /topics more."] : []),
    "",
    "Use /topic <ref> to continue one Topic. Task progress remains under /task and /watch.",
  ].join("\n");
}

export function renderTelegramTopic(topic: AppConversationTopic, messages: AppConversationMessage[]): string {
  const tasks = topic.taskRefs.map((task) => `• ${task.ref ?? "????????"} · ${task.appId}`);
  const recent = messages
    .filter((message) => message.metadata?.topicId === topic.id)
    .slice(-8)
    .flatMap((message) => {
      const text = message.text.trim().replace(/\s+/g, " ");
      if (!text) return [];
      const speaker = message.author.kind === "human" ? "You" : message.author.kind === "agent" ? "May" : "View";
      return [`${speaker}: ${text.length > 180 ? `${text.slice(0, 177)}...` : text}`];
    });
  return [
    `Following ${topicReference(topic)} · ${topic.title}`,
    "Tasks:",
    ...(tasks.length ? tasks : ["• None"]),
    ...(recent.length ? ["", "Recent conversation:", ...recent] : []),
  ].join("\n");
}

export function renderTelegramTasks(tasks: HumanTaskView[], includeDone: boolean, hasMore = false): string {
  if (tasks.length === 0) return includeDone ? "No active or recent Tasks." : "No active Tasks.";
  return [
    includeDone ? "Tasks (active and recent):" : "Active Tasks:",
    ...tasks.flatMap((task) => {
      const result = task.response?.trim() || task.summary?.trim();
      return [
        `• ${task.ref} · ${task.appId} · ${taskStatusLabel(task)} · ${updatedAgeText(task.updatedAt)}\n  ${task.outcome} · ${task.humanAction ? "needs you" : "no action from you"}`,
        ...(task.terminal && result ? [`  ${result}`] : []),
      ];
    }),
    ...(hasMore ? ["More Tasks are available; use /tasks more for the next page."] : []),
  ].join("\n");
}

function taskStatusLabel(task: Pick<HumanTaskView, "status" | "humanAction">): string {
  switch (task.status) {
    case "pending":
      return "queued";
    case "running":
      return "working";
    case "waiting":
      return "waiting";
    case "attention":
      return task.humanAction ? "needs you" : "needs review";
    case "up-to-date":
      return "up to date";
    case "done":
      return "done";
    case "cancelled":
      return "cancelled";
  }
}

function currentTaskText(task: HumanTaskView): string {
  const observed = task.terminal
    ? task.response?.trim() || task.summary?.trim()
    : task.progress?.message?.trim() || task.response?.trim() || task.summary?.trim();
  if (observed) return observed;
  switch (task.status) {
    case "pending":
      return "No attempt has started yet.";
    case "running":
      return "Work is active; no detailed progress has been reported yet.";
    case "waiting":
      return "No new progress has been reported while the Task waits.";
    case "attention":
      return "No recovery update has been reported yet.";
    case "up-to-date":
      return "Current linked work is reconciled; this Task will wake when relevant facts change.";
    case "done":
      return "No result summary was recorded.";
    case "cancelled":
      return "The Task will not continue.";
  }
}

function humanActionText(task: HumanTaskView): string {
  return task.humanAction?.requestedAction.trim() || task.summary?.trim() || task.outcome;
}

function humanActionLine(task: HumanTaskView): string {
  const owner = task.humanAction?.task;
  return owner ? `On Task ${owner.ref} · ${owner.appId}: ${humanActionText(task)}` : humanActionText(task);
}

function elapsedText(value: number): string {
  const minutes = Math.floor(Math.max(0, Date.now() - value) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function updatedAgeText(value: number): string {
  const age = elapsedText(value);
  return age === "just now" ? age : `${age} ago`;
}

export function renderTelegramTodos(
  tasks: HumanTaskView[],
  total = tasks.length,
  appId?: string,
  hasMore = false,
): string {
  const scope = appId ? ` for ${appId}` : " across all Apps";
  if (tasks.length === 0) return `Nothing needs your action${scope}.`;
  return [
    `Actions needed${scope}:`,
    ...tasks.map((task) => {
      const since = task.humanAction?.since;
      return `• ${task.ref} · ${task.appId}${since === undefined ? "" : ` · ${elapsedText(since)}`}\n  ${humanActionText(task)}`;
    }),
    ...(total > tasks.length
      ? [`${total - tasks.length} more action(s) are not shown.${hasMore ? " Use /todo more." : ""}`]
      : []),
  ].join("\n");
}

export function renderTelegramTask(task: HumanTaskView): string {
  const acceptance = (task.acceptance ?? []).filter((item) => item.trim());
  const currentHeading =
    !task.terminal && task.progress ? `Current · ${formatWorkTime(task.progress.updatedAt)}` : "Current";
  return [
    `Task ${task.ref} · ${task.appId}`,
    "",
    `Goal\n${task.outcome}`,
    "",
    `State\n${taskStatusLabel(task)}. ${task.statusDetail ?? ""}`.trimEnd(),
    "",
    `${currentHeading}\n${currentTaskText(task)}`,
    ...(task.waitingOn ?? []).map((wait) =>
      wait.kind === "task"
        ? `Waiting on ${wait.ref} · ${wait.appId} · ${taskStatusLabel(wait)}\n${wait.outcome}`
        : wait.kind === "app"
          ? `Waiting on App ${wait.appId} · ${wait.status}`
          : `Waiting for ${wait.type}\n${wait.subject}`,
    ),
    "",
    "Expected result",
    ...(acceptance.length > 0
      ? acceptance.map((item) => `• ${item}`)
      : ["No separate completion criteria were recorded."]),
    "",
    `You\n${task.humanAction ? humanActionLine(task) : "Nothing needed right now."}`,
    ...(task.requestedBy
      ? ["", `Related\nRequested by ${task.requestedBy.ref} · ${task.requestedBy.appId}\n${task.requestedBy.outcome}`]
      : []),
    "",
    `Updated\n${formatWorkTime(task.updatedAt)}`,
    "",
    `Details\nID: ${task.taskId}`,
    ...(task.execution?.sessionId ? [`Session: ${task.execution.sessionId}`] : []),
  ].join("\n");
}

function taskPresentationRevision(task: HumanTaskView): string {
  return JSON.stringify({
    status: task.status,
    statusDetail: task.statusDetail,
    outcome: task.outcome,
    acceptance: task.acceptance,
    updatedAt: task.updatedAt,
    summary: task.summary,
    response: task.response,
    evidence: task.evidence,
    progress: task.progress,
    waitingOn: task.waitingOn,
    requestedBy: task.requestedBy,
    execution: task.execution,
    humanAction: task.humanAction,
    terminal: task.terminal,
  });
}

function representedTaskIdentities(task: HumanTaskView): Array<{ appId: string; taskId: string }> {
  return [
    { appId: task.appId, taskId: task.taskId },
    ...(task.requestedBy ? [{ appId: task.requestedBy.appId, taskId: task.requestedBy.taskId }] : []),
    ...(task.waitingOn ?? []).flatMap((wait) =>
      wait.kind === "task" ? [{ appId: wait.appId, taskId: wait.taskId }] : [],
    ),
  ];
}

function formatWorkTime(value: number): string {
  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function renderTelegramConversationMessage(message: AppConversationMessage): string {
  const channel = message.metadata?.channel?.trim() || "another surface";
  const taskLines = (message.metadata?.taskRefs ?? []).flatMap((task) =>
    task.ref ? [`Task ${task.ref} (${task.appId})`] : [],
  );
  const text = taskLines.length > 0 ? `${message.text}\n\n${taskLines.join("\n")}` : message.text;
  if (channel === "telegram" && message.author.kind === "agent") return text;
  if (message.author.kind === "tool" && message.metadata?.command === "task-admitted") {
    return `Task activity\n${text}`;
  }
  const surface = channel === "may-console" ? "Console" : channel;
  const speaker =
    message.author.kind === "human"
      ? "You"
      : message.author.kind === "agent"
        ? "May"
        : message.author.kind === "command"
          ? "View"
          : "Tool";
  return `${surface} · ${speaker}\n${text}`;
}

export function telegramMayInputEvent(input: {
  message: string;
  chatId: string;
  messageId: number;
  conversationId: string;
  topicId?: string | number;
  conversationTopicId?: string;
  replyToMessageId?: number;
  replyToSourceId?: string;
  context?: Record<string, unknown>;
}): EventInput {
  const sourceId = `telegram:${input.chatId}:${input.messageId}`;
  return {
    type: "conversation.message.created",
    target: { appId: "may" },
    data: {
      conversationId: input.conversationId,
      author: { kind: "human", id: sourceId },
      text: input.message,
      ...(input.context ? { context: input.context } : {}),
      ...(input.replyToSourceId
        ? { replyTo: input.replyToSourceId }
        : input.replyToMessageId === undefined
          ? {}
          : { replyTo: `telegram:${input.chatId}:${input.replyToMessageId}` }),
      metadata: {
        channel: "telegram",
        channelTargetId: input.chatId,
        ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
        channelMessageId: input.messageId,
        ...(input.conversationTopicId ? { topicId: input.conversationTopicId } : {}),
      },
    },
    idempotencyKey: sourceId,
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
  const watchedTasks = new Map<
    string,
    { appId: string; taskId: string; ref: string; chatId: string; topicId?: number }
  >();
  const selectedApps = new Map<string, string>();
  const selectedTopics = new Map<string, AppConversationTopic>();
  const surfaces = new Map<string, { chatId: string; topicId?: number }>();
  const surfaceMessageHandlers = new Map<string, Promise<void>>();
  const shownTodoActions = new Map<string, Map<string, string>>();
  const todoReads = new Set<string>();
  const dirtyTodos = new Set<string>();
  const scheduledTodos = new Set<string>();
  const nextTaskPageBySurface = new Map<string, { appId?: string; includeDone: boolean; cursor: string }>();
  const nextTopicPageBySurface = new Map<string, string>();
  const lastRenderedMayMessageBySurface = new Map<string, string>();
  const pendingReloads = new Map<
    string,
    { chatId: string; topicId?: number; conversationId: string; command: string }
  >();
  const watchReads = new Set<string>();
  const dirtyWatches = new Set<string>();
  const scheduledWatches = new Set<string>();
  const shownWatchRevisions = new Map<string, string>();
  const stopWatching = (surface: string): boolean => {
    shownWatchRevisions.delete(surface);
    return watchedTasks.delete(surface);
  };
  const surfaceKey = (chatId: string, topicId?: number) => `${chatId}:${topicId ?? 0}`;
  const sharedConversationId = primaryConversationId(opts.interfaceAgent);
  const nextTodoPageBySurface = new Map<string, { appId?: string; cursor: string }>();
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
    }).messages) {
      rememberRenderedConversationMessage(message.id);
    }
  } catch {
    // The Conversation may not be available until App runtime startup finishes.
  }
  let conversationSyncRunning = false;
  let conversationSyncDirty = false;
  let conversationSyncTimer: ReturnType<typeof setTimeout> | null = null;

  async function syncConversation(): Promise<void> {
    const messages = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
      limit: 200,
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
      if (message.author.kind === "agent") {
        lastRenderedMayMessageBySurface.set(
          surfaceKey(targetChatId, threadId && /^[1-9]\d*$/.test(threadId) ? Number(threadId) : undefined),
          message.id,
        );
      }
      rememberRenderedConversationMessage(message.id);
    }
  }

  function queueConversationSync(): void {
    if (!running) return;
    if (conversationSyncRunning) {
      conversationSyncDirty = true;
      return;
    }
    if (conversationSyncTimer) clearTimeout(conversationSyncTimer);
    // EventBus listeners drain a bounded FIFO asynchronously. Defer the read
    // by one turn so a burst of wake-only events collapses before touching the
    // Conversation resource. An update observed during I/O still requests one
    // dirty retry below.
    conversationSyncTimer = setTimeout(() => {
      conversationSyncTimer = null;
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
    }, 5);
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
        stopWatching(surface);
        await sendMessage(watched.chatId, `Task ${watched.ref} is no longer available; watch ended.`, undefined, {
          messageThreadId: watched.topicId,
        });
        return;
      }
      const revision = taskPresentationRevision(task);
      if (shownWatchRevisions.get(surface) === revision) return;
      const delivered = await sendMessage(watched.chatId, renderTelegramTask(task), undefined, {
        eventType: "task.watch",
        agent: opts.interfaceAgent,
        messageThreadId: watched.topicId,
      });
      if (!delivered) return;
      shownWatchRevisions.set(surface, revision);
      if (task.terminal) {
        stopWatching(surface);
      }
    } finally {
      watchReads.delete(surface);
      if (dirtyWatches.delete(surface) && watchedTasks.has(surface)) void refreshWatch(surface);
    }
  }

  function queueWatchRefresh(surface: string): void {
    if (!running || scheduledWatches.has(surface)) return;
    scheduledWatches.add(surface);
    setTimeout(() => {
      scheduledWatches.delete(surface);
      if (running && watchedTasks.has(surface)) void refreshWatch(surface);
    }, 0);
  }

  const todoTaskKey = (task: HumanTaskView): string => `${task.appId}\0${task.taskId}`;
  const todoActionSignature = (task: HumanTaskView): string => humanActionText(task);

  async function refreshTodos(surface: string): Promise<void> {
    const coordinates = surfaces.get(surface);
    if (!coordinates) return;
    if (todoReads.has(surface)) {
      dirtyTodos.add(surface);
      return;
    }
    todoReads.add(surface);
    try {
      const appId = selectedApps.get(surface) ?? opts.interfaceAgent;
      const page = opts.humanTasks.listTasks({ appId, humanActionOnly: true, limit: TODO_PAGE_SIZE });
      const prior = shownTodoActions.get(surface) ?? new Map<string, string>();
      const next = new Map(page.items.map((task) => [todoTaskKey(task), todoActionSignature(task)]));
      const watched = watchedTasks.get(surface);
      const changed = page.items.filter(
        (task) =>
          prior.get(todoTaskKey(task)) !== todoActionSignature(task) &&
          !(watched?.appId === task.appId && watched.taskId === task.taskId),
      );
      if (changed.length === 0) {
        shownTodoActions.set(surface, next);
        return;
      }
      const first = changed[0]!;
      const text =
        page.total === 1 && changed.length === 1
          ? `Action needed · ${first.appId} · ${first.ref}\n${humanActionText(first)}\n\nUse /watch ${first.ref} to respond.`
          : `${page.total ?? page.items.length} Tasks need your action in ${appId}. Use /todo.`;
      const messageId = await sendMessage(coordinates.chatId, text, undefined, {
        eventType: "task.human-action",
        agent: opts.interfaceAgent,
        messageThreadId: coordinates.topicId,
      });
      if (!messageId) return;
      shownTodoActions.set(surface, next);
      recordConversationMessage({
        conversationId: sharedConversationId,
        text,
        command: "/todo notification",
        messageId,
        chatId: coordinates.chatId,
        topicId: coordinates.topicId,
        taskRefs: page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
        idempotencyKey: `todo-notification:telegram:${surface}:${first.appId}:${first.taskId}:${first.resourceVersion}`,
      });
    } finally {
      todoReads.delete(surface);
      if (dirtyTodos.delete(surface)) queueTodoRefresh(surface);
    }
  }

  function queueTodoRefresh(surface: string): void {
    if (!running || scheduledTodos.has(surface)) return;
    scheduledTodos.add(surface);
    setTimeout(() => {
      scheduledTodos.delete(surface);
      if (running) {
        void refreshTodos(surface).catch((error) => {
          bus.emit({
            type: "info",
            message: `[telegram] Todo refresh failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        });
      }
    }, 0);
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
        if (watched.appId === wake.appId && watched.taskId === wake.taskId) queueWatchRefresh(surface);
      }
      if (isTaskDerivedViewWake(event)) {
        for (const surface of surfaces.keys()) {
          const selected = selectedApps.get(surface) ?? opts.interfaceAgent;
          if (selected === wake.appId) queueTodoRefresh(surface);
        }
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
    taskRefs?: Array<{ appId: string; taskId: string }>;
    conversationTopicId?: string;
    idempotencyKey?: string;
  }): void {
    opts.publishEvent({
      type: "conversation.message.created",
      target: { appId: opts.interfaceAgent },
      data: {
        conversationId: input.conversationId,
        author: { kind: "command", id: "telegram" },
        text: input.text,
        ...(input.transient ? { transient: true } : {}),
        metadata: {
          channel: "telegram",
          ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
          channelMessageId: input.messageId,
          command: input.command,
          ...(input.conversationTopicId ? { topicId: input.conversationTopicId } : {}),
          ...(input.taskRefs?.length ? { taskRefs: input.taskRefs } : {}),
        },
      },
      idempotencyKey:
        input.idempotencyKey ??
        `telegram:${input.chatId ?? "unknown"}:conversation:${input.messageId}:${input.command}`,
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
    replyToSourceId?: string,
    conversationTopicId?: string,
  ): void {
    if (!channelMessageId || !chatId || !conversationId) return;
    const received = opts.publishEvent(
      telegramMayInputEvent({
        message,
        chatId,
        messageId: channelMessageId,
        conversationId,
        topicId,
        conversationTopicId,
        replyToMessageId: replyToMsgId,
        replyToSourceId,
        context: {
          ...(context ?? {}),
        },
      }),
    );

    const rowId = received.eventId;
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
    const surface = surfaceKey(chatIdStr, topicId);
    surfaces.set(surface, { chatId: chatIdStr, ...(topicId === undefined ? {} : { topicId }) });
    const conversationId = primaryConversationId(opts.interfaceAgent);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    // Keep the human text authoritative. A reply contributes only its provider
    // anchor and bounded quoted text; Conversation and Task resources own the
    // semantic context.
    let inputContext: Record<string, unknown> | undefined;
    const replyToMsg = msg.reply_to_message;
    const replyToMsgId = replyToMsg?.message_id;
    let replyToSourceId: string | undefined;
    if (replyToMsgId) {
      try {
        const notification = getNotificationMessage(persistDir, replyToMsgId);
        const data = notification?.data ? (JSON.parse(notification.data) as Record<string, unknown>) : undefined;
        replyToSourceId =
          typeof data?.conversationMessageId === "string" && data.conversationMessageId.trim()
            ? data.conversationMessageId.trim()
            : `telegram:${chatIdStr}:${replyToMsgId}`;
      } catch {
        replyToSourceId = `telegram:${chatIdStr}:${replyToMsgId}`;
      }
      const quotedText = telegramMessageText(replyToMsg).slice(0, 2_000);
      inputContext = {
        reply: {
          channel: "telegram",
          messageId: replyToMsgId,
          ...(quotedText ? { quotedText } : {}),
        },
      };
    }

    if (await handleTelegramCommand(text, chatIdStr, msg, conversationId, topicId)) {
      return;
    }

    // Every ordinary turn becomes one durable May request.
    const focusedTask = watchedTasks.get(surfaceKey(chatIdStr, topicId));
    const focusedApp = selectedApps.get(surfaceKey(chatIdStr, topicId)) ?? opts.interfaceAgent;
    const conversationTopic = selectedTopics.get(surface);
    inputContext = { ...(inputContext ?? {}), focusedApp };
    if (focusedTask) {
      inputContext = {
        ...(inputContext ?? {}),
        focusedTask: { appId: focusedTask.appId, taskId: focusedTask.taskId },
      };
    }
    emitChatStart(
      text,
      msg.message_id,
      inputContext,
      chatIdStr,
      topicId,
      conversationId,
      replyToMsgId,
      replyToSourceId ?? lastRenderedMayMessageBySurface.get(surface),
      conversationTopic?.id,
    );
  }

  function queueMessage(msg: any): void {
    const surface = surfaceKey(String(msg.chat?.id ?? "unknown"), msg.message_thread_id as number | undefined);
    const prior = surfaceMessageHandlers.get(surface) ?? Promise.resolve();
    const next = prior
      .catch(() => {})
      .then(() => handleMessage(msg))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        bus.emit({ type: "info", message: `[telegram] Message handler error: ${message}` });
      })
      .finally(() => {
        if (surfaceMessageHandlers.get(surface) === next) surfaceMessageHandlers.delete(surface);
      });
    surfaceMessageHandlers.set(surface, next);
  }

  async function handleTelegramCommand(
    text: string,
    chatIdStr: string,
    msg: any,
    conversationId: string,
    topicId?: number,
  ): Promise<boolean> {
    if (!text.startsWith("/")) return false;

    const [cmd = "", ...rest] = text.split(/\s+/);
    const command = cmd.split("@")[0];
    const surface = surfaceKey(chatIdStr, topicId);

    const deliverCommandView = async (
      rendered: string,
      taskRefs: Array<{ appId: string; taskId: string }> = [],
    ): Promise<boolean> => {
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
          conversationTopicId: selectedTopics.get(surface)?.id,
        });
        return true;
      }
      return false;
    };

    if (command === "/apps") {
      if (rest.length > 1) await deliverCommandView("Use: /apps [app]");
      else {
        const apps = opts.humanTasks.listApps(rest[0]);
        let selectedChanged = false;
        if (rest[0] && apps.length === 1) {
          const nextApp = apps[0]!.id;
          selectedApps.set(surface, nextApp);
          shownTodoActions.delete(surface);
          nextTodoPageBySurface.delete(surface);
          const watched = watchedTasks.get(surface);
          if (watched && watched.appId !== nextApp) stopWatching(surface);
          selectedChanged = true;
        }
        const selected = selectedApps.get(surface) ?? opts.interfaceAgent;
        await deliverCommandView(
          apps.length === 0
            ? `App ${rest[0]} was not found.`
            : `${rest[0] ? `Selected App: ${selected}\n` : ""}${renderTelegramApps(apps, selected)}`,
        );
        if (selectedChanged) queueTodoRefresh(surface);
      }
      return true;
    }

    if (command === "/topics") {
      const more = rest.length === 1 && rest[0]?.toLowerCase() === "more";
      if (rest.length > 1 || (rest.length === 1 && !more)) await deliverCommandView("Use: /topics, or /topics more");
      else {
        const cursor = more ? nextTopicPageBySurface.get(surface) : undefined;
        if (more && !cursor) {
          await deliverCommandView("No next page. Use /topics first.");
          return true;
        }
        const conversation = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
          limit: 30,
          ...(cursor ? { topicCursor: cursor } : {}),
        });
        if (conversation.nextTopicCursor) nextTopicPageBySurface.set(surface, conversation.nextTopicCursor);
        else nextTopicPageBySurface.delete(surface);
        await deliverCommandView(
          renderTelegramTopics(conversation.topics ?? [], selectedTopics.get(surface)?.id, {
            older: more,
            hasMore: Boolean(conversation.nextTopicCursor),
          }),
        );
      }
      return true;
    }

    if (command === "/topic") {
      if (rest.length > 1) {
        await deliverCommandView("Use: /topic [ref|clear]");
        return true;
      }
      if (rest[0]?.toLowerCase() === "clear") {
        const prior = selectedTopics.get(surface);
        selectedTopics.delete(surface);
        await deliverCommandView(
          prior
            ? `Stopped following Topic ${topicReference(prior)}. Its Tasks continue unchanged.`
            : "No Topic is followed.",
        );
        return true;
      }
      const exactTopicId = rest[0] ?? selectedTopics.get(surface)?.id;
      const conversation = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
        limit: 30,
        ...(exactTopicId ? { topicId: exactTopicId } : {}),
      });
      const selectedTopic = selectedTopics.get(surface);
      const topic = rest[0]
        ? resolveConversationTopic(conversation.topics ?? [], rest[0])
        : conversation.topics?.find((candidate) => candidate.id === selectedTopic?.id);
      if (!topic) {
        await deliverCommandView(
          rest[0] ? `Topic ${rest[0]} was not found. Use /topics.` : "No Topic is followed. Use /topics to choose one.",
        );
        return true;
      }
      if (rest[0]) {
        const linked = new Set(topic.taskRefs.map((task) => `${task.appId}\0${task.taskId}`));
        const watched = watchedTasks.get(surface);
        if (watched && !linked.has(`${watched.appId}\0${watched.taskId}`)) stopWatching(surface);
        selectedTopics.set(surface, topic);
      }
      await deliverCommandView(renderTelegramTopic(topic, conversation.messages), topic.taskRefs);
      return true;
    }

    if (command === "/todo") {
      const tokens = rest.map((part) => part.toLowerCase());
      const more = tokens.length === 1 && tokens[0] === "more";
      const prior = more ? nextTodoPageBySurface.get(surface) : undefined;
      if (more && !prior) {
        await deliverCommandView("No next page. Use /todo first.");
        return true;
      }
      if (tokens.length > 1 || (tokens.length === 1 && tokens[0] !== "all" && !more)) {
        await deliverCommandView("Use: /todo [all], or /todo more");
        return true;
      }
      const appId = more
        ? prior!.appId
        : tokens.includes("all")
          ? undefined
          : (selectedApps.get(surface) ?? opts.interfaceAgent);
      const page = opts.humanTasks.listTasks({
        ...(appId ? { appId } : {}),
        humanActionOnly: true,
        limit: TODO_PAGE_SIZE,
        ...(prior?.cursor ? { cursor: prior.cursor } : {}),
      });
      if (page.nextCursor) {
        nextTodoPageBySurface.set(surface, { ...(appId ? { appId } : {}), cursor: page.nextCursor });
      } else {
        nextTodoPageBySurface.delete(surface);
      }
      const delivered = await deliverCommandView(
        renderTelegramTodos(page.items, page.total ?? page.items.length, appId, Boolean(page.nextCursor)),
        page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
      );
      if (delivered && !more && appId === (selectedApps.get(surface) ?? opts.interfaceAgent)) {
        shownTodoActions.set(
          surface,
          new Map(page.items.map((task) => [todoTaskKey(task), todoActionSignature(task)])),
        );
      }
      return true;
    }

    if (command === "/tasks") {
      const more = rest.length === 1 && rest[0].toLowerCase() === "more";
      const prior = more ? nextTaskPageBySurface.get(surface) : undefined;
      if (more && !prior) {
        await deliverCommandView("No next page. Use /tasks first.");
        return true;
      }
      const tokens = more ? [] : rest.map((part) => part.toLowerCase());
      if (tokens.some((part) => part !== "all" && part !== "history") || new Set(tokens).size !== tokens.length) {
        await deliverCommandView("Use: /tasks [all] [history], or /tasks more");
        return true;
      }
      const includeDone = prior?.includeDone ?? tokens.includes("history");
      const appId = more
        ? prior!.appId
        : tokens.includes("all")
          ? undefined
          : (selectedApps.get(surface) ?? opts.interfaceAgent);
      const page = opts.humanTasks.listTasks({
        ...(appId ? { appId } : {}),
        includeDone,
        limit: TASK_PAGE_SIZE,
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
        task ? representedTaskIdentities(task) : [],
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
          const delivered = await deliverCommandView(
            task ? renderTelegramTask(task) : `Task ${watched.ref} was not found; watch ended.`,
            task ? representedTaskIdentities(task) : [],
          );
          if (task && delivered) shownWatchRevisions.set(surface, taskPresentationRevision(task));
          if (!task || task.terminal) {
            stopWatching(surface);
          }
        }
        return true;
      }
      const task = opts.humanTasks.getTask({ ref: rest[0] });
      if (!task) {
        await deliverCommandView(`Task ${rest[0]} was not found.`);
      } else if (task.terminal) {
        stopWatching(surface);
        await deliverCommandView(`${renderTelegramTask(task)}\n\nThis Task is terminal, so it was not watched.`, [
          ...representedTaskIdentities(task),
        ]);
      } else {
        watchedTasks.set(surface, {
          appId: task.appId,
          taskId: task.taskId,
          ref: task.ref,
          chatId: chatIdStr,
          ...(topicId === undefined ? {} : { topicId }),
        });
        const delivered = await deliverCommandView(
          `${renderTelegramTask(task)}\n\nWatching ${task.ref}. May receives replies with this Task in context.`,
          representedTaskIdentities(task),
        );
        if (delivered) shownWatchRevisions.set(surface, taskPresentationRevision(task));
      }
      return true;
    }

    if (command === "/unwatch") {
      if (rest.length > 0) await deliverCommandView("Use: /unwatch");
      else if (stopWatching(surface)) {
        await deliverCommandView("Stopped watching. The Task is unchanged.");
      } else await deliverCommandView("No Task is watched.");
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
        const selected = opts.humanTasks.getTask(
          rest[0]
            ? { ref: rest[0] }
            : {
                appId: watched!.appId,
                taskId: watched!.taskId,
              },
        );
        if (!selected) throw new Error("Task was not found");
        const receipt = opts.publishEvent(
          taskCancelRequestedEvent(selected, "human requested cancellation from Telegram"),
        );
        if (receipt.delivery !== "accepted") {
          throw new Error("Task cancellation was recorded but not accepted; refresh the Task and retry");
        }
        const task = opts.humanTasks.getTask({ appId: selected.appId, taskId: selected.taskId });
        if (!task) throw new Error("Task disappeared after cancellation");
        stopWatching(surface);
        await deliverCommandView(renderTelegramTask(task), representedTaskIdentities(task));
      } catch (error) {
        await deliverCommandView(`[cancel] ${error instanceof Error ? error.message : String(error)}`);
      }
      return true;
    }

    if (command === "/start" || command === "/help") {
      await sendMessage(
        chatIdStr,
        "🤖 *May*\n\n" +
          "Send any message to interact with May.\n\n" +
          "*Commands:*\n" +
          "/apps \[app\] — List or select an App\n" +
          "/topics — List Topics; use /topics more for older pages\n" +
          "/topic \[ref\|clear\] — Show, follow, or leave a Topic\n" +
          "/tasks \[all\] \[history\], /tasks more — Show Tasks\n" +
          "/todo \[all\], /todo more — Show Tasks that need your action\n" +
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
      opts.publishEvent({
        type: "runtime.reload.requested",
        data: { requestId },
        idempotencyKey: requestId,
      });
      return true;
    }

    if (command === "/close") {
      opts.publishEvent({
        type: "runtime.shutdown.requested",
        data: {},
        idempotencyKey: `telegram:${chatIdStr}:${msg.message_id}:shutdown`,
      });
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
      // Configured chats are valid notification surfaces immediately after a
      // restart; receiving a new message is not a prerequisite for alerts.
      for (const chatId of allowedChatIds) {
        const surface = surfaceKey(chatId);
        surfaces.set(surface, { chatId });
        queueTodoRefresh(surface);
      }
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
              // Surfaces stay independent, while commands and the following
              // human text from one chat/thread retain Telegram update order.
              queueMessage(update.message);
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
      if (conversationSyncTimer) clearTimeout(conversationSyncTimer);
      unsubscribeConversation();
    },
  };
}
