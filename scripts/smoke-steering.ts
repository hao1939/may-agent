#!/usr/bin/env bun
/**
 * End-to-end smoke test for the WebUI steering verbs against a running
 * may-agent container. Checks each POST endpoint:
 *   - happy path returns 200 with expected shape
 *   - input validation returns 400 with error
 *   - unknown ids return 404
 *
 * Reads from the same SQLite file the server writes to (read-only) to
 * confirm DB writes happened. Attempts to restore the edited threshold, but
 * a failed request can leave it changed and queued work cannot be undone.
 *
 * Usage:
 *   bun run scripts/smoke-steering.ts                    # localhost:8080
 *   PORT=9090 STATE_DIR=/tmp/foo bun run scripts/...     # custom
 *
 * Changes live state and may queue agent work. Run only against an explicitly
 * authorized disposable installation, never in PR CI or a pre-commit hook.
 */

import { Database } from "bun:sqlite";

const PORT = process.env.PORT ?? "8080";
const STATE_DIR = process.env.STATE_DIR ?? ".state";
const BASE = `http://localhost:${PORT}`;
const DB_PATH = `${STATE_DIR}/may.db`;

let pass = 0, fail = 0;
const failures: string[] = [];

function ok(msg: string) { console.log(`  ✓ ${msg}`); pass++; }
function bad(msg: string, detail?: unknown) {
  console.log(`  ✗ ${msg}${detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  fail++;
  failures.push(msg);
}

async function http(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* leave as text */ }
  return { status: res.status, body: parsed };
}

console.log(`Steering verbs smoke @ ${BASE}  (state: ${STATE_DIR})`);
console.log("─".repeat(60));

// 1. /api/requests should be gone (Phase 1 cleanup).
{
  const { status } = await http("GET", "/api/requests");
  if (status === 404) ok("GET /api/requests → 404 (deleted)");
  else bad("GET /api/requests should be 404", status);
}

// 2. /api/liveness includes alertId in alerts.
{
  const { status, body } = await http("GET", "/api/liveness");
  if (status !== 200) { bad("GET /api/liveness", status); }
  else if (!Array.isArray(body.alerts)) { bad("liveness.alerts not array"); }
  else {
    const ok2 = body.alerts.every((a: any) => "alertId" in a);
    if (ok2) ok(`GET /api/liveness alerts have alertId (n=${body.alerts.length})`);
    else bad("liveness alerts missing alertId on at least one row");
  }
}

// 3. POST /api/agents/:name/heartbeat-now (just verify accepted; we don't want
//    to actually trigger a heartbeat in a test loop, but the socket may not be
//    bound during smoke either, so 200 OR 503 is acceptable).
{
  const { status, body } = await http("POST", "/api/agents/may/heartbeat-now", { actor: "smoke-test" });
  if (status === 200 || status === 503) ok(`POST heartbeat-now (status=${status}, ${status === 503 ? "socket not bound, OK" : "queued"})`);
  else bad("POST heartbeat-now unexpected status", { status, body });
}

// 4. POST /api/sessions/:id/message validation.
{
  const { status } = await http("POST", "/api/sessions/no-such/message", {});
  if (status === 400) ok("POST /api/sessions/.../message rejects empty body");
  else bad("POST /api/sessions/.../message should 400 on empty", status);
}

// 5. POST /api/metrics/:id/threshold — pick a real metric, change & revert.
let testMetricId: string | null = null;
{
  const db = new Database(DB_PATH, { readonly: true });
  const m = db.prepare(
    "SELECT id, threshold FROM metrics WHERE threshold IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
  ).get() as { id: string; threshold: number } | undefined;
  db.close();
  if (!m) { bad("no metric with threshold found in DB to test threshold endpoint"); }
  else {
    testMetricId = m.id;
    const newThr = m.threshold + 0.001;
    const { status, body } = await http("POST", `/api/metrics/${encodeURIComponent(m.id)}/threshold`, { threshold: newThr });
    if (status === 200 && body.from === m.threshold && Math.abs(body.to - newThr) < 1e-9) {
      ok(`POST threshold ${m.id}: ${m.threshold} → ${newThr}`);
    } else {
      bad("POST threshold unexpected", { status, body });
    }
    // Verify DB.
    const verifyDb = new Database(DB_PATH, { readonly: true });
    const after = verifyDb.prepare("SELECT threshold FROM metrics WHERE id = ?").get(m.id) as { threshold: number };
    verifyDb.close();
    if (Math.abs(after.threshold - newThr) < 1e-9) ok("DB reflects new threshold");
    else bad("DB threshold mismatch", { expected: newThr, actual: after.threshold });

    // Revert.
    const rev = await http("POST", `/api/metrics/${encodeURIComponent(m.id)}/threshold`, { threshold: m.threshold });
    if (rev.status === 200) ok(`Reverted threshold to ${m.threshold}`);
    else bad("Failed to revert threshold", rev);
  }
}

// 6. POST threshold validation.
{
  const { status } = await http("POST", `/api/metrics/${testMetricId ?? "any"}/threshold`, { threshold: "not-a-number" });
  if (status === 400) ok("POST threshold rejects non-number");
  else bad("POST threshold should 400 on non-number", status);

  const { status: s2 } = await http("POST", "/api/metrics/no.such.metric.exists/threshold", { threshold: 0.5 });
  if (s2 === 404) ok("POST threshold 404s on unknown metric");
  else bad("POST threshold should 404", s2);
}

// 7. POST /api/alerts/:id/resolve — only if there's an open alert. Don't
//    auto-resolve real alerts; just exercise the validation paths.
{
  const { status } = await http("POST", "/api/alerts/0/resolve", { reason: "smoke" });
  if (status === 404) ok("POST /api/alerts/0/resolve 404s on unknown");
  else bad("alerts/0/resolve should 404", status);

  const { status: s2 } = await http("POST", "/api/alerts/notanumber/resolve", { reason: "x" });
  if (s2 === 400) ok("POST /api/alerts/.../resolve rejects non-numeric id");
  else bad("alerts/notanumber should 400", s2);
}

console.log("─".repeat(60));
console.log(`Result: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
