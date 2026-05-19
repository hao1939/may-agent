/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * This is the ONLY component that writes to the DB.
 * Core emits events, DbWriter persists them.
 *
 * See: shared/may-agent-docs/events.md
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalEnvelope(event: Record<string, unknown>): boolean {
  return isRecord(event.data) && (
    "owner" in event ||
    "source" in event ||
    "urgency" in event ||
    "ttl_ms" in event
  );
}

function eventPayload(event: Record<string, unknown>): Record<string, unknown> {
  if (isCanonicalEnvelope(event)) return event.data as Record<string, unknown>;
  const { type: _type, ...data } = event;
  return data;
}

function eventSource(event: Record<string, unknown>, fallback?: unknown): string | null {
  const source = isCanonicalEnvelope(event) ? event.source : eventPayload(event).source;
  return typeof source === "string" ? source : typeof fallback === "string" ? fallback : null;
}

function eventOwner(event: Record<string, unknown>, fallback?: unknown): string | null {
  const owner = isCanonicalEnvelope(event) ? event.owner : eventPayload(event).owner;
  return typeof owner === "string" ? owner : typeof fallback === "string" ? fallback : null;
}

function messageOwner(target: unknown): string | null {
  if (typeof target !== "string") return null;
  const value = target.trim();
  if (!value) return null;
  if (value.startsWith("agent:") || value.startsWith("human:")) return value;
  const lower = value.toLowerCase();
  if (lower === "human" || lower === "hao" || lower === "user" || lower === "operator") return "human:operator";
  return `agent:${value}`;
}

function messageSource(source: unknown): string | null {
  if (typeof source !== "string") return null;
  const value = source.trim();
  if (!value) return null;
  if (value.includes(":")) return value;
  const lower = value.toLowerCase();
  if (lower === "human" || lower === "hao" || lower === "user" || lower === "operator") return "human:operator";
  if (["socket", "telegram", "web-ui", "cli", "cron", "runtime", "metrics", "metrics-snapshot"].includes(lower)) return value;
  return `agent:${value}`;
}

function eventUrgency(event: Record<string, unknown>): string {
  const urgency = isCanonicalEnvelope(event) ? event.urgency : eventPayload(event).urgency;
  return typeof urgency === "string" ? urgency : "normal";
}

function eventTtlMs(event: Record<string, unknown>): number | null {
  const ttl = isCanonicalEnvelope(event) ? event.ttl_ms : eventPayload(event).ttl_ms;
  return typeof ttl === "number" ? ttl : null;
}

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
          {
          const ev = event as any;
          const payload = eventPayload(ev);
          upsertSession(this.persistDir, {
            sessionId: payload.sessionId as string,
            agent: payload.agent as string,
            task: (payload.task as string | undefined) ?? "",
            status: "running",
            kind: payload.kind as string | undefined,
            source: (payload.source as string | undefined) ?? eventSource(ev) ?? undefined,
            parentSessionId: payload.parentSessionId as string | undefined,
            workflowRunId: payload.workflowRunId as string | undefined,
            projectId: payload.projectId as string | undefined,
            requestId: payload.requestId as string | undefined,
            stepLabel: payload.stepLabel as string | undefined,
            startedAt: Date.now(),
          });
          // Also write event row for analytics / audit
          try {
            this.db.run(
              "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
              [event.type, eventSource(ev, payload.agent), eventOwner(ev, payload.agent), JSON.stringify(payload), Date.now()],
            );
          } catch { /* best-effort */ }
          break;
          }

        case "session.end":
          {
          const ev = event as any;
          const payload = eventPayload(ev);
          updateSessionDb(this.persistDir, payload.sessionId as string, {
            status: payload.status as any,
            error: payload.error as string | undefined,
            outcome: payload.outcome as string | undefined,
            opCount: payload.opCount as number | undefined,
            endedAt: Date.now(),
          });
          // Also write event row for analytics / audit
          try {
            this.db.run(
              "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
              [event.type, eventSource(ev, payload.agent), eventOwner(ev, payload.agent), JSON.stringify(payload), Date.now()],
            );
          } catch { /* best-effort */ }
          break;
          }

        case "message.created":
          {
            const ev = event as any;
            const payload = eventPayload(ev);
            const priority = payload.priority ?? "P2";
            const urgency = isCanonicalEnvelope(ev)
              ? eventUrgency(ev)
              : priority === "P0" ? "high" : "normal";
            // v2 inter-agent message — persist with canonical source/owner so
            // inbox queries key on the event owner. Accept both canonical
            // envelopes and legacy flat live-bus messages.
            this.db.run(
              "INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?,?,?,?,?,?)",
              [
                "message.created",
                eventSource(ev) ?? messageSource(payload.from),
                eventOwner(ev) ?? messageOwner(payload.to),
                JSON.stringify({
                  from: payload.from,
                  to: payload.to,
                  content: payload.content,
                  intent: payload.intent ?? null,
                  artifact: payload.artifact ?? null,
                  priority,
                  // Mirror to legacy 'task' field so prompt assembly (which reads
                  // data.task) renders the message even before that code is updated.
                  task: payload.content,
                }),
                Date.now(),
                urgency,
              ],
            );
            break;
          }

        default:
          if (DURABLE_COMMAND_EVENTS.has(event.type)) {
            try {
              const ev = event as any;
              const data = eventPayload(ev);
              this.db.run(
                "INSERT INTO events (event_type, source, owner, data, timestamp, urgency, ttl_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [event.type, eventSource(ev), eventOwner(ev), JSON.stringify(data), Date.now(), eventUrgency(ev), eventTtlMs(ev)],
              );
            } catch { /* table may not exist */ }
            break;
          }

          // Persist domain events (dot-separated types) to events table
          if (event.type.includes('.')) {
            try {
              const ev = event as any;
              const data = eventPayload(ev);
              this.db.run(
                "INSERT INTO events (event_type, source, owner, data, timestamp, urgency, ttl_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [event.type, eventSource(ev), eventOwner(ev), JSON.stringify(data), Date.now(), eventUrgency(ev), eventTtlMs(ev)],
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
