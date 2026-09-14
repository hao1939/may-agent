import { createHash } from "node:crypto";

/** Stable across attempts, restart and executor changes. */
export function conversationTaskId(appId: string, conversationId: string): string {
  return `conversation_${createHash("sha256").update([appId, conversationId].join("\0")).digest("hex").slice(0, 24)}`;
}
