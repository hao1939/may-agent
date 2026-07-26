/**
 * Register the event-pair orphan GC as a synthetic cron entry.
 *
 * Periodically identifies stale orphan event pairs (older than 24h by default)
 * and emits synthetic close events via the event bus. The db-writer's
 * closePairForFollowup() processes these events and transitions pairs to 'closed'.
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

    // Read-only: find orphan pairs older than the configured age.
    const orphans = db
      .prepare(
        `SELECT open_event_id, pair_name, correlation_key
         FROM event_pair_runs
         WHERE status = 'orphan'
           AND closed_at IS NULL
           AND opened_at < ?
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
        data: { closedCount: 0, message: "No stale orphans found" },
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
