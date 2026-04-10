#!/usr/bin/env bun
/**
 * session-query.ts — Query session data from filesystem history
 *
 * Replaces the 15-25 bash-call session archaeology pattern:
 *   ls sessions → loop meta.json → grep receipts.jsonl
 *
 * Usage:
 *   bun scripts/session-query.ts [options]
 *
 * Options:
 *   --agent <name>       Filter by agent name (exact match)
 *   --since <duration>   Filter to sessions within duration (e.g. "6h", "2d", "30m")
 *   --after <ISO|epoch>  Filter to sessions after this timestamp
 *   --before <ISO|epoch> Filter to sessions before this timestamp
 *   --task <pattern>     Filter by task substring (case-insensitive)
 *   --status <status>    Filter by status (done, error, running, timeout)
 *   --min-ops <n>        Filter to sessions with >= n ops
 *   --max-ops <n>        Filter to sessions with <= n ops
 *   --kind <kind>        Filter by session kind (job, heartbeat, etc.)
 *   --limit <n>          Max results (default: 20)
 *   --tools              Include tool usage breakdown per session
 *   --json               Output as JSON instead of table
 *   --sort <field>       Sort by: startedAt (default), opCount, agent
 *   --desc               Sort descending (default: true for startedAt)
 *   --asc                Sort ascending
 *
 * Examples:
 *   bun scripts/session-query.ts --agent coach --since 6h --min-ops 30
 *   bun scripts/session-query.ts --task "heartbeat" --tools --limit 5
 *   bun scripts/session-query.ts --agent optimizer --since 2d --json
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// --- Argument parsing ---

interface Filters {
  agent?: string;
  afterMs?: number;
  beforeMs?: number;
  taskPattern?: string;
  status?: string;
  minOps?: number;
  maxOps?: number;
  kind?: string;
  limit: number;
  includeTools: boolean;
  jsonOutput: boolean;
  sortField: string;
  sortAsc: boolean;
}

function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${s}. Use e.g. "6h", "2d", "30m"`);
  const val = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return val * multipliers[unit];
}

function parseTimestamp(s: string): number {
  // Try epoch ms first
  if (/^\d{13,}$/.test(s)) return parseInt(s);
  // Try epoch seconds
  if (/^\d{10}$/.test(s)) return parseInt(s) * 1000;
  // Try ISO
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error(`Invalid timestamp: ${s}`);
  return d.getTime();
}

function parseArgs(argv: string[]): Filters {
  const filters: Filters = {
    limit: 20,
    includeTools: false,
    jsonOutput: false,
    sortField: "startedAt",
    sortAsc: false, // default descending for startedAt (most recent first)
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    switch (arg) {
      case "--agent": filters.agent = next(); break;
      case "--since": {
        const dur = parseDuration(next());
        filters.afterMs = Date.now() - dur;
        break;
      }
      case "--after": filters.afterMs = parseTimestamp(next()); break;
      case "--before": filters.beforeMs = parseTimestamp(next()); break;
      case "--task": filters.taskPattern = next().toLowerCase(); break;
      case "--status": filters.status = next(); break;
      case "--min-ops": filters.minOps = parseInt(next()); break;
      case "--max-ops": filters.maxOps = parseInt(next()); break;
      case "--kind": filters.kind = next(); break;
      case "--limit": filters.limit = parseInt(next()); break;
      case "--tools": filters.includeTools = true; break;
      case "--json": filters.jsonOutput = true; break;
      case "--sort": filters.sortField = next(); break;
      case "--asc": filters.sortAsc = true; break;
      case "--desc": filters.sortAsc = false; break;
      case "--help": case "-h": printHelp(); process.exit(0);
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}. Use --help for usage.`);
          process.exit(1);
        }
    }
  }
  return filters;
}

function printHelp() {
  console.log(`session-query — Query session history data

Usage: bun scripts/session-query.ts [options]

Filters:
  --agent <name>       Filter by agent name
  --since <duration>   Sessions within duration (6h, 2d, 30m)
  --after <timestamp>  Sessions after ISO date or epoch ms
  --before <timestamp> Sessions before ISO date or epoch ms
  --task <pattern>     Task substring match (case-insensitive)
  --status <status>    Filter by status (done, error, running, timeout)
  --min-ops <n>        Minimum op count
  --max-ops <n>        Maximum op count
  --kind <kind>        Session kind (job, heartbeat)
  --limit <n>          Max results (default: 20)

Output:
  --tools              Include tool usage breakdown
  --json               JSON output
  --sort <field>       Sort by: startedAt, opCount, agent
  --asc / --desc       Sort direction (default: desc)

Examples:
  bun scripts/session-query.ts --agent coach --since 6h --min-ops 30
  bun scripts/session-query.ts --task "heartbeat" --tools --limit 5
  bun scripts/session-query.ts --since 1d --sort opCount --desc`);
}

// --- Session data loading ---

interface SessionMeta {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  opCount: number;
  kind?: string;
  error?: string;
}

interface ToolBreakdown {
  [toolName: string]: number;
}

interface SessionResult extends SessionMeta {
  durationSec?: number;
  tools?: ToolBreakdown;
}

const SESSIONS_DIR = join(process.cwd(), "agents", ".state", "sessions", "history");

function loadMeta(sessionId: string): SessionMeta | null {
  const metaPath = join(SESSIONS_DIR, sessionId, "meta.json");
  try {
    const raw = readFileSync(metaPath, "utf-8");
    const data = JSON.parse(raw);
    return {
      sessionId,
      agent: data.agent || "unknown",
      task: data.task || "",
      status: data.status || "unknown",
      startedAt: data.startedAt || 0,
      endedAt: data.endedAt,
      opCount: data.opCount || 0,
      kind: data.kind,
      error: data.error,
    };
  } catch {
    return null;
  }
}

function loadToolBreakdown(sessionId: string): ToolBreakdown {
  const receiptsPath = join(SESSIONS_DIR, sessionId, "receipts.jsonl");
  const breakdown: ToolBreakdown = {};
  try {
    const raw = readFileSync(receiptsPath, "utf-8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const tool = entry.toolName || "unknown";
        breakdown[tool] = (breakdown[tool] || 0) + 1;
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // no receipts file
  }
  return breakdown;
}

// --- Filtering & sorting ---

function matchesFilters(meta: SessionMeta, f: Filters): boolean {
  if (f.agent && meta.agent !== f.agent) return false;
  if (f.afterMs && meta.startedAt < f.afterMs) return false;
  if (f.beforeMs && meta.startedAt > f.beforeMs) return false;
  if (f.taskPattern && !meta.task.toLowerCase().includes(f.taskPattern)) return false;
  if (f.status && meta.status !== f.status) return false;
  if (f.minOps !== undefined && meta.opCount < f.minOps) return false;
  if (f.maxOps !== undefined && meta.opCount > f.maxOps) return false;
  if (f.kind && meta.kind !== f.kind) return false;
  return true;
}

function sortSessions(sessions: SessionResult[], field: string, asc: boolean) {
  sessions.sort((a, b) => {
    let va: any, vb: any;
    switch (field) {
      case "opCount": va = a.opCount; vb = b.opCount; break;
      case "agent": va = a.agent; vb = b.agent; break;
      case "status": va = a.status; vb = b.status; break;
      case "startedAt":
      default: va = a.startedAt; vb = b.startedAt; break;
    }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

// --- Output formatting ---

function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m${s > 0 ? s + "s" : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm > 0 ? rm + "m" : ""}`;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

function printTable(results: SessionResult[], includeTools: boolean) {
  if (results.length === 0) {
    console.log("No sessions matched the filters.");
    return;
  }

  // Header
  console.log(`\n  Found ${results.length} session(s)\n`);
  const divider = "─".repeat(120);
  console.log(divider);

  for (const r of results) {
    const dur = r.durationSec !== undefined ? formatDuration(r.durationSec) : "running";
    const statusIcon = r.status === "done" ? "✓" : r.status === "error" ? "✗" : r.status === "timeout" ? "⏱" : "…";
    const kindLabel = r.kind ? ` [${r.kind}]` : "";

    console.log(
      `  ${statusIcon} ${r.agent.padEnd(12)} ${String(r.opCount).padStart(4)} ops  ${dur.padStart(7)}  ${formatTimestamp(r.startedAt)}${kindLabel}`
    );
    console.log(`    ${truncate(r.task, 110)}`);

    if (includeTools && r.tools && Object.keys(r.tools).length > 0) {
      const sorted = Object.entries(r.tools).sort((a, b) => b[1] - a[1]);
      const toolStr = sorted.map(([t, n]) => `${t}:${n}`).join("  ");
      console.log(`    tools: ${truncate(toolStr, 108)}`);
    }

    if (r.error) {
      console.log(`    error: ${truncate(r.error, 108)}`);
    }

    console.log(divider);
  }
}

function printJson(results: SessionResult[]) {
  console.log(JSON.stringify(results, null, 2));
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);
  const filters = parseArgs(args);

  if (!existsSync(SESSIONS_DIR)) {
    console.error(`Sessions directory not found: ${SESSIONS_DIR}`);
    process.exit(1);
  }

  // Quick pre-filter: if --since or --after is set, we can skip sessions with
  // IDs that are clearly older (session IDs start with s_<epochMs>_)
  const sessionDirs = readdirSync(SESSIONS_DIR);
  let candidates = sessionDirs;

  if (filters.afterMs) {
    candidates = candidates.filter((dir) => {
      const match = dir.match(/^s_(\d+)_/);
      if (!match) return true; // include if we can't parse
      return parseInt(match[1]) >= filters.afterMs! - 600_000; // 10min buffer for clock skew
    });
  }

  if (filters.beforeMs) {
    candidates = candidates.filter((dir) => {
      const match = dir.match(/^s_(\d+)_/);
      if (!match) return true;
      return parseInt(match[1]) <= filters.beforeMs!;
    });
  }

  // Load and filter
  const results: SessionResult[] = [];

  for (const dir of candidates) {
    const meta = loadMeta(dir);
    if (!meta) continue;
    if (!matchesFilters(meta, filters)) continue;

    const result: SessionResult = { ...meta };

    if (meta.endedAt && meta.startedAt) {
      result.durationSec = Math.round((meta.endedAt - meta.startedAt) / 1000);
    }

    if (filters.includeTools) {
      result.tools = loadToolBreakdown(dir);
    }

    results.push(result);
  }

  // Sort
  sortSessions(results, filters.sortField, filters.sortAsc);

  // Limit
  const limited = results.slice(0, filters.limit);

  // Output
  if (filters.jsonOutput) {
    printJson(limited);
  } else {
    printTable(limited, filters.includeTools);
    if (results.length > filters.limit) {
      console.log(`  (showing ${filters.limit} of ${results.length} — use --limit to see more)\n`);
    }
  }
}

main();
