/**
 * Register the shared message lifecycle reconciler and legacy pair cleanup.
 *
 * The historical handler name remains stable for deployment compatibility.
 * Message state changes are emitted as events; this code only reads the DB.
 */

import type { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";
import { getDb } from "../../lib/db/connection.js";

const RECONCILE_INTERVAL_MS = 15 * 60 * 1000;
const DELIVERY_PROOF_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10_000;

type OpenMessage = {
  openEventId: number;
  owner: string | null;
  openedAt: number;
  expectedCloseAt: number;
  timestamp: number;
  ttlMs: number | null;
  data: Record<string, unknown>;
  traceId: string;
};

type StoredEvent = {
  id: number;
  eventType: string;
  timestamp: number;
  projectId: string | null;
  data: Record<string, unknown>;
};

type MessageOutcome = "fulfilled" | "superseded" | "expired" | "failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeActor(value: unknown): string {
  const actor = typeof value === "string" ? value.trim() : "";
  return actor.replace(/^(agent|human):/, "");
}

function isHumanRecipient(data: Record<string, unknown>): boolean {
  const recipient = typeof data.to === "string" ? data.to.trim().toLowerCase() : "";
  const target = isRecord(data.target) ? data.target : {};
  return recipient === "human" || recipient.startsWith("human:") || target.human === true;
}

function isOwnerRecipient(message: OpenMessage): boolean {
  return Boolean(normalizeActor(message.owner) && normalizeActor(message.data.to) === normalizeActor(message.owner));
}

function expectedResponse(data: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(data.expectedResponse) && typeof data.expectedResponse.type === "string") {
    return data.expectedResponse;
  }
  const approval = isRecord(data.approval) ? data.approval : null;
  return approval && isRecord(approval.directEvent) && typeof approval.directEvent.type === "string"
    ? approval.directEvent
    : null;
}

