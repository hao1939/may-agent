import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDbSchema } from "../db/schema.js";
import { closeDb, getDb } from "../requests.js";
import { printSystemStatus } from "./system-dashboard.js";

test("status keeps ordinary agent evidence without promoting a named learning process", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-policy-"));
  try {
    const db = getDb(root);
    applyDbSchema(db);
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["fixture-session", "coach", "growth-cycle fixture", "done", Date.now() - 1000, Date.now()],
    );
    const status = printSystemStatus(root, { includeProcessHealth: false });
    expect(status).toContain("AGENTS (last 24h)");
    expect(status).toMatch(/coach\s+1\s+1\s+0\s+100%/);
    expect(status).not.toContain("Coach growth cycles");
    expect(db.prepare("SELECT task FROM sessions WHERE sessionId = ?").get("fixture-session"))
      .toEqual({ task: "growth-cycle fixture" });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
