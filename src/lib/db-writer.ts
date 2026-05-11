/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * This is the ONLY component that writes to the DB.
 * Core emits events, DbWriter persists them.
 *
 * See: agents/shared/may-agent-docs/events.md
 */

import type { AgentEvent } from "../app/event-bus.js";
import { getDb, upsertSession, updateSessionDb } from "./requests.js";
import type { SqliteDb } from "./db.js";

const DURABLE_COMMAND_EVENTS = new Set([
  "input",
  "steer",
  "cancel",
  "cancel_all",
  "resume",
  "reload",
  "restart",
  "shutdown",
]);

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
        case "session.start":
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
            stepLabel: (event as any).stepLabel,
            startedAt: Date.now(),
          });
          // Also write event row for analytics / audit
          try {
            const { type, ...data } = event as any;
            this.db.run(
              "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
              [type, event.agent, event.agent, JSON.stringify(data), Date.now()],
            );
          } catch { /* best-effort */ }
          break;

        case "session.end":
          updateSessionDb(this.persistDir, event.sessionId, {
            status: event.status as any,
            error: event.error,
            outcome: event.outcome,
            opCount: event.opCount,
            endedAt: Date.now(),
          });
          // Also write event row for analytics / audit
          try {
            const { type, ...data } = event as any;
            this.db.run(
              "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
              [type, event.agent, event.agent, JSON.stringify(data), Date.now()],
            );
          } catch { /* best-effort */ }
          break;

        case "message.created":
          // v2 canonical inter-agent message — persist with from→source, to→owner
          // mapping so existing inbox queries (which key on owner) keep working.
          this.db.run(
            "INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?,?,?,?,?,?)",
            [
              "message.created",
              event.from,
              event.to,
              JSON.stringify({
                from: event.from,
                to: event.to,
                content: event.content,
                intent: event.intent ?? null,
                artifact: event.artifact ?? null,
                priority: event.priority ?? "P2",
                // Mirror to legacy 'task' field so prompt assembly (which reads
                // data.task) renders the message even before that code is updated.
                task: event.content,
              }),
              Date.now(),
              event.priority === "P0" ? "high" : "normal",
            ],
          );
          break;

        default:
          if (DURABLE_COMMAND_EVENTS.has(event.type)) {
            try {
              const ev = event as any;
              const { type, ...data } = ev;
              this.db.run(
                "INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)",
                [type, data.source ?? null, data.owner ?? null, JSON.stringify(data), Date.now(), data.urgency ?? "normal"],
              );
            } catch { /* table may not exist */ }
            break;
          }

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