function recoverySourceEventId(data: Record<string, unknown>): number | null {
  const recovery = isRecord(data.recovery) ? data.recovery : null;
  const value = Number(recovery?.sourceEventId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isRequest(data: Record<string, unknown>): boolean {
  return Boolean(
    expectedResponse(data) ||
    data.requestedAction ||
    data.requestedHumanAction ||
    data.approvalId ||
    data.waitId ||
    data.approval,
  );
}

function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function explicitExpiry(message: OpenMessage): number | null {
  const declared = timestamp(message.data.expiresAt ?? message.data.deadlineAt);
  if (declared !== null) return declared;
  return message.ttlMs && message.ttlMs > 0 ? message.timestamp + message.ttlMs : null;
}

function eventField(event: StoredEvent, key: string): unknown {
  if (event.data[key] !== undefined) return event.data[key];
  if (key === "project") return event.projectId ?? event.data.projectId ?? event.data.project;
  const target = isRecord(event.data.target) ? event.data.target : {};
  return target[key];
}

function responseMatches(expected: Record<string, unknown>, event: StoredEvent): boolean {
  if (event.eventType !== expected.type) return false;
  const expectedTarget = isRecord(expected.target) ? expected.target : {};
  if (typeof expectedTarget.project === "string" && eventField(event, "project") !== expectedTarget.project) {
    return false;
  }
  for (const key of ["approvalKind", "approvalId", "waitId", "pathId", "packetPath", "taskId"]) {
    if (expected[key] !== undefined && eventField(event, key) !== expected[key]) return false;
  }
  if (
    Array.isArray(expected.acceptedDecisions) &&
    !expected.acceptedDecisions.some((decision) => decision === eventField(event, "decision"))
  ) {
    return false;
  }
  return true;
}

function readOpenMessage(db: ReturnType<typeof getDb>, openEventId: number): OpenMessage | null {
  const row = db
    .prepare(
      `SELECT p.open_event_id, p.owner, p.opened_at, p.expected_close_at,
              e.timestamp, e.ttl_ms, e.data, COALESCE(t.trace_id, 'event:' || e.id) AS trace_id
       FROM event_pair_runs p
       JOIN events e ON e.id = p.open_event_id
       LEFT JOIN event_traces t ON t.event_id = e.id
       WHERE p.pair_name = 'owner_inbox'
         AND p.status IN ('open', 'orphan')
         AND e.event_type = 'message.created'
         AND p.open_event_id = ?
       LIMIT 1`,
    )
    .get(openEventId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    openEventId: Number(row.open_event_id),
    owner: typeof row.owner === "string" ? row.owner : null,
    openedAt: Number(row.opened_at),
    expectedCloseAt: Number(row.expected_close_at),
    timestamp: Number(row.timestamp),
    ttlMs: typeof row.ttl_ms === "number" ? row.ttl_ms : null,
    data: parseRecord(row.data),
    traceId: String(row.trace_id),
  };
}

function readStoredEvents(db: ReturnType<typeof getDb>, eventType: string, afterEventId: number): StoredEvent[] {
  return (
    db
      .prepare(
        `SELECT id, event_type, timestamp, project_id, data
         FROM events
         WHERE event_type = ? AND id > ?
         ORDER BY id DESC
         LIMIT 200`,
      )
      .all(eventType, afterEventId) as Array<Record<string, unknown>>
  ).map((row) => ({
    id: Number(row.id),
    eventType: String(row.event_type),
    timestamp: Number(row.timestamp),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    data: parseRecord(row.data),
  }));
}

function matchingResponse(db: ReturnType<typeof getDb>, message: OpenMessage): StoredEvent | null {
  const expected = expectedResponse(message.data);
  if (!expected) return null;
  return (
    readStoredEvents(db, String(expected.type), message.openEventId).find((event) =>
      responseMatches(expected, event),
    ) ?? null
  );
}

function directDeliveryEvent(db: ReturnType<typeof getDb>, sourceEventId: number): StoredEvent | null {
  const exact = db
    .prepare(
      `SELECT id, event_type, timestamp, project_id, data
       FROM events
       WHERE event_type IN ('channel.delivery.completed', 'channel.delivery.failed')
         AND json_extract(data, '$.sourceEventId') = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(sourceEventId) as Record<string, unknown> | undefined;
  return exact
    ? {
        id: Number(exact.id),
        eventType: String(exact.event_type),
        timestamp: Number(exact.timestamp),
        projectId: typeof exact.project_id === "string" ? exact.project_id : null,
        data: parseRecord(exact.data),
      }
    : null;
}

function exactDeliveryEvent(db: ReturnType<typeof getDb>, message: OpenMessage): StoredEvent | null {
  const exact = directDeliveryEvent(db, message.openEventId);
  if (exact) return exact;

  // An explicitly reviewed recovery may use a new carrier event while the
  // original message remains the semantic request. Treat delivery of that
  // carrier as proof for the original instead of keeping both requests open.
  const recovered = db
    .prepare(
      `SELECT d.id, d.event_type, d.timestamp, d.project_id, d.data
       FROM events recovery
       JOIN events d
         ON d.event_type IN ('channel.delivery.completed', 'channel.delivery.failed')
        AND json_extract(d.data, '$.sourceEventId') = recovery.id
       WHERE recovery.event_type = 'message.created'
         AND json_extract(recovery.data, '$.recovery.sourceEventId') = ?
       ORDER BY CASE d.event_type WHEN 'channel.delivery.completed' THEN 0 ELSE 1 END,
                d.id DESC
       LIMIT 1`,
    )
    .get(message.openEventId) as Record<string, unknown> | undefined;
  if (recovered) {
    return {
      id: Number(recovered.id),
      eventType: String(recovered.event_type),
      timestamp: Number(recovered.timestamp),
      projectId: typeof recovered.project_id === "string" ? recovered.project_id : null,
      data: parseRecord(recovered.data),
    };
  }

  // Legacy delivery events lacked sourceEventId. Their trace still gives a
  // bounded recovery path for messages created before this convention.
  const legacy = db
    .prepare(
      `SELECT e.id, e.event_type, e.timestamp, e.project_id, e.data
       FROM event_traces t
       JOIN events e ON e.id = t.event_id
       WHERE t.trace_id = ?
         AND e.id > ?
         AND e.event_type IN ('channel.delivery.completed', 'channel.delivery.failed')
         AND json_extract(e.data, '$.resultEventType') = 'message.created'
       ORDER BY e.id DESC
       LIMIT 1`,
    )
    .get(message.traceId, message.openEventId) as Record<string, unknown> | undefined;
  return legacy
    ? {
        id: Number(legacy.id),
        eventType: String(legacy.event_type),
        timestamp: Number(legacy.timestamp),
        projectId: typeof legacy.project_id === "string" ? legacy.project_id : null,
        data: parseRecord(legacy.data),
      }
    : null;
}

function latestAdmissionFailure(db: ReturnType<typeof getDb>, message: OpenMessage): StoredEvent | null {
  const row = db
    .prepare(
      `SELECT id, event_type, timestamp, project_id, data
       FROM events
       WHERE event_type = 'human.attention.reviewed'
         AND json_extract(data, '$.sourceEventId') = ?
         AND COALESCE(json_extract(data, '$.delivered'), 0) = 0
         AND json_extract(data, '$.status') = 'failed'
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(message.openEventId) as Record<string, unknown> | undefined;
  return row
    ? {
        id: Number(row.id),
        eventType: String(row.event_type),
        timestamp: Number(row.timestamp),
        projectId: typeof row.project_id === "string" ? row.project_id : null,
        data: parseRecord(row.data),
      }
    : null;
}

function latestCompletedAdmissionReview(db: ReturnType<typeof getDb>, sourceEventId: number): StoredEvent | null {
  const row = db
    .prepare(
      `SELECT id, event_type, timestamp, project_id, data
       FROM events
       WHERE event_type = 'human.attention.reviewed'
         AND json_extract(data, '$.sourceEventId') = ?
         AND json_extract(data, '$.status') = 'completed'
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(sourceEventId) as Record<string, unknown> | undefined;
  return row
    ? {
        id: Number(row.id),
        eventType: String(row.event_type),
        timestamp: Number(row.timestamp),
        projectId: typeof row.project_id === "string" ? row.project_id : null,
        data: parseRecord(row.data),
      }
    : null;
}

function admissionDisposition(review: StoredEvent | null): string | null {
  const value = review?.data.disposition;
  return typeof value === "string" && value.trim() ? value : null;
}

function isDeliveredAdmission(review: StoredEvent | null): boolean {
  return admissionDisposition(review) === "deliver" && review?.data.delivered === true;
}

function terminalAdmissionOutcome(review: StoredEvent | null): { outcome: MessageOutcome; summary: string } | null {
  const disposition = admissionDisposition(review);
  if (!disposition || review?.data.status !== "completed") return null;
  switch (disposition) {
    case "handle":
      return {
        outcome: "fulfilled",
        summary: "Admission review handled the request without delivering a new human message.",
      };
    case "route":
      return {
        outcome: "superseded",
        summary: "Admission review routed the request to the accountable owner without delivering it to the human inbox.",
      };
    case "clarify-producer":
      return {
        outcome: "superseded",
        summary: "Admission review returned the request to the producer for bounded clarification instead of human delivery.",
      };
    case "reject":
      return {
        outcome: "failed",
        summary: "Admission review rejected the request instead of delivering it to the human inbox.",
      };
    default:
      return null;
  }
}

function latestSupersedingRecoveryEvidence(db: ReturnType<typeof getDb>, message: OpenMessage): StoredEvent | null {
  const row = db
    .prepare(
      `SELECT proof.id, proof.event_type, proof.timestamp, proof.project_id, proof.data
       FROM events carrier
       JOIN events proof
         ON (
           (
             proof.event_type = 'human.attention.reviewed'
             AND json_extract(proof.data, '$.sourceEventId') = carrier.id
             AND json_extract(proof.data, '$.status') = 'completed'
           )
           OR (
             proof.event_type IN ('channel.delivery.completed', 'channel.delivery.failed')
             AND json_extract(proof.data, '$.sourceEventId') = carrier.id
           )
           OR (
             proof.event_type = 'message.resolved'
             AND json_extract(proof.data, '$.openEventId') = carrier.id
             AND json_extract(proof.data, '$.openEventType') = 'message.created'
           )
         )
       WHERE carrier.event_type = 'message.created'
         AND carrier.id > ?
         AND (
           json_extract(carrier.data, '$.recovery.sourceEventId') = ?
           OR json_extract(carrier.data, '$.recovery.previousReplayEventId') = ?
         )
       ORDER BY proof.id DESC
       LIMIT 1`,
    )
    .get(message.openEventId, message.openEventId, message.openEventId) as Record<string, unknown> | undefined;
  return row
    ? {
        id: Number(row.id),
        eventType: String(row.event_type),
        timestamp: Number(row.timestamp),
        projectId: typeof row.project_id === "string" ? row.project_id : null,
        data: parseRecord(row.data),
      }
    : null;
}

function recoveryPredecessorIds(db: ReturnType<typeof getDb>, carrierEventId: number): number[] {
  const row = db
    .prepare(
      `SELECT data
       FROM events
       WHERE id = ?
         AND event_type = 'message.created'
       LIMIT 1`,
    )
    .get(carrierEventId) as Record<string, unknown> | undefined;
  if (!row) return [];
  const data = parseRecord(row.data);
  const recovery = isRecord(data.recovery) ? data.recovery : {};
  const ids = [Number(recovery.sourceEventId), Number(recovery.previousReplayEventId)].filter(
    (value, index, all): value is number => Number.isInteger(value) && value > 0 && all.indexOf(value) === index,
  );
  return ids;
}

function messageProject(data: Record<string, unknown>): string | undefined {
  for (const value of [data.project, data.domainProjectId, data.projectId]) {
    if (typeof value === "string" && value.trim()) return value.replace(/^projects\//, "").replace(/\.app$/, "");
  }
  return undefined;
}

function resolveMessage(
  bus: EventBus,
  message: OpenMessage,
  outcome: MessageOutcome,
  summary: string,
  evidenceEventId?: number,
): void {
  const project = messageProject(message.data);
  bus.emit({
    type: "message.resolved",
    source: "handler:message-lifecycle",
    owner: message.owner ?? "agent:may",
    ...(project ? { target: { project } } : {}),
    data: {
      openEventId: message.openEventId,
      openEventType: "message.created",
      ...(project ? { project, projectId: project } : {}),
      disposition: outcome === "fulfilled" ? "answered" : outcome,
      outcome,
      summary,
      taskRefs: [],
      ...(evidenceEventId ? { evidenceEventId } : {}),
    },
    trace: {
      traceId: message.traceId,
      parentEventId: evidenceEventId ?? message.openEventId,
      links: [{ eventId: message.openEventId, type: "closure", label: "message.resolved" }],
    },
  } as any);
}

function wakeOwner(bus: EventBus, message: OpenMessage): void {
  bus.emit({
    type: "owner.inbox.accepted",
    source: "handler:message-lifecycle",
    owner: message.owner ?? "agent:may",
    data: {
      sourceEventId: message.openEventId,
      sourceEventType: "message.created",
      reason: "periodic-resync",
      ...(typeof message.data.project === "string" ? { project: message.data.project } : {}),
      input: message.data,
    },
    trace: {
      traceId: message.traceId,
      parentEventId: message.openEventId,
      links: [{ eventId: message.openEventId, type: "reference", label: "owner.inbox.accepted" }],
    },
  } as any);
}

function reconcileMessage(
  db: ReturnType<typeof getDb>,
  bus: EventBus,
  message: OpenMessage,
  now: number,
  periodic: boolean,
): "open" | "rewoken" | "resolved" {
  if (isOwnerRecipient(message)) {
    if (periodic) wakeOwner(bus, message);
    return periodic ? "rewoken" : "open";
  }
  if (!isHumanRecipient(message.data)) return "open";

  const supersedingRecovery = latestSupersedingRecoveryEvidence(db, message);
  if (supersedingRecovery) {
    const deliveredRecovery =
      supersedingRecovery.eventType === "channel.delivery.completed" || isDeliveredAdmission(supersedingRecovery);
    const supersedingDisposition = admissionDisposition(supersedingRecovery);
    resolveMessage(
      bus,
      message,
      "superseded",
      deliveredRecovery
        ? "A later recovery carrier passed admission review or delivery and now owns the exact human-facing request."
        : `A later recovery carrier reached terminal ${supersedingDisposition ?? supersedingRecovery.eventType} disposition, so this earlier carrier no longer owns the request.`,
      supersedingRecovery.id,
    );
    return "resolved";
  }

  const recoveredFrom = recoverySourceEventId(message.data);
  if (recoveredFrom && readOpenMessage(db, recoveredFrom)) {
    const originalDirectDelivery = directDeliveryEvent(db, recoveredFrom);
    const originalReviewedDelivery = latestCompletedAdmissionReview(db, recoveredFrom);
    if (
      originalDirectDelivery?.eventType === "channel.delivery.completed" ||
      isDeliveredAdmission(originalReviewedDelivery)
    ) {
      const lineageEvidence =
        originalDirectDelivery?.eventType === "channel.delivery.completed"
          ? originalDirectDelivery
          : originalReviewedDelivery;
      resolveMessage(
        bus,
        message,
        "superseded",
        `Delivery already continued the original message ${recoveredFrom}; this recovery carrier no longer owns a separate request.`,
        lineageEvidence?.id,
      );
      return "resolved";
    }
  }

  const response = matchingResponse(db, message);
  if (response) {
    resolveMessage(bus, message, "fulfilled", `Accepted the expected ${response.eventType} response.`, response.id);
    return "resolved";
  }

  const completedReview = latestCompletedAdmissionReview(db, message.openEventId);
  const terminalReview = terminalAdmissionOutcome(completedReview);
  if (terminalReview) {
    resolveMessage(bus, message, terminalReview.outcome, terminalReview.summary, completedReview?.id);
    return "resolved";
  }

  const expiresAt = explicitExpiry(message);
  if (expiresAt !== null && now >= expiresAt) {
    resolveMessage(bus, message, "expired", "The producer's explicit message deadline elapsed.");
    return "resolved";
  }

  const delivery = exactDeliveryEvent(db, message);
  const reviewedDelivery = isDeliveredAdmission(completedReview) ? completedReview : null;
  const delivered = delivery?.eventType === "channel.delivery.completed" ? delivery : reviewedDelivery;
  if (delivered) {
    if (expectedResponse(message.data)) return "open";
    if (isRequest(message.data)) {
      resolveMessage(
        bus,
        message,
        "failed",
        "The request was delivered without an exact expectedResponse, so its result cannot be correlated safely.",
        delivered.id,
      );
      return "resolved";
    }
    resolveMessage(
      bus,
      message,
      "fulfilled",
      delivered.eventType === "human.attention.reviewed"
        ? "Admission review delivered the message to the human inbox."
        : "Channel delivery was confirmed.",
      delivered.id,
    );
    return "resolved";
  }

  const failure = delivery?.eventType === "channel.delivery.failed" ? delivery : latestAdmissionFailure(db, message);
  const failureSince = failure?.timestamp ?? message.openedAt;
  const deliveryWindowElapsed = now >= Math.max(message.expectedCloseAt, failureSince + DELIVERY_PROOF_TIMEOUT_MS);
  if (deliveryWindowElapsed) {
    resolveMessage(
      bus,
      message,
      "failed",
      failure
        ? "Delivery failed and no later confirmation arrived within the bounded recovery window."
        : "No delivery proof arrived within the bounded delivery window.",
      failure?.id,
    );
    return "resolved";
  }
  return "open";
}

function sourceEventId(event: Record<string, unknown>): number | null {
  const data = isRecord(event.data) ? event.data : event;
  const value = Number(data.sourceEventId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function registerEventPairOrphanGc(cron: Cron, persistDir: string, bus: EventBus): void {
  const db = getDb(persistDir);

  bus.subscribe((rawEvent) => {
    const event = rawEvent as unknown as Record<string, unknown>;
    const directSourceId = sourceEventId(event);
    if (
      directSourceId &&
      ["channel.delivery.completed", "channel.delivery.failed", "human.attention.reviewed"].includes(String(event.type))
    ) {
      const message = readOpenMessage(db, directSourceId);
      if (message) reconcileMessage(db, bus, message, Date.now(), false);
      for (const predecessorId of recoveryPredecessorIds(db, directSourceId)) {
        const predecessor = readOpenMessage(db, predecessorId);
        if (predecessor) reconcileMessage(db, bus, predecessor, Date.now(), false);
      }
      return;
    }

    const eventType = typeof event.type === "string" ? event.type : "";
    if (!eventType || eventType === "message.resolved") return;
    const candidates = db
      .prepare(
        `SELECT p.open_event_id
         FROM event_pair_runs p
         JOIN events e ON e.id = p.open_event_id
         WHERE p.pair_name = 'owner_inbox'
           AND p.status IN ('open', 'orphan')
           AND e.event_type = 'message.created'
           AND (
             json_extract(e.data, '$.expectedResponse.type') = ?
             OR json_extract(e.data, '$.approval.directEvent.type') = ?
           )
         ORDER BY p.opened_at ASC
         LIMIT 200`,
      )
      .all(eventType, eventType) as Array<{ open_event_id: number }>;
    for (const candidate of candidates) {
      const message = readOpenMessage(db, Number(candidate.open_event_id));
      if (message) reconcileMessage(db, bus, message, Date.now(), false);
    }
  });

  cron.registerHandler("event-pair-orphan-gc", async (_event, _signal) => {
    const rows = db
      .prepare(
        `SELECT p.open_event_id
         FROM event_pair_runs p
         JOIN events e ON e.id = p.open_event_id
         WHERE p.pair_name = 'owner_inbox'
           AND p.status IN ('open', 'orphan')
           AND e.event_type = 'message.created'
         ORDER BY p.opened_at ASC
         LIMIT ?`,
      )
      .all(DEFAULT_BATCH_SIZE) as Array<{ open_event_id: number }>;

    let rewoken = 0;
    let resolved = 0;
    for (const row of rows) {
      const message = readOpenMessage(db, Number(row.open_event_id));
      if (!message) continue;
      const result = reconcileMessage(db, bus, message, Date.now(), true);
      if (result === "rewoken") rewoken++;
      if (result === "resolved") resolved++;
    }

    const cutoff = Date.now() - DEFAULT_MAX_AGE_MS;
    const orphans = db
      .prepare(
        `SELECT open_event_id, pair_name, correlation_key
         FROM event_pair_runs
         WHERE status = 'orphan'
           AND closed_at IS NULL
           AND opened_at < ?
           AND NOT (
             pair_name = 'owner_inbox'
             AND open_event_id IN (SELECT id FROM events WHERE event_type = 'message.created')
           )
         ORDER BY opened_at ASC
         LIMIT ?`,
      )
      .all(cutoff, DEFAULT_BATCH_SIZE) as Array<{
      open_event_id: number;
      pair_name: string;
      correlation_key: string;
    }>;

    for (const orphan of orphans) {
      bus.emit({
        type: "event-pair.orphan-gc.close",
        source: "handler:event-pair-orphan-gc",
        owner: "agent:may",
        data: {
          openEventId: orphan.open_event_id,
          pairName: orphan.pair_name,
          correlationKey: orphan.correlation_key,
          reason: "stale-orphan-gc",
        },
      } as any);
    }

    bus.emit({
      type: "event-pair.orphan-gc.pass",
      source: "handler:event-pair-orphan-gc",
      owner: "agent:may",
      data: {
        reconciledMessages: rows.length,
        rewokenOwnerMessages: rewoken,
        resolvedMessages: resolved,
        closedLegacyOrphans: orphans.length,
      },
    } as any);
  });

  cron.addSyntheticEntry({
    name: "event-pair-orphan-gc",
    intervalMs: RECONCILE_INTERVAL_MS,
    handler: "event-pair-orphan-gc",
    category: "handler",
    enabled: true,
    handlerConfig: {
      deliveryProofTimeoutMs: DELIVERY_PROOF_TIMEOUT_MS,
      maxAgeMs: DEFAULT_MAX_AGE_MS,
      batchSize: DEFAULT_BATCH_SIZE,
    },
  } as any);
}
