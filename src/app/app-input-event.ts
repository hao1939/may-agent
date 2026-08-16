import type { AgentEvent } from "./event-bus.js";

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
