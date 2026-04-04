#!/usr/bin/env bash
# scripts/agent-dashboard.sh — One-call system overview for agent heartbeats
# Reduces multiple DB queries to a single invocation
# Usage: ./scripts/agent-dashboard.sh [agent-name]
set -euo pipefail
cd "$(dirname "$0")/.."

AGENT="${1:-}"
export PATH=".state/.bun/bin:$PATH"

bun -e "
import {Database} from 'bun:sqlite';
import {existsSync, readFileSync, readdirSync} from 'fs';

const db = new Database('.state/may.db', {readonly: true});
const agent = '$AGENT';
const now = Date.now();
const h24 = now - 86400000;
const h72 = now - 3*86400000;

// === 1. Pending requests for this agent ===
if (agent) {
  const pending = db.query(\`
    SELECT requestId, task, status, createdAt FROM requests 
    WHERE toAgent = ? AND status IN ('pending','in_progress')
    ORDER BY createdAt ASC LIMIT 10
  \`).all(agent);
  if (pending.length > 0) {
    console.log('## Pending Tasks');
    for (const r of pending) {
      const age = Math.round((now - (r.createdAt as number)) / 3600000);
      console.log(\`- [\${r.status}] \${(r.task as string).slice(0, 80)} (\${age}h ago)\`);
    }
    console.log();
  }
}

// === 2. Quality Dashboard ===
const q24 = db.query(\`
  SELECT verdict, COUNT(*) as c FROM evaluations
  WHERE createdAt > ? GROUP BY verdict
\`).all(h24);
const qMap: Record<string, number> = {};
let qTotal = 0;
for (const r of q24) {
  qMap[r.verdict as string] = r.c as number;
  if (r.verdict !== 'skipped') qTotal += r.c as number;
}
const goodRate = qTotal > 0 ? ((qMap.good||0) / qTotal * 100).toFixed(1) : 'N/A';
console.log(\`## Quality (24h): \${goodRate}% good (\${qMap.good||0}/\${qTotal} non-skipped)\`);
if (qMap.needs_improvement) console.log(\`  ⚠️ \${qMap.needs_improvement} needs_improvement\`);
console.log();

// === 3. System Health ===
const sessions24 = db.query(\`
  SELECT status, COUNT(*) as c FROM sessions
  WHERE startedAt > ? GROUP BY status
\`).all(h24);
const sMap: Record<string, number> = {};
for (const r of sessions24) sMap[r.status as string] = r.c as number;
console.log(\`## Sessions (24h): \${sMap.done||0} done, \${sMap.interrupted||0} interrupted, \${sMap.error||0} errors, \${sMap.running||0} running\`);

// === 4. Recent errors ===
const errors = db.query(\`
  SELECT agent, error, opCount FROM sessions
  WHERE startedAt > ? AND status = 'error' AND error NOT LIKE '%aborted%'
  ORDER BY startedAt DESC LIMIT 5
\`).all(h24);
if (errors.length > 0) {
  console.log(\`\n## Recent Errors (24h)\`);
  for (const e of errors) {
    console.log(\`- \${(e.agent as string).padEnd(10)} ops=\${e.opCount} \${(e.error as string).slice(0, 70)}\`);
  }
}

// === 5. Agent-specific recent sessions ===
if (agent) {
  const recent = db.query(\`
    SELECT status, opCount, task,
      CASE WHEN endedAt > 0 AND startedAt > 0 THEN (endedAt - startedAt)/1000 ELSE 0 END as dur
    FROM sessions
    WHERE startedAt > ? AND agent = ? AND opCount > 0
    ORDER BY startedAt DESC LIMIT 5
  \`).all(h24, agent);
  if (recent.length > 0) {
    console.log(\`\n## Your Recent Sessions\`);
    for (const s of recent) {
      console.log(\`- \${(s.status as string).padEnd(12)} ops=\${String(s.opCount).padStart(3)} \${s.dur}s \${(s.task as string).slice(0, 60)}\`);
    }
  }
}

// === 6. Convention failures (last 24h) ===
if (agent) {
  const convFails = db.query(\`
    SELECT convention, violations FROM convention_checks
    WHERE checked_at > ? AND agent = ? AND passed = 0
    ORDER BY checked_at DESC LIMIT 3
  \`).all(h24, agent);
  if (convFails.length > 0) {
    console.log(\`\n## Convention Failures\`);
    for (const c of convFails) {
      console.log(\`- \${c.convention}: \${(c.violations as string).slice(0, 100)}\`);
    }
  }
}

console.log(\`\n---\nGenerated at \${new Date().toISOString().slice(0, 19)}Z\`);
"
