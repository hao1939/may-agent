import type { AgentEvent } from "./core/events/bus.js";

/** Append an explicit human-visible runtime notice to the selected Conversation. */
export function conversationNoticeEvent(input: {
  appId: string;
  conversationId: string;
  source: string;
  authorId: string;
  text: string;
}): AgentEvent {
  const source = input.source.trim();
  const authorId = input.authorId.trim();
  const text = input.text.trim();
  const appId = input.appId.trim();
  const conversationId = input.conversationId.trim();
  if (!appId || !conversationId || !source || !authorId || !text) {
    throw new Error("Conversation notice requires destination, source, author, and text");
  }
  return {
    type: "conversation.message.created",
    source,
    owner: `app:${appId}`,
    data: {
      appId,
      conversationId,
      author: { kind: "tool", id: authorId },
      text,
    },
  };
}
