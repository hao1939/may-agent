/**
 * Telegram Bot transport and surface adapter for May.
 *
 * Shares the same control-plane contract as `may-console`:
 *   - Reads through `getAppConversation` and `humanTasks` (`listApps`, `listTasks`, `getTask`)
 *   - Writes through `publishEvent`
 *   - Subscribes to `conversation.updated`, `runtime.reload.finished`, and `TASK_UPDATE_EVENT_TYPES`
 *   - Maintains one `SurfaceSession` per `(chatId, topicId)` coordinate
 *   - Uses `telegram-format.ts` for pure rendering and `telegram-client.ts` for Bot API I/O and delivery receipts
 */

import { randomUUID } from "node:crypto";
import { setDefaultAutoSelectFamily } from "node:net";
import type { AppConversationResource, AppConversationTopic } from "@may-agent/sdk";
import type { ApprovalProposal, EventInput, EventReceipt } from "@may-agent/control/events";
import type { EventBus } from "../core/events/bus.js";
import { readPersistedTelegramReloadCompletion, resumeRecordedTelegramInput } from "../core/events/persisted.js";
import { log } from "../../lib/log.js";
import {
  isTaskDerivedViewWake,
  TASK_UPDATE_EVENT_TYPES,
  taskUpdateIdentity,
} from "../../../packages/control/src/task-wake.js";
import {
  TaskReferenceError,
  approvalProposalForTask,
  humanConditionAnchorForTask as humanConditionAnchor,
  readHumanConversation,
  readHumanConversationTopic,
  todoActionSignatureForTask as todoActionSignature,
  type HumanTaskService,
  type HumanTaskView,
} from "../human-task-service.js";
import { taskCancelRequestedEvent } from "../task-control-events.js";
import { createTelegramClient, telegramThreadId } from "./telegram-client.js";
import {
  TELEGRAM_HELP_MARKDOWN,
  primaryConversationId,
  renderTelegramApps,
  renderTelegramConversationMessage,
  renderTelegramSingleTodoNotification,
  renderTelegramTask,
  renderTelegramTaskUpdate,
  renderTelegramTasks,
  renderTelegramTodos,
  renderTelegramTopic,
  renderTelegramTopics,
  representedTaskIdentities,
  resolveConversationTopic,
  singleTaskReference,
  taskButtons,
  taskPresentationRevision,
  telegramConversationInputEvent,
  topicReference,
  type TelegramApprovalAnchor,
} from "./telegram-format.js";

export {
  primaryConversationId,
  renderTelegramApps,
  renderTelegramConversationMessage,
  renderTelegramTask,
  renderTelegramTasks,
  renderTelegramTodos,
  renderTelegramTopic,
  renderTelegramTopics,
  taskPresentationRevision,
  telegramConversationInputEvent,
  type TelegramApprovalAnchor,
};

const TASK_PAGE_SIZE = 10;
const TODO_PAGE_SIZE = 50;

// Non-text content in https://core.telegram.org/bots/api#message (reviewed 2026-09-12).
// Also acknowledge explicit user shares/Web App data; passive service notices stay quiet.
const TELEGRAM_CONTENT_FIELDS = [
  "animation",
  "audio",
  "document",
  "live_photo",
  "paid_media",
  "photo",
  "sticker",
  "story",
  "video",
  "video_note",
  "voice",
  "caption",
  "checklist",
  "contact",
  "dice",
  "game",
  "poll",
  "venue",
  "location",
  "rich_message",
  "invoice",
  "giveaway",
  "giveaway_winners",
  "passport_data",
  "users_shared",
  "chat_shared",
  "web_app_data",
] as const;

function hasTelegramContent(message: Record<string, unknown>): boolean {
  return TELEGRAM_CONTENT_FIELDS.some((field) => message[field] != null);
}

function telegramMessageText(message: any): string {
  const text = message?.text ?? message?.caption ?? "";
  return typeof text === "string" ? text.trim() : "";
}

function surfaceKey(chatId: string, topicId?: number): string {
  return `${chatId}:${topicId ?? 0}`;
}

// Force IPv4 for fetch — Node 22's undici tries IPv6 first which times out
// on some networks (e.g., when IPv6 to api.telegram.org is unreachable).
try {
  setDefaultAutoSelectFamily(false);
} catch {
  /* noop — bun may not support */
}

interface WatchedTaskTarget {
  appId: string;
  taskId: string;
  ref: string;
  chatId: string;
  topicId?: number;
}

