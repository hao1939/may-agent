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

import { randomUUID } from "node:crypto";
import { log } from "../../lib/log.js";
import { setDefaultAutoSelectFamily } from "node:net";
import type { AppConversationMessage, AppConversationTopic, AppConversationResource } from "@may-agent/sdk";
import type { EventInput, EventReceipt } from "@may-agent/control/events";
import { EVENT_DELIVERY_RESULT, eventData, type EventBus } from "../core/events/bus.js";
import { loadPersistedEvent } from "../core/events/persisted.js";
import { getDb } from "../../lib/requests.js";
import { getNotificationMessage, storeNotificationMessage } from "../../lib/db/notifications.js";
import { readAppConversationResource, readConversationTopic } from "../core/state/conversations.js";
import { TaskReferenceError } from "../core/state/task-reference-index.js";
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

// Non-text content in https://core.telegram.org/bots/api#message (reviewed 2026-09-12).
// Also acknowledge explicit user shares/Web App data; passive service notices stay quiet.
// Keep this provider list current when adding Telegram content support, not another work route.
const TELEGRAM_CONTENT_FIELDS = [
  "animation", "audio", "document", "live_photo", "paid_media", "photo", "sticker", "story",
  "video", "video_note", "voice", "caption", "checklist", "contact", "dice", "game", "poll",
  "venue", "location", "rich_message", "invoice", "giveaway", "giveaway_winners", "passport_data",
  "users_shared", "chat_shared", "web_app_data",
] as const;

function hasTelegramContent(message: Record<string, unknown>): boolean {
  return TELEGRAM_CONTENT_FIELDS.some((field) => message[field] != null);
}

// Stored channel coordinates are transport-neutral text. Use the same
// no-thread fallback for delivery, controls and watch bookkeeping.
function telegramThreadId(value?: string): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

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
    case "closed":
      return "closed";
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
    case "closed":
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
    facts: task.facts,
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

function renderTelegramTaskUpdate(task: HumanTaskView): string {
  return [
    task.outcome,
    taskStatusLabel(task),
    "",
    currentTaskText(task),
    ...(task.humanAction ? ["", `Needs you: ${humanActionText(task)}`, "Reply here with your decision."] : []),
  ].join("\n");
}

function singleTaskReference(value: unknown): { appId: string; taskId: string } | undefined {
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  const task = value[0];
  return task && typeof task.appId === "string" && task.appId && typeof task.taskId === "string" && task.taskId
    ? { appId: task.appId, taskId: task.taskId }
    : undefined;
}

function taskButtons(taskRefs: unknown) {
  return singleTaskReference(taskRefs)
    ? {
        inline_keyboard: [
          [
            { text: "Details", callback_data: "task:details" },
            { text: "Follow updates", callback_data: "task:follow" },
          ],
        ],
      }
    : undefined;
}

