/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * This is the ONLY component that writes to the DB.
 * Core emits events, DbWriter persists them.
 *
 * See: agents/shared/may-agent-docs/design/architecture-redesign.md
 */

import type { AgentEvent } from "../app/event-bus.js";
import { getDb, upsertSession, updateSessionDb, trackRequest } from "./requests.js";
import type { SqliteDb } from "./db.js";

export class DbWriter {
  private db: SqliteDb;
  private persistDir: string;

  constructor(persistDir: string) {
    this.persistDir = persistDir;
    this.db = getDb(persistDir);
  }

  /** Subscribe this writer to an EventBus. */
  handler = (event: AgentEvent): void => {
    try {
      switch (event.type) {
        case "session_start":
          upsertSession(this.persistDir, {
            sessionId: event.sessionId,
            agent: event.agent,
            task: (event as any).task ?? "",
            status: "running",
            kind: (event as any).kind,
            parentSessionId: event.parentSessionId,
            startedAt: Date.now(),
          });
          break;

        case "session_end":
          updateSessionDb(this.persistDir, event.sessionId, {
            status: event.status as any,
            error: event.error,
            outcome: event.outcome,
            opCount: event.opCount,
            endedAt: Date.now(),
          });
          break;

        case "message_created":
          trackRequest(this.persistDir, {
            fromEntity: event.from,
            toAgent: event.to,
            task: event.task,
            method: "message",
          });
          break;

        case "cron_fired":
          // Track cron job history
          try {
            this.db.run("INSERT INTO cron_history (job, agent, fired_at) VALUES (?, ?, ?)", [
              event.job,
              event.agent ?? null,
              event.timestamp,
            ]);
          } catch {
            /* table may not exist yet */
          }
          break;
      }
    } catch (err) {
      // DB errors are operational — log but don't break the bus
      console.error(`[db-writer] Error persisting ${event.type}:`, err instanceof Error ? err.message : err);
    }
  };
}
