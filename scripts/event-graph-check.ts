#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { openReadOnlyDatabase } from "../src/lib/db.js";
import { backfillEventPairTraces, checkEventTraceIntegrity } from "../src/lib/db/event-traces.js";
import { closeDb, getDb } from "../src/lib/requests.js";

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const stateDir = resolve(argValue("--state-dir") ?? process.env.MAY_STATE_DIR ?? "/app/.state");
const shouldBackfill = process.argv.includes("--backfill");
const limit = Number(argValue("--limit") ?? 100000);

const path = join(stateDir, "may.db");
if (!existsSync(path)) throw new Error(`Event inspection requires an existing database: ${path}`);
// Inspection must not initialize, restore or migrate Host state. Backfill is
// the explicitly requested write path; it retains the Host's schema handling.
const db = shouldBackfill ? getDb(stateDir) : openReadOnlyDatabase(path);
try {
  let backfilled = 0;
  if (shouldBackfill) {
    backfilled = backfillEventPairTraces(db, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : 100000,
    });
  }
  const integrity = checkEventTraceIntegrity(db);
  console.log(JSON.stringify({ stateDir, backfilled, integrity }, null, 2));
  if (!integrity.ok) process.exitCode = 1;
} catch (error) {
  throw new Error(
    `Cannot ${shouldBackfill ? "backfill" : "inspect"} event traces in ${path}; verify the database schema: ${String(error)}`,
  );
} finally {
  if (shouldBackfill) closeDb(stateDir);
  else db.close();
}
