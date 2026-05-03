#!/usr/bin/env bun
/**
 * Dev heartbeat live-health query helper.
 *
 * Keep this helper aligned with the current .state/may.db schema so heartbeat
 * diagnostics do not depend on stale examples in docs. Use single-quoted SQL
 * literals; SQLite double quotes are identifiers and can hide failures when a
 * column has the same name as the intended literal (for example error).
 */
const { Database } = require('bun:sqlite');

const db = new Database('.state/may.db', { readonly: true });
const now = Date.now();
const sixHoursAgo = now - 6 * 60 * 60 * 1000;
const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
const staleCutoff = now - 30 * 60 * 1000;

function show(title, rows) {
  console.log('\n## ' + title);
  console.log(JSON.stringify(rows, null, 2));
}

show('active reliability metrics', db.prepare("SELECT id, name, owner, current, target, threshold, alert_op, updated_at FROM metrics WHERE status='active' AND id IN ('session.error-rate-6h', 'handler.success-rate', 'handler.failed-count', 'handler.p95-duration') ORDER BY id").all());
show('session status counts 6h', db.prepare("SELECT status, COUNT(*) AS count FROM sessions WHERE startedAt >= ? GROUP BY status ORDER BY count DESC").all(sixHoursAgo));
show('recent failed sessions', db.prepare("SELECT sessionId, agent, status, error, startedAt, endedAt, opCount FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 10").all());
show('error groups 24h', db.prepare("SELECT agent, error, COUNT(*) AS count, MAX(startedAt) AS lastAt FROM sessions WHERE status='error' AND startedAt >= ? GROUP BY agent, error ORDER BY count DESC, lastAt DESC LIMIT 20").all(twentyFourHoursAgo));
show('stale running sessions >30m', db.prepare("SELECT sessionId, agent, source, startedAt, opCount, ROUND((? - startedAt) / 60000.0, 1) AS age_min, substr(task, 1, 160) AS task_prefix FROM sessions WHERE status='running' AND startedAt < ? ORDER BY startedAt ASC LIMIT 20").all(now, staleCutoff));
show('handler failures', db.prepare("SELECT event_type, data, timestamp, status, reason FROM events WHERE event_type='handler.failed' ORDER BY timestamp DESC LIMIT 10").all());
show('handler failure groups 7d', db.prepare("SELECT json_extract(data, '$.handler') AS handler, json_extract(data, '$.error') AS error, status, COUNT(*) AS count, MAX(timestamp) AS lastAt, ROUND((? - MAX(timestamp)) / 3600000.0, 1) AS last_age_h FROM events WHERE event_type='handler.failed' AND timestamp >= ? GROUP BY handler, error, status ORDER BY count DESC, lastAt DESC LIMIT 20").all(now, now - 7 * 24 * 60 * 60 * 1000));
show('pending handler failure backlog', db.prepare("SELECT status, COUNT(*) AS count, MIN(timestamp) AS oldestAt, MAX(timestamp) AS newestAt, ROUND((? - MIN(timestamp)) / 3600000.0, 1) AS oldest_age_h FROM events WHERE event_type='handler.failed' AND status='pending' GROUP BY status").all(now));
show('stale pending handler failures >24h', db.prepare("SELECT data, timestamp, ROUND((? - timestamp) / 3600000.0, 1) AS age_h FROM events WHERE event_type='handler.failed' AND status='pending' AND timestamp < ? ORDER BY timestamp ASC LIMIT 10").all(now, now - 24 * 60 * 60 * 1000));
show('long sessions by opCount', db.prepare("SELECT sessionId, agent, status, opCount, startedAt, endedAt, (endedAt-startedAt) AS duration_ms FROM sessions WHERE opCount > 10 ORDER BY startedAt DESC LIMIT 10").all());
show('unmeasured metrics', db.prepare("SELECT m.id, m.name, m.owner FROM metrics m LEFT JOIN metric_snapshots ms ON m.id = ms.metric_id AND ms.measured_at > (unixepoch()*1000 - 3600000) WHERE ms.metric_id IS NULL AND m.status='active' ORDER BY m.owner, m.id").all());
show('session metric coverage gaps', db.prepare("SELECT id, name, owner, source_query FROM metrics WHERE status='active' AND (id LIKE 'session.%' OR source_query LIKE '%FROM sessions%') ORDER BY id").all());
