import { boundedAppRequestConversation, boundedUtf8Text } from "../core/reads/conversation-context.js";
export {
  boundedAppRequestConversation,
  APP_REQUEST_CONVERSATION_MAX_BYTES,
} from "../core/reads/conversation-context.js";
import { Check } from "typebox/value";
import type { AppTaskClaim } from "../core/tasks/app-task-reconciler.js";
import { readConversationRequest, listConversationInputRequests } from "../core/state/conversation-requests.js";
import {
  conversationRequestUpdatesSchema,
  type ConversationTurnResult,
  type AppInput,
  type AppInputContext,
  type AppConversationResource,
  type AppDependencyObservation,
} from "@may-agent/sdk";
import type { SqliteDb } from "../../lib/db.js";
import type { AppInboxItem } from "../core/state/app-inbox-store.js";
import { readAppConversationResource, readConversationInputTopicId } from "../core/state/conversations.js";
import { observeTaskDependency, readInputContext, type AppDependencyReader } from "../core/inbox/input-context.js";

const APP_REQUEST_REFERENCED_TASK_MAX = 8;

function inputContext(input: AppInput): Record<string, unknown> {
  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) return {};
  const context = (input.data as Record<string, unknown>).context;
  return context && typeof context === "object" && !Array.isArray(context)
    ? (context as Record<string, unknown>)
    : {};
}

function focusedTaskIdentity(context: Record<string, unknown>): { appId: string; taskId: string } | null {
  const focusedTask = context.focusedTask;
  if (!focusedTask || typeof focusedTask !== "object" || Array.isArray(focusedTask)) return null;
  const value = focusedTask as Record<string, unknown>;
  const appId = typeof value.appId === "string" ? value.appId.trim().replace(/\.app$/, "") : "";
  const taskId = typeof value.taskId === "string" ? value.taskId.trim() : "";
  return appId && taskId ? { appId, taskId } : null;
}

function referencedTaskIdentities(
  conversation: AppConversationResource,
): Array<{ appId: string; taskId: string; ref?: string }> {
  const seen = new Set<string>();
  const result: Array<{ appId: string; taskId: string; ref?: string }> = [];
  for (const message of [...conversation.messages].reverse()) {
    for (const task of message.metadata?.taskRefs ?? []) {
      const key = `${task.appId}\0${task.taskId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(task);
      if (result.length >= APP_REQUEST_REFERENCED_TASK_MAX) return result;
    }
  }
  return result;
}

/** Optional enrichment for conversation-aware execution and Task handoffs. */
export async function prepareConversationInput(
  db: SqliteDb,
  item: AppInboxItem,
  input: Readonly<AppInputContext>,
  readDependency?: AppDependencyReader,
): Promise<AppInputContext> {
  const request = { ...input };
  const context = inputContext(item.input);
  const focusedTask = focusedTaskIdentity(context);
  if (focusedTask) {
    let observation: AppDependencyObservation | null = null;
    try {
      observation = await observeTaskDependency(readDependency, focusedTask.appId, {
        kind: "task", id: focusedTask.taskId,
      });
    } catch {
      // Focus is bounded context, not an admission or execution gate.
    }
    request.focusedTask = {
      appId: focusedTask.appId,
      task: {
        kind: "task", id: focusedTask.taskId, status: observation?.status ?? "unknown",
        ...(observation && {
          generation: observation.generation,
          resourceVersion: observation.resourceVersion,
          closed: observation.closed,
          outcome: observation.outcome === undefined ? undefined : boundedUtf8Text(observation.outcome, 1_000),
          summary: observation.summary === undefined ? undefined : boundedUtf8Text(observation.summary, 2_000),
        }),
      },
    };
  }
  if (item.conversationId) {
    const contextTopicId = readConversationInputTopicId(db, item);
    const conversation = readAppConversationResource(db, item.appId, item.conversationId, {
      limit: 40,
      ...(contextTopicId ? { topicId: contextTopicId } : {}),
    });
    // Results bring their callers' asks back into bounded context even after
    // regrouping or a long discussion. The agent still judges which to address;
    // receiving evidence alone does not assign or reopen every related Request.
    const data = item.input.data as Record<string, unknown> | null;
    const originInputIds = item.source.kind === "system" &&
      ["task-outcome", "task-closed"].includes(item.input.kind) && Array.isArray(data?.originInputIds)
      ? data.originInputIds.filter((id): id is string => typeof id === "string").slice(0, 100) : [];
    const callerRequests = listConversationInputRequests(db, item.appId, item.conversationId, originInputIds);
    const callerRequestIds = new Set(callerRequests.map(({ id }) => id));
    const boundedConversation = boundedAppRequestConversation(
      {
        ...conversation,
        requests: [
          ...callerRequests.map(({ inputIds: _inputIds, ...request }) => request),
          ...(conversation.requests ?? []).filter(({ id }) => !callerRequestIds.has(id)),
        ],
        current: {
          messageId: item.source.id,
          ...(item.replyToSourceId ? { replyTo: item.replyToSourceId } : {}),
          ...(contextTopicId ? { topicId: contextTopicId } : {}),
        },
      },
      item.id,
    );
    request.conversation = boundedConversation;
    const referencedTasks = referencedTaskIdentities(boundedConversation);
    if (referencedTasks.length > 0) request.referencedTasks = referencedTasks;
  }
  return request;
}

/** Build bounded presentation independently of Task operation authority. */
export async function prepareConversationTaskContext(
  db: SqliteDb,
  turn: { items: readonly AppInboxItem[]; replyInput: AppInboxItem },
  previousAttempt: AppTaskClaim["previousAttempt"],
  readDependency?: AppDependencyReader,
): Promise<Readonly<AppInputContext>> {
  const { items, replyInput: item } = turn;
  const inputContext = await prepareConversationInput(db, item, readInputContext(db, item), readDependency);
  inputContext.inputs = items.map(({ id, source, input }) => ({ id, source, input }));
  inputContext.assignedRequests = listConversationInputRequests(
    db, item.appId, item.conversationId!, items.map(({ id }) => id),
  ).map(({ id, revision, scope, status, inputIds }) => ({ id, revision, scope, status, inputIds }));
  if (previousAttempt) inputContext.previousAttempt = structuredClone(previousAttempt);
  // Bring the exact Requests involved in rejected settlement back into bounded
  // context, including closed asks outside the ordinary context window.
  const priorDecision = previousAttempt?.unacceptedResult?.result?.conversation;
  // Historical proposed results are evidence, not executable decisions. Validate
  // only the references being read so an older handoff shape cannot hide scope.
  const priorUpdates =
    priorDecision && typeof priorDecision === "object" && !Array.isArray(priorDecision)
      ? (priorDecision as Record<string, unknown>).requestUpdates
      : undefined;
  if (inputContext.conversation && Check(conversationRequestUpdatesSchema, priorUpdates)) {
    const requests = (priorUpdates as NonNullable<ConversationTurnResult["requestUpdates"]>).flatMap(({ id }) => {
      const request = readConversationRequest(db, item.appId, item.conversationId!, id);
      return request ? [request] : [];
    });
    inputContext.conversation = boundedAppRequestConversation(
      {
        ...inputContext.conversation,
        requests: [
          ...requests,
          ...(inputContext.conversation.requests ?? []).filter(
            (request) => !requests.some((prior) => prior.id === request.id),
          ),
        ],
      },
      item.id,
    );
  }
  return inputContext;
}
