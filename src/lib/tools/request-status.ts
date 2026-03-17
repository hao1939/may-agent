/**
 * request-status.ts — CLI status tool for request tracking
 *
 * Queries the SQLite request DB and prints a summary:
 * - Active requests (CREATED / IN_PROGRESS)
 * - Stale requests (>2h old, still active)
 * - Completion rates by agent (last 24h)
 *
 * Phase 5 of request-tracking plan.
 */

// Lazy-load requests module to avoid pulling bun:sqlite at module level (vitest compat)
let _requestsModule: typeof import("../requests.js") | null = null;
function getRequestsModule() {
  if (!_requestsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _requestsModule = require("../requests.js") as typeof import("../requests.js");
  }
  return _requestsModule;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < HOUR) return `${Math.round(diff / 60000)}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  return `${Math.round(diff / DAY)}d ago`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function printRequestStatus(persistDir: string): string {
  const lines: string[] = [];
  const req = getRequestsModule();

  // ── Active requests ────────────────────────────────────────────────
  const active = req.getActiveRequests(persistDir);
  lines.push(`\n📋 Active Requests: ${active.length}`);
  if (active.length > 0) {
    lines.push("─".repeat(70));
    for (const r of active) {
      const age = ago(r.createdAt);
      const task = truncate(r.task, 60);
      lines.push(
        `  [${r.status}] ${r.fromEntity} → ${r.toAgent} (${r.method}, ${age})`
      );
      lines.push(`           ${task}`);
    }
  }

  // ── Stale requests (>2h) ───────────────────────────────────────────
  const stale = req.getStaleRequests(persistDir, 2 * HOUR);
  if (stale.length > 0) {
    lines.push(`\n⚠️  Stale Requests (>2h): ${stale.length}`);
    lines.push("─".repeat(70));
    for (const r of stale) {
      const age = ago(r.createdAt);
      lines.push(
        `  [${r.status}] ${r.fromEntity} → ${r.toAgent} (${age}) ${truncate(r.task, 50)}`
      );
    }
  }

  // ── Completion rates (last 24h) ────────────────────────────────────
  const db = req.getDb(persistDir);
  const cutoff = Date.now() - DAY;
  const stats = db
    .query(
      `SELECT toAgent,
              COUNT(*) as total,
              SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
              AVG(CASE WHEN durationMs IS NOT NULL THEN durationMs END) as avgDuration
       FROM requests
       WHERE createdAt > ?
       GROUP BY toAgent
       ORDER BY total DESC`
    )
    .all(cutoff) as Array<{
    toAgent: string;
    total: number;
    completed: number;
    failed: number;
    avgDuration: number | null;
  }>;

  lines.push(`\n📊 Completion Rates (last 24h):`);
  if (stats.length > 0) {
    lines.push("─".repeat(70));
    lines.push(
      `  ${"Agent".padEnd(15)} ${"Total".padStart(6)} ${"Done".padStart(6)} ${"Fail".padStart(6)} ${"Rate".padStart(7)} ${"Avg ms".padStart(8)}`
    );
    for (const s of stats) {
      const rate =
        s.total > 0
          ? `${Math.round((s.completed / s.total) * 100)}%`
          : "—";
      const avg =
        s.avgDuration !== null ? `${Math.round(s.avgDuration)}` : "—";
      lines.push(
        `  ${s.toAgent.padEnd(15)} ${String(s.total).padStart(6)} ${String(s.completed).padStart(6)} ${String(s.failed).padStart(6)} ${rate.padStart(7)} ${avg.padStart(8)}`
      );
    }
  } else {
    lines.push("  No requests in the last 24h.");
  }

  lines.push("");
  return lines.join("\n");
}
