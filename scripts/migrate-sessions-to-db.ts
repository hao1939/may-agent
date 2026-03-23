#!/usr/bin/env bun
/**
 * migrate-sessions-to-db.ts — One-time backfill of sessions table from meta.json files.
 *
 * Usage: bun scripts/migrate-sessions-to-db.ts [persist-dir]
 * Default persist-dir: .state
 *
 * Reads all meta.json files from sessions/history/ and sessions/ (active),
 * upserts them into the sessions table. Idempotent — safe to run multiple times.
 */

import { getDb, upsertSession } from "../src/lib/requests.ts";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const persistDir = process.argv[2] || ".state";

const db = getDb(persistDir);
const before = (db.prepare("SELECT COUNT(*) as cnt FROM sessions").get() as any).cnt;
console.log(`Sessions in DB before: ${before}`);

let migrated = 0;
let skipped = 0;
let errors = 0;

function migrateDir(baseDir: string) {
  if (!existsSync(baseDir)) return;
  const dirs = readdirSync(baseDir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== "history");

  for (const d of dirs) {
    const metaPath = join(baseDir, d.name, "meta.json");
    if (!existsSync(metaPath)) { skipped++; continue; }

    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      upsertSession(persistDir, {
        sessionId: d.name,
        agent: meta.agent ?? "unknown",
        task: meta.task ?? "",
        status: meta.status ?? "done",
        kind: meta.kind,
        parentSessionId: meta.parentSessionId,
        requestId: meta.orderId,
        workflowRunId: meta.workflowRunId,
        startedAt: meta.startedAt ?? 0,
        endedAt: meta.endedAt,
        error: meta.error,
        opCount: meta.opCount,
      });
      migrated++;
    } catch {
      errors++;
    }

    if (migrated % 2000 === 0 && migrated > 0) {
      console.log(`  ...migrated ${migrated}`);
    }
  }
}

// Active sessions
migrateDir(join(persistDir, "sessions"));
// Archived sessions
migrateDir(join(persistDir, "sessions", "history"));

const after = (db.prepare("SELECT COUNT(*) as cnt FROM sessions").get() as any).cnt;
console.log(`Done. ${migrated} migrated, ${skipped} skipped (no meta.json), ${errors} errors.`);
console.log(`Sessions in DB: ${before} → ${after}`);
