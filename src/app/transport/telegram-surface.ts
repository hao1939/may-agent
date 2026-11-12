/**
 * Telegram surface session controller.
 *
 * Mirrors `may-console`'s interactive surface model: manages per-surface
 * (`chatId` + `topicId`) selection state (`selectedApps`, `selectedTopics`,
 * `watchedTasks`, pagination cursors), slash command evaluation (`/apps`,
 * `/topics`, `/topic`, `/tasks`, `/todo`, `/task`, `/watch`, `/unwatch`,
 * `/cancel`, `/reload`, `/help`), and reactive watch/todo/conversation view
 * synchronization.
 */

import { randomUUID } from "node:crypto";
import type { AppConversationMessage, AppConversationResource, AppConversationTopic } from "@may-agent/sdk";
import type { ApprovalProposal, EventInput, EventReceipt } from "@may-agent/control/events";
import { EVENT_RECORD_ONLY, type EventBus } from "../core/events/bus.js";
import { readPersistedTelegramReloadCompletion, resumeRecordedTelegramInput } from "../core/events/persisted.js";
import { readAppConversationResource, readConversationTopic } from "../core/state/conversations.js";
import { getDb } from "../../lib/db/connection.js";
import {
  conversationDeliveryId,
  prepareConversationDelivery,
  readConversationDelivery,
  settleConversationDelivery,
  type ConversationDelivery,
} from "../../lib/db/telegram-conversation-deliveries.js";
import { hasCompletedHumanActionDelivery } from "../../lib/db/notifications.js";
import { log } from "../../lib/log.js";
import {
  isTaskDerivedViewWake,
  TASK_UPDATE_EVENT_TYPES,
  taskUpdateIdentity,
} from "../../../packages/control/src/task-wake.js";
import {
  approvalProposalForTask,
  humanConditionAnchorForTask as humanConditionAnchor,
  todoActionSignatureForTask as todoActionSignature,
  type HumanConditionAnchor as TelegramHumanConditionAnchor,
  type HumanTaskService,
  type HumanTaskView,
} from "../human-task-service.js";
import { taskCancelRequestedEvent } from "../task-control-events.js";
import type { TelegramSendContext } from "./telegram-client.js";
import {
  TELEGRAM_HELP_MARKDOWN,
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
  taskButtons,
  taskPresentationRevision,
  telegramConversationInputEvent,
  topicReference,
  type TelegramApprovalAnchor,
} from "./telegram-format.js";

const TASK_PAGE_SIZE = 10;
const TODO_PAGE_SIZE = 50;

// Stored channel coordinates are transport-neutral text. Use the same
// no-thread fallback for delivery, controls and watch bookkeeping.
export function telegramThreadId(value?: string): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

export function surfaceKey(chatId: string, topicId?: number): string {
  return `${chatId}:${topicId ?? 0}`;
}

export interface TelegramSurfaceTransport {
  isRunning: () => boolean;
  sendMessage: (
    chatId: string,
    text: string,
    parseMode?: string,
    context?: TelegramSendContext,
  ) => Promise<number | undefined>;
  clearReplyMarkup: (chatId: string, messageId: number) => Promise<void>;
}

export interface TelegramSurfaceControllerOptions {
  persistDir: string;
  bus: EventBus;
  interfaceAgent: string;
  conversationAppId: string;
  sharedConversationId: string;
  allowedChatIds: string[];
  allowedApproverIds: string[];
  humanTasks: Pick<HumanTaskService, "getTask" | "listApps" | "listTasks">;
  publishEvent: (
    input: EventInput,
    approvalAuthorization?: {
      actor: { kind: "human"; id: string };
      reference: string;
      evidence: Record<string, unknown>;
    },
  ) => EventReceipt;
  transport: TelegramSurfaceTransport;
  onInboundRecorded?: (entry: {
    chatId: string;
    messageId: number;
    topicId?: number;
    conversationId: string;
    replyToMsgId?: number;
    eventId?: number;
    text: string;
  }) => void;
}

export interface TelegramInboundReplyContext {
  replyToMsgId: number;
  quotedText: string;
  replyToSourceId: string;
  replyTopicId?: string;
  replyTask?: { appId: string; taskId: string };
  replyApprovalAnchor: TelegramApprovalAnchor | null;
  replyHumanCondition: TelegramHumanConditionAnchor | null;
}

