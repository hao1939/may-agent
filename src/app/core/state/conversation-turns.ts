import { createHash } from "node:crypto";
import type { AppInputContext, ConversationTurnResult } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction as withTransaction } from "../../../lib/db/transaction.js";
import {
  assertAppInboxClaim,
  associateAppInboxClaimTopic,
  recordAppInboxHandling,
  type AppInboxClaim,
  type AppInboxHandling,
} from "./app-inbox-store.js";
import { createConversationTopic, readConversationTopic } from "./conversations.js";
import {
  applyConversationRequestUpdates,
  readConversationRequest,
  ConversationRequestConflict,
} from "./conversation-requests.js";

type TurnDecisionInput = {
  claim: AppInboxClaim;
  request: Readonly<AppInputContext>;
  decision: ConversationTurnResult;
  authorize: () => void;
  now: number;
};

export function stableTopicId(appId: string, conversationId: string, originMessageId: string): string {
  return `topic_${createHash("sha256").update([appId, conversationId, originMessageId].join("\0")).digest("hex").slice(0, 24)}`;
}

export function applyTurnTopic(db: SqliteDb, input: TurnDecisionInput): string | undefined {
  const { claim, request, decision, authorize, now } = input;
  return withTransaction(db, () => {
    authorize();
    assertAppInboxClaim(db, claim, now);
    const conversation = request.conversation;
    if (claim.item.topicId) {
      if (!conversation || !readConversationTopic(db, claim.item.appId, conversation.id, claim.item.topicId)) {
        throw new Error(`App ${claim.item.appId} request ${request.id} has unavailable Topic ${claim.item.topicId}`);
      }
      if (!associateAppInboxClaimTopic(db, claim, claim.item.topicId, now)) {
        throw new Error("claim is stale");
      }
      return claim.item.topicId;
    }
    if (decision.topic.kind === "none") return undefined;
    if (!conversation) throw new Error(`App ${claim.item.appId} cannot assign a Topic without a Conversation`);
    let topicId: string;
    if (decision.topic.kind === "existing") {
      const selectedTopicId = decision.topic.id;
      const topic = readConversationTopic(db, claim.item.appId, conversation.id, selectedTopicId);
      if (!topic) throw new Error(`App ${claim.item.appId} selected unavailable Topic ${selectedTopicId}`);
      topicId = topic.id;
    } else {
      topicId = stableTopicId(claim.item.appId, conversation.id, request.source.id);
      createConversationTopic(db, {
        id: topicId,
        appId: claim.item.appId,
        conversationId: conversation.id,
        title: decision.topic.title,
        openedBy: request.source.kind,
        originMessageId: conversation.current?.messageId ?? request.source.id,
        now,
      });
    }
    if (!associateAppInboxClaimTopic(db, claim, topicId, now)) {
      throw new Error("claim is stale");
    }
    return topicId;
  });
}

/** Save Topic, accepted/refined asks and the replayable decision together. */
export function acceptConversationTurnDecision(db: SqliteDb, input: TurnDecisionInput) {
  const { claim, request, decision, authorize, now } = input;
  const requestUpdates = decision.requestUpdates ?? [];
  const followUp = decision.followUp;
  const requestRevisions: Record<string, number> = Object.create(null);
  return withTransaction(db, () => {
    authorize();
    assertAppInboxClaim(db, claim, now);
    // Topic effects and accepted Requests must not outlive an unsaved decision.
    const topicId = applyTurnTopic(db, input);
    for (const update of requestUpdates) {
      const current = readConversationRequest(db, claim.item.appId, claim.item.conversationId!, update.id);
      if (update.disposition !== "open" && current && current.scope !== update.scope) {
        throw new ConversationRequestConflict("Closing an accepted Request cannot change its scope");
      }
    }
    if (requestUpdates.length)
      applyConversationRequestUpdates(db, {
        appId: claim.item.appId,
        conversationId: claim.item.conversationId!,
        topicId,
        updates: requestUpdates.map((update) => ({ ...update, disposition: "open", reason: undefined })),
        updateKey: `input:${claim.item.id}:accept`,
        now,
      });
    for (const update of requestUpdates) requestRevisions[update.id] = update.expectedRevision + 1;
    if (followUp?.requestId && requestRevisions[followUp.requestId] === undefined) {
      const observed =
        request.conversation?.requests?.find((ask) => ask.id === followUp.requestId) ??
        readConversationRequest(db, claim.item.appId, claim.item.conversationId!, followUp.requestId);
      if (!observed || observed.status !== "open")
        throw new ConversationRequestConflict("Handoff must name an open accepted Request in this Conversation");
      requestRevisions[followUp.requestId] = observed.revision;
    }
    const handling: AppInboxHandling = { phase: "decided", decision, requestRevisions };
    recordAppInboxHandling(db, claim, handling, now);
    return { topicId, handling };
  });
}
