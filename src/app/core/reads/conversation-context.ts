import type { AppConversationResource } from "@may-agent/sdk/app";

export const APP_REQUEST_CONVERSATION_MAX_BYTES = 12 * 1_024;
const APP_REQUEST_MESSAGE_BYTES = 7_500;
const APP_REQUEST_MESSAGE_TEXT_BYTES = 2_000;
const APP_REQUEST_OLDER_AGENT_TEXT_BYTES = 600;

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
  const recentHumanIds = new Set(
    available
      .filter((candidate) => candidate.author.kind === "human")
      .slice(-3)
      .map((candidate) => candidate.id),
  );
  const priority = available.filter(
    (candidate) =>
      candidate.id === repliedMessageId ||
      recentHumanIds.has(candidate.id) ||
      (currentTopicId !== undefined && candidate.metadata?.topicId === currentTopicId),
  );
  const remaining = available.filter((candidate) => !priority.includes(candidate));
  const latestAgentId = available.filter((candidate) => candidate.author.kind === "agent").at(-1)?.id;
  for (const item of [...priority].reverse().concat([...remaining].reverse())) {
    const isHotMessage =
      item.author.kind === "human" ||
      item.id === repliedMessageId ||
      item.id === latestAgentId ||
      (currentTopicId !== undefined && item.metadata?.topicId === currentTopicId);
    const maxTextBytes = isHotMessage ? APP_REQUEST_MESSAGE_TEXT_BYTES : APP_REQUEST_OLDER_AGENT_TEXT_BYTES;
    const projected = {
      ...item,
      text: boundedUtf8Text(item.text, maxTextBytes),
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
  const orderedRequests = [
    ...(conversation.requests ?? []).filter((request) => request.status === "open"),
    ...(conversation.requests ?? []).filter((request) => request.status !== "open"),
  ];
  for (const request of orderedRequests) {
    const requests = [...result.requests!, request];
    if (encodedBytes({ ...result, requests }) <= APP_REQUEST_CONVERSATION_MAX_BYTES) result.requests = requests;
  }
  if (encodedBytes(result) > APP_REQUEST_CONVERSATION_MAX_BYTES) {
    throw new Error("Bounded Conversation context exceeded its byte contract");
  }
  return result;
}
