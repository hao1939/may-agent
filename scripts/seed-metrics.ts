#!/usr/bin/env node
/**
 * seed-metrics.ts — Seeds the initial metric set into may.db.
 *
 * Run: bun scripts/seed-metrics.ts
 *
 * Idempotent: inserts missing current metrics and retires removed legacy
 * definitions without deleting their historical samples.
 *
 * Initial metrics come from the approved design doc:
 *   projects/may-agent.app/docs/2a-design/metrics.md
 *
 * Hao's decisions applied:
 *   - REMOVED: cost.daily (deferred)
 *   - REMOVED: efficiency.daily-ops (deferred)
 *   - ADDED: gym.scenario-discrimination
 */

import { join } from "node:path";

// ── Detect runtime and open DB ────────────────────────────────────────

const DB_PATH = join(import.meta.dir ?? ".", "..", ".state", "may.db");

// Use the project's db.ts adapter
const { openDatabase } = await import("../src/lib/db.js");

const db = openDatabase(DB_PATH.includes(".state") ? DB_PATH : join(process.cwd(), ".state", "may.db"));

// ── Ensure tables exist ───────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS metrics (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  owner           TEXT NOT NULL,
  current         REAL,
  target          REAL NOT NULL,
  threshold       REAL,
  unit            TEXT,
  priority        TEXT NOT NULL DEFAULT 'P1',
  status          TEXT NOT NULL DEFAULT 'active',
  blocker         TEXT,
  project         TEXT,
  source          TEXT,
  source_query    TEXT,
  source_command  TEXT,
  sensitivity     REAL,
  measure_interval INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  closed_at       INTEGER
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  value       REAL NOT NULL,
  sample_size INTEGER,
  measured_at INTEGER NOT NULL,
  measured_by TEXT,
  note        TEXT
);

CREATE TABLE IF NOT EXISTS metric_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  severity    TEXT NOT NULL,
  message     TEXT NOT NULL,
  value       REAL,
  threshold   REAL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS research_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  ref         TEXT,
  agent       TEXT NOT NULL,
  rating      INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner, status);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON metric_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_research_log_agent ON research_log(agent, type, created_at);