export interface TelegramSurfaceController {
  registerSurface: (chatIdStr: string, topicId?: number) => void;
  registerInitialSurfaces: (chatIds: string[]) => void;
  queueConversationRefresh: () => void;
  handleCommand: (
    text: string,
    chatIdStr: string,
    messageId: number,
    topicId?: number,
    linked?: { task: { appId: string; taskId: string }; topicId?: string },
  ) => boolean;
  handleConversationTurn: (input: {
    text: string;
    chatIdStr: string;
    messageId: number;
    topicId?: number;
    senderId: string;
    resolveReply: () => TelegramInboundReplyContext | undefined;
  }) => void;
  handleTurnStopCallback: (input: {
    chatId: number | undefined;
    topicId?: number;
    messageId?: number;
    data: string;
    isAllowed: boolean;
  }) => { text: string; admissionFailure?: unknown };
  queueCommandDelivery: (surface: string, deliver: () => Promise<unknown>) => void;
  close: () => void;
}

export function createTelegramSurfaceController(
  opts: TelegramSurfaceControllerOptions,
): TelegramSurfaceController {
  const {
    persistDir,
    bus,
    interfaceAgent,
    conversationAppId,
    sharedConversationId,
    allowedChatIds,
    allowedApproverIds,
    humanTasks,
    publishEvent,
    transport,
  } = opts;
  const pendingChatId: string | null = allowedChatIds[0] || null;

  // Order immediate command replies, including help/errors, without blocking input or updates.
  const commandDeliveries = new Map<string, Promise<void>>();
  function queueCommandDelivery(surface: string, deliver: () => Promise<unknown>): void {
    const prior = commandDeliveries.get(surface) ?? Promise.resolve();
    const next = prior
      .then(async () => {
        if (transport.isRunning()) await deliver();
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
  const nextTodoPageBySurface = new Map<string, { appId?: string; cursor: string }>();
  const pendingReloads = new Map<
    string,
    { chatId: string; topicId?: number; conversationId: string; command: string }
  >();
  const shownWatchRevisions = new Map<string, string>();

  const stopWatching = (surface: string): boolean => {
    shownWatchRevisions.delete(surface);
    return watchedTasks.delete(surface);
  };

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

  const historicalDeliveries = new Set<string>();
  let startupCaptured = false;
  function captureStartupMessages(messages: AppConversationMessage[]): void {
    if (startupCaptured) return;
    for (const message of messages) {
      const delivery = addressedConversationDelivery(message);
      if (delivery) historicalDeliveries.add(conversationDeliveryId(delivery));
      else rememberRenderedConversationMessage(message.id);
    }
    // Keep this bounded first-snapshot fence even when a receipt write fails.
    // Until the first successful read, no answer can be classified as fresh.
    startupCaptured = true;
  }

  try {
    captureStartupMessages(
      readAppConversationResource(getDb(persistDir), conversationAppId, sharedConversationId, {
        limit: 200,
      }).messages,
    );
  } catch (error) {
    log(
      "warn",
      `[telegram] Startup Conversation read unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Presentation only: one read in flight per key, with at most one follow-up
  // for updates observed during I/O. Errors do not schedule retries; new events do.
  function createRefreshQueue(label: string, refresh: (key: string) => Promise<void>, delayMs = 0) {
    const pending = new Map<string, { timer: ReturnType<typeof setTimeout> | null; dirty: boolean }>();
    function queue(key: string): void {
      if (!transport.isRunning()) return;
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
          if (transport.isRunning()) await refresh(key);
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

  async function clearTurnControl(surface: string): Promise<void> {
    const control = turnControls.get(surface);
    const coordinates = surfaces.get(surface);
    turnControls.delete(surface);
    if (!control || !coordinates) return;
    await transport.clearReplyMarkup(coordinates.chatId, control.messageId);
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
      if (!transport.isRunning()) return;
      const previous = turnControls.get(surface);
      const relevant = surface === sourceSurface;
      if (!relevant) {
        if (previous) await clearTurnControl(surface);
        continue;
      }
      if (previous?.turnId === turn?.id && previous?.revision === turn?.revision) continue;
      if (previous) await clearTurnControl(surface);
      if (!turn) continue;
      const token = `stop:${randomUUID()}`;
      const messageId = await transport.sendMessage(
        coordinates.chatId,
        "May is working on this message.",
        undefined,
        {
          messageThreadId: coordinates.topicId,
          ...(sourceChatId ? { replyToMessageId: turn.channelMessageId } : {}),
          replyMarkup: { inline_keyboard: [[{ text: "Stop this turn", callback_data: token }]] },
        },
      );
      if (messageId && transport.isRunning()) {
        turnControls.set(surface, { token, turnId: turn.id, revision: turn.revision, messageId });
      }
    }
  }

  function addressedConversationDelivery(message: AppConversationMessage): ConversationDelivery | undefined {
    if (
      message.author.kind !== "agent" ||
      message.metadata?.channel !== "telegram" ||
      !message.metadata.channelTargetId ||
      !message.metadata.requestId
    )
      return undefined;
    return {
      appId: conversationAppId,
      conversationId: sharedConversationId,
      messageId: message.id,
      chatId: message.metadata.channelTargetId,
      threadId: telegramThreadId(message.metadata.channelThreadId),
      text: renderTelegramConversationMessage(message),
    };
  }

  function reportConversationDelivery(
    message: AppConversationMessage,
    delivery: ConversationDelivery,
    state: string,
    error?: unknown,
  ): void {
    const status = state === "failed" ? "failed" : "uncertain";
    const operationId = conversationDeliveryId(delivery);
    const identity = {
      appId: conversationAppId,
      conversationId: sharedConversationId,
      requestId: message.metadata?.requestId,
      conversationMessageId: message.id,
      deliveryOperationId: operationId,
      to: delivery.chatId,
      channelThreadId: message.metadata?.channelThreadId,
    };
    const context = JSON.stringify(identity);
    if (error !== undefined) {
      log(
        "warn",
        `[telegram] Conversation answer delivery failed ${context}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      bus.emit({
        [EVENT_RECORD_ONLY]: true,
        type: "message.delivery_failed",
        source: "telegram",
        owner: `app:${conversationAppId}`,
        data: {
          from: conversationAppId,
          ...identity,
          content: message.text.slice(0, 500),
          reason:
            status === "failed"
              ? "Telegram rejected the answer before any chunk was delivered; the existing answer remains available for delivery."
              : "No complete Telegram delivery outcome is available; verify the caller receipt before resending the existing answer.",
          deliveryStatus: status,
          idempotencyKey: `telegram-conversation-delivery:${operationId}:${status}`,
        },
      });
    } catch (reportingError) {
      log(
        "warn",
        `[telegram] Delivery diagnostic not persisted ${context}: ${reportingError instanceof Error ? reportingError.message : String(reportingError)}`,
      );
    }
  }

  async function syncConversation(): Promise<void> {
    const conversation = readAppConversationResource(getDb(persistDir), conversationAppId, sharedConversationId, {
      limit: 200,
    });
    captureStartupMessages(conversation.messages);
    await syncTurnControls(conversation.activeTurn);
    for (const message of conversation.messages) {
      if (!transport.isRunning()) return;
      const delivery = addressedConversationDelivery(message);
      if (!delivery && renderedConversationMessages.has(message.id)) continue;
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
      const operationId = delivery ? conversationDeliveryId(delivery) : undefined;
      let delivered: number | undefined;
      try {
        if (delivery) {
          const decision = prepareConversationDelivery(
            persistDir,
            delivery,
            historicalDeliveries.has(operationId!) ? "historical" : "fresh",
          );
          if (decision.kind === "retained") {
            if (decision.state !== "delivered") reportConversationDelivery(message, delivery, decision.state);
            continue;
          }
        }
        delivered = await transport.sendMessage(targetChatId, renderTelegramConversationMessage(message), undefined, {
          eventType: "conversation.mirror",
          agent: message.author.kind === "agent" ? interfaceAgent : message.author.id,
          messageThreadId: topicId,
          ...(operationId
            ? {
                onDelivery: (outcome) => {
                  settleConversationDelivery(persistDir, operationId, outcome);
                  if (outcome.state !== "delivered") reportConversationDelivery(message, delivery!, outcome.state);
                },
              }
            : {}),
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
      } catch (error) {
        if (!delivery) throw error;
        reportConversationDelivery(message, delivery, "uncertain", error);
        continue;
      }
      if (!transport.isRunning()) return;
      if (!delivered) {
        if (delivery) continue;
        return;
      }
      if (!delivery) rememberRenderedConversationMessage(message.id);
      const watched = watchedTasks.get(surface);
      if (
        watched &&
        message.author.kind === "agent" &&
        message.metadata?.taskRefs?.some((task) => task.appId === watched.appId && task.taskId === watched.taskId)
      ) {
        const task = humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
        if (task?.terminal && (task.response?.trim() || task.summary?.trim()) === message.text.trim()) {
          stopWatching(surface);
        }
      }
    }
  }

  function selectedTaskTopicId(surface: string, task: { appId: string; taskId: string }): string | undefined {
    const selected = selectedTopics.get(surface);
    if (!selected) return undefined;
    const topic = readConversationTopic(getDb(persistDir), conversationAppId, sharedConversationId, selected.id);
    if (topic) selectedTopics.set(surface, topic);
    else selectedTopics.delete(surface);
    return topic?.taskRefs.some((ref) => ref.appId === task.appId && ref.taskId === task.taskId) ? topic.id : undefined;
  }

  const todoTaskKey = (task: HumanTaskView): string => `${task.appId}\0${task.taskId}`;
  const presentedTodoActionRevision = (signature: { value: string; exact: boolean }) =>
    JSON.stringify({ value: signature.value, exact: signature.exact });

  async function refreshWatch(surface: string): Promise<void> {
    const watched = watchedTasks.get(surface);
    if (!watched) return;
    const task = humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
    if (!task) {
      stopWatching(surface);
      await transport.sendMessage(
        watched.chatId,
        `Task ${watched.ref} is no longer available; watch ended.`,
        undefined,
        {
          messageThreadId: watched.topicId,
        },
      );
      return;
    }
    const revision = taskPresentationRevision(task);
    if (shownWatchRevisions.get(surface) === revision) return;
    if (task.terminal) {
      const result = task.response?.trim() || task.summary?.trim();
      const conversation = readAppConversationResource(getDb(persistDir), conversationAppId, sharedConversationId, {
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
        const delivery = addressedConversationDelivery(equivalent);
        const presented = delivery
          ? readConversationDelivery(persistDir, conversationDeliveryId(delivery))?.state === "delivered"
          : renderedConversationMessages.has(equivalent.id);
        if (presented) stopWatching(surface);
        else conversationRefresh.queue(sharedConversationId);
        return;
      }
    }
    const rendered = renderTelegramTaskUpdate(task);
    const displayedApproval = approvalProposalForTask(task);
    const displayedHumanCondition = !displayedApproval ? humanConditionAnchor(task) : null;
    const displayedAction = task.humanAction
      ? { key: todoTaskKey(task), signature: todoActionSignature(task) }
      : null;
    const conversationTopicId = selectedTaskTopicId(surface, task);
    const delivered = await transport.sendMessage(watched.chatId, rendered, undefined, {
      eventType: "task.watch",
      agent: interfaceAgent,
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
    if (!delivered || !transport.isRunning()) return;
    if (watchedTasks.get(surface) !== watched) {
      if (watchedTasks.has(surface)) {
        shownWatchRevisions.delete(surface);
        watchRefresh.queue(surface);
      }
      return;
    }
    const currentTask = humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
    if (!currentTask || taskPresentationRevision(currentTask) !== revision) {
      shownWatchRevisions.delete(surface);
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
    shownWatchRevisions.set(surface, revision);
    if (displayedAction) {
      const current = shownTodoActions.get(surface);
      if (current) current.set(displayedAction.key, presentedTodoActionRevision(displayedAction.signature));
      else
        shownTodoActions.set(
          surface,
          new Map([[displayedAction.key, presentedTodoActionRevision(displayedAction.signature)]]),
        );
    }
    if (task.terminal) stopWatching(surface);
  }

  async function refreshTodos(surface: string): Promise<void> {
    const coordinates = surfaces.get(surface);
    if (!coordinates) return;
    const appId = selectedApps.get(surface) ?? conversationAppId;
    const page = humanTasks.listTasks({ appId, humanActionOnly: true, limit: TODO_PAGE_SIZE });
    const actions = page.items.map((task) => {
      const owner = task.humanAction?.task ?? { appId: task.appId, taskId: task.taskId };
      const detail = humanTasks.getTask?.(owner) ?? task;
      return { task, detail, signature: todoActionSignature(detail) };
    });
    const prior = shownTodoActions.get(surface) ?? new Map<string, string>();
    const currentKeys = new Set(actions.map(({ task }) => todoTaskKey(task)));
    const next = new Map([...prior].filter(([key]) => currentKeys.has(key)));
    const watched = watchedTasks.get(surface);
    const changed = actions.filter(({ task, detail, signature }) => {
      if (watched?.appId === task.appId && watched.taskId === task.taskId) return false;
      const key = todoTaskKey(task);
      const revision = presentedTodoActionRevision(signature);
      if (prior.get(key) === revision) return false;
      if (!signature.exact) return true;
      if (
        hasCompletedHumanActionDelivery(persistDir, coordinates.chatId, coordinates.topicId, {
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
    shownTodoActions.set(surface, next);
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
    const messageId = await transport.sendMessage(coordinates.chatId, text, single ? undefined : "HTML", {
      eventType: "task.human-action",
      agent: interfaceAgent,
      messageThreadId: coordinates.topicId,
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
    if (!messageId || !transport.isRunning()) return;
    if ((selectedApps.get(surface) ?? conversationAppId) === appId) {
      for (const { task, signature } of changed) {
        next.set(todoTaskKey(task), presentedTodoActionRevision(signature));
      }
      shownTodoActions.set(surface, next);
    }
    recordConversationMessage({
      conversationId: sharedConversationId,
      text,
      command: "/todo notification",
      messageId,
      chatId: coordinates.chatId,
      topicId: coordinates.topicId,
      taskRefs,
      idempotencyKey: `todo-notification:telegram:${surface}:${first.task.appId}:${first.task.taskId}:${first.task.resourceVersion}`,
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
    void transport
      .sendMessage(pending.chatId, summary, undefined, {
        eventType: "runtime.reload.finished",
        agent: interfaceAgent,
        messageThreadId: pending.topicId,
      })
      .then((messageId) => {
        if (!messageId || !transport.isRunning()) return;
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
      for (const [surface, watched] of watchedTasks) {
        if (watched.appId === wake.appId && watched.taskId === wake.taskId) watchRefresh.queue(surface);
      }
      if (isTaskDerivedViewWake(event)) {
        for (const surface of surfaces.keys()) {
          const selected = selectedApps.get(surface) ?? conversationAppId;
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
    publishEvent({
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

  function resumeRecordedInput(type: string, key: string, requireAccepted = true): number | undefined {
    return resumeRecordedTelegramInput(getDb(persistDir), bus, {
      type,
      idempotencyKey: key,
      persistDir,
      requireAccepted,
    });
  }

  function requireAdmission(receipt: EventReceipt): void {
    if (receipt.delivery !== "accepted") throw new Error("Telegram input is recorded but not yet admitted");
  }

  function emitChatStart(
    message: string,
    channelMessageId: number,
    context: Record<string, unknown> | undefined,
    chatId: string,
    topicId: number | undefined,
    conversationId: string,
    replyToMsgId?: number,
    replyToSourceId?: string,
    conversationTopicId?: string,
    approvalReply?: { target: { appId: string; taskId: string }; proposal: ApprovalProposal },
    approvalAuthorization?: Parameters<TelegramSurfaceControllerOptions["publishEvent"]>[1],
  ): void {
    const input = telegramConversationInputEvent({
      appId: conversationAppId,
      message,
      chatId,
      messageId: channelMessageId,
      conversationId,
      topicId,
      conversationTopicId,
      replyToMessageId: replyToMsgId,
      replyToSourceId,
      context: context ?? {},
    });
    if (approvalReply) input.data.approvalReply = approvalReply;
    const received = publishEvent(input, approvalAuthorization);

    requireAdmission(received);
    if (received.approval) {
      const result = received.approval;
      queueCommandDelivery(surfaceKey(chatId, topicId), () =>
        transport.sendMessage(
          chatId,
          "reason" in result ? result.reason : `${result.decision} recorded for the exact proposal.`,
          undefined,
          { replyToMessageId: channelMessageId, messageThreadId: topicId },
        ),
      );
    }
    opts.onInboundRecorded?.({
      chatId,
      messageId: channelMessageId,
      topicId,
      conversationId,
      replyToMsgId,
      eventId: received.eventId,
      text: message,
    });
  }

  function handleTurnStopCallback(input: {
    chatId: number | undefined;
    topicId?: number;
    messageId?: number;
    data: string;
    isAllowed: boolean;
  }): { text: string; admissionFailure?: unknown } {
    const surface = surfaceKey(String(input.chatId), input.topicId);
    const control = turnControls.get(surface);
    let text = "This Stop button has expired. Refresh the conversation.";
    let admissionFailure: unknown;
    try {
      if (!input.isAllowed) text = "Unauthorized.";
      else if (control && input.data === control.token && input.messageId === control.messageId) {
        const active = readAppConversationResource(getDb(persistDir), conversationAppId, sharedConversationId, {
          limit: 1,
        }).activeTurn;
        if (!active || active.id !== control.turnId || active.revision !== control.revision) {
          text = "That turn already ended. Current work is unchanged.";
        } else {
          try {
            const receipt = publishEvent({
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
        void clearTurnControl(surface);
        conversationRefresh.queue(sharedConversationId);
      }
    } catch (error) {
      text = `Stop was not confirmed: ${error instanceof Error ? error.message : String(error)}`;
    }
    return { text, admissionFailure };
  }

  function handleCommand(
    text: string,
    chatIdStr: string,
    messageId: number,
    topicId?: number,
    linked?: { task: { appId: string; taskId: string }; topicId?: string },
  ): boolean {
    if (!text.startsWith("/")) return false;

    const [cmd = "", ...rest] = text.split(/\s+/);
    const command = cmd.split("@")[0];
    const surface = surfaceKey(chatIdStr, topicId);
    const conversationId = sharedConversationId;

    const taskTopicId = (task: { appId: string; taskId: string }): string | undefined => {
      if (linked) return linked.topicId;
      return selectedTaskTopicId(surface, task);
    };

    const deliverCommandView = (
      rendered: string,
      taskRefs: Array<{ appId: string; taskId: string }> = [],
      prepareRecord?: () => false | void | (() => void),
      followTask?: { appId: string; taskId: string },
      approvalTask?: HumanTaskView,
      parseMode?: string,
    ): void => {
      const conversationTopicId = followTask ? taskTopicId(followTask) : selectedTopics.get(surface)?.id;
      const displayedApproval = approvalProposalForTask(approvalTask ?? null);
      queueCommandDelivery(surface, async () => {
        const deliveredMessageId = await transport.sendMessage(chatIdStr, rendered, parseMode, {
          eventType: displayedApproval ? "task.human-action" : "telegram.reply",
          agent: interfaceAgent,
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
          replyToMessageId: messageId,
          messageThreadId: topicId,
          replyMarkup: taskButtons(followTask ? [followTask] : taskRefs),
        });
        if (!deliveredMessageId || !transport.isRunning()) return;
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
        const apps = humanTasks.listApps(rest[0]);
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
        const selected = selectedApps.get(surface) ?? conversationAppId;
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
        const conversation = readAppConversationResource(getDb(persistDir), conversationAppId, conversationId, {
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
      const conversation = readAppConversationResource(getDb(persistDir), conversationAppId, conversationId, {
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
          : (selectedApps.get(surface) ?? conversationAppId);
      const page = humanTasks.listTasks({
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
        undefined,
        undefined,
        undefined,
        "HTML",
      );
      return true;
    }

    if (command === "/tasks") {
      const more = rest.length === 1 && rest[0]!.toLowerCase() === "more";
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
          : (selectedApps.get(surface) ?? conversationAppId);
      const page = humanTasks.listTasks({
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
      const task = humanTasks.getTask(linked?.task ?? { ref: rest[0] });
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
        const watched = watchedTasks.get(surface);
        if (!watched) deliverCommandView("No Task is watched. Use /watch <ref>.");
        else {
          const task = humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
          deliverCommandView(
            task ? renderTelegramTask(task) : `Task ${watched.ref} was not found; watch ended.`,
            task ? representedTaskIdentities(task) : [],
            () => {
              if (!task || task.terminal) return;
              if (watchedTasks.get(surface) !== watched) {
                if (watchedTasks.has(surface)) {
                  shownWatchRevisions.delete(surface);
                  watchRefresh.queue(surface);
                }
                return false;
              }
              const revision = taskPresentationRevision(task);
              const currentTask = humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
              if (!currentTask || taskPresentationRevision(currentTask) !== revision) {
                shownWatchRevisions.delete(surface);
                watchRefresh.queue(surface);
                return false;
              }
              return () => shownWatchRevisions.set(surface, revision);
            },
            task ? { appId: task.appId, taskId: task.taskId } : undefined,
            task ?? undefined,
          );
          if (!task || task.terminal) {
            stopWatching(surface);
          }
        }
        return true;
      }
      const task = humanTasks.getTask(linked?.task ?? { ref: rest[0] });
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
          ? readConversationTopic(getDb(persistDir), conversationAppId, conversationId, topicRef)
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
            if (!watched || watchedTasks.get(surface) !== watched) {
              if (watchedTasks.has(surface)) {
                shownWatchRevisions.delete(surface);
                watchRefresh.queue(surface);
              }
              return false;
            }
            const revision = taskPresentationRevision(task);
            const currentTask = humanTasks.getTask({ appId: watched.appId, taskId: watched.taskId });
            if (!currentTask || taskPresentationRevision(currentTask) !== revision) {
              shownWatchRevisions.delete(surface);
              watchRefresh.queue(surface);
              return false;
            }
            return () => shownWatchRevisions.set(surface, revision);
          },
          { appId: task.appId, taskId: task.taskId },
          task,
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
      const cancellationKey = `telegram:${chatIdStr}:${messageId}:cancel`;
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
      const selected = humanTasks.getTask(
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
      const receipt = publishEvent({
        ...taskCancelRequestedEvent(selected, "human requested cancellation from Telegram"),
        idempotencyKey: cancellationKey,
      });
      requireAdmission(receipt);
      try {
        const task = humanTasks.getTask({ appId: selected.appId, taskId: selected.taskId });
        if (!task) throw new Error("Task disappeared after cancellation");
        stopWatching(surface);
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
        transport.sendMessage(chatIdStr, TELEGRAM_HELP_MARKDOWN, "Markdown", { messageThreadId: topicId }),
      );
      return true;
    }

    if (command === "/reload") {
      const requestId = `telegram:${chatIdStr}:${messageId}:reload`;
      pendingReloads.set(requestId, {
        chatId: chatIdStr,
        ...(topicId === undefined ? {} : { topicId }),
        conversationId,
        command: text,
      });
      const completion = readPersistedTelegramReloadCompletion(getDb(persistDir), {
        idempotencyKey: requestId,
        persistDir,
      });
      if (completion) {
        showReloadResult(requestId, completion.summary);
        return true;
      }
      if (resumeRecordedInput("runtime.reload.requested", requestId)) return true;
      const receipt = publishEvent({
        type: "runtime.reload.requested",
        data: { requestId },
        idempotencyKey: requestId,
      });
      requireAdmission(receipt);
      return true;
    }

    queueCommandDelivery(surface, () =>
      transport.sendMessage(chatIdStr, `Unknown command: ${command}. Use /help to see available commands.`, undefined, {
        eventType: "telegram.reply",
        agent: interfaceAgent,
        data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
        replyToMessageId: messageId,
        messageThreadId: topicId,
      }),
    );
    return true;
  }

  function handleConversationTurn(input: {
    text: string;
    chatIdStr: string;
    messageId: number;
    topicId?: number;
    senderId: string;
    resolveReply: () => TelegramInboundReplyContext | undefined;
  }): void {
    const { text, chatIdStr, messageId, topicId, senderId, resolveReply } = input;
    const surface = surfaceKey(chatIdStr, topicId);
    surfaces.set(surface, { chatId: chatIdStr, ...(topicId === undefined ? {} : { topicId }) });
    const recordedConversationId = resumeRecordedInput(
      "conversation.message.created",
      `telegram:${chatIdStr}:${messageId}`,
    );
    conversationRefresh.queue(sharedConversationId);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    const reply = resolveReply();
    const replyToMsgId = reply?.replyToMsgId;
    const replyTask = reply?.replyTask;
    const focusedTask = replyToMsgId ? replyTask : watchedTasks.get(surface);
    const focusedApp = replyToMsgId
      ? (replyTask?.appId ?? conversationAppId)
      : (selectedApps.get(surface) ?? conversationAppId);
    const conversationTopic = replyToMsgId ? undefined : selectedTopics.get(surface);

    const inputContext: Record<string, unknown> = {
      ...(reply
        ? {
            reply: {
              channel: "telegram",
              messageId: reply.replyToMsgId,
              ...(reply.quotedText ? { quotedText: reply.quotedText } : {}),
            },
          }
        : {}),
      focusedApp,
      ingress: {
        provider: "telegram",
        authenticatedSenderId: senderId,
        chatId: chatIdStr,
        sourceMessageId: messageId,
        ...(replyToMsgId ? { replyToMessageId: replyToMsgId } : {}),
      },
      ...(focusedTask
        ? {
            focusedTask: { appId: focusedTask.appId, taskId: focusedTask.taskId },
            ...(reply?.replyHumanCondition ? { displayedHumanCondition: reply.replyHumanCondition } : {}),
          }
        : {}),
    };

    if (!recordedConversationId) {
      emitChatStart(
        text,
        messageId,
        inputContext,
        chatIdStr,
        topicId,
        sharedConversationId,
        replyToMsgId,
        reply?.replyToSourceId,
        reply?.replyTopicId ?? conversationTopic?.id,
        replyTask && reply?.replyApprovalAnchor ? { target: replyTask, proposal: reply.replyApprovalAnchor } : undefined,
        allowedApproverIds.includes(senderId)
          ? {
              actor: { kind: "human", id: senderId },
              reference: `telegram:${chatIdStr}:${messageId}`,
              evidence: { chatId: chatIdStr, sourceMessageId: messageId, replyToMessageId: replyToMsgId },
            }
          : undefined,
      );
    }

    // Presentation after durable recording cannot turn a saved input into a retry.
    try {
      const active = readAppConversationResource(getDb(persistDir), conversationAppId, sharedConversationId, {
        limit: 1,
      }).activeTurn;
      if (
        active &&
        !(
          active.channel === "telegram" &&
          active.channelTargetId === chatIdStr &&
          active.channelMessageId === messageId
        )
      ) {
        void transport.sendMessage(
          chatIdStr,
          "Message saved. May is still handling an earlier turn; this message hasn't changed running work yet.",
          undefined,
          { replyToMessageId: messageId, messageThreadId: topicId },
        );
      }
    } catch (error) {
      log("warn", `[telegram] Could not show queue status: ${String(error)}`);
    }
  }

  return {
    registerSurface(chatIdStr: string, topicId?: number) {
      const surface = surfaceKey(chatIdStr, topicId);
      surfaces.set(surface, { chatId: chatIdStr, ...(topicId === undefined ? {} : { topicId }) });
    },
    registerInitialSurfaces(chatIds: string[]) {
      for (const chatId of chatIds) {
        const surface = surfaceKey(chatId);
        surfaces.set(surface, { chatId });
        todoRefresh.queue(surface);
      }
      conversationRefresh.queue(sharedConversationId);
    },
    queueConversationRefresh() {
      conversationRefresh.queue(sharedConversationId);
    },
    handleCommand(text, chatIdStr, messageId, topicId, linked) {
      return handleCommand(text, chatIdStr, messageId, topicId, linked);
    },
    handleConversationTurn,
    handleTurnStopCallback,
    queueCommandDelivery,
    close() {
      turnControls.clear();
      conversationRefresh.close();
      watchRefresh.close();
      todoRefresh.close();
      unsubscribeConversation();
    },
  };
}
