import type { AppConversationResource } from "@may-agent/sdk";

export const APP_REQUEST_CONVERSATION_MAX_BYTES = 12 * 1_024;
const APP_REQUEST_MESSAGE_BYTES = 7_500;
const APP_REQUEST_MESSAGE_TEXT_BYTES = 2_000;

function encodedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function boundedUtf8Text(value: string, maxBytes: number): string {
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
  currentRequestId?: string,
): AppConversationResource {
  const messages: AppConversationResource["messages"] = [];
  const available = conversation.messages.filter(
    (candidate) => currentRequestId === undefined || candidate.metadata?.requestId !== currentRequestId,
  );
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
