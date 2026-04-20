/**
 * File-Read Tracking — Cross-agent file read logging and query helpers.
 *
 * Tracks when agents read files produced by other agents, enabling
 * feedback loops (e.g. "your report was read by 3 agents" or
 * "these reports have zero readers").
 *
 * Uses the `file_reads` table in `.state/may.db`.
 *
 * Schema (already exists in DB):
 *   file_reads(id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     sessionId TEXT NOT NULL, agent TEXT NOT NULL,
 *     filePath TEXT NOT NULL, readAt INTEGER NOT NULL,
 *     producerAgent TEXT)
 */

import { Database } from "bun:sqlite";
import { join } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────

export interface FileReadRecord {
  id: number;
  sessionId: string;
  agent: string;
  filePath: string;
  readAt: number;
  producerAgent: string | null;
}

export interface FileReadStats {
  producer: string;
  reader: string;
  readCount: number;
  lastReadAt: number;
}

export interface UnreadDeliverable {
  filePath: string;
  producerAgent: string;
  createdAt: number;
}

// ── DB Helpers ────────────────────────────────────────────────────────

const DB_PATH = join(process.cwd(), ".state", "may.db");

function getDb(readonly = false): Database {
  return new Database(DB_PATH, { readonly });
}

/** Ensure the file_reads table exists. Idempotent. */
export function ensureFileReadsTable(db?: Database): void {
  const d = db ?? getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS file_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      agent TEXT NOT NULL,
      filePath TEXT NOT NULL,
      readAt INTEGER NOT NULL,
      producerAgent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_file_reads_agent ON file_reads(agent);
    CREATE INDEX IF NOT EXISTS idx_file_reads_path ON file_reads(filePath);
    CREATE INDEX IF NOT EXISTS idx_file_reads_producer ON file_reads(producerAgent);
  `);
  if (!db) d.close();
}

// ── Core: Log a file read ─────────────────────────────────────────────

/**
 * Derive the producer agent from a file path.
 * e.g. "agents/scout/workspace/report.md" → "scout"
 */
export function deriveProducer(filePath: string): string | null {
  const match = filePath.match(/agents\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Log a file read. Skips self-reads (agent reading their own files).
 */
export function logFileRead(
  sessionId: string,
  agent: string,
  filePath: string,
  db?: Database,
): void {
  const producer = deriveProducer(filePath);
  // Skip self-reads
  if (producer === agent) return;

  const d = db ?? getDb();
  d.prepare(
    `INSERT INTO file_reads (sessionId, agent, filePath, readAt, producerAgent)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(sessionId, agent, filePath, Date.now(), producer);
  if (!db) d.close();
}

// ── Queries ───────────────────────────────────────────────────────────

/**
 * Get aggregated read stats: which agents read which producers' files.
 */
export function getFileReadStats(
  opts: { since?: number; limit?: number } = {},
): FileReadStats[] {
  const db = getDb(true);
  const since = opts.since ?? Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  const limit = opts.limit ?? 50;

  const rows = db
    .prepare(
      `SELECT producerAgent as producer, agent as reader,
              COUNT(*) as readCount, MAX(readAt) as lastReadAt
       FROM file_reads
       WHERE readAt > ? AND producerAgent IS NOT NULL
       GROUP BY producerAgent, agent
       ORDER BY readCount DESC
       LIMIT ?`,
    )
    .all(since, limit) as FileReadStats[];

  db.close();
  return rows;
}

/**
 * Get files from a producer that have zero cross-agent reads.
 * Uses the file_deliverables table if it exists, otherwise returns empty.
 */
export function getUnreadDeliverables(
  producerAgent?: string,
  sinceDays = 7,
): UnreadDeliverable[] {
  const db = getDb(true);
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

  // Check if file_deliverables table exists
  const tableExists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='file_deliverables'`,
    )
    .get();

  if (!tableExists) {
    db.close();
    return [];
  }

  const query = producerAgent
    ? `SELECT d.filePath, d.producerAgent, d.createdAt
       FROM file_deliverables d
       LEFT JOIN file_reads r ON d.filePath = r.filePath AND r.agent != d.producerAgent
       WHERE d.createdAt > ? AND d.producerAgent = ? AND r.id IS NULL
       ORDER BY d.createdAt DESC`
    : `SELECT d.filePath, d.producerAgent, d.createdAt
       FROM file_deliverables d
       LEFT JOIN file_reads r ON d.filePath = r.filePath AND r.agent != d.producerAgent
       WHERE d.createdAt > ? AND r.id IS NULL
       ORDER BY d.createdAt DESC`;

  const params = producerAgent ? [since, producerAgent] : [since];
  const rows = db.prepare(query).all(...params) as UnreadDeliverable[];
  db.close();
  return rows;
}

/**
 * Create a file-read tracker function suitable for use as an event-bus subscriber.
 * Returns a function that can be called on each file read event.
 */
export function createFileReadTracker(db?: Database) {
  return (event: { sessionId: string; agent: string; filePath: string }) => {
    logFileRead(event.sessionId, event.agent, event.filePath, db);
  };
}
