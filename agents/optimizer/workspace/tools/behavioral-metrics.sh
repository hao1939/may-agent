#!/usr/bin/env bash
# behavioral-metrics.sh — Extract behavioral metrics from session.jsonl files
#
# Metrics:
#   first-write-op:      Op number of first write/edit tool call
#   max-bash-streak:     Longest consecutive bash calls without other tool types
#   read-before-edit%:   % of edits preceded by a read of the same file in prior 3 ops
#
# Usage: ./behavioral-metrics.sh [--limit N] [--agent NAME] [--recent HOURS]
# Defaults: limit=50, all agents, last 24h

set -euo pipefail

LIMIT=50
AGENT_FILTER=""
RECENT_HOURS=24

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)  LIMIT="$2"; shift 2;;
    --agent)  AGENT_FILTER="$2"; shift 2;;
    --recent) RECENT_HOURS="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--limit N] [--agent NAME] [--recent HOURS]"
      exit 0;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

SESSIONS_DIR=".state/sessions"
CUTOFF_MS=$(( $(date +%s) * 1000 - RECENT_HOURS * 3600 * 1000 ))

# Collect eligible session dirs (sorted by recency, most recent first)
SESSION_DIRS=()
for dir in "$SESSIONS_DIR"/s_*; do
  [[ -f "$dir/session.jsonl" ]] || continue
  [[ -f "$dir/meta.json" ]] || continue
  
  # Extract timestamp from session ID (s_TIMESTAMP_N)
  sid=$(basename "$dir")
  ts=$(echo "$sid" | sed 's/s_\([0-9]*\)_.*/\1/')
  
  # Skip sessions older than cutoff
  [[ "$ts" -ge "$CUTOFF_MS" ]] || continue
  
  # Agent filter
  if [[ -n "$AGENT_FILTER" ]]; then
    agent=$(grep -o '"agent": *"[^"]*"' "$dir/meta.json" | head -1 | sed 's/.*: *"//;s/"//')
    [[ "$agent" == "$AGENT_FILTER" ]] || continue
  fi
  
  SESSION_DIRS+=("$ts|$dir")
done

# Sort by timestamp descending, take limit
if [[ ${#SESSION_DIRS[@]} -eq 0 ]]; then
  echo "No sessions found matching criteria."
  exit 0
fi
IFS=$'\n' SORTED=($(printf '%s\n' "${SESSION_DIRS[@]}" | sort -t'|' -k1 -rn | head -"$LIMIT"))
unset IFS

# Header
printf "%-12s | %-28s | %5s | %11s | %16s | %17s\n" \
  "agent" "session" "ops" "first-write" "max-bash-streak" "read-before-edit%"
printf "%-12s-+-%-28s-+-%5s-+-%11s-+-%16s-+-%17s\n" \
  "------------" "----------------------------" "-----" "-----------" "----------------" "-----------------"

# Process each session using bun for JSON parsing (fast, handles edge cases)
for entry in "${SORTED[@]}"; do
  dir="${entry#*|}"
  sid=$(basename "$dir")
  
  # Use bun to extract metrics from session.jsonl
  export BUN_PATH=".state/.bun/bin/bun"
  $BUN_PATH -e "
    const fs = require('fs');
    const metaPath = '${dir}/meta.json';
    const sessionPath = '${dir}/session.jsonl';
    
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const agent = meta.agent || '?';
    const lines = fs.readFileSync(sessionPath, 'utf8').trim().split('\n');
    
    // Extract ordered tool calls from assistant messages
    const toolCalls = [];
    let opNum = 0;
    for (const line of lines) {
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.role !== 'assistant') continue;
      if (!Array.isArray(msg.content)) continue;
      
      // Each assistant message with tool calls = one op
      const calls = msg.content.filter(c => c.type === 'toolCall');
      if (calls.length === 0) continue;
      opNum++;
      
      for (const call of calls) {
        const name = call.name || '';
        let path = '';
        if (call.arguments) {
          if (typeof call.arguments === 'string') {
            try { 
              const a = JSON.parse(call.arguments);
              path = a.path || '';
            } catch {}
          } else {
            path = call.arguments.path || '';
          }
        }
        toolCalls.push({ op: opNum, name, path });
      }
    }
    
    if (toolCalls.length === 0) {
      // Skip sessions with no tool calls
      process.exit(0);
    }
    
    // 1. First write op: first edit or write call
    let firstWriteOp = '-';
    for (const tc of toolCalls) {
      if (tc.name === 'edit' || tc.name === 'write') {
        firstWriteOp = tc.op;
        break;
      }
    }
    
    // 2. Max bash streak: longest consecutive bash calls
    let maxBashStreak = 0;
    let currentStreak = 0;
    for (const tc of toolCalls) {
      if (tc.name === 'bash') {
        currentStreak++;
        if (currentStreak > maxBashStreak) maxBashStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
    
    // 3. Read-before-edit rate: % of edits where same file was read in prior 3 ops
    let editCount = 0;
    let readBeforeEditCount = 0;
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      if (tc.name !== 'edit' || !tc.path) continue;
      editCount++;
      
      // Look back at prior tool calls within 3 ops
      const minOp = tc.op - 3;
      for (let j = i - 1; j >= 0; j--) {
        if (toolCalls[j].op < minOp) break;
        if (toolCalls[j].name === 'read' && toolCalls[j].path === tc.path) {
          readBeforeEditCount++;
          break;
        }
      }
    }
    const readBeforeEditRate = editCount > 0 
      ? Math.round((readBeforeEditCount / editCount) * 100) 
      : '-';
    
    const sid = '${sid}';
    const totalOps = opNum;
    
    // Pad output for table alignment
    const a = agent.padEnd(12);
    const s = sid.padEnd(28);
    const o = String(totalOps).padStart(5);
    const fw = String(firstWriteOp).padStart(11);
    const bs = String(maxBashStreak).padStart(16);
    const rb = (readBeforeEditRate === '-' ? '-' : readBeforeEditRate + '%').padStart(17);
    
    console.log(a + ' | ' + s + ' | ' + o + ' | ' + fw + ' | ' + bs + ' | ' + rb);
  " 2>/dev/null || true
done
