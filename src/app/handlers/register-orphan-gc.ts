/**
 * Register the event-pair orphan GC as a synthetic cron entry.
 *
 * Periodically reconciles open owner messages and retires stale orphan pairs
 * that do not represent unfinished owner work.
 *
 * Contract: No direct DB writes for mutations. Read-only queries identify
 * candidates; all state changes flow through ctx.emit() / bus.emit().
 */

import type { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";
import { getDb } from "../../lib/db/connection.js";

/** Default interval: run orphan GC every 15 minutes. */
const GC_INTERVAL_MS = 15 * 60 * 1000;

/** Default age: orphans older than 24h are eligible for GC. */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Max orphans to close per pass. */
const DEFAULT_BATCH_SIZE = 10000;

export function registerEventPairOrphanGc(cron: Cron, persistDir: string, bus: EventBus): void {
  const maxAgeMs = DEFAULT_MAX_AGE_MS;
  const batchSize = DEFAULT_BATCH_SIZE;

  cron.registerHandler("event-pair-orphan-gc", async (_event, _signal) => {
    const db = getDb(persistDir);
    const cutoff = Date.now() - maxAgeMs;

    const ownerMessages = db
      .prepare(
        `SELECT p.open_event_id, e.event_type, e.owner, e.data
         FROM event_pair_runs p
         JOIN events e ON e.id = p.open_event_id
         WHERE p.pair_name = 'owner_inbox'
           AND p.status IN ('open', 'orphan')
           AND e.event_type = 'message.created'
         ORDER BY p.opened_at ASC
         LIMIT ?`,
      )
      .all(batchSize) as Array<{
      open_event_id: number;
      event_type: string;
      owner: string | null;
      data: string | null;
    }>;

    for (const message of ownerMessages) {
      let input: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(message.data ?? "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) input = parsed;
      } catch {
        /* keep malformed legacy content bounded to its durable event reference */
      }
      bus.emit({
        type: "owner.inbox.accepted",
        source: "handler:event-pair-orphan-gc",
        owner: message.owner ?? "agent:may",
        data: {
          sourceEventId: message.open_event_id,
          sourceEventType: message.event_type,
          reason: "periodic-resync",
          ...(typeof input.project === "string" ? { project: input.project } : {}),
          input,
        },
        trace: {
          traceId: `event:${message.open_event_id}`,
          parentEventId: message.open_event_id,
          links: [{ eventId: message.open_event_id, type: "reference", label: "owner.inbox.accepted" }],
        },
      } as any);
    }

    // Owner messages remain open until their intended result is verified.
    // Other abandoned pair types retain the legacy bounded cleanup policy.
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
      .all(cutoff, batchSize) as Array<{
      open_event_id: number;
      pair_name: string;
      correlation_key: string;
    }>;

    if (orphans.length === 0) {
      bus.emit({
        type: "event-pair.orphan-gc.pass",
        source: "handler:event-pair-orphan-gc",
        owner: "agent:may",
        data: {
          reconciledOwnerMessages: ownerMessages.length,
          closedCount: 0,
          message: "Owner messages reconciled; no stale non-owner orphans found",
        },
      } as any);
      return;
    }

    // Emit a synthetic close event for each orphan. The db-writer's
    // closePairForFollowup() picks up events with `openEventId` or
    // `open_event_id` in their data payload and closes matching pairs.
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

    // Summary event for observability.
    bus.emit({
      type: "event-pair.orphan-gc.pass",
      source: "handler:event-pair-orphan-gc",
      owner: "agent:may",
      data: {
        reconciledOwnerMessages: ownerMessages.length,
        closedCount: orphans.length,
        maxAgeMs,
        cutoffTimestamp: cutoff,
        message: `GC closed ${orphans.length} stale orphan pair(s)`,
      },
    } as any);
  });

  cron.addSyntheticEntry({
    name: "event-pair-orphan-gc",
    intervalMs: GC_INTERVAL_MS,
    handler: "event-pair-orphan-gc",
    category: "handler",
    enabled: true,
    handlerConfig: {
      maxAgeMs,
      batchSize,
    },
  } as any);
}
