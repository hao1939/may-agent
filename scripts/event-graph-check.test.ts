import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/lib/db.js";
import { closeDb, getDb } from "../src/lib/requests.js";

const script = new URL("./event-graph-check.ts", import.meta.url).pathname;
const run = (root: string, ...args: string[]) =>
  promisify(execFile)(process.execPath, [script, "--state-dir", root, ...args], { timeout: 10_000 });

test("event inspection reads existing evidence without initializing or migrating it", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-inspect-"));
  try {
    getDb(root);
    closeDb(root);
    const path = join(root, "may.db");
    const before = readFileSync(path);
    const result = JSON.parse((await run(root)).stdout);
    expect(result).toMatchObject({ backfilled: 0, integrity: { ok: true, eventCount: 0 } });
    expect(readFileSync(path)).toEqual(before);
    // SQLite WAL readers can create sidecars; they must not alter stored data.
    // An older/incompatible schema is evidence to diagnose, not a request to upgrade.
    const db = openDatabase(path);
    db.exec("DROP TABLE event_traces");
    db.close();
    const incompatible = readFileSync(path);
    await expect(run(root)).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("verify the database schema"),
    });
    expect(readFileSync(path)).toEqual(incompatible);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("event inspection and backfill refuse missing state instead of creating it", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-missing-"));
  try {
    const missing = join(root, "missing");
    for (const args of [[], ["--backfill"]])
      await expect(run(missing, ...args)).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("existing database"),
      });
    expect(existsSync(missing)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("only explicit backfill repairs missing trace rows", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-backfill-"));
  try {
    const db = getDb(root);
    db.run("INSERT INTO events (event_type, timestamp, data) VALUES (?, ?, ?)", ["fixture.observed", Date.now(), "{}"]);
    db.exec("DELETE FROM event_traces");
    closeDb(root);
    const path = join(root, "may.db");
    const before = readFileSync(path);
    await expect(run(root)).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining('"missingTraceCount": 1'),
    });
    expect(readFileSync(path)).toEqual(before);
    const repaired = JSON.parse((await run(root, "--backfill")).stdout);
    expect(repaired.backfilled).toBeGreaterThan(0);
    expect(repaired.integrity).toMatchObject({ ok: true, eventCount: 1, missingTraceCount: 0 });
    expect(JSON.parse((await run(root)).stdout).integrity.ok).toBe(true);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