/** Unified per-surface session state (one per `chatId:topicId` coordinate). */
interface SurfaceSession {
  readonly key: string;
  readonly chatId: string;
  readonly topicId?: number;
  selectedApp?: string;
  selectedTopic?: AppConversationTopic;
  watchedTask?: WatchedTaskTarget;
  shownWatchRevision?: string;
  shownTodoActions: Map<string, string>;
  nextTaskPage?: { appId?: string; includeDone: boolean; cursor: string };
  nextTopicCursor?: string;
  nextTodoPage?: { appId?: string; cursor: string };
  turnControl?: { token: string; turnId: string; revision: number; messageId: number };
}

export interface TelegramBotOptions {
  persistDir?: string;
  bus: EventBus;
  interfaceAgent: string;
  conversationAppId?: string;
  conversationId?: string;
  getAppConversation?: (
    appId: string,
    conversationId: string,
    options?: { limit?: number; topicId?: string; topicLimit?: number; topicCursor?: string },
  ) => AppConversationResource;
  humanTasks: Pick<HumanTaskService, "getTask" | "listApps" | "listTasks">;
  publishEvent: (
    input: EventInput,
    approvalAuthorization?: {
      actor: { kind: "human"; id: string };
      reference: string;
      evidence: Record<string, unknown>;
    },
  ) => EventReceipt;
}

