import type { EventInput } from "@may-agent/control/events";
import { findEventPublication, getEventView } from "../../core/events/interface.js";
import type { SqliteDb } from "../../../lib/db.js";

export class ChatPublicationConflict extends Error {}

/** Recover routing from the original publication, before considering today's default. */
export function readChatPublication(
  db: SqliteDb,
  request: { agent: string; content: string; requestId: string; forceNew: boolean },
): { input: EventInput; accepted: boolean } | undefined {
  // Browser submission IDs are unique across targets. Multiple matches are
  // ambiguous; never select a newer target by sorting or interpreting the draft.
  const rows = db
    .prepare(
      `SELECT id FROM events
    WHERE event_type IN ('chat.start.requested', 'session.steer.requested')
      AND source = 'control-socket' AND ingress_source = 'event-interface'
      AND idempotency_key = ? AND idempotency_key != '' LIMIT 2`,
    )
    .all(request.requestId) as { id: number }[];
  if (!rows.length) return undefined;
  if (rows.length !== 1) throw new ChatPublicationConflict("Ambiguous chat publication identity");
  const eventId = rows[0].id;
  const saved = getEventView(db, eventId);
  if (!saved) throw new Error("Original chat publication unavailable");
  const sessionId = saved.event.target?.sessionId;
  if (saved.event.type === "session.steer.requested") {
    const session = db.prepare("SELECT agent FROM sessions WHERE sessionId = ?").get(sessionId) as
      { agent?: string } | undefined;
    if (!session) throw new Error("Original chat session unavailable");
    if (request.forceNew || session.agent !== request.agent)
      throw new ChatPublicationConflict("Chat request conflicts with its original target");
  }
  const input: EventInput = {
    type: saved.event.type,
    ...(sessionId ? { target: { sessionId } } : {}),
    idempotencyKey: request.requestId,
    data:
      saved.event.type === "session.steer.requested"
        ? { message: request.content, channel: "web-ui" }
        : {
            agent: request.agent,
            message: request.content,
            channel: "web-ui",
            forceNew: request.forceNew,
            requestId: request.requestId,
          },
  };
  // Compare the complete caller input with the stored publication hash. A
  // truncated SQL projection cannot establish equality for a long message.
  if (findEventPublication(db, input, { source: "control-socket" }) !== eventId) {
    throw new ChatPublicationConflict("Chat request conflicts with its original input");
  }
  return { input, accepted: saved.delivery.state === "accepted" };
}
