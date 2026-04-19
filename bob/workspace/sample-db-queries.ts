// Sample the actual bun -e "...Database..." bash commands agents run at heartbeat startup.
// Goal: see whether they fetch fields beyond what's already injected (task, fromEntity, createdAt, requestId).
import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";

const PRODUCTIVE = new Set(["edit", "write", "agents", "notify", "workflow", "finish", "checkpoint"]);
const db = new Database(".state/may.db", { readonly: true });
const cutoff = Date.now() - 7 * 86400_000;
const agents = ["may", "coach", "bob", "tech-lead", "optimizer"];

type Hit = { agent: string; session: string; cmd: string };
const hits: Hit[] = [];

for (const agent of agents) {
  const sessions = db.query(`
    SELECT sessionId FROM sessions
    WHERE agent = ? AND status='done' AND startedAt > ?
      AND sessionId LIKE 's_%' AND kind='job' AND task LIKE '%heartbeat%'
    ORDER BY startedAt DESC LIMIT 20
  `).all(agent, cutoff) as any[];

  for (const s of sessions) {
    let path = `.state/sessions/${s.sessionId}/session.jsonl`;
    if (!existsSync(path)) path = `.state/sessions/history/${s.sessionId}/session.jsonl`;
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    let foundProd = false;
    for (const ln of text.split("\n")) {
      if (!ln.trim()) continue;
      let obj: any; try { obj = JSON.parse(ln); } catch { continue; }
      if (obj.role !== "assistant" || !Array.isArray(obj.content)) continue;
      for (const c of obj.content) {
        if (c.type !== "toolCall") continue;
        if (PRODUCTIVE.has(c.name)) { foundProd = true; break; }
        if (c.name === "bash") {
          const cmd: string = (c.arguments || c.input)?.command || "";
          if (/Database|sqlite|may\.db/.test(cmd)) {
            hits.push({ agent, session: s.sessionId, cmd });
          }
        }
      }
      if (foundProd) break;
    }
  }
}

console.log(`# Startup DB queries sampled: ${hits.length} total\n`);
const byAgent: Record<string, number> = {};
for (const h of hits) byAgent[h.agent] = (byAgent[h.agent] || 0) + 1;
console.log("## Count by agent");
for (const [a, n] of Object.entries(byAgent)) console.log(`- ${a}: ${n}`);

console.log("\n## Samples (up to 6 per agent)\n");
for (const a of agents) {
  const rows = hits.filter(h => h.agent === a).slice(0, 6);
  if (!rows.length) continue;
  console.log(`### ${a}`);
  for (const r of rows) {
    console.log("```");
    console.log(r.cmd.slice(0, 600));
    console.log("```");
  }
  console.log();
}

// Extract which SQL tables/columns are referenced
console.log("## Tables/columns referenced\n");
const tableRe = /\bFROM\s+(\w+)/gi;
const colRe = /SELECT\s+([^F]+?)\s+FROM/gis;
const tables: Record<string, number> = {};
const cols: Record<string, number> = {};
for (const h of hits) {
  for (const m of h.cmd.matchAll(tableRe)) tables[m[1].toLowerCase()] = (tables[m[1].toLowerCase()] || 0) + 1;
  for (const m of h.cmd.matchAll(colRe)) {
    const list = m[1].split(",").map(s => s.trim().split(/\s+/).pop()!.toLowerCase());
    for (const c of list) if (c && c.length < 40) cols[c] = (cols[c] || 0) + 1;
  }
}
console.log("Tables:");
for (const [t, n] of Object.entries(tables).sort((a,b)=>b[1]-a[1])) console.log(`- ${t}: ${n}`);
console.log("\nColumns (from SELECT clauses):");
for (const [c, n] of Object.entries(cols).sort((a,b)=>b[1]-a[1]).slice(0,20)) console.log(`- ${c}: ${n}`);