export interface TelegramBot {
  close: () => void;
}

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus } = opts;

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const allowedChatIds = (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const allowedApproverIds = (process.env.TELEGRAM_APPROVER_ID || "")
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

  const conversationAppId = opts.conversationAppId?.trim() || "";
  if (!conversationAppId) throw new Error("Telegram requires CONVERSATION_APP");
  const sharedConversationId = opts.conversationId ?? primaryConversationId(conversationAppId);
  const getConversation =
    opts.getAppConversation ??
    ((appId, conversationId, options) => readHumanConversation(persistDir, appId, conversationId, options));

  bus.emit({ type: "info", message: `[telegram] Bot enabled (${allowedChatIds.length} allowed chat(s))` });
  let running = true;
  let offset = 0;

  const telegramClient = createTelegramClient({
    token,
    persistDir,
    bus,
    conversationAppId,
    sharedConversationId,
    interfaceAgent: opts.interfaceAgent,
    emitInfo: (message) => bus.emit({ type: "info", message }),
  });
  const { apiCall, sendMessage } = telegramClient;

  // Single map of surface sessions indexed by `chatId:topicId`
  const sessions = new Map<string, SurfaceSession>();
  function ensureSession(chatId: string, topicId?: number): SurfaceSession {
    const key = surfaceKey(chatId, topicId);
    let session = sessions.get(key);
    if (!session) {
      session = {
        key,
        chatId,
        ...(topicId === undefined ? {} : { topicId }),
        shownTodoActions: new Map(),
      };
      sessions.set(key, session);
    }
    return session;
  }

  function stopWatching(session: SurfaceSession | undefined): boolean {
    if (!session?.watchedTask) return false;
    delete session.watchedTask;
    delete session.shownWatchRevision;
    return true;
  }

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

  const pendingReloads = new Map<
    string,
    { chatId: string; topicId?: number; conversationId: string; command: string }
  >();
  const renderedConversationMessages = new Set<string>();
  function rememberRenderedConversationMessage(messageId: string): void {
    renderedConversationMessages.add(messageId);
    while (renderedConversationMessages.size > 512) {
      const oldest = renderedConversationMessages.values().next().value;
      if (typeof oldest !== "string") break;
      renderedConversationMessages.delete(oldest);
    }
  }

  try {
    telegramClient.captureStartupMessages(
      getConversation(conversationAppId, sharedConversationId, { limit: 200 }).messages,
      rememberRenderedConversationMessage,
    );
  } catch (error) {
    log(
      "warn",
      `[telegram] Startup Conversation read unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
        clearTimeout(existing.timer);
      }
      const state = { timer: null as ReturnType<typeof setTimeout> | null, dirty: false };
      pending.set(key, state);
      state.timer = setTimeout(async () => {
        state.timer = null;
        try {
          if (running) await refresh(key);
        } catch (error) {
          log("warn", `[telegram] ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
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

  async function clearTurnControl(session: SurfaceSession): Promise<void> {
    const control = session.turnControl;
    delete session.turnControl;
    if (!control) return;
    try {
      await apiCall("editMessageReplyMarkup", {
        chat_id: session.chatId,
        message_id: control.messageId,
        reply_markup: { inline_keyboard: [] },
      });
    } catch (error) {
      log("warn", `[telegram] Could not clear turn button: ${String(error)}`);
    }
  }

  async function syncTurnControls(turn?: AppConversationResource["activeTurn"]): Promise<void> {
    const sourceChatId = turn?.channel === "telegram" ? turn.channelTargetId : undefined;
    const topicId = telegramThreadId(turn?.channelThreadId);
    const sourceSurface = sourceChatId ? surfaceKey(sourceChatId, topicId) : undefined;
    if (sourceChatId && allowedChatIds.includes(sourceChatId)) {
      ensureSession(sourceChatId, topicId);
    }
    for (const session of sessions.values()) {
      if (!running) return;
      const previous = session.turnControl;
      if (session.key !== sourceSurface) {
        if (previous) await clearTurnControl(session);
        continue;
      }
      if (previous?.turnId === turn?.id && previous?.revision === turn?.revision) continue;
      if (previous) await clearTurnControl(session);
      if (!turn) continue;
      const token = `stop:${randomUUID()}`;
      const messageId = await sendMessage(
        session.chatId,
        "May is working on this message.",
        undefined,
        {
          messageThreadId: session.topicId,
          ...(sourceChatId ? { replyToMessageId: turn.channelMessageId } : {}),
          replyMarkup: { inline_keyboard: [[{ text: "Stop this turn", callback_data: token }]] },
        },
      );
      if (messageId && running) {
        session.turnControl = { token, turnId: turn.id, revision: turn.revision, messageId };
      }
    }
  }

  async function syncConversation(): Promise<void> {
    const conversation = getConversation(conversationAppId, sharedConversationId, { limit: 200 });
    telegramClient.captureStartupMessages(conversation.messages, rememberRenderedConversationMessage);
    await syncTurnControls(conversation.activeTurn);
    for (const message of conversation.messages) {
      if (!running) return;
      const outcome = await telegramClient.deliverConversationMessage(
        message,
        pendingChatId,
        renderedConversationMessages,
        rememberRenderedConversationMessage,
      );
      if (!running || outcome.status === "halted") return;
      if (outcome.status === "skipped" || !outcome.targetChatId) continue;
      const session = sessions.get(surfaceKey(outcome.targetChatId, outcome.topicId));
      const watched = session?.watchedTask;
      if (
        watched &&
        message.author.kind === "agent" &&
        message.metadata?.taskRefs?.some((task) => task.appId === watched.appId && task.taskId === watched.taskId)
      ) {
        const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
        if (task?.terminal && (task.response?.trim() || task.summary?.trim()) === message.text.trim()) {
          stopWatching(session);
        }
      }
    }
  }

  function selectedTaskTopicId(
    session: SurfaceSession | undefined,
    task: { appId: string; taskId: string },
  ): string | undefined {
    const selected = session?.selectedTopic;
    if (!session || !selected) return undefined;
    const topic = readHumanConversationTopic(persistDir, conversationAppId, sharedConversationId, selected.id);
    if (topic) session.selectedTopic = topic;
    else delete session.selectedTopic;
    return topic?.taskRefs.some((ref) => ref.appId === task.appId && ref.taskId === task.taskId) ? topic.id : undefined;
  }

  const todoTaskKey = (task: HumanTaskView): string => `${task.appId}\0${task.taskId}`;
  const presentedTodoActionRevision = (signature: { value: string; exact: boolean }) =>
    JSON.stringify({ value: signature.value, exact: signature.exact });

  async function refreshWatch(surface: string): Promise<void> {
    const session = sessions.get(surface);
    const watched = session?.watchedTask;
    if (!session || !watched) return;
    const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
    if (!task) {
      stopWatching(session);
      await sendMessage(watched.chatId, `Task ${watched.ref} is no longer available; watch ended.`, undefined, {
        messageThreadId: watched.topicId,
      });
      return;
    }
    const revision = taskPresentationRevision(task);
    if (session.shownWatchRevision === revision) return;
    if (task.terminal) {
      const result = task.response?.trim() || task.summary?.trim();
      const conversation = getConversation(conversationAppId, sharedConversationId, { limit: 40 });
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
        if (telegramClient.isConversationMessageDelivered(equivalent, renderedConversationMessages)) {
          stopWatching(session);
        } else {
          conversationRefresh.queue(sharedConversationId);
        }
        return;
      }
    }
    const rendered = renderTelegramTaskUpdate(task);
    const displayedApproval = approvalProposalForTask(task);
    const displayedHumanCondition = !displayedApproval ? humanConditionAnchor(task) : null;
    const displayedAction = task.humanAction
      ? { key: todoTaskKey(task), signature: todoActionSignature(task) }
      : null;
    const conversationTopicId = selectedTaskTopicId(session, task);
    const delivered = await sendMessage(watched.chatId, rendered, undefined, {
      eventType: "task.watch",
      agent: opts.interfaceAgent,
      messageThreadId: watched.topicId,
      replyMarkup: taskButtons([{ appId: task.appId, taskId: task.taskId }]),
      data: JSON.stringify({
        taskRefs: [{ appId: task.appId, taskId: task.taskId }],
        topicId: conversationTopicId,
        ...(displayedApproval ? { approvalAnchor: displayedApproval } : {}),
        ...(displayedHumanCondition ? { humanCondition: displayedHumanCondition } : {}),
        ...(displayedAction?.signature.exact
          ? {
              completedHumanAction: {
                version: 1,
                appId: task.appId,
                taskId: task.taskId,
                signature: displayedAction.signature.value,
              },
            }
          : {}),
      }),
      bindToCompleteDelivery: Boolean(displayedApproval || displayedHumanCondition || displayedAction?.signature.exact),
    });
    if (!delivered || !running) return;
    if (session.watchedTask !== watched) {
      if (session.watchedTask) {
        delete session.shownWatchRevision;
        watchRefresh.queue(surface);
      }
      return;
    }
    const currentTask = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
    if (!currentTask || taskPresentationRevision(currentTask) !== revision) {
      delete session.shownWatchRevision;
      watchRefresh.queue(surface);
      return;
    }
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
    session.shownWatchRevision = revision;
    if (displayedAction) {
      session.shownTodoActions.set(displayedAction.key, presentedTodoActionRevision(displayedAction.signature));
    }
    if (task.terminal) stopWatching(session);
  }

  async function refreshTodos(surface: string): Promise<void> {
    const session = sessions.get(surface);
    if (!session) return;
    const appId = session.selectedApp ?? conversationAppId;
    const page = opts.humanTasks.listTasks({ appId, humanActionOnly: true, limit: TODO_PAGE_SIZE });
    const actions = page.items.map((task) => {
      const owner = task.humanAction?.task ?? { appId: task.appId, taskId: task.taskId };
      const detail = opts.humanTasks.getTask?.(owner) ?? task;
      return { task, detail, signature: todoActionSignature(detail) };
    });
    const prior = session.shownTodoActions;
    const currentKeys = new Set(actions.map(({ task }) => todoTaskKey(task)));
    const next = new Map([...prior].filter(([key]) => currentKeys.has(key)));
    const watched = session.watchedTask;
    const changed = actions.filter(({ task, detail, signature }) => {
      if (watched?.appId === task.appId && watched.taskId === task.taskId) return false;
      const key = todoTaskKey(task);
      const revision = presentedTodoActionRevision(signature);
      if (prior.get(key) === revision) return false;
      if (!signature.exact) return true;
      if (
        telegramClient.hasDeliveredHumanAction(session.chatId, session.topicId, {
          appId: detail.appId,
          taskId: detail.taskId,
          signature: signature.value,
        })
      ) {
        next.set(key, revision);
        return false;
      }
      return true;
    });
    session.shownTodoActions = next;
    if (changed.length === 0) return;
    const first = changed[0]!;
    const single = changed.length === 1;
    const proposal = first.detail;
    const taskRefs = changed.map(({ detail }) => ({ appId: detail.appId, taskId: detail.taskId }));
    const completedHumanActions = changed.flatMap(({ detail, signature }) =>
      signature.exact
        ? [{ version: 1, appId: detail.appId, taskId: detail.taskId, signature: signature.value }]
        : [],
    );
    const displayedApproval = single ? approvalProposalForTask(proposal) : null;
    const displayedHumanCondition = single && !displayedApproval ? humanConditionAnchor(proposal) : null;
    const text = single
      ? renderTelegramSingleTodoNotification(proposal)
      : renderTelegramTodos(
          changed.map(({ detail }) => detail),
          changed.length,
          appId,
        );
    const messageId = await sendMessage(session.chatId, text, single ? undefined : "HTML", {
      eventType: "task.human-action",
      agent: opts.interfaceAgent,
      messageThreadId: session.topicId,
      replyMarkup: taskButtons(taskRefs),
      data: JSON.stringify({
        taskRefs,
        ...(displayedApproval ? { approvalAnchor: displayedApproval } : {}),
        ...(displayedHumanCondition ? { humanCondition: displayedHumanCondition } : {}),
        ...(single && completedHumanActions[0]
          ? { completedHumanAction: completedHumanActions[0] }
          : completedHumanActions.length > 0
            ? { completedHumanActions }
            : {}),
      }),
      bindToCompleteDelivery: Boolean(
        displayedApproval || displayedHumanCondition || completedHumanActions.length > 0,
      ),
    });
    if (!messageId || !running) return;
    if ((session.selectedApp ?? conversationAppId) === appId) {
      for (const { task, signature } of changed) {
        next.set(todoTaskKey(task), presentedTodoActionRevision(signature));
      }
      session.shownTodoActions = next;
    }
    recordConversationMessage({
      conversationId: sharedConversationId,
      text,
      command: "/todo notification",
      messageId,
      chatId: session.chatId,
      topicId: session.topicId,
      taskRefs,
      idempotencyKey: `todo-notification:telegram:${surface}:${first.task.appId}:${first.task.taskId}:${first.task.resourceVersion}`,
    });
  }

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
        if (data.appId === conversationAppId && data.conversationId === sharedConversationId) {
          conversationRefresh.queue(sharedConversationId);
        }
        return;
      }
      const wake = taskUpdateIdentity(event);
      if (!wake) return;
      for (const session of sessions.values()) {
        const watched = session.watchedTask;
        if (watched?.appId === wake.appId && watched.taskId === wake.taskId) {
          watchRefresh.queue(session.key);
        }
        if (isTaskDerivedViewWake(event)) {
          const selected = session.selectedApp ?? conversationAppId;
          if (selected === wake.appId) todoRefresh.queue(session.key);
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
      target: { appId: conversationAppId },
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

  function isAllowed(chatId: number): boolean {
    return allowedChatIds.includes(String(chatId));
  }

  function resumeRecordedInput(type: string, key: string, requireAccepted = true): number | undefined {
    return resumeRecordedTelegramInput(persistDir, bus, {
      type,
      idempotencyKey: key,
      requireAccepted,
    });
  }

  function requireAdmission(receipt: EventReceipt): void {
    if (receipt.delivery !== "accepted") throw new Error("Telegram input is recorded but not yet admitted");
  }

  function handleTurnControl(query: any): void {
    const chatId = query.message?.chat?.id;
    const session = sessions.get(surfaceKey(String(chatId), query.message?.message_thread_id));
    const control = session?.turnControl;
    let text = "This Stop button has expired. Refresh the conversation.";
    let admissionFailure: unknown;
    try {
      if (!isAllowed(chatId)) text = "Unauthorized.";
      else if (session && control && query.data === control.token && query.message?.message_id === control.messageId) {
        const active = getConversation(conversationAppId, sharedConversationId, { limit: 1 }).activeTurn;
        if (!active || active.id !== control.turnId || active.revision !== control.revision) {
          text = "That turn already ended. Current work is unchanged.";
        } else {
          try {
            const receipt = opts.publishEvent({
              type: "conversation.turn.stop.requested",
              target: { appId: conversationAppId },
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
        void clearTurnControl(session);
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
    else if (/^task:(details(?::\d+)?|follow)$/.test(query.data)) {
      const lookup = telegramClient.readMessageContext(chatId, query.message?.message_id);
      const indexedDetails = /^task:details:(\d+)$/.exec(query.data);
      const target = indexedDetails
        ? lookup.taskRefs[Number(indexedDetails[1])]
        : singleTaskReference(lookup.taskRefs);
      if (target && opts.humanTasks.getTask(target)) {
        const session = ensureSession(chatId, query.message?.message_thread_id);
        handleTelegramCommand(
          query.data === "task:follow" ? "/watch linked" : "/task linked",
          session,
          query.message,
          sharedConversationId,
          { task: target, topicId: lookup.replyTopicId },
        );
        text =
          query.data === "task:follow" ? "Showing this Task. Other work is unchanged." : "Showing current details.";
      }
    }
    void apiCall("answerCallbackQuery", { callback_query_id: query.id, text }).catch((error) =>
      log("warn", `[telegram] Could not acknowledge control: ${String(error)}`),
    );
  }

  function emitChatStart(
    message: string,
    channelMessageId: number,
    context: Record<string, unknown> | undefined,
    session: SurfaceSession,
    conversationId: string,
    replyToMsgId?: number,
    replyToSourceId?: string,
    conversationTopicId?: string,
    approvalReply?: { target: { appId: string; taskId: string }; proposal: ApprovalProposal },
    approvalAuthorization?: Parameters<TelegramBotOptions["publishEvent"]>[1],
  ): void {
    const input = telegramConversationInputEvent({
      appId: conversationAppId,
      message,
      chatId: session.chatId,
      messageId: channelMessageId,
      conversationId,
      topicId: session.topicId,
      conversationTopicId,
      replyToMessageId: replyToMsgId,
      replyToSourceId,
      context: context ?? {},
    });
    if (approvalReply) input.data.approvalReply = approvalReply;
    const received = opts.publishEvent(input, approvalAuthorization);

    requireAdmission(received);
    if (received.approval) {
      const result = received.approval;
      queueCommandDelivery(session.key, () =>
        sendMessage(
          session.chatId,
          "reason" in result ? result.reason : `${result.decision} recorded for the exact proposal.`,
          undefined,
          { replyToMessageId: channelMessageId, messageThreadId: session.topicId },
        ),
      );
    }
    telegramClient.recordInboundMessage({
      chatId: session.chatId,
      messageId: channelMessageId,
      topicId: session.topicId,
      conversationId,
      replyToMsgId,
      eventId: received.eventId,
      text: message,
    });
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
    const session = ensureSession(chatIdStr, topicId);
    const conversationId = sharedConversationId;
    const recordedConversationId = !text.startsWith("/")
      ? resumeRecordedInput("conversation.message.created", `telegram:${chatIdStr}:${msg.message_id}`)
      : undefined;
    conversationRefresh.queue(sharedConversationId);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    const replyToMsg = msg.reply_to_message;
    const replyToMsgId = replyToMsg?.message_id as number | undefined;
    const lookup = replyToMsgId ? telegramClient.readMessageContext(chatIdStr, replyToMsgId) : undefined;
    const quotedText = replyToMsgId ? telegramMessageText(replyToMsg).slice(0, 2_000) : "";
    let inputContext: Record<string, unknown> | undefined = replyToMsgId
      ? {
          reply: {
            channel: "telegram",
            messageId: replyToMsgId,
            ...(quotedText ? { quotedText } : {}),
          },
        }
      : undefined;

    const approverId = String(msg.from?.id ?? "");

    try {
      if (handleTelegramCommand(text, session, msg, conversationId)) return;
    } catch (error) {
      if (!(error instanceof TaskReferenceError)) throw error;
      queueCommandDelivery(session.key, () =>
        sendMessage(chatIdStr, `${error.message}. Ask May to find the work, or use /tasks.`, undefined, {
          replyToMessageId: msg.message_id,
          messageThreadId: topicId,
        }),
      );
      return;
    }

    const replyTask = lookup?.replyTask;
    const focusedTask = replyToMsgId ? replyTask : session.watchedTask;
    const focusedApp = replyToMsgId
      ? (replyTask?.appId ?? conversationAppId)
      : (session.selectedApp ?? conversationAppId);
    const conversationTopic = replyToMsgId ? undefined : session.selectedTopic;
    inputContext = {
      ...(inputContext ?? {}),
      focusedApp,
      ingress: {
        provider: "telegram",
        authenticatedSenderId: approverId,
        chatId: chatIdStr,
        sourceMessageId: msg.message_id,
        ...(replyToMsgId ? { replyToMessageId: replyToMsgId } : {}),
      },
    };
    if (focusedTask) {
      inputContext = {
        ...(inputContext ?? {}),
        focusedTask: { appId: focusedTask.appId, taskId: focusedTask.taskId },
        ...(lookup?.replyHumanCondition ? { displayedHumanCondition: lookup.replyHumanCondition } : {}),
      };
    }
    if (!recordedConversationId) {
      emitChatStart(
        text,
        msg.message_id,
        inputContext,
        session,
        conversationId,
        replyToMsgId,
        lookup?.replyToSourceId,
        lookup?.replyTopicId ?? conversationTopic?.id,
        replyTask && lookup?.replyApprovalAnchor
          ? { target: replyTask, proposal: lookup.replyApprovalAnchor }
          : undefined,
        allowedApproverIds.includes(approverId)
          ? {
              actor: { kind: "human", id: approverId },
              reference: `telegram:${chatIdStr}:${msg.message_id}`,
              evidence: { chatId: chatIdStr, sourceMessageId: msg.message_id, replyToMessageId: replyToMsgId },
            }
          : undefined,
      );
    }
    try {
      const active = getConversation(conversationAppId, conversationId, { limit: 1 }).activeTurn;
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
    session: SurfaceSession,
    msg: any,
    conversationId: string,
    linked?: { task: { appId: string; taskId: string }; topicId?: string },
  ): boolean {
    if (!text.startsWith("/")) return false;

    const [cmd = "", ...rest] = text.split(/\s+/);
    const command = cmd.split("@")[0];
    const { key: surface, chatId: chatIdStr, topicId } = session;

    const taskTopicId = (task: { appId: string; taskId: string }): string | undefined => {
      if (linked) return linked.topicId;
      return selectedTaskTopicId(session, task);
    };

    const deliverCommandView = (
      rendered: string,
      taskRefs: Array<{ appId: string; taskId: string }> = [],
      prepareRecord?: () => false | void | (() => void),
      followTask?: { appId: string; taskId: string },
      approvalTask?: HumanTaskView,
      parseMode?: string,
    ): void => {
      const conversationTopicId = followTask ? taskTopicId(followTask) : session.selectedTopic?.id;
      const displayedApproval = approvalProposalForTask(approvalTask ?? null);
      queueCommandDelivery(surface, async () => {
        const deliveredMessageId = await sendMessage(chatIdStr, rendered, parseMode, {
          eventType: displayedApproval ? "task.human-action" : "telegram.reply",
          agent: opts.interfaceAgent,
          data: JSON.stringify({
            direction: "outbound",
            conversationId,
            command: text,
            taskRefs,
            followTask,
            topicId: conversationTopicId,
            ...(displayedApproval ? { approvalAnchor: displayedApproval } : {}),
          }),
          bindToCompleteDelivery: Boolean(displayedApproval),
          replyToMessageId: msg.message_id,
          messageThreadId: topicId,
          replyMarkup: taskButtons(followTask ? [followTask] : taskRefs),
        });
        if (!deliveredMessageId || !running) return;
        const afterRecord = prepareRecord?.();
        if (afterRecord === false) return;
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
        afterRecord?.();
      });
    };

    if (command === "/apps") {
      if (rest.length > 1) deliverCommandView("Use: /apps [app]");
      else {
        const apps = opts.humanTasks.listApps(rest[0]);
        let selectedChanged = false;
        if (rest[0] && apps.length === 1) {
          const nextApp = apps[0]!.id;
          session.selectedApp = nextApp;
          session.shownTodoActions.clear();
          delete session.nextTodoPage;
          if (session.watchedTask && session.watchedTask.appId !== nextApp) stopWatching(session);
          selectedChanged = true;
        }
        const selected = session.selectedApp ?? conversationAppId;
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
        const cursor = more ? session.nextTopicCursor : undefined;
        if (more && !cursor) {
          deliverCommandView("No next page. Use /topics first.");
          return true;
        }
        const conversation = getConversation(conversationAppId, conversationId, {
          limit: 30,
          ...(cursor ? { topicCursor: cursor } : {}),
        });
        if (conversation.nextTopicCursor) session.nextTopicCursor = conversation.nextTopicCursor;
        else delete session.nextTopicCursor;
        deliverCommandView(
          renderTelegramTopics(conversation.topics ?? [], session.selectedTopic?.id, {
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
        const prior = session.selectedTopic;
        delete session.selectedTopic;
        deliverCommandView(
          prior
            ? `Stopped following Topic ${topicReference(prior)}. Its Tasks continue unchanged.`
            : "No Topic is followed.",
        );
        return true;
      }
      const exactTopicId = rest[0] ?? session.selectedTopic?.id;
      const conversation = getConversation(conversationAppId, conversationId, {
        limit: 30,
        ...(exactTopicId ? { topicId: exactTopicId } : {}),
      });
      const selectedTopic = session.selectedTopic;
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
        const linkedTasks = new Set(topic.taskRefs.map((task) => `${task.appId}\0${task.taskId}`));
        const watched = session.watchedTask;
        if (watched && !linkedTasks.has(`${watched.appId}\0${watched.taskId}`)) stopWatching(session);
        session.selectedTopic = topic;
      }
      deliverCommandView(renderTelegramTopic(topic, conversation.messages), topic.taskRefs);
      return true;
    }

    if (command === "/todo") {
      const tokens = rest.map((part) => part.toLowerCase());
      const more = tokens.length === 1 && tokens[0] === "more";
      const prior = more ? session.nextTodoPage : undefined;
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
          : (session.selectedApp ?? conversationAppId);
      const page = opts.humanTasks.listTasks({
        ...(appId ? { appId } : {}),
        humanActionOnly: true,
        limit: TODO_PAGE_SIZE,
        ...(prior?.cursor ? { cursor: prior.cursor } : {}),
      });
      if (page.nextCursor) {
        session.nextTodoPage = { ...(appId ? { appId } : {}), cursor: page.nextCursor };
      } else {
        delete session.nextTodoPage;
      }
      deliverCommandView(
        renderTelegramTodos(page.items, page.total ?? page.items.length, appId, Boolean(page.nextCursor)),
        page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
        undefined,
        undefined,
        undefined,
        "HTML",
      );
      return true;
    }

    if (command === "/tasks") {
      const more = rest.length === 1 && rest[0]!.toLowerCase() === "more";
      const prior = more ? session.nextTaskPage : undefined;
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
          : (session.selectedApp ?? conversationAppId);
      const page = opts.humanTasks.listTasks({
        ...(appId ? { appId } : {}),
        includeDone,
        limit: TASK_PAGE_SIZE,
        ...(prior?.cursor ? { cursor: prior.cursor } : {}),
      });
      if (page.nextCursor) {
        session.nextTaskPage = { ...(appId ? { appId } : {}), includeDone, cursor: page.nextCursor };
      } else {
        delete session.nextTaskPage;
      }
      deliverCommandView(
        renderTelegramTasks(page.items, includeDone, Boolean(page.nextCursor)),
        page.items.map((task) => ({ appId: task.appId, taskId: task.taskId })),
        undefined,
        undefined,
        undefined,
        "HTML",
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
        task ?? undefined,
      );
      return true;
    }

    if (command === "/watch") {
      if (rest.length > 1) {
        deliverCommandView("Use: /watch [ref]");
        return true;
      }
      if (rest.length === 0) {
        const watched = session.watchedTask;
        if (!watched) deliverCommandView("No Task is watched. Use /watch <ref>.");
        else {
          const task = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
          deliverCommandView(
            task ? renderTelegramTask(task) : `Task ${watched.ref} was not found; watch ended.`,
            task ? representedTaskIdentities(task) : [],
            () => {
              if (!task || task.terminal) return;
              if (session.watchedTask !== watched) {
                if (session.watchedTask) {
                  delete session.shownWatchRevision;
                  watchRefresh.queue(surface);
                }
                return false;
              }
              const revision = taskPresentationRevision(task);
              const currentTask = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
              if (!currentTask || taskPresentationRevision(currentTask) !== revision) {
                delete session.shownWatchRevision;
                watchRefresh.queue(surface);
                return false;
              }
              return () => {
                session.shownWatchRevision = revision;
              };
            },
            task ? { appId: task.appId, taskId: task.taskId } : undefined,
            task ?? undefined,
          );
          if (!task || task.terminal) {
            stopWatching(session);
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
          task,
        );
      } else {
        const topicRef = taskTopicId(task);
        const topic = topicRef
          ? readHumanConversationTopic(persistDir, conversationAppId, conversationId, topicRef)
          : null;
        if (topic) session.selectedTopic = topic;
        else delete session.selectedTopic;
        session.selectedApp = task.appId;
        const watched: WatchedTaskTarget = {
          appId: task.appId,
          taskId: task.taskId,
          ref: task.ref,
          chatId: chatIdStr,
          ...(topicId === undefined ? {} : { topicId }),
        };
        session.watchedTask = watched;
        deliverCommandView(
          `${renderTelegramTaskUpdate(task)}\n\nFollowing updates. Reply here to discuss this work. Other Tasks continue unchanged.`,
          [{ appId: task.appId, taskId: task.taskId }],
          () => {
            if (session.watchedTask !== watched) {
              if (session.watchedTask) {
                delete session.shownWatchRevision;
                watchRefresh.queue(surface);
              }
              return false;
            }
            const revision = taskPresentationRevision(task);
            const currentTask = opts.humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
            if (!currentTask || taskPresentationRevision(currentTask) !== revision) {
              delete session.shownWatchRevision;
              watchRefresh.queue(surface);
              return false;
            }
            return () => {
              session.shownWatchRevision = revision;
            };
          },
          { appId: task.appId, taskId: task.taskId },
          task,
        );
      }
      return true;
    }

    if (command === "/unwatch") {
      if (rest.length > 0) deliverCommandView("Use: /unwatch");
      else if (stopWatching(session)) {
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
      const watched = session.watchedTask;
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
      const receipt = opts.publishEvent({
        ...taskCancelRequestedEvent(selected, "human requested cancellation from Telegram"),
        idempotencyKey: cancellationKey,
      });
      requireAdmission(receipt);
      try {
        const task = opts.humanTasks.getTask({ appId: selected.appId, taskId: selected.taskId });
        if (!task) throw new Error("Task disappeared after cancellation");
        stopWatching(session);
        deliverCommandView(renderTelegramTask(task), representedTaskIdentities(task), undefined, {
          appId: task.appId,
          taskId: task.taskId,
        });
      } catch (error) {
        deliverCommandView(`[cancel] ${error instanceof Error ? error.message : String(error)}`);
      }
      return true;
    }

    if (command === "/start" || command === "/help") {
      queueCommandDelivery(surface, () =>
        sendMessage(chatIdStr, TELEGRAM_HELP_MARKDOWN, "Markdown", { messageThreadId: topicId }),
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
      const completion = readPersistedTelegramReloadCompletion(persistDir, {
        idempotencyKey: requestId,
      });
      if (completion) {
        showReloadResult(requestId, completion.summary);
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

  async function pollLoop(): Promise<void> {
    bus.emit({
      type: "info",
      message: `[telegram] Bot started (polling). Allowed chats: ${allowedChatIds.join(", ")}`,
    });

    try {
      const me = await apiCall("getMe");
      if (!running) return;
      bus.emit({ type: "info", message: `[telegram] Bot: @${me.username} (${me.first_name})` });
      for (const chatId of allowedChatIds) {
        const session = ensureSession(chatId);
        todoRefresh.queue(session.key);
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
              handleMessage(update.message);
            }
            offset = update.update_id + 1;
          }
        }
      } catch (err) {
        if (!running) break;
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[telegram] Poll error: ${msg}` });
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  pollLoop().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[telegram] Poll loop crashed: ${msg}` });
  });

  return {
    close: () => {
      running = false;
      telegramClient.close();
      sessions.clear();
      conversationRefresh.close();
      watchRefresh.close();
      todoRefresh.close();
      unsubscribeConversation();
    },
  };
}
