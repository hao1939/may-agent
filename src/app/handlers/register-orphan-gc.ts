/**
 * Register bounded cleanup for stale legacy event pairs.
 *
 * Pair state is infrastructure bookkeeping. The collector deliberately does
 * not infer message meaning, reconstruct traces, or wake an App owner.
 */

import type { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";
import { getDb } from "../../lib/db/connection.js";

const RECONCILE_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10_000;

type StalePair = {
  open_event_id: number;
  pair_name: string;
  correlation_key: string;
  owner: string | null;
};

export function registerEventPairOrphanGc(cron: Cron, persistDir: string, bus: EventBus): void {
  const db = getDb(persistDir);

  cron.registerHandler("event-pair-orphan-gc", async (_event, _signal) => {
    const cutoff = Date.now() - DEFAULT_MAX_AGE_MS;
    const orphans = db
      .prepare(
        `SELECT open_event_id, pair_name, correlation_key, owner
         FROM event_pair_runs
         WHERE status = 'orphan'
           AND closed_at IS NULL
           AND opened_at < ?
         ORDER BY opened_at ASC
         LIMIT ?`,
      )
      .all(cutoff, DEFAULT_BATCH_SIZE) as StalePair[];

    for (const orphan of orphans) {
      bus.emit({
        type: "event-pair.orphan-gc.close",
        source: "handler:event-pair-orphan-gc",
        owner: orphan.owner ?? "agent:may",
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
      data: { closedLegacyOrphans: orphans.length },
    } as any);
  });

  cron.addSyntheticEntry({
    name: "event-pair-orphan-gc",
    intervalMs: RECONCILE_INTERVAL_MS,
    handler: "event-pair-orphan-gc",
    category: "handler",
    enabled: true,
    handlerConfig: {
      maxAgeMs: DEFAULT_MAX_AGE_MS,
      batchSize: DEFAULT_BATCH_SIZE,
    },
  } as any);
}
