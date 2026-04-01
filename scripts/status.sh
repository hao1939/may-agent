#!/usr/bin/env bash
# scripts/status.sh — check recent agent activity and results
# Usage:
#   ./scripts/status.sh              # last 20 sessions
#   ./scripts/status.sh bob          # filter by agent
#   ./scripts/status.sh -n 50        # more results
#   ./scripts/status.sh bob -n 10    # combined

set -euo pipefail
cd "$(dirname "$0")/.."

AGENT=""
LIMIT=20

while [[ $# -gt 0 ]]; do
  case $1 in
    -n) LIMIT="$2"; shift 2 ;;
    *) AGENT="$1"; shift ;;
  esac
done

FILTER=""
if [[ -n "$AGENT" ]]; then
  FILTER="WHERE agent = '$AGENT'"
fi

bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.state/may.db', { readonly: true });

const rows = db.query(\`
  SELECT agent, status, kind, source, startedAt, endedAt, opCount, task, outcome
  FROM sessions
  $FILTER
  ORDER BY startedAt DESC
  LIMIT $LIMIT
\`).all();

if (rows.length === 0) {
  console.log('No sessions found.');
  process.exit(0);
}

// Header
console.log(\`\${'Agent'.padEnd(12)} \${'Status'.padEnd(12)} \${'Ops'.padStart(4)} \${'Duration'.padStart(10)} Task\`);
console.log('-'.repeat(100));

for (const r of rows) {
  const agent = (r.agent || '?').padEnd(12);
  const status = (r.status || '?').padEnd(12);
  const ops = String(r.opCount || '-').padStart(4);

  let duration = '-';
  if (r.startedAt && r.endedAt) {
    const ms = Number(r.endedAt) - Number(r.startedAt);
    if (ms > 0) {
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      duration = mins > 0 ? \`\${mins}m\${secs}s\` : \`\${secs}s\`;
    }
  }
  duration = duration.padStart(10);

  // Clean task: remove [heartbeat]/[cron:*] prefix noise, truncate
  let task = (r.task || '').replace(/^\[(?:heartbeat|cron:[^\]]+)\]\s*/i, '').slice(0, 60);
  if (task.length === 0 && r.outcome) task = String(r.outcome).slice(0, 60);

  console.log(\`\${agent} \${status} \${ops} \${duration} \${task}\`);
}

// Summary
const done = rows.filter(r => r.status === 'done').length;
const interrupted = rows.filter(r => r.status === 'interrupted').length;
const running = rows.filter(r => r.status === 'running').length;
console.log(\`\nShowing \${rows.length} sessions: \${done} done, \${interrupted} interrupted, \${running} running\`);
"
