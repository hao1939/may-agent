/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * This is the ONLY component that writes to the DB.
 * Core emits events, DbWriter persists them.
 *
 * See: agents/shared/may-agent-docs/design/architecture-redesign.md
 */

import type { AgentEvent } from "../app/event-bus.js";
import { getDb, upsertSession, updateSessionDb } from "./requests.js";
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
            task: event.task ?? "",
            status: "running",
            kind: event.kind,
            source: event.source,
            parentSessionId: event.parentSessionId,
            workflowRunId: event.workflowRunId,
            projectId: (event as any).projectId,
            requestId: event.requestId,
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
          // Persisted as event — no duplicate request needed
          this.db.run(
            "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
            ["agent.notification", event.from, event.to, JSON.stringify({ task: event.task, from: event.from }), Date.now()]
          );
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

        case "emit":
          // Legacy compat: still handle old-style {type:"emit", event:X, data:{}} if any remain
          try {
            const data = (event as any).data as Record<string, unknown> | undefined;
            this.db.run(
              "INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)",
              [
                (event as any).event,
                data?.source as string ?? null,
                data?.owner as string ?? null,
                data ? JSON.stringify(data) : null,
                Date.now(),
                data?.urgency as string ?? "normal",
              ],
            );
          } catch {
            /* table may not exist on first run */
          }
          break;

        default:
          // Persist domain events (dot-separated types) to events table
          if (event.type.includes('.')) {
            try {
              const ev = event as any;
              const { type, ...data } = ev;
              this.db.run(
                "INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)",
                [type, data.source ?? null, data.owner ?? null, JSON.stringify(data), Date.now(), data.urgency ?? "normal"],
              );
            } catch { /* table may not exist */ }
          }
          break;
      }
    } catch (err) {
      // DB errors are operational — log but don't break the bus
      console.error(`[db-writer] Error persisting ${event.type}:`, err instanceof Error ? err.message : err);
    }
  };
}
