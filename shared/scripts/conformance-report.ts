/**
 * conformance-report.ts — Generates a self-contained HTML conformance report.
 *
 * Queries the agent SQLite DB for:
 *   1. Heartbeat timeline (last 24h of sessions per agent)
 *   2. Session trace completeness (context.read + agent.decision events)
 *   3. Current metric values vs targets
 *
 * Usage: npx tsx shared/scripts/conformance-report.ts
 * Output: projects/closed-loop-reliability/outputs/conformance-report.html
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const ROOT = join(import.meta.dirname || __dirname, "../..");
const DB_PATH = join(ROOT, ".state/may.db");
const OUTPUT_DIR = join(ROOT, "projects/closed-loop-reliability/outputs");
const OUTPUT_PATH = join(OUTPUT_DIR, "conformance-report.html");

interface Session {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  kind: string | null;
  startedAt: number;
  endedAt: number | null;
}

interface Event {
  id: number;
  event_type: string;
  source: string | null;
  data: string | null;
  timestamp: number;
}

interface Metric {
  id: string;
  name: string;
  type: string;
  owner: string;
  current: number | null;
  status: string;
}

function queryDB() {
  if (!existsSync(DB_PATH)) {
    console.warn(`DB not found at ${DB_PATH}, generating report with sample data`);
    return { sessions: [], events: [], metrics: [] };
  }

  const db = new Database(DB_PATH, { readonly: true });

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;

  const sessions: Session[] = db
    .prepare(
      `SELECT sessionId, agent, task, status, kind, startedAt, endedAt
       FROM sessions
       WHERE startedAt > ?
       ORDER BY startedAt DESC
       LIMIT 200`
    )
    .all(cutoff24h) as Session[];

  const events: Event[] = db
    .prepare(
      `SELECT id, event_type, source, data, timestamp
       FROM events
       WHERE timestamp > ?
         AND event_type IN ('context.read', 'agent.decision', 'handler.started', 'handler.completed')
       ORDER BY timestamp DESC
       LIMIT 500`
    )
    .all(cutoff24h) as Event[];

  const metrics: Metric[] = db
    .prepare(
      `SELECT id, name, type, owner, current, status FROM metrics ORDER BY id`
    )
    .all() as Metric[];

  db.close();
  return { sessions, events, metrics };
}

function formatTime(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

function generateHTML(data: ReturnType<typeof queryDB>): string {
  const { sessions, events, metrics } = data;

  // Group sessions by agent
  const byAgent: Record<string, Session[]> = {};
  for (const s of sessions) {
    (byAgent[s.agent] ??= []).push(s);
  }

  // Session completeness: which sessions have both context.read and agent.decision
  const sessionEvents: Record<string, Set<string>> = {};
  for (const e of events) {
    if (e.source) {
      (sessionEvents[e.source] ??= new Set()).add(e.event_type);
    }
  }

  const timelineRows = sessions
    .slice(0, 50)
    .map(
      (s) => `
    <tr>
      <td>${s.agent}</td>
      <td title="${s.sessionId}">${s.sessionId.slice(0, 12)}…</td>
      <td>${s.kind || "—"}</td>
      <td><span class="status-${s.status}">${s.status}</span></td>
      <td>${formatTime(s.startedAt)}</td>
      <td>${s.endedAt ? formatTime(s.endedAt) : "—"}</td>
      <td>${s.task.slice(0, 60)}${s.task.length > 60 ? "…" : ""}</td>
    </tr>`
    )
    .join("\n");

  const traceRows = Object.entries(sessionEvents)
    .slice(0, 50)
    .map(([src, types]) => {
      const hasRead = types.has("context.read");
      const hasDecision = types.has("agent.decision");
      const complete = hasRead && hasDecision;
      return `
    <tr class="${complete ? "complete" : "incomplete"}">
      <td>${src.slice(0, 20)}</td>
      <td>${hasRead ? "✅" : "❌"}</td>
      <td>${hasDecision ? "✅" : "❌"}</td>
      <td>${complete ? "✅ Complete" : "⚠️ Incomplete"}</td>
    </tr>`;
    })
    .join("\n");

  const metricRows = metrics
    .map((m) => {
      const val = m.current != null ? m.current.toFixed(2) : "—";
      return `
    <tr>
      <td>${m.id}</td>
      <td>${m.name}</td>
      <td>${m.owner}</td>
      <td>${m.type}</td>
      <td>${val}</td>
      <td><span class="status-${m.status}">${m.status}</span></td>
    </tr>`;
    })
    .join("\n");

  const generatedAt = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Conformance Report — Agent System</title>
<style>
  :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --accent: #58a6ff; --green: #3fb950; --red: #f85149; --yellow: #d29922; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.5; }
  h1 { color: var(--accent); margin-bottom: 0.5rem; }
  h2 { color: var(--accent); margin: 2rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
  .meta { color: #8b949e; margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; background: var(--card); border-radius: 6px; overflow: hidden; }
  th, td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
  th { background: #21262d; font-weight: 600; }
  tr:hover { background: #1c2128; }
  .status-ok, .status-done, .status-running { color: var(--green); }
  .status-breach, .status-error, .status-failing { color: var(--red); }
  .status-stalled, .status-idle { color: var(--yellow); }
  .complete { background: rgba(63,185,80,0.05); }
  .incomplete { background: rgba(248,81,73,0.05); }
  .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.2rem; text-align: center; }
  .card .value { font-size: 2rem; font-weight: bold; color: var(--accent); }
  .card .label { font-size: 0.8rem; color: #8b949e; margin-top: 0.3rem; }
  .empty { padding: 2rem; text-align: center; color: #8b949e; }
</style>
</head>
<body>
<h1>🔬 Conformance Report</h1>
<p class="meta">Generated: ${generatedAt} | Window: last 24 hours</p>

<div class="summary-cards">
  <div class="card"><div class="value">${sessions.length}</div><div class="label">Sessions (24h)</div></div>
  <div class="card"><div class="value">${Object.keys(byAgent).length}</div><div class="label">Active Agents</div></div>
  <div class="card"><div class="value">${events.length}</div><div class="label">Traced Events</div></div>
  <div class="card"><div class="value">${metrics.length}</div><div class="label">Tracked Metrics</div></div>
  <div class="card"><div class="value">${metrics.filter((m) => m.status === "breach").length}</div><div class="label">Breaching Metrics</div></div>
</div>

<h2>1. Heartbeat Timeline (Last 24h)</h2>
${sessions.length === 0 ? '<p class="empty">No sessions found in the last 24 hours.</p>' : `
<table>
<thead><tr><th>Agent</th><th>Session</th><th>Kind</th><th>Status</th><th>Started</th><th>Ended</th><th>Task</th></tr></thead>
<tbody>${timelineRows}</tbody>
</table>`}

<h2>2. Session Trace Completeness</h2>
<p style="margin-bottom:1rem;color:#8b949e;">Shows whether sessions emitted both <code>context.read</code> and <code>agent.decision</code> events (required for full observability).</p>
${Object.keys(sessionEvents).length === 0 ? '<p class="empty">No traced events found. Ensure handlers emit context.read and agent.decision events.</p>' : `
<table>
<thead><tr><th>Source</th><th>context.read</th><th>agent.decision</th><th>Complete?</th></tr></thead>
<tbody>${traceRows}</tbody>
</table>`}

<h2>3. Metric Values vs Targets</h2>
${metrics.length === 0 ? '<p class="empty">No metrics found in database.</p>' : `
<table>
<thead><tr><th>ID</th><th>Name</th><th>Owner</th><th>Type</th><th>Current</th><th>Status</th></tr></thead>
<tbody>${metricRows}</tbody>
</table>`}

</body>
</html>`;
}

// Main
mkdirSync(OUTPUT_DIR, { recursive: true });
const data = queryDB();
const html = generateHTML(data);
writeFileSync(OUTPUT_PATH, html);
console.log(`✅ Report written to ${OUTPUT_PATH}`);
console.log(`   Sessions: ${data.sessions.length}, Events: ${data.events.length}, Metrics: ${data.metrics.length}`);
