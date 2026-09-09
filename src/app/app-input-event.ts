import type { AgentEvent } from "./core/events/bus.js";

/** Append an explicit human-visible runtime notice to May's shared Conversation. */
export function mayConversationNoticeEvent(input: {
  source: string;
  authorId: string;
  text: string;
}): AgentEvent {
  const source = input.source.trim();
  const authorId = input.authorId.trim();
  const text = input.text.trim();
  if (!source || !authorId || !text) {
    throw new Error("May Conversation notice requires source, author, and text");
  }
  return {
    type: "conversation.message.created",
    source,
    owner: "app:may",
    data: {
      appId: "may",
      conversationId: "may:primary",
      author: { kind: "tool", id: authorId },
      text,
    },
  };
}

/** Build one durable request to the canonical App Inbox. */
export function appOwnerReviewEvent(input: {
  appId: string;
  source: string;
  sourceId: string;
  data: Record<string, unknown>;
}): AgentEvent {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const sourceId = input.sourceId.trim();
  if (!appId || !sourceId) {
    throw new Error("App owner review requires non-empty App and source identities");
  }
  return {
    type: "app.input.requested",
    source: input.source,
    owner: `app:${appId}`,
    data: {
      appId,
      input: { kind: "owner-review", data: input.data },
      source: { kind: "system", id: sourceId },
      idempotencyKey: `owner-review:${sourceId}`,
    },
  };
}
