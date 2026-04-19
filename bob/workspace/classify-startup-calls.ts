// Classify WHAT the startup tool calls in worst-offender heartbeats are doing.
// Buckets:
//   context_read  — read/cat of agent context/soul/skills/knowledge docs
//   task_lookup   — DB queries, INBOX/PRIORITY-TRACKER reads, looking for pending work
//   path_probe    — ls / find / stat / grep -l just to locate files
//   fs_scan       — grep/rg across many files, or reading >1 doc
//   git_status    — git status/log/diff
//   system_status — system_status tool
//   other
import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";

const PRODUCTIVE = new Set(["edit", "write", "agents", "notify", "workflow", "finish", "checkpoint"]);

const db = new Database(".state/may.db", { readonly: true });
const targets = ["may", "coach", "bob"];
const cutoff = Date.now() - 7 * 86400_000;

type Call = { tool: string; input: any };
type Classified = { tool: string; bucket: string; snippet: string };

function classify(c: Call): Classified {
  const t = c.tool;
  const s = JSON.stringify(c.input || {}).slice(0, 200);
  if (t === "system_status") return { tool: t, bucket: "system_status", snippet: s };
  if (t === "read") {
    const p: string = c.input?.path || "";
    if (/context\.md|SOUL\.md|TOOLS\.md|skills\/|knowledge\//.test(p)) return { tool: t, bucket: "context_read", snippet: p };
    if (/INBOX|PRIORITY-TRACKER|last-session|periodic-tasks|journal/.test(p)) return { tool: t, bucket: "task_lookup", snippet: p };
    return { tool: t, bucket: "fs_scan", snippet: p };
  }
  if (t === "bash") {
    const cmd: string = c.input?.command || "";
    if (/^git\s+(status|log|diff|branch)/.test(cmd.trim())) return { tool: t, bucket: "git_status", snippet: cmd.slice(0, 80) };
    if (/^(ls|find|stat)\b/.test(cmd.trim()) || /\bwhich\b|\bcat\b.*\|.*head/.test(cmd)) return { tool: t, bucket: "path_probe", snippet: cmd.slice(0, 80) };
    if (/\bgrep\b|\brg\b/.test(cmd)) return { tool: t, bucket: "fs_scan", snippet: cmd.slice(0, 80) };
    if (/bun -e.*Database|sqlite|\.state\/may\.db/.test(cmd)) return { tool: t, bucket: "task_lookup", snippet: cmd.slice(0, 80) };
    if (/\bcat\b/.test(cmd)) return { tool: t, bucket: "context_read", snippet: cmd.slice(0, 80) };
    return { tool: t, bucket: "other", snippet: cmd.slice(0, 80) };
  }
  return { tool: t, bucket: "other", snippet: s.slice(0, 80) };
}

const byAgentBucket: Record<string, Record<string, number>> = {};
const samples: Record<string, string[]> = {};

for (const agent of targets) {
  byAgentBucket[agent] = {};
  const sessions = db.query(`
    SELECT sessionId FROM sessions
    WHERE agent = ? AND status='done' AND startedAt > ?
      AND sessionId LIKE 's_%' AND kind='job' AND task LIKE '%heartbeat%'
    ORDER BY startedAt DESC LIMIT 10
  `).all(agent, cutoff) as any[];

  let picked = 0;
  for (const s of sessions) {
    if (picked >= 5) break;
    let path = `.state/sessions/${s.sessionId}/session.jsonl`;
    if (!existsSync(path)) path = `.state/sessions/history/${s.sessionId}/session.jsonl`;
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const lines = text.split("\n").filter(l => l.trim());
    const startupCalls: Call[] = [];
    let foundProd = false;
    let total = 0;
    for (const ln of lines) {
      let obj: any;
      try { obj = JSON.parse(ln); } catch { continue; }
      if (obj.role !== "assistant" || !Array.isArray(obj.content)) continue;
      for (const c of obj.content) {
        if (c.type !== "toolCall") continue;
        total++;
        if (!foundProd) {
          if (PRODUCTIVE.has(c.name)) { foundProd = true; continue; }
          startupCalls.push({ tool: c.name, input: c.arguments || c.input });
        }
      }
    }
    if (total < 3 || !foundProd || startupCalls.length === 0) continue;
    picked++;
    for (const sc of startupCalls) {
      const cl = classify(sc);
      byAgentBucket[agent][cl.bucket] = (byAgentBucket[agent][cl.bucket] || 0) + 1;
      const key = `${agent}/${cl.bucket}`;
      samples[key] = samples[key] || [];
      if (samples[key].length < 3) samples[key].push(cl.snippet);
    }
  }
}

console.log("# Startup call classification (top-3 offenders)\n");
for (const agent of targets) {
  console.log(`## ${agent}`);
  const total = Object.values(byAgentBucket[agent]).reduce((a, b) => a + b, 0);
  const entries = Object.entries(byAgentBucket[agent]).sort((a, b) => b[1] - a[1]);
  for (const [bucket, n] of entries) {
    const pct = ((n / total) * 100).toFixed(0);
    console.log(`- **${bucket}**: ${n} (${pct}%)`);
    const ex = samples[`${agent}/${bucket}`] || [];
    for (const e of ex) console.log(`    - \`${e}\``);
  }
  console.log(`- **total startup calls classified**: ${total}\n`);
}
