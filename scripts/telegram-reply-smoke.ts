#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

type EventRow = {
  id: number;
  event_type: string;
  source: string | null;
  owner: string | null;
  timestamp: number;
  data: string | null;
};

type NotificationRow = {
  telegram_msg_id: number;
  event_type: string | null;
  agent: string | null;
  session_id: string | null;
  project_id: string | null;
  data: string | null;
  sent_at: number | null;
};

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

function parseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

const dbPath = resolve(arg("--db", ".state/may.db"));
const hours = Number(arg("--hours", "24"));
if (!Number.isFinite(hours) || hours <= 0) {
  console.error("--hours must be a positive number");
  process.exit(2);
}

if (!existsSync(dbPath)) {
  console.error(`DB not found: ${dbPath}`);
  process.exit(2);
}

const since = Date.now() - hours * 60 * 60 * 1000;
const db = new Database(dbPath, { readonly: true });

const replies = db.query(
  `SELECT id, event_type, source, owner, timestamp, data
   FROM events
   WHERE event_type = 'telegram.reply'
     AND timestamp >= ?
   ORDER BY id DESC
   LIMIT 20`,
).all(since) as EventRow[];

if (replies.length === 0) {
  console.log(`No telegram.reply events in the last ${hours}h.`);
  process.exit(1);
}

let passed = false;
for (const reply of replies) {
  const data = parseJson(reply.data);
  const originalMsgId = typeof data.originalMsgId === "number"
    ? data.originalMsgId
    : typeof data.originalMsgId === "string"
      ? Number(data.originalMsgId)
      : null;
  const notification = originalMsgId && Number.isFinite(originalMsgId)
    ? db.query(
      `SELECT telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at
       FROM notification_messages
       WHERE telegram_msg_id = ?`,
    ).get(originalMsgId) as NotificationRow | null
    : null;
  const followups = db.query(
    `SELECT id, event_type, source, owner, timestamp, data
     FROM events
     WHERE id > ?
       AND timestamp <= ?
       AND (
         event_type IN ('steer', 'project.comment.created', 'input', 'session.cancel.requested', 'reload', 'shutdown')
         OR event_type IN ('session.start', 'session.resume_failed')
       )
     ORDER BY id ASC
     LIMIT 8`,
  ).all(reply.id, reply.timestamp + 10_000) as EventRow[];

  const action = followups.find((row) => {
    const actionData = parseJson(row.data);
    if (notification?.session_id) {
      return (row.event_type === "steer" || row.event_type === "session.start" || row.event_type === "session.resume_failed")
        && actionData.sessionId === notification.session_id;
    }
    if (notification?.project_id) {
      return row.event_type === "project.comment.created"
        && (actionData.projectPath === notification.project_id || actionData.projectId === notification.project_id);
    }
    return row.source === "telegram" || actionData.source === "telegram";
  });

  const routed = !!action && (
    action.event_type === "steer"
    || action.event_type === "project.comment.created"
    || action.event_type === "session.start"
    || action.event_type === "session.resume_failed"
    || action.event_type === "input"
    || action.event_type === "session.cancel.requested"
    || action.event_type === "reload"
    || action.event_type === "shutdown"
  );

  if (routed) passed = true;

  console.log([
    routed ? "PASS" : "MISS",
    `reply=${reply.id}`,
    `at=${iso(reply.timestamp)}`,
    `owner=${reply.owner ?? "unknown"}`,
    `enriched=${String(data.enriched ?? "unknown")}`,
    originalMsgId ? `originalMsgId=${String(originalMsgId)}` : null,
    data.delivery ? `delivery=${String(data.delivery)}` : null,
    data.hasSessionCtx !== undefined ? `hasSessionCtx=${String(data.hasSessionCtx)}` : null,
    notification?.session_id ? `targetSession=${notification.session_id}` : null,
    notification?.project_id ? `targetProject=${notification.project_id}` : null,
    data.reason ? `reason=${String(data.reason)}` : null,
    action ? `action=${action.event_type}#${action.id}` : "action=none",
  ].filter(Boolean).join(" "));
}

process.exit(passed ? 0 : 1);
