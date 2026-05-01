#!/usr/bin/env bash
# heartbeat-snapshot.sh — one-call triage snapshot for agent heartbeats.
#
# Replaces the typical sequence of 4-8 individual `bun -e` SQL one-liners that
# agents (especially coach/bob/may) run at the start of every heartbeat.
# See agents/bob/workspace/projects/test-persistent-task-experiment.md (Iter 2,
# pattern #2) for the measurement showing this is the single biggest startup
# overhead win.
#
# Usage:
#   bash agents/shared/scripts/heartbeat-snapshot.sh [agent_name]
#
# If agent_name is provided, sections are filtered to that agent where it
# makes sense. Otherwise prints global view.
#
# Output is plain text in stable section order so an agent can grep/awk it
# without re-running queries.

set -euo pipefail

AGENT="${1:-}"
DB=".state/may.db"
BUN="${BUN:-.state/.bun/bin/bun}"

if [[ ! -x "$BUN" ]]; then
  if command -v bun >/dev/null 2>&1; then
    BUN="bun"
  else
    echo "ERROR: bun not found at $BUN or on PATH" >&2
    exit 2
  fi
fi

if [[ ! -f "$DB" ]]; then
  echo "ERROR: $DB not found (run from repo root /app)" >&2
  exit 2
fi

"$BUN" -e "
import {Database} from 'bun:sqlite';
const db = new Database('$DB', {readonly:true});
const AGENT = '${AGENT}';
const now = Date.now();
const dayAgo = now - 24*3600*1000;
const hourAgo = now - 3600*1000;

function print(title, rows, cols) {
  console.log('=== ' + title + ' (' + rows.length + ') ===');
  if (rows.length === 0) { console.log('(none)'); console.log(''); return; }
  for (const r of rows) {
    const parts = cols.map(c => {
      const v = r[c];
      if (v == null) return c+'=-';
      if (typeof v === 'number' && v > 1e12) {
        const ageMin = Math.round((now - v) / 60000);
        return c+'='+ageMin+'m';
      }
      const s = String(v).replace(/\s+/g,' ').trim();
      return c+'='+(s.length>80?s.slice(0,77)+'...':s);
    });
    console.log('  ' + parts.join(' | '));
  }
  console.log('');
}

// 1. Currently running sessions (global — you almost always want this)
print('RUNNING_SESSIONS',
  db.query(\`SELECT sessionId, agent, startedAt, opCount
            FROM sessions WHERE status='running'
            ORDER BY startedAt DESC LIMIT 20\`).all(),
  ['sessionId','agent','startedAt','opCount']);

// 2. Recent errors (last 24h)
print('RECENT_ERRORS_24H',
  db.query(\`SELECT sessionId, agent, error, endedAt
            FROM sessions WHERE status='error' AND endedAt > ?
            ORDER BY endedAt DESC LIMIT 10\`).all(dayAgo),
  ['sessionId','agent','endedAt','error']);

// 3. Pending agent.notification events for this agent (or all)
//    The legacy 'requests' table was removed; agent-to-agent tasking now
//    flows through events(event_type='agent.notification'). data is JSON
//    blob; we extract task/source for display.
const pendRaw = AGENT
  ? db.query(\`SELECT id, source, owner, timestamp, data
              FROM events
              WHERE event_type='agent.notification'
                AND status='pending' AND owner=?
              ORDER BY timestamp DESC LIMIT 20\`).all(AGENT)
  : db.query(\`SELECT id, source, owner, timestamp, data
              FROM events
              WHERE event_type='agent.notification'
                AND status='pending'
              ORDER BY timestamp DESC LIMIT 20\`).all();
const pendQ = pendRaw.map(r => {
  let task = '';
  try { const d = JSON.parse(r.data || '{}'); task = d.task || d.message || ''; }
  catch { task = String(r.data || '').slice(0, 120); }
  return { id:r.id, fromEntity:r.source, toAgent:r.owner, createdAt:r.timestamp, task };
});
print('PENDING_NOTIFICATIONS' + (AGENT?'_FOR_'+AGENT:''), pendQ,
  AGENT ? ['id','fromEntity','createdAt','task']
        : ['id','fromEntity','toAgent','createdAt','task']);

// 4. Agent's own recent sessions (last 6) — context for 'what did I just do'
if (AGENT) {
  print('MY_RECENT_SESSIONS',
    db.query(\`SELECT sessionId, status, opCount, startedAt, endedAt
              FROM sessions WHERE agent=?
              ORDER BY startedAt DESC LIMIT 6\`).all(AGENT),
    ['sessionId','status','opCount','startedAt','endedAt']);
}

// 5. Activity heatmap last hour (who's been busy?)
print('ACTIVITY_LAST_HOUR',
  db.query(\`SELECT agent, COUNT(*) as n, SUM(opCount) as ops
            FROM sessions WHERE startedAt > ?
            GROUP BY agent ORDER BY n DESC\`).all(hourAgo),
  ['agent','n','ops']);

console.log('-- snapshot generated at ' + new Date(now).toISOString() + ' --');
"

# 6. Active persistent-task projects for this agent (folds an `ls projects/` +
#    `grep Status:` pair into the snapshot). Bob's heartbeats showed 4/6
#    recent sessions running this as a separate op — bundling saves ~1 op.
if [[ -n "$AGENT" && -d "agents/${AGENT}/workspace/projects" ]]; then
  echo "=== ACTIVE_PROJECTS_${AGENT} ==="
  found=0
  for f in agents/"${AGENT}"/workspace/projects/*.md; do
    [[ -e "$f" ]] || continue
    # Match "Status: active" or "**Status**: active" on a single line, in
    # the first 10 lines only (real status headers; not prose referencing
    # the word "active"). Requires `active` to follow the colon, word-bounded.
    if head -10 "$f" | grep -iE '^\s*(\*\*)?status(\*\*)?[[:space:]]*:[[:space:]]*\**[[:space:]]*active\b' >/dev/null 2>&1; then
      # First line is usually "# Project: ..."; show that + path
      title=$(head -1 "$f" | sed 's/^#\+\s*//')
      echo "  ${f#agents/${AGENT}/workspace/projects/} | ${title:0:80}"
      found=$((found+1))
    fi
  done
  [[ $found -eq 0 ]] && echo "  (none)"
  echo ""
fi

# 7. Deep-dive INBOX head (folds a `cat INBOX.md` op into the snapshot).
#    5/6 recent bob heartbeats read this as a separate op. Show just the
#    first ~30 lines — the unread section — which is what agents scan.
INBOX="agents/shared/knowledge/library/deep-dives/INBOX.md"
if [[ -f "$INBOX" ]]; then
  echo "=== DD_INBOX_HEAD (first 30 lines of $INBOX) ==="
  head -30 "$INBOX" | sed 's/^/  /'
  echo ""
fi