function renderTelegramConversationMessage(message: AppConversationMessage): string {
  const channel = message.metadata?.channel?.trim() || "another surface";
  const text = message.text;
  if (channel === "telegram" && message.author.kind === "agent") return text;
  if (message.author.kind === "tool" && message.metadata?.command === "task-admitted") {
    return `Background work accepted\n${message.text.replace(/^Accepted durable work:\s*/, "")}`;
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
  // Order immediate command replies, including help/errors, without blocking input or updates.
  const commandDeliveries = new Map<string, Promise<void>>();
  function queueCommandDelivery(surface: string, deliver: () => Promise<unknown>): void {
    const prior = commandDeliveries.get(surface) ?? Promise.resolve();
    const next = prior
      .then(async () => {
        if (running) await deliver();
      })
      .catch((error) => log("warn", `[telegram] Command delivery failed: ${String(error)}`))
      .finally(() => {
        if (commandDeliveries.get(surface) === next) commandDeliveries.delete(surface);
      });
    commandDeliveries.set(surface, next);
  }
  const watchedTasks = new Map<
    string,
    { appId: string; taskId: string; ref: string; chatId: string; topicId?: number }
  >();
  const selectedApps = new Map<string, string>();
  const selectedTopics = new Map<string, AppConversationTopic>();
  const turnControls = new Map<string, { token: string; turnId: string; revision: number; messageId: number }>();
  const surfaces = new Map<string, { chatId: string; topicId?: number }>();
  const shownTodoActions = new Map<string, Map<string, string>>();
  const nextTaskPageBySurface = new Map<string, { appId?: string; includeDone: boolean; cursor: string }>();
  const nextTopicPageBySurface = new Map<string, string>();
  const pendingReloads = new Map<
    string,
    { chatId: string; topicId?: number; conversationId: string; command: string }
  >();
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

  // Presentation only: one read in flight per key, with at most one follow-up
  // for updates observed during I/O. Errors do not schedule retries; new events do.
  function createRefreshQueue(label: string, refresh: (key: string) => Promise<void>, delayMs = 0) {
    const pending = new Map<string, { timer: ReturnType<typeof setTimeout> | null; dirty: boolean }>();
    function queue(key: string): void {
      if (!running) return;
      const existing = pending.get(key);
      if (existing) {
        if (existing.timer === null) {
          existing.dirty = true;
          return;
        }
        if (delayMs === 0) return;
        // Conversation wakes drain over several EventBus turns. Preserve its
        // short debounce window, rather than rereading each partial burst.
        clearTimeout(existing.timer);
      }
      const state = { timer: null as ReturnType<typeof setTimeout> | null, dirty: false };
      pending.set(key, state);
      state.timer = setTimeout(async () => {
        state.timer = null;
        try {
          if (running) await refresh(key);
        } catch (error) {
          bus.emit({
            type: "info",
            message: `[telegram] ${label} failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        } finally {
          pending.delete(key);
          if (state.dirty) queue(key);
        }
      }, delayMs);
    }
    return {
      queue,
      close() {
        for (const state of pending.values()) {
          if (state.timer !== null) clearTimeout(state.timer);
        }
        pending.clear();
      },
    };
  }

  async function clearTurnControl(surface: string): Promise<void> {
    const control = turnControls.get(surface);
    const coordinates = surfaces.get(surface);
    turnControls.delete(surface);
    if (!control || !coordinates) return;
    try {
      await apiCall("editMessageReplyMarkup", {
        chat_id: coordinates.chatId,
        message_id: control.messageId,
        reply_markup: { inline_keyboard: [] },
      });
    } catch (error) {
      // The token is already invalid locally even if Telegram cannot update it.
      log("warn", `[telegram] Could not clear turn button: ${String(error)}`);
    }
  }

  async function syncTurnControls(turn?: AppConversationResource["activeTurn"]): Promise<void> {
    const sourceChatId = turn?.channel === "telegram" ? turn.channelTargetId : undefined;
    const topicId = telegramThreadId(turn?.channelThreadId);
    const sourceSurface = sourceChatId ? surfaceKey(sourceChatId, topicId) : undefined;
    if (sourceChatId && sourceSurface && allowedChatIds.includes(sourceChatId)) {
      surfaces.set(sourceSurface, {
        chatId: sourceChatId,
        ...(topicId === undefined ? {} : { topicId }),
      });
    }
    for (const [surface, coordinates] of surfaces) {
      if (!running) return;
      const previous = turnControls.get(surface);
      const relevant = sourceSurface === undefined || surface === sourceSurface;
      if (!relevant) {
        if (previous) await clearTurnControl(surface);
        continue;
      }
      if (previous?.turnId === turn?.id && previous?.revision === turn?.revision) continue;
      if (previous) await clearTurnControl(surface);
      if (!turn) continue;
      const token = `stop:${randomUUID()}`;
      const messageId = await sendMessage(
        coordinates.chatId,
        sourceChatId
          ? "May is working on this message."
          : "May is working in the shared conversation.",
        undefined,
        {
          messageThreadId: coordinates.topicId,
          ...(sourceChatId ? { replyToMessageId: turn.channelMessageId } : {}),
          replyMarkup: { inline_keyboard: [[{ text: "Stop this turn", callback_data: token }]] },
        },
      );
      if (messageId && running)
        turnControls.set(surface, { token, turnId: turn.id, revision: turn.revision, messageId });
    }
  }

  function handleTurnControl(query: any): void {
    const chatId = query.message?.chat?.id;
    const surface = surfaceKey(String(chatId), query.message?.message_thread_id);
    const control = turnControls.get(surface);
    let text = "This Stop button has expired. Refresh the conversation.";
    let admissionFailure: unknown;
    try {
      if (!isAllowed(chatId)) text = "Unauthorized.";
      else if (control && query.data === control.token && query.message?.message_id === control.messageId) {
        const active = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
          limit: 1,
        }).activeTurn;
        if (!active || active.id !== control.turnId || active.revision !== control.revision) {
          text = "That turn already ended. Current work is unchanged.";
        } else {
          let receipt: EventReceipt;
          try {
            receipt = opts.publishEvent({
              type: "conversation.turn.stop.requested",
              target: { appId: opts.interfaceAgent },
              data: {
                conversationId: sharedConversationId,
                turnId: control.turnId,
                expectedRevision: control.revision,
              },
              idempotencyKey: `telegram-stop:${control.turnId}:${control.revision}`,
            });
            requireAdmission(receipt);
          } catch (error) {
            admissionFailure = error;
            throw error;
          }
          text = "Stop request accepted. Background Tasks continue.";
        }
        void clearTurnControl(surface);
        conversationRefresh.queue(sharedConversationId);
      }
    } catch (error) {
      text = `Stop was not confirmed: ${error instanceof Error ? error.message : String(error)}`;
    }
    void apiCall("answerCallbackQuery", { callback_query_id: query.id, text: text.slice(0, 200) }).catch((error) =>
      log("warn", `[telegram] Could not acknowledge Stop: ${String(error)}`),
    );
    if (admissionFailure) throw admissionFailure;
  }

  function handleCallback(query: any): void {
    if (typeof query.data === "string" && query.data.startsWith("stop:")) {
      handleTurnControl(query);
      return;
    }
    const chatId = String(query.message?.chat?.id ?? "");
    let text = "This control is unavailable. Ask May for the current status.";
    if (!isAllowed(query.message?.chat?.id)) text = "Unauthorized.";
    else if (query.data === "task:details" || query.data === "task:follow") {
      const stored = getNotificationMessage(persistDir, chatId, query.message?.message_id);
      let data: Record<string, unknown> | undefined;
      try {
        data = JSON.parse(stored?.data ?? "null") ?? undefined;
      } catch {
        /* legacy facts */
      }
      const target = singleTaskReference(data?.followTask ? [data.followTask] : data?.taskRefs);
      if (target && opts.humanTasks.getTask(target)) {
        handleTelegramCommand(
          query.data === "task:follow" ? "/watch linked" : "/task linked",
          chatId,
          query.message,
          sharedConversationId,
          query.message?.message_thread_id,
          { task: target, topicId: typeof data?.topicId === "string" ? data.topicId : undefined },
        );
        text =
          query.data === "task:follow" ? "Showing this Task. Other work is unchanged." : "Showing current details.";
      }
    }
    void apiCall("answerCallbackQuery", { callback_query_id: query.id, text }).catch((error) =>
      log("warn", `[telegram] Could not acknowledge control: ${String(error)}`),
    );
  }

  async function syncConversation(): Promise<void> {
    const conversation = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
      limit: 200,
    });
    await syncTurnControls(conversation.activeTurn);
    for (const message of conversation.messages) {
      if (!running) return;
      if (renderedConversationMessages.has(message.id)) continue;
      if (
        message.metadata?.channel === "telegram" &&
        (message.author.kind === "human" || message.author.kind === "command")
      ) {
        rememberRenderedConversationMessage(message.id);
        continue;
      }
      const targetChatId = message.metadata?.channelTargetId ?? pendingChatId;
      if (!targetChatId) return;
      const topicId = telegramThreadId(message.metadata?.channelThreadId);
      const surface = surfaceKey(targetChatId, topicId);
      const delivered = await sendMessage(targetChatId, renderTelegramConversationMessage(message), undefined, {
        eventType: "conversation.mirror",
        agent: message.author.kind === "agent" ? opts.interfaceAgent : message.author.id,
        messageThreadId: topicId,
        ...(message.metadata?.channelMessageId ? { replyToMessageId: message.metadata.channelMessageId } : {}),
        replyMarkup: taskButtons(
          message.metadata?.followTask ? [message.metadata.followTask] : message.metadata?.taskRefs,
        ),
        data: JSON.stringify({
          direction: "mirror",
          conversationId: sharedConversationId,
          conversationMessageId: message.id,
          sourceChannel: message.metadata?.channel,
          text: message.text.slice(0, 500),
          taskRefs: message.metadata?.followTask ? [message.metadata.followTask] : message.metadata?.taskRefs,
          topicId: message.metadata?.topicId,
        }),
      });
      if (!delivered || !running) return;
      rememberRenderedConversationMessage(message.id);
      const watched = watchedTasks.get(surface);
      if (
        watched && message.author.kind === "agent" && message.metadata?.taskRefs?.some(
          (task) => task.appId === watched.appId && task.taskId === watched.taskId,
        )
      ) {
        const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
        if (task?.terminal && (task.response?.trim() || task.summary?.trim()) === message.text.trim()) {
          stopWatching(surface);
        }
      }
    }
  }

  function selectedTaskTopicId(surface: string, task: { appId: string; taskId: string }): string | undefined {
    const selected = selectedTopics.get(surface);
    if (!selected) return undefined;
    // Admission can append Task links after selection. Read the current Topic
    // before deciding whether this Task belongs to it.
    const topic = readConversationTopic(getDb(persistDir), opts.interfaceAgent, sharedConversationId, selected.id);
    if (topic) selectedTopics.set(surface, topic);
    else selectedTopics.delete(surface);
    return topic?.taskRefs.some((ref) => ref.appId === task.appId && ref.taskId === task.taskId)
      ? topic.id
      : undefined;
  }

  async function refreshWatch(surface: string): Promise<void> {
    const watched = watchedTasks.get(surface);
    if (!watched) return;
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
    if (task.terminal) {
      const result = task.response?.trim() || task.summary?.trim();
      const conversation = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
        limit: 40,
      });
      const equivalent =
        result &&
        conversation.messages.find(
          (message) =>
            message.author.kind === "agent" &&
            message.text.trim() === result &&
            surfaceKey(
              message.metadata?.channelTargetId ?? pendingChatId ?? "",
              telegramThreadId(message.metadata?.channelThreadId),
            ) === surface &&
            message.metadata?.taskRefs?.some((ref) => ref.appId === task.appId && ref.taskId === task.taskId),
        );
      if (equivalent) {
        if (renderedConversationMessages.has(equivalent.id)) stopWatching(surface);
        else conversationRefresh.queue(sharedConversationId);
        return;
      }
    }
    const rendered = renderTelegramTaskUpdate(task);
    // Keep the card's context consistent even if selection changes during I/O.
    const conversationTopicId = selectedTaskTopicId(surface, task);
    const delivered = await sendMessage(watched.chatId, rendered, undefined, {
      eventType: "task.watch",
      agent: opts.interfaceAgent,
      messageThreadId: watched.topicId,
      replyMarkup: taskButtons([{ appId: task.appId, taskId: task.taskId }]),
      data: JSON.stringify({ taskRefs: [{ appId: task.appId, taskId: task.taskId }], topicId: conversationTopicId }),
    });
    if (delivered && running)
      recordConversationMessage({
        conversationId: sharedConversationId,
        text: rendered,
        command: "/watch update",
        messageId: delivered,
        chatId: watched.chatId,
        topicId: watched.topicId,
        taskRefs: [{ appId: task.appId, taskId: task.taskId }],
        conversationTopicId,
      });
    // A send already in flight cannot be recalled. Its late result must not
    // change a newer selection, including a new watch of the same Task.
    if (!delivered || !running || watchedTasks.get(surface) !== watched) return;
    shownWatchRevisions.set(surface, revision);
    if (task.terminal) stopWatching(surface);
  }

  const todoTaskKey = (task: HumanTaskView): string => `${task.appId}\0${task.taskId}`;
  const todoActionSignature = (task: HumanTaskView): string => humanActionText(task);

  async function refreshTodos(surface: string): Promise<void> {
    const coordinates = surfaces.get(surface);
    if (!coordinates) return;
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
    const single = page.total === 1 && changed.length === 1;
    const taskRefs = (single ? [first] : page.items).map((task) => ({ appId: task.appId, taskId: task.taskId }));
    const text =
      page.total === 1 && changed.length === 1
        ? `Needs your decision: ${first.outcome}\n${humanActionText(first)}\n\nReply here with your decision.`
        : `${page.total ?? page.items.length} Tasks need your action in ${appId}. Ask May what needs your attention, or use /todo.`;
    const messageId = await sendMessage(coordinates.chatId, text, undefined, {
      eventType: "task.human-action",
      agent: opts.interfaceAgent,
      messageThreadId: coordinates.topicId,
      replyMarkup: taskButtons(taskRefs),
      data: JSON.stringify({ taskRefs }),
    });
    if (!messageId || !running) return;
    if ((selectedApps.get(surface) ?? opts.interfaceAgent) === appId) shownTodoActions.set(surface, next);
    // Record what was actually shown, even if the user selected another App
    // during the send; only the current App's notification cache is protected.
    recordConversationMessage({
      conversationId: sharedConversationId,
      text,
      command: "/todo notification",
      messageId,
      chatId: coordinates.chatId,
      topicId: coordinates.topicId,
      taskRefs,
      idempotencyKey: `todo-notification:telegram:${surface}:${first.appId}:${first.taskId}:${first.resourceVersion}`,
    });
  }

  // Allow the EventBus's asynchronous FIFO to drain before reading Conversation.
  const conversationRefresh = createRefreshQueue("Conversation sync", syncConversation, 5);
  const watchRefresh = createRefreshQueue("Watch refresh", refreshWatch);
  const todoRefresh = createRefreshQueue("Todo refresh", refreshTodos);

  function showReloadResult(requestId: string, summary: string): void {
    const pending = pendingReloads.get(requestId);
    if (!pending) return;
    pendingReloads.delete(requestId);
    void sendMessage(pending.chatId, summary, undefined, {
      eventType: "runtime.reload.finished",
      agent: opts.interfaceAgent,
      messageThreadId: pending.topicId,
    })
      .then((messageId) => {
        if (!messageId || !running) return;
        recordConversationMessage({
          conversationId: pending.conversationId,
          text: summary,
          command: pending.command,
          messageId,
          chatId: pending.chatId,
          topicId: pending.topicId,
        });
      })
      .catch((error) => log("warn", `[telegram] Reload result view failed: ${String(error)}`));
  }

  const unsubscribeConversation = bus.listen(
    (event: any) => {
      const data = event && typeof event.data === "object" && event.data ? event.data : {};
      if (event.type === "runtime.reload.finished") {
        const requestId = typeof data.requestId === "string" ? data.requestId : "";
        showReloadResult(requestId, String(data.summary || "[reload] Finished"));
        return;
      }
      if (event.type === "conversation.updated") {
        if (data.appId === opts.interfaceAgent && data.conversationId === sharedConversationId) {
          conversationRefresh.queue(sharedConversationId);
        }
        return;
      }
      const wake = taskUpdateIdentity(event);
      if (!wake) return;
      for (const [surface, watched] of watchedTasks) {
        if (watched.appId === wake.appId && watched.taskId === wake.taskId) watchRefresh.queue(surface);
      }
      if (isTaskDerivedViewWake(event)) {
        for (const surface of surfaces.keys()) {
          const selected = selectedApps.get(surface) ?? opts.interfaceAgent;
          if (selected === wake.appId) todoRefresh.queue(surface);
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
    chatId: string;
    transient?: boolean;
    taskRefs?: Array<{ appId: string; taskId: string }>;
    followTask?: { appId: string; taskId: string };
    conversationTopicId?: string;
    idempotencyKey?: string;
  }): void {
    opts.publishEvent({
      type: "conversation.message.created",
      target: { appId: opts.interfaceAgent },
      data: {
        conversationId: input.conversationId,
        messageId: `telegram:${input.chatId}:${input.messageId}`,
        author: { kind: "command", id: "telegram" },
        text: input.text,
        ...(input.transient ? { transient: true } : {}),
        metadata: {
          channel: "telegram",
          channelTargetId: input.chatId,
          ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
          channelMessageId: input.messageId,
          command: input.command,
          ...(input.conversationTopicId ? { topicId: input.conversationTopicId } : {}),
          ...(input.taskRefs?.length ? { taskRefs: input.taskRefs } : {}),
          ...(input.followTask ? { followTask: input.followTask } : {}),
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

    requireAdmission(received);
    const rowId = received.eventId;
    try {
      storeNotificationMessage(persistDir, {
        chat_id: chatId,
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

  function resumeRecordedInput(type: string, key: string): number | undefined {
    // Provider redelivery may follow restart or a lost publication receipt.
    // Do not rebuild an accepted input using today's focus and cause a hash
    // conflict. The existing event journal/recovery owns its original payload.
    const db = getDb(persistDir);
    const row = db.prepare(
      "SELECT id, delivery_status FROM events WHERE event_type = ? AND source = 'telegram' AND idempotency_key = ? LIMIT 1",
    ).get(type, key);
    if (!row) return undefined;
    // Reload acceptance only starts an asynchronous operation. Its caller has
    // already checked for completion; reenter the route after a crash, while
    // the router shares any execution still in flight in this process.
    if (row.delivery_status !== "accepted" || type === "runtime.reload.requested") {
      const event = loadPersistedEvent(db, Number(row.id), persistDir);
      if (!event) throw new Error("Original Telegram event is unavailable; input remains unacknowledged");
      const retried = bus.redeliverPersisted(event, Number(row.id));
      if (!retried[EVENT_DELIVERY_RESULT]?.accepted) throw new Error("Telegram input is recorded but not yet admitted");
    }
    return Number(row.id);
  }

  function requireAdmission(receipt: EventReceipt): void {
    if (receipt.delivery !== "accepted") throw new Error("Telegram input is recorded but not yet admitted");
  }

  function handleMessage(msg: any): void {
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!chatId) return;

    if (!isAllowed(chatId)) {
      bus.emit({ type: "info", message: `[telegram] Rejected message from unauthorized chat ${chatId}` });
      void sendMessage(String(chatId), "⛔ Unauthorized. This bot is private.");
      return;
    }

    if (!text) {
      // Reject unsupported content honestly; delivery is not input acceptance.
      if (hasTelegramContent(msg)) {
        void sendMessage(
          String(chatId),
          "I can't read this attachment yet. Please paste the question or error text.",
          undefined,
          {
            replyToMessageId: msg.message_id,
            messageThreadId: msg.message_thread_id,
          },
        );
      }
      return;
    }

    const chatIdStr = String(chatId);
    const topicId = msg.message_thread_id as number | undefined;
    const surface = surfaceKey(chatIdStr, topicId);
    surfaces.set(surface, { chatId: chatIdStr, ...(topicId === undefined ? {} : { topicId }) });
    const conversationId = primaryConversationId(opts.interfaceAgent);
    if (
      !text.startsWith("/") &&
      resumeRecordedInput("conversation.message.created", `telegram:${chatIdStr}:${msg.message_id}`)
    )
      return;
    conversationRefresh.queue(sharedConversationId);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    // Keep the human text authoritative. A reply contributes only its provider
    // anchor and bounded quoted text; Conversation and Task resources own the
    // semantic context.
    let inputContext: Record<string, unknown> | undefined;
    const replyToMsg = msg.reply_to_message;
    const replyToMsgId = replyToMsg?.message_id;
    let replyToSourceId: string | undefined;
    let replyTopicId: string | undefined;
    let replyTask: { appId: string; taskId: string } | undefined;
    if (replyToMsgId) {
      try {
        const notification = getNotificationMessage(persistDir, chatIdStr, replyToMsgId);
        const data = notification?.data ? (JSON.parse(notification.data) as Record<string, unknown>) : undefined;
        replyTask = singleTaskReference(data?.followTask ? [data.followTask] : data?.taskRefs);
        replyTopicId = typeof data?.topicId === "string" ? data.topicId : undefined;
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

    try {
      if (handleTelegramCommand(text, chatIdStr, msg, conversationId, topicId)) return;
    } catch (error) {
      if (!(error instanceof TaskReferenceError)) throw error;
      queueCommandDelivery(surface, () =>
        sendMessage(chatIdStr, `${error.message}. Ask May to find the work, or use /tasks.`, undefined, {
          replyToMessageId: msg.message_id,
          messageThreadId: topicId,
        }),
      );
      return;
    }

    // Every ordinary turn becomes one durable May request.
    const focusedTask = replyToMsgId ? replyTask : watchedTasks.get(surfaceKey(chatIdStr, topicId));
    const focusedApp = replyToMsgId
      ? (replyTask?.appId ?? opts.interfaceAgent)
      : (selectedApps.get(surface) ?? opts.interfaceAgent);
    const conversationTopic = replyToMsgId ? undefined : selectedTopics.get(surface);
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
      replyToSourceId,
      replyTopicId ?? conversationTopic?.id,
    );
    // Presentation after durable recording cannot turn a saved input into a retry.
    try {
      const active = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
        limit: 1,
      }).activeTurn;
      if (
        active &&
        !(
          active.channel === "telegram" &&
          active.channelTargetId === chatIdStr &&
          active.channelMessageId === msg.message_id
        )
      ) {
        void sendMessage(
          chatIdStr,
          "Message saved. May is still handling an earlier turn; this message hasn't changed running work yet.",
          undefined,
          { replyToMessageId: msg.message_id, messageThreadId: topicId },
        );
      }
    } catch (error) {
      log("warn", `[telegram] Could not show queue status: ${String(error)}`);
    }
  }

  function handleTelegramCommand(
    text: string,
    chatIdStr: string,
    msg: any,
    conversationId: string,
    topicId?: number,
    linked?: { task: { appId: string; taskId: string }; topicId?: string },
  ): boolean {
    if (!text.startsWith("/")) return false;

    const [cmd = "", ...rest] = text.split(/\s+/);
    const command = cmd.split("@")[0];
    const surface = surfaceKey(chatIdStr, topicId);

    const taskTopicId = (task: { appId: string; taskId: string }): string | undefined => {
      // A clicked message supplies its own context, never today's selection.
      if (linked) return linked.topicId;
      return selectedTaskTopicId(surface, task);
    };

    const deliverCommandView = (
      rendered: string,
      taskRefs: Array<{ appId: string; taskId: string }> = [],
      onDelivered?: () => void,
      followTask?: { appId: string; taskId: string },
    ): void => {
      const conversationTopicId = followTask ? taskTopicId(followTask) : selectedTopics.get(surface)?.id;
      queueCommandDelivery(surface, async () => {
        const deliveredMessageId = await sendMessage(chatIdStr, rendered, undefined, {
          eventType: "telegram.reply",
          agent: opts.interfaceAgent,
          data: JSON.stringify({
            direction: "outbound",
            conversationId,
            command: text,
            taskRefs,
            followTask,
            topicId: conversationTopicId,
          }),
          replyToMessageId: msg.message_id,
          messageThreadId: topicId,
          replyMarkup: taskButtons(followTask ? [followTask] : taskRefs),
        });
        if (!deliveredMessageId || !running) return;
        recordConversationMessage({
          conversationId,
          text: rendered,
          command: text,
          messageId: deliveredMessageId,
          chatId: chatIdStr,
          topicId,
          taskRefs,
          followTask,
          conversationTopicId,
        });
        onDelivered?.();
      });
    };

    if (command === "/apps") {
      if (rest.length > 1) deliverCommandView("Use: /apps [app]");
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
        deliverCommandView(
          apps.length === 0
            ? `App ${rest[0]} was not found.`
            : `${rest[0] ? `Selected App: ${selected}\n` : ""}${renderTelegramApps(apps, selected)}`,
        );
        if (selectedChanged) todoRefresh.queue(surface);
      }
      return true;
    }

    if (command === "/topics") {
      const more = rest.length === 1 && rest[0]?.toLowerCase() === "more";
      if (rest.length > 1 || (rest.length === 1 && !more)) deliverCommandView("Use: /topics, or /topics more");
      else {
        const cursor = more ? nextTopicPageBySurface.get(surface) : undefined;
        if (more && !cursor) {
          deliverCommandView("No next page. Use /topics first.");
          return true;
        }
        const conversation = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
          limit: 30,
          ...(cursor ? { topicCursor: cursor } : {}),
        });
        if (conversation.nextTopicCursor) nextTopicPageBySurface.set(surface, conversation.nextTopicCursor);
        else nextTopicPageBySurface.delete(surface);
        deliverCommandView(
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
        deliverCommandView("Use: /topic [ref|clear]");
        return true;
      }
      if (rest[0]?.toLowerCase() === "clear") {
        const prior = selectedTopics.get(surface);
        selectedTopics.delete(surface);
        deliverCommandView(
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
        deliverCommandView(
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
      deliverCommandView(renderTelegramTopic(topic, conversation.messages), topic.taskRefs);
      return true;
    }

    if (command === "/todo") {
      const tokens = rest.map((part) => part.toLowerCase());
      const more = tokens.length === 1 && tokens[0] === "more";
      const prior = more ? nextTodoPageBySurface.get(surface) : undefined;
      if (more && !prior) {
        deliverCommandView("No next page. Use /todo first.");
        return true;
      }
      if (tokens.length > 1 || (tokens.length === 1 && tokens[0] !== "all" && !more)) {
        deliverCommandView("Use: /todo [all], or /todo more");
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
      deliverCommandView(
        renderTelegramTodos(page.items, page.total ?? page.items.length, appId, Boolean(page.nextCursor)),
        page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
        () => {
          if (!more && appId === (selectedApps.get(surface) ?? opts.interfaceAgent)) {
            shownTodoActions.set(
              surface,
              new Map(page.items.map((task) => [todoTaskKey(task), todoActionSignature(task)])),
            );
          }
        },
      );
      return true;
    }

    if (command === "/tasks") {
      const more = rest.length === 1 && rest[0].toLowerCase() === "more";
      const prior = more ? nextTaskPageBySurface.get(surface) : undefined;
      if (more && !prior) {
        deliverCommandView("No next page. Use /tasks first.");
        return true;
      }
      const tokens = more ? [] : rest.map((part) => part.toLowerCase());
      if (tokens.some((part) => part !== "all" && part !== "history") || new Set(tokens).size !== tokens.length) {
        deliverCommandView("Use: /tasks [all] [history], or /tasks more");
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
      deliverCommandView(
        renderTelegramTasks(page.items, includeDone, Boolean(page.nextCursor)),
        page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
      );
      return true;
    }

    if (command === "/task") {
      if (rest.length !== 1) {
        deliverCommandView("Use: /task <ref>");
        return true;
      }
      const task = opts.humanTasks.getTask(linked?.task ?? { ref: rest[0] });
      deliverCommandView(
        task ? renderTelegramTask(task) : `Task ${rest[0]} was not found.`,
        task ? representedTaskIdentities(task) : [],
        undefined,
        task ? { appId: task.appId, taskId: task.taskId } : undefined,
      );
      return true;
    }

    if (command === "/watch") {
      if (rest.length > 1) {
        deliverCommandView("Use: /watch [ref]");
        return true;
      }
      if (rest.length === 0) {
        const watched = watchedTasks.get(surface);
        if (!watched) deliverCommandView("No Task is watched. Use /watch <ref>.");
        else {
          const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
          deliverCommandView(
            task ? renderTelegramTask(task) : `Task ${watched.ref} was not found; watch ended.`,
            task ? representedTaskIdentities(task) : [],
            () => {
              if (task && watchedTasks.get(surface) === watched)
                shownWatchRevisions.set(surface, taskPresentationRevision(task));
            },
            task ? { appId: task.appId, taskId: task.taskId } : undefined,
          );
          if (!task || task.terminal) {
            stopWatching(surface);
          }
        }
        return true;
      }
      const task = opts.humanTasks.getTask(linked?.task ?? { ref: rest[0] });
      if (!task) {
        deliverCommandView(`Task ${rest[0]} was not found.`);
      } else if (task.terminal) {
        deliverCommandView(
          `${renderTelegramTask(task)}\n\nThis Task is terminal, so it was not watched. Your current selection is unchanged.`,
          representedTaskIdentities(task),
          undefined,
          { appId: task.appId, taskId: task.taskId },
        );
      } else {
        const topicRef = taskTopicId(task);
        const topic = topicRef
          ? readConversationTopic(getDb(persistDir), opts.interfaceAgent, conversationId, topicRef)
          : null;
        if (topic) selectedTopics.set(surface, topic);
        else selectedTopics.delete(surface);
        selectedApps.set(surface, task.appId);
        watchedTasks.set(surface, {
          appId: task.appId,
          taskId: task.taskId,
          ref: task.ref,
          chatId: chatIdStr,
          ...(topicId === undefined ? {} : { topicId }),
        });
        const watched = watchedTasks.get(surface);
        deliverCommandView(
          `${renderTelegramTaskUpdate(task)}\n\nFollowing updates. Reply here to discuss this work. Other Tasks continue unchanged.`,
          [{ appId: task.appId, taskId: task.taskId }],
          () => {
            if (watchedTasks.get(surface) === watched) shownWatchRevisions.set(surface, taskPresentationRevision(task));
          },
          { appId: task.appId, taskId: task.taskId },
        );
      }
      return true;
    }

    if (command === "/unwatch") {
      if (rest.length > 0) deliverCommandView("Use: /unwatch");
      else if (stopWatching(surface)) {
        deliverCommandView("Stopped watching. The Task is unchanged.");
      } else deliverCommandView("No Task is watched.");
      return true;
    }

    if (command === "/cancel") {
      const cancellationKey = `telegram:${chatIdStr}:${msg.message_id}:cancel`;
      if (resumeRecordedInput("app.task.cancel.requested", cancellationKey)) return true;
      if (rest.length > 1) {
        deliverCommandView("Use: /cancel [ref]");
        return true;
      }
      const watched = watchedTasks.get(surface);
      if (!rest[0] && !watched) {
        deliverCommandView("Use: /cancel <ref>, or watch a Task first.");
        return true;
      }
      const selected = opts.humanTasks.getTask(
        rest[0]
          ? { ref: rest[0] }
          : {
              appId: watched!.appId,
              taskId: watched!.taskId,
            },
      );
      if (!selected) {
        deliverCommandView("Task was not found; nothing was cancelled.");
        return true;
      }
      // Persistence failures reach polling before its acknowledgment advances.
      // After persistence, uncertain presentation must never replay the mutation.
      const receipt = opts.publishEvent({
        ...taskCancelRequestedEvent(selected, "human requested cancellation from Telegram"),
        idempotencyKey: cancellationKey,
      });
      requireAdmission(receipt);
      try {
        const task = opts.humanTasks.getTask({ appId: selected.appId, taskId: selected.taskId });
        if (!task) throw new Error("Task disappeared after cancellation");
        stopWatching(surface);
        deliverCommandView(renderTelegramTask(task), representedTaskIdentities(task), undefined, {
          appId: task.appId, taskId: task.taskId,
        });
      } catch (error) {
        deliverCommandView(`[cancel] ${error instanceof Error ? error.message : String(error)}`);
      }
      return true;
    }

    if (command === "/start" || command === "/help") {
      queueCommandDelivery(surface, () =>
        sendMessage(
          chatIdStr,
          "🤖 *May*\n\n" +
            "Tell May what you need. Reply to an update to follow up.\n" +
            "You can ask ‘What's still running?’ or ‘Where were we?’ without remembering IDs.\n" +
            "Background work continues when you close Telegram.\n\n" +
            "*Optional shortcuts:*\n" +
            "/apps \[app\] — List or select an App\n" +
            "/topics — List Topics; use /topics more for older pages\n" +
            "/topic \[ref\|clear\] — Show, follow, or leave a Topic\n" +
            "/tasks \[all\] \[history\], /tasks more — Show Tasks\n" +
            "/todo \[all\], /todo more — Show Tasks that need your action\n" +
            "/task <ref> — Show one Task\n" +
            "/watch \[ref\] — Watch or show one Task\n" +
            "/unwatch — Stop watching without changing the Task\n" +
            "/cancel \[ref\] — Cancel a Task\n" +
            "/help — Show this message\n\n" +
            "Use Stop this turn to interrupt the current turn; background Tasks continue. New messages wait their turn.\n\n" +
            "*Host administration (all Apps):*\n" +
            "/reload — Reload Host definitions",
          "Markdown",
          { messageThreadId: topicId },
        ),
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
      // Completion can be durable even if recording acceptance failed. Check
      // the exact request's result before redelivery can repeat the reload.
      const db = getDb(persistDir);
      const completion = db.prepare(`
        SELECT e.id FROM events request
        JOIN event_traces t ON t.parent_event_id = request.id
        JOIN events e ON e.id = t.event_id
        WHERE request.event_type = 'runtime.reload.requested'
          AND request.source = 'telegram' AND request.idempotency_key = ?
          AND e.event_type = 'runtime.reload.finished'
        ORDER BY e.id DESC LIMIT 1
      `).get(requestId);
      if (completion) {
        const event = loadPersistedEvent(db, Number(completion.id), persistDir);
        if (!event) throw new Error("Saved reload result is unavailable");
        showReloadResult(requestId, String(eventData(event).summary || "[reload] Finished"));
        return true;
      }
      if (resumeRecordedInput("runtime.reload.requested", requestId)) return true;
      const receipt = opts.publishEvent({
        type: "runtime.reload.requested",
        data: { requestId },
        idempotencyKey: requestId,
      });
      requireAdmission(receipt);
      return true;
    }

    queueCommandDelivery(surface, () =>
      sendMessage(chatIdStr, `Unknown command: ${command}. Use /help to see available commands.`, undefined, {
        eventType: "telegram.reply",
        agent: opts.interfaceAgent,
        data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
        replyToMessageId: msg.message_id,
        messageThreadId: topicId,
      }),
    );
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
      if (!running) return;
      bus.emit({ type: "info", message: `[telegram] Bot: @${me.username} (${me.first_name})` });
      // Configured chats are valid notification surfaces immediately after a
      // restart; receiving a new message is not a prerequisite for alerts.
      for (const chatId of allowedChatIds) {
        const surface = surfaceKey(chatId);
        surfaces.set(surface, { chatId });
        todoRefresh.queue(surface);
      }
      conversationRefresh.queue(sharedConversationId);
    } catch (err) {
      if (!running) return;
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[telegram] Failed to connect: ${msg}` });
      return;
    }

    while (running) {
      try {
        const updates = await apiCall("getUpdates", {
          offset,
          timeout: 30,
          allowed_updates: ["message", "callback_query"],
        });
        if (!running) break;

        if (Array.isArray(updates)) {
          for (const update of updates) {
            if (update.callback_query) {
              handleCallback(update.callback_query);
            }
            if (update.message) {
              // Recording and local selection are synchronous, in provider order.
              // Sends and model work never hold up another input or Stop callback.
              handleMessage(update.message);
            }
            // A failure above leaves this update and its suffix unacknowledged.
            offset = update.update_id + 1;
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
      telegramClient.close();
      turnControls.clear();
      conversationRefresh.close();
      watchRefresh.close();
      todoRefresh.close();
      unsubscribeConversation();
    },
  };
}
