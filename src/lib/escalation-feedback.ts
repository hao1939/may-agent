import type { SqliteDb } from "./db.js";
import { isRecord } from "../../packages/control/src/event-envelope.js";

/** Translate retained escalation provenance to the ordinary exact Task address. */
export function escalationFeedbackTarget(db: SqliteDb, data: Record<string, unknown>): { appId: string; taskId: string } | null {
  const read = (id: unknown, key: unknown) => {
    const exactId = Number.isSafeInteger(Number(id)) && Number(id) > 0;
    const row = db.prepare(`SELECT data, project_id, task_id, session_id FROM events
      WHERE event_type = 'escalation.created' AND ${exactId ? "id" : "escalation_id"} = ?
      ORDER BY id DESC LIMIT 1`).get(exactId ? Number(id) : typeof key === "string" ? key : "") as
      { data: string; project_id?: string; task_id?: string; session_id?: string } | undefined;
    return row ? { ...row, data: JSON.parse(row.data) as Record<string, unknown> } : null;
  };
  let origin = read(data.openEventId ?? data.open_event_id, data.escalationId);
  if (origin?.data.parentEscalationId) origin = read(undefined, origin.data.parentEscalationId);
  if (!origin) return null;
  if (origin.project_id && origin.task_id) return { appId: origin.project_id, taskId: origin.task_id };
  const resume = isRecord(origin.data.resume) ? origin.data.resume : {};
  const sessionId = origin.session_id ?? (resume.kind === "session" ? resume.sessionId : undefined);
  if (typeof sessionId !== "string") return null;
  const session = db.prepare("SELECT app_id, task_id FROM sessions WHERE sessionId = ?").get(sessionId) as
    { app_id?: string; task_id?: string } | undefined;
  return session?.app_id && session.task_id ? { appId: session.app_id, taskId: session.task_id } : null;
}
