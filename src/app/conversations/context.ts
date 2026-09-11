import type {
  AppInput,
  AppInputContext,
  AppConversationResource,
  AppDependencyObservation,
} from "@may-agent/sdk";
import type { SqliteDb } from "../../lib/db.js";
import type { AppInboxItem } from "../core/state/app-inbox-store.js";
import {
  readAppConversationResource,
  readConversationMessageTopicId,
  readConversationTopic,
} from "../core/state/conversations.js";
import {
  observeTaskDependency,
  type AppDependencyReader,
} from "../core/inbox/input-context.js";

export const APP_REQUEST_CONVERSATION_MAX_BYTES = 12 * 1_024;
const APP_REQUEST_MESSAGE_BYTES = 7_500;
const APP_REQUEST_MESSAGE_TEXT_BYTES = 2_000;
const APP_REQUEST_REFERENCED_TASK_MAX = 8;

function encodedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

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

function boundedUtf8Text(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const characters: string[] = [];
  let bytes = 0;
  const suffixBytes = Buffer.byteLength("…", "utf8");
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes + suffixBytes > maxBytes) break;
    characters.push(character);
    bytes += characterBytes;
  }
  return `${characters.join("").trimEnd()}…`;
}

/** Keep ordinary May context proportional to the current turn, not Conversation history. */
export function boundedAppRequestConversation(
  conversation: AppConversationResource,
  currentRequestId: string,
): AppConversationResource {
  const messages: AppConversationResource["messages"] = [];
  const available = conversation.messages.filter((candidate) => candidate.metadata?.requestId !== currentRequestId);
  const currentTopicId = conversation.current?.topicId;
  const repliedMessageId = conversation.current?.replyTo;
  const priority = available.filter(
    (candidate) =>
      candidate.id === repliedMessageId ||
      (currentTopicId !== undefined && candidate.metadata?.topicId === currentTopicId),
  );
  const remaining = available.filter((candidate) => !priority.includes(candidate));
  for (const item of [...priority].reverse().concat([...remaining].reverse())) {
    const projected = {
      ...item,
      text: boundedUtf8Text(item.text, APP_REQUEST_MESSAGE_TEXT_BYTES),
    };
    const candidate = [...messages, projected];
    if (encodedBytes(candidate) > APP_REQUEST_MESSAGE_BYTES) continue;
    messages.push(projected);
  }
  messages.sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.sequence - right.sequence || left.id.localeCompare(right.id),
  );

  const result: AppConversationResource = {
    ...conversation,
    messages,
    requests: [],
  };
  for (const request of conversation.requests ?? []) {
    const requests = [...result.requests!, request];
    if (encodedBytes({ ...result, requests }) <= APP_REQUEST_CONVERSATION_MAX_BYTES) result.requests = requests;
  }
  if (encodedBytes(result) > APP_REQUEST_CONVERSATION_MAX_BYTES) {
    throw new Error("Bounded Conversation context exceeded its byte contract");
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
    if (readDependency) {
      try {
        observation = await readDependency({
          appId: focusedTask.appId,
          dependency: { kind: "task", id: focusedTask.taskId },
        });
      } catch {
        // Focus is bounded context, not an admission or execution gate.
      }
    }
    request.focusedTask = {
      appId: focusedTask.appId,
      task: observation ?? { kind: "task", id: focusedTask.taskId, status: "unknown" },
    };
  }
  if (item.conversationId) {
    const hintedTopic =
      typeof context.conversationTopicId === "string" && context.conversationTopicId.trim()
        ? readConversationTopic(db, item.appId, item.conversationId, context.conversationTopicId)
        : null;
    const repliedTopicId = item.replyToSourceId
      ? readConversationMessageTopicId(db, item.appId, item.conversationId, item.replyToSourceId)
      : undefined;
    const contextTopicId = item.topicId ?? repliedTopicId ?? hintedTopic?.id;
    const conversation = readAppConversationResource(db, item.appId, item.conversationId, {
      limit: 40,
      ...(contextTopicId ? { topicId: contextTopicId } : {}),
    });
    const boundedConversation = boundedAppRequestConversation(
      {
        ...conversation,
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
    if (referencedTasks.length > 0) {
      request.referencedTasks = await Promise.all(
        referencedTasks.map(async (identity) => {
          let observation: AppDependencyObservation | null = null;
          try {
            observation = await observeTaskDependency(readDependency, identity.appId, {
              kind: "task",
              id: identity.taskId,
            });
          } catch {
            // A rendered reference remains useful identity even when its App is no longer readable.
          }
          return {
            appId: identity.appId,
            ...(identity.ref ? { ref: identity.ref } : {}),
            task: observation ?? { kind: "task" as const, id: identity.taskId, status: "unknown" as const },
          };
        }),
      );
    }
  }
  return request;
}
