#!/usr/bin/env bash
#
# context-learn-backfill.sh — Run LLM context extraction on historical sessions.
#
# Reads session transcripts from .state/sessions/history/ and runs the
# context-learn workflow's merge prompt via the evaluator agent.
#
# Usage:
#   scripts/context-learn-backfill.sh [--agent <name>] [--limit <n>] [--human-only] [--dry-run]
#
# Options:
#   --agent <name>    Only backfill for this agent (default: all enabled agents)
#   --limit <n>       Max sessions per agent (default: 20)
#   --human-only      Only process sessions from human input
#   --dry-run         Show what would be processed, don't run extraction

set -euo pipefail
cd "$(dirname "$0")/.."

AGENT=""
LIMIT=20
HUMAN_ONLY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --human-only) HUMAN_ONLY=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

exec bun -e "
import { Database } from 'bun:sqlite';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { learnFromSession } from './src/lib/context-learn.ts';

const db = new Database('.state/may.db', { readonly: true });
const agentFilter = '${AGENT}';
const limit = ${LIMIT};
const humanOnly = ${HUMAN_ONLY};
const dryRun = ${DRY_RUN};

const agents = agentFilter 
  ? [agentFilter]
  : ['coder', 'may', 'bob', 'coach', 'optimizer', 'tech-lead'];

for (const agent of agents) {
  const whereClause = humanOnly
    ? \`AND (s.task LIKE '%from Hao%' OR s.task LIKE '%from:hao%' 
           OR s.task LIKE '%DISCUSSION%' OR s.task LIKE '%ACTION ITEM%'
           OR s.task LIKE '%REVIEW REQUEST%' OR s.task LIKE '%PRIORITY TASK%'
           OR s.kind = 'chat')\`
    : '';
  
  const rows = db.query(\`
    SELECT s.sessionId, s.task, s.opCount, s.startedAt
    FROM sessions s
    WHERE s.agent = '\${agent}' AND s.status = 'done' AND s.opCount > 2
    \${whereClause}
    ORDER BY s.startedAt DESC
    LIMIT \${limit}
  \`).all();
  
  if (rows.length === 0) {
    console.log(\`\${agent}: no sessions to process\`);
    continue;
  }
  
  console.log(\`\${agent}: processing \${rows.length} sessions...\`);
  
  if (dryRun) {
    for (const r of rows) {
      const date = new Date(r.startedAt).toISOString().slice(0, 10);
      const task = String(r.task || '').slice(0, 80).replace(/\n/g, ' ');
      console.log(\`  [dry-run] \${r.sessionId} [\${date}] ops=\${r.opCount} | \${task}\`);
    }
    continue;
  }
  
  const agentDir = join('agents', agent);
  let totalAdded = 0;
  
  for (const r of rows) {
    const path = join('.state/sessions/history', r.sessionId, 'session.jsonl');
    if (!existsSync(path)) continue;
    
    try {
      const messages = readFileSync(path, 'utf-8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
      
      const result = learnFromSession({ agentDir, messages });
      totalAdded += result.added.length;
      
      if (result.added.length > 0) {
        const date = new Date(r.startedAt).toISOString().slice(0, 10);
        console.log(\`  [\${date}] +\${result.added.length}: \${result.added.map(f => f.slice(0, 60)).join('; ')}\`);
      }
    } catch (err) {
      console.error(\`  error on \${r.sessionId}: \${err.message}\`);
    }
  }
  
  const ctxPath = join(agentDir, 'context.md');
  if (existsSync(ctxPath)) {
    const lines = readFileSync(ctxPath, 'utf-8').split('\n').filter(l => l.startsWith('- ')).length;
    console.log(\`  → \${ctxPath}: \${lines} facts total (+\${totalAdded} new)\`);
  }
}
"