`;

db.exec(SCHEMA_SQL);

// ── Metric definitions ────────────────────────────────────────────────

interface MetricDef {
  id: string;
  name: string;
  type: "one-off" | "continuous" | "health";
  owner: string;
  target: number;
  threshold?: number;
  unit?: string;
  priority: string;
  source: "auto" | "command" | "manual";
  source_query?: string;
  source_command?: string;
  sensitivity?: number;
  measure_interval?: number; // hours
}

const now = Date.now();

const retiredLegacyMetricIds = [
  "gym.pass-rate",
  "gym.scenario-discrimination",
  "convention.aggregate",
  "research.experiments-rate",
  "research.hypotheses-concluded",
];
const retireLegacyMetric = db.prepare(
  `UPDATE metrics
   SET status = 'retired', closed_at = COALESCE(closed_at, ?), updated_at = ?
   WHERE id = ? AND COALESCE(status, '') <> 'retired'`,
);
let retired = 0;
for (const id of retiredLegacyMetricIds) retired += Number(retireLegacyMetric.run(now, now, id).changes);

const metrics: MetricDef[] = [
  // ── Auto-measured from DB (source = 'auto') ─────────────────────

  {
    id: "quality.coder",
    name: "Coder quality score",
    type: "continuous",
    owner: "coach",
    target: 0.9,
    unit: "score",
    priority: "P1",
    source: "auto",
    source_query: `SELECT round(avg(quality), 2) FROM evaluations WHERE agent = 'coder' AND createdAt > (strftime('%s','now')*1000 - 86400000)`,
    sensitivity: 0.15,
  },
  {
    id: "quality.bob",
    name: "Bob quality score",
    type: "continuous",
    owner: "coach",
    target: 0.9,
    unit: "score",
    priority: "P1",
    source: "auto",
    source_query: `SELECT round(avg(quality), 2) FROM evaluations WHERE agent = 'bob' AND createdAt > (strftime('%s','now')*1000 - 86400000)`,
    sensitivity: 0.15,
  },
  {
    id: "quality.system",
    name: "System avg quality",
    type: "health",
    owner: "may",
    target: 1.0,
    threshold: 0.85,
    unit: "score",
    priority: "P1",
    source: "auto",
    source_query: `SELECT round(avg(quality), 2) FROM evaluations WHERE createdAt > (strftime('%s','now')*1000 - 86400000)`,
    sensitivity: 0.1,
  },
  {
    id: "health.error-rate",
    name: "System error rate",
    type: "health",
    owner: "may",
    target: 0,
    threshold: 2,
    unit: "%",
    priority: "P0",
    source: "auto",
    source_query: `SELECT round(100.0 * sum(CASE WHEN status = 'error' THEN 1 ELSE 0 END) / max(count(*), 1), 1) FROM sessions WHERE startedAt > (strftime('%s','now')*1000 - 86400000)`,
  },
  {
    id: "efficiency.ops-per-session",
    name: "Avg ops per session (24h)",
    type: "continuous",
    owner: "optimizer",
    target: 25,
    unit: "count",
    priority: "P2",
    source: "auto",
    source_query: `SELECT round(avg(opCount), 1) FROM sessions WHERE startedAt > (strftime('%s','now')*1000 - 86400000) AND opCount > 0`,
    sensitivity: 0.15,
  },
  // ── Auto-measured from research_log (source = 'auto') ─────────────

  {
    id: "research.dd-rate",
    name: "Deep dives per week",
    type: "health",
    owner: "scout",
    target: 20,
    threshold: 15,
    unit: "count",
    priority: "P2",
    source: "auto",
    source_query: `SELECT count(*) FROM research_log WHERE type = 'deep-dive' AND created_at > (strftime('%s','now')*1000 - 604800000)`,
  },
  {
    id: "research.hypothesis-generation",
    name: "Hypotheses proposed (30d)",
    type: "continuous",
    owner: "scout",
    target: 50,
    unit: "count",
    priority: "P2",
    source: "auto",
    source_query: `SELECT count(*) FROM research_log WHERE type = 'hypothesis' AND created_at > (strftime('%s','now')*1000 - 2592000000)`,
  },

  // ── Command-measured (source = 'command') ─────────────────────────

  {
    id: "health.tsc-clean",
    name: "TypeScript errors",
    type: "health",
    owner: "tech-lead",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P1",
    source: "command",
    source_command: `cd /app && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c 'error TS' || echo 0`,
  },
  {
    id: "health.test-count",
    name: "Test count (bun test)",
    type: "health",
    owner: "tech-lead",
    target: 2000,
    threshold: 1800,
    unit: "count",
    priority: "P1",
    source: "command",
    source_command: `cd /app && bun test test shared agents --timeout 30000 2>&1 | grep -oE '[0-9]+ pass' | tail -1 | awk '{print $1}' || echo 0`,
  },
  {
    id: "research.knowledge-entries",
    name: "Knowledge entry count",
    type: "continuous",
    owner: "scout",
    target: 250,
    unit: "count",
    priority: "P2",
    source: "command",
    source_command: `find /app/shared/knowledge/entries/ -name '*.md' 2>/dev/null | wc -l`,
  },

  // ── Manual metrics (source = 'manual') ────────────────────────────

  {
    id: "ops.prompt-caching",
    name: "Enable prompt caching",
    type: "one-off",
    owner: "tech-lead",
    target: 1,
    priority: "P1",
    source: "manual",
  },
  {
    id: "infra.persistent-task-adoption",
    name: "Projects using persistent-task",
    type: "continuous",
    owner: "tech-lead",
    target: 10,
    unit: "count",
    priority: "P2",
    source: "manual",
    measure_interval: 168, // weekly
  },
  {
    id: "skill.effectiveness",
    name: "Skills that move quality",
    type: "continuous",
    owner: "coach",
    target: 60,
    unit: "%",
    priority: "P1",
    source: "manual",
    measure_interval: 72, // 3 days
  },
  {
    id: "research.novelty-ratio",
    name: "% DDs rated ★★★★+",
    type: "continuous",
    owner: "scout",
    target: 40,
    unit: "%",
    priority: "P2",
    source: "manual",
    measure_interval: 168, // weekly
  },
];

// ── Insert metrics ────────────────────────────────────────────────────

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO metrics (
    id, name, type, owner, current, target, threshold, unit, priority, status,
    source, source_query, source_command, sensitivity, measure_interval,
    created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

let inserted = 0;
let skipped = 0;

for (const m of metrics) {
  const result = insertStmt.run(
    m.id,
    m.name,
    m.type,
    m.owner,
    null, // current — will be populated by first snapshot
    m.target,
    m.threshold ?? null,
    m.unit ?? null,
    m.priority,
    "active",
    m.source,
    m.source_query ?? null,
    m.source_command ?? null,
    m.sensitivity ?? null,
    m.measure_interval ?? null,
    now,
    now,
  );
  if (result.changes > 0) {
    inserted++;
  } else {
    skipped++;
  }
}

// ── Validate source queries ───────────────────────────────────────────

console.log(`\n📊 Seed metrics: ${inserted} inserted, ${skipped} already exist, ${retired} legacy retired\n`);

const autoMetrics = db
  .prepare("SELECT id, source_query FROM metrics WHERE source = 'auto' AND status = 'active'")
  .all() as Array<{ id: string; source_query: string }>;

let valid = 0;
let broken = 0;

for (const m of autoMetrics) {
  if (!m.source_query) continue;
  try {
    const row = db.prepare(m.source_query).get();
    const value = row ? Object.values(row)[0] : null;
    console.log(`  ✅ ${m.id}: ${value}`);
    valid++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ ${m.id}: ${msg.slice(0, 100)}`);
    broken++;
  }
}

console.log(`\nSource query validation: ${valid} valid, ${broken} broken`);

// ── Summary table ─────────────────────────────────────────────────────

const allMetrics = db
  .prepare("SELECT id, type, owner, priority, source FROM metrics WHERE status = 'active' ORDER BY priority, type")
  .all() as Array<{ id: string; type: string; owner: string; priority: string; source: string }>;

console.log(`\n📋 Active metrics (${allMetrics.length} total):\n`);
console.log("  ID".padEnd(40) + "Type".padEnd(14) + "Owner".padEnd(14) + "P".padEnd(5) + "Source");
console.log("  " + "─".repeat(80));
for (const m of allMetrics) {
  console.log(`  ${m.id.padEnd(38)}${m.type.padEnd(14)}${m.owner.padEnd(14)}${m.priority.padEnd(5)}${m.source}`);
}

db.close();
console.log("\n✅ Done. Run the metrics-snapshot handler to populate initial values.\n");
