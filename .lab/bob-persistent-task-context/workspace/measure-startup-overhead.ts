// Measure session startup overhead.
// Definition: "startup" = sequence of tool calls before the FIRST "productive" tool call.
// Productive = edit | write | agents (call/fork) | notify | workflow | finish | checkpoint.
// Read/ls/bash/grep are classified as "startup" UNTIL the first productive call.
// overhead_pct = startup_calls / total_calls.
// We also compute startup wall-clock time = (first productive tool call timestamp) - (session start timestamp).
import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";

const PRODUCTIVE = new Set(["edit", "write", "agents", "notify", "workflow", "finish", "checkpoint"]);

const db = new Database(".state/may.db", { readonly: true });
const agents = ["bob", "may", "coach", "tech-lead", "optimizer"];
const cutoff = Date.now() - 7 * 86400_000;

type Row = { agent: string; sessionId: string; total: number; startup: number; pct: number; startupMs: number; durationMs: number };
const rows: Row[] = [];

for (const agent of agents) {
  const sessions = db.query(`
    SELECT sessionId, startedAt, endedAt FROM sessions
    WHERE agent = ? AND status='done' AND startedAt > ?
      AND sessionId LIKE 's_%'
      AND kind='job'
      AND task LIKE '%heartbeat%'
    ORDER BY startedAt DESC LIMIT 30
  `).all(agent, cutoff) as any[];

  let picked = 0;
  for (const s of sessions) {
    if (picked >= 3) break;
    let path = `.state/sessions/${s.sessionId}/session.jsonl`;
    if (!existsSync(path)) path = `.state/sessions/history/${s.sessionId}/session.jsonl`;
    if (!existsSync(path)) continue;
    let text: string;
    try { text = readFileSync(path, "utf8"); } catch { continue; }
    const lines = text.split("\n").filter(l => l.trim());
    let total = 0, startup = 0, firstProdTs: number | null = null, sessStart: number | null = null;
    let foundProd = false;
    for (const ln of lines) {
      let obj: any;
      try { obj = JSON.parse(ln); } catch { continue; }
      if (sessStart === null && obj.timestamp) sessStart = obj.timestamp;
      if (obj.role !== "assistant" || !Array.isArray(obj.content)) continue;
      for (const c of obj.content) {
        if (c.type !== "toolCall") continue;
        total++;
        if (!foundProd) {
          if (PRODUCTIVE.has(c.name)) {
            foundProd = true;
            firstProdTs = obj.timestamp ?? firstProdTs;
          } else {
            startup++;
          }
        }
      }
    }
    if (total < 3) continue; // skip trivial sessions
    if (!foundProd) {
      // No productive call at all — whole session was "startup-like"; skip (degenerate).
      continue;
    }
    const pct = Math.round((startup / total) * 1000) / 10;
    const startupMs = (firstProdTs ?? 0) - (sessStart ?? 0);
    const durationMs = (s.endedAt ?? 0) - (s.startedAt ?? 0);
    rows.push({ agent, sessionId: s.sessionId, total, startup, pct, startupMs, durationMs });
    picked++;
  }
}

// Print markdown table
console.log("| agent | session_id | total_calls | startup_calls | overhead_pct | startup_time_s | session_s |");
console.log("|-------|-----------|-------------|---------------|--------------|----------------|-----------|");
for (const r of rows) {
  console.log(`| ${r.agent} | ${r.sessionId} | ${r.total} | ${r.startup} | ${r.pct}% | ${(r.startupMs/1000).toFixed(1)} | ${(r.durationMs/1000).toFixed(0)} |`);
}

// Aggregate per agent
console.log("\n## Per-agent averages");
console.log("| agent | n | avg_total | avg_startup | avg_overhead_pct |");
console.log("|-------|---|-----------|-------------|------------------|");
const byAgent = new Map<string, Row[]>();
for (const r of rows) {
  if (!byAgent.has(r.agent)) byAgent.set(r.agent, []);
  byAgent.get(r.agent)!.push(r);
}
let grandPct = 0, grandN = 0;
for (const [a, rs] of byAgent) {
  const n = rs.length;
  const avgT = rs.reduce((s,r)=>s+r.total,0)/n;
  const avgS = rs.reduce((s,r)=>s+r.startup,0)/n;
  const avgP = rs.reduce((s,r)=>s+r.pct,0)/n;
  console.log(`| ${a} | ${n} | ${avgT.toFixed(1)} | ${avgS.toFixed(1)} | ${avgP.toFixed(1)}% |`);
  grandPct += avgP * n; grandN += n;
}
console.log(`\n**Overall mean overhead (n=${grandN}): ${(grandPct/grandN).toFixed(1)}%**`);
