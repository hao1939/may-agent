import { createHash } from "node:crypto";

/** Stable across attempts, restart and executor changes. */
export function conversationTaskId(appId: string, conversationId: string): string {
  return `conversation_${createHash("sha256").update([appId, conversationId].join("\0")).digest("hex").slice(0, 24)}`;
}

/** Stable lineage identity used only when a historical Conversation Task is terminal. */
export function conversationTaskSuccessorId(appId: string, conversationId: string, ordinal: number): string {
  if (!Number.isSafeInteger(ordinal) || ordinal < 2) throw new Error("Conversation successor ordinal must be at least 2");
  return `${conversationTaskId(appId, conversationId)}_successor_${ordinal}`;
}
