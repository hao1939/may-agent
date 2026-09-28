import type { AppInputContext, AppTaskInput } from "@may-agent/sdk";

/** Scripted reply fixtures select the reply input; the full batch stays available. */
export function readConversationReplyContext(prompt: string): AppInputContext {
  const match = prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error("Conversation prompt missing input context");
  const { inputs, replyTo, ...context } = JSON.parse(match[1]!) as Omit<AppInputContext, "id" | "source" | "input"> & {
    inputs: AppTaskInput[];
    replyTo: { id: string };
  };
  const replyInput = inputs.find(({ id }) => id === replyTo.id);
  if (!replyInput) throw new Error("Conversation reply input missing from batch");
  return { ...context, ...replyInput, inputs };
}
