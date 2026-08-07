/** A finish call is committed only when its matching tool result succeeded. */
function finishToolCallSucceeded(messages: any[], toolCallId: string | undefined): boolean {
  if (!toolCallId) return false;
  const result = messages.find((message) => message?.role === "toolResult" && message.toolCallId === toolCallId);
  if (!result) return false;
  if (result.isError === true) return false;
  const content = Array.isArray(result.content) ? result.content : [];
  return !content.some(
    (block: any) =>
      block?.type === "text" &&
      String(block.text ?? "")
        .trimStart()
        .startsWith("finish() error:"),
  );
}

export type FinishParams = {
  status: string;
  summary: string;
  blockers?: { reason: string; context: string }[];
  deliverables?: { path: string; description: string }[];
  next_steps?: string;
  completed_items?: string[];
  new_items?: string[];
  lessons?: { category: string; content: string }[];
  verification_evidence?: string[];
  context_updates?: { action: string; content: string }[];
  result?: unknown;
};

export function extractFinishParams(messages: any[]): FinishParams | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      const rawArgs = block?.arguments ?? block?.args;
      if (block?.type !== "toolCall" || block.name !== "finish" || !rawArgs) continue;
      if (!finishToolCallSucceeded(messages, block.id ?? block.toolCallId)) continue;
      try {
        const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
        return {
          status: args.status,
          summary: args.summary,
          blockers: args.blockers,
          deliverables: args.deliverables,
          next_steps: args.next_steps,
          completed_items: args.completed_items,
          new_items: args.new_items,
          lessons: args.lessons,
          verification_evidence: args.verification_evidence,
          context_updates: args.context_updates,
          result: args.result,
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}
