#!/usr/bin/env bash
# scripts/convention-investigate.sh — Convention investigation tool for coach
#
# Replaces the manual 76-op investigation protocol with a single script call.
# Queries may.db for trend data, failing sessions, and check logic,
# then searches git for recent related changes.
#
# Usage: ./scripts/convention-investigate.sh <convention> <agent>
# Example: ./scripts/convention-investigate.sh C1.1 coder
#          ./scripts/convention-investigate.sh C12.1 bob
#
# Output: Structured investigation report to stdout
#
# Tables used:
#   convention_checks: session_id, agent, convention, passed, violations, checked_at
#   sessions: sessionId, agent, task, status, opCount, startedAt, endedAt
#   evaluations: sessionId, agent, verdict, issues, createdAt

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Args ───────────────────────────────────────────────────────────────

CONVENTION="${1:-}"
AGENT="${2:-}"

if [[ -z "$CONVENTION" || -z "$AGENT" ]]; then
  echo "Usage: $0 <convention> <agent>"
  echo ""
  echo "Examples:"
  echo "  $0 C1.1 coder    # read-before-edit for coder"
  echo "  $0 C12.1 bob     # session-start for bob"
  echo "  $0 C1.3 coach    # verify-writes for coach"
  echo ""
  echo "Known conventions: C1.1, C1.3, C1.4, C1.5, C1.7, C2.1, C3.2, C3.3, C6.1, C7.1, C8.2, C12.1"
  exit 1
fi

export PATH=".state/.bun/bin:$PATH"

# ── Section 1: DB Queries ──────────────────────────────────────────────

# Write the bun query script to a temp file to avoid shell quoting issues
QUERY_SCRIPT=$(mktemp /tmp/conv-investigate-XXXXX.ts)
trap "rm -f $QUERY_SCRIPT" EXIT

cat > "$QUERY_SCRIPT" << 'QUERY_EOF'
import {Database} from "bun:sqlite";
const db = new Database(".state/may.db", {readonly: true});
const conv = Bun.argv[2];
const agent = Bun.argv[3];
const now = Date.now();
const h24 = now - 86400000;
const h72 = now - 3 * 86400000;
const d7  = now - 7 * 86400000;

// 1a. Overall pass rate (all-time, 7d, 24h)

function passRate(afterMs: number) {
  const row = db.query(
    "SELECT COUNT(*) as total, SUM(passed) as passes FROM convention_checks WHERE convention = ? AND agent = ? AND checked_at > ?"
  ).get(conv, agent, afterMs) as any;
  if (!row || row.total === 0) return { total: 0, passes: 0, rate: "N/A" };
  return { total: row.total, passes: row.passes, rate: (row.passes / row.total * 100).toFixed(1) + "%" };
}

const allTime = passRate(0);
const last7d = passRate(d7);
const last24h = passRate(h24);

console.log("## 1. Pass Rate Trend");
console.log("");
console.log("| Window   | Pass Rate       | Passed | Total |");
console.log("|----------|-----------------|--------|-------|");
console.log("| All-time | " + allTime.rate.padEnd(15) + " | " + String(allTime.passes).padEnd(6) + " | " + allTime.total + " |");
console.log("| Last 7d  | " + last7d.rate.padEnd(15) + " | " + String(last7d.passes).padEnd(6) + " | " + last7d.total + " |");
console.log("| Last 24h | " + last24h.rate.padEnd(15) + " | " + String(last24h.passes).padEnd(6) + " | " + last24h.total + " |");
console.log("");

// 1b. Daily breakdown (last 7 days)

const daily = db.query(
  "SELECT date(checked_at/1000, 'unixepoch') as day, COUNT(*) as total, SUM(passed) as passes FROM convention_checks WHERE convention = ? AND agent = ? AND checked_at > ? GROUP BY day ORDER BY day DESC"
).all(conv, agent, d7) as any[];

if (daily.length > 0) {
  console.log("### Daily Breakdown (7d)");
  console.log("");
  console.log("| Date       | Rate   | Pass/Total |");
  console.log("|------------|--------|------------|");
  for (const d of daily) {
    const rate = d.total > 0 ? (d.passes / d.total * 100).toFixed(1) + "%" : "N/A";
    console.log("| " + d.day + " | " + rate.padEnd(6) + " | " + d.passes + "/" + d.total + " |");
  }
  console.log("");
}

// 1c. Failing sessions with violations (last 72h, limit 10)

const failures = db.query(
  "SELECT cc.session_id, cc.violations, cc.checked_at, s.task, s.opCount, s.status FROM convention_checks cc LEFT JOIN sessions s ON cc.session_id = s.sessionId WHERE cc.convention = ? AND cc.agent = ? AND cc.passed = 0 AND cc.checked_at > ? ORDER BY cc.checked_at DESC LIMIT 10"
).all(conv, agent, h72) as any[];

console.log("## 2. Recent Failures (72h)");
console.log("");
if (failures.length === 0) {
  console.log("No failures in last 72 hours. ✅");
} else {
  console.log("Found " + failures.length + " failure(s):");
  console.log("");
  for (const f of failures) {
    const time = new Date(f.checked_at).toISOString().slice(0, 16) + "Z";
    const task = f.task ? f.task.slice(0, 80) : "(no task)";
    const status = f.status || "?";
    console.log("### " + f.session_id);
    console.log("- **Time**: " + time);
    console.log("- **Status**: " + status + " | **Ops**: " + (f.opCount || "?"));
    console.log("- **Task**: " + task);
    try {
      const viols = JSON.parse(f.violations || "[]");
      console.log("- **Violations**:");
      for (const v of viols) {
        console.log("  - " + v);
      }
    } catch {
      console.log("- **Violations**: " + (f.violations || "none"));
    }
    console.log("");
  }
}

// 1d. Compare with other agents on same convention

const comparison = db.query(
  "SELECT agent, COUNT(*) as total, SUM(passed) as passes, ROUND(100.0 * SUM(passed) / COUNT(*), 1) as rate FROM convention_checks WHERE convention = ? AND checked_at > ? GROUP BY agent ORDER BY rate ASC"
).all(conv, d7) as any[];

if (comparison.length > 1) {
  console.log("## 3. Cross-Agent Comparison (" + conv + ", 7d)");
  console.log("");
  console.log("| Agent        | Rate    | Pass/Total |");
  console.log("|-------------|---------|------------|");
  for (const c of comparison) {
    const marker = c.agent === agent ? " ← target" : "";
    console.log("| " + (c.agent + marker).padEnd(12) + "| " + (c.rate + "%").padEnd(7) + " | " + c.passes + "/" + c.total + " |");
  }
  console.log("");
}
QUERY_EOF

DB_OUTPUT=$(bun "$QUERY_SCRIPT" "$CONVENTION" "$AGENT" 2>&1)

# ── Section 2: Check Logic Extraction ──────────────────────────────────

HANDLER_FILE="agents/may/handlers/convention-check.ts"

# Map convention IDs to their check function names
declare -A FUNC_MAP
FUNC_MAP["C1.1"]="checkC1_1_readBeforeEdit"
FUNC_MAP["C1.3"]="checkC1_3_verifyWrites"
FUNC_MAP["C1.4"]="checkC1_4_finishClearly"
FUNC_MAP["C1.5"]="checkC1_5_ghostDeliverables"
FUNC_MAP["C1.7"]="checkC1_7_verificationEvidence"
FUNC_MAP["C2.1"]="checkC2_1_preciseArgs"
FUNC_MAP["C3.2"]="checkC3_2_workspaceIsolation"
FUNC_MAP["C3.3"]="checkC3_3_safeAppend"
FUNC_MAP["C6.1"]="checkC6_1_budgetAwareness"
FUNC_MAP["C7.1"]="checkC7_1_rootIsApp"
FUNC_MAP["C8.2"]="checkC8_2_promiseDeliverReport"
FUNC_MAP["C12.1"]="checkC12_1_sessionStart"

FUNC_NAME="${FUNC_MAP[$CONVENTION]:-}"

CHECK_LOGIC=""
if [[ -n "$FUNC_NAME" && -f "$HANDLER_FILE" ]]; then
  # Extract the function and its preceding doc comment
  # Find the line number where the function starts (doc comment or function)
  DOC_LINE=$(grep -n "^\(/\*\*\|function $FUNC_NAME\)" "$HANDLER_FILE" | grep -B1 "$FUNC_NAME" | head -1 | cut -d: -f1)
  FUNC_LINE=$(grep -n "^function $FUNC_NAME" "$HANDLER_FILE" | head -1 | cut -d: -f1)

  if [[ -n "$FUNC_LINE" ]]; then
    # Find the start: either the doc comment above or the function itself
    START_LINE=${DOC_LINE:-$FUNC_LINE}

    # Find the end: next function definition or end of file
    NEXT_FUNC_LINE=$(awk "NR > $FUNC_LINE && /^function /{print NR; exit}" "$HANDLER_FILE")
    if [[ -n "$NEXT_FUNC_LINE" ]]; then
      END_LINE=$((NEXT_FUNC_LINE - 2))
    else
      # Also check for next section marker
      NEXT_SECTION=$(awk "NR > $FUNC_LINE && /^\/\/ ──/{print NR; exit}" "$HANDLER_FILE")
      if [[ -n "$NEXT_SECTION" ]]; then
        END_LINE=$((NEXT_SECTION - 2))
      else
        END_LINE=$((FUNC_LINE + 60))  # fallback: show 60 lines
      fi
    fi

    CHECK_LOGIC=$(sed -n "${START_LINE},${END_LINE}p" "$HANDLER_FILE")
  fi
fi

# ── Section 3: Related Config ──────────────────────────────────────────

# Find convention-related config (exemptions, thresholds, patterns)
CONFIG_CONTEXT=""
if [[ -f "$HANDLER_FILE" ]]; then
  # Extract relevant constants that mention this convention
  CONST_REFS=$(grep -n "C${CONVENTION#C}" "$HANDLER_FILE" 2>/dev/null | grep -v -m 10 "^.*function\|^.*console\|^.*\/\/") || true
  if [[ -n "$CONST_REFS" ]]; then
    CONFIG_CONTEXT="$CONST_REFS"
  fi

  # For specific conventions, extract their exempt/config patterns
  case "$CONVENTION" in
    C1.3)
      CONFIG_CONTEXT=$(grep -A1 -m 15 "C1_3_EXEMPT" "$HANDLER_FILE") || true
      ;;
    C3.2)
      CONFIG_CONTEXT=$(grep -A1 -m 5 "WORKSPACE_EXEMPT\|ALLOWED_WRITE" "$HANDLER_FILE") || true
      ;;
    C6.1)
      CONFIG_CONTEXT=$(grep -m 3 "BUDGET_THRESHOLD" "$HANDLER_FILE") || true
      ;;
    C7.1)
      CONFIG_CONTEXT=$(grep -m 3 "FORBIDDEN_PATH" "$HANDLER_FILE") || true
      ;;
  esac
fi

# ── Section 4: Git Archaeology ─────────────────────────────────────────

# Look for recent changes to agent-relevant files
AGENT_DIR="agents/${AGENT}"
GIT_CHANGES=""

if [[ -d "$AGENT_DIR" ]]; then
  # Recent changes to the agent's config files (7 days)
  # Note: use -n instead of | head to avoid SIGPIPE with set -euo pipefail
  GIT_CHANGES=$(cd agents && git log --oneline -15 --since="7 days ago" -- "${AGENT}/" 2>/dev/null) || true
fi

# Recent changes to convention-check handler itself
HANDLER_CHANGES=$(cd agents && git log --oneline -5 --since="7 days ago" -- "may/handlers/convention-check.ts" 2>/dev/null) || true

# Recent changes to shared conventions/skills
SHARED_CHANGES=$(cd agents && git log --oneline -5 --since="7 days ago" -- "shared/" 2>/dev/null) || true

# ── Section 5: Agent Context Files ─────────────────────────────────────

# Check if the convention is mentioned in the agent's context files
CONTEXT_MENTIONS=""
for f in "${AGENT_DIR}/context.md" "${AGENT_DIR}/SOUL.md" "${AGENT_DIR}/LESSONS.md" "${AGENT_DIR}/TOOLS.md"; do
  if [[ -f "$f" ]]; then
    MATCH=$(grep -i -m 3 "${CONVENTION}\|${CONVENTION/C/c}" "$f" 2>/dev/null) || true
    if [[ -n "$MATCH" ]]; then
      CONTEXT_MENTIONS="${CONTEXT_MENTIONS}
### $(basename $f)
${MATCH}
"
    fi
  fi
done

# ── Output Report ──────────────────────────────────────────────────────

cat <<EOF
# Convention Investigation: ${CONVENTION} × ${AGENT}
**Generated**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

---

${DB_OUTPUT}

## 4. Check Logic (${CONVENTION})

\`\`\`typescript
${CHECK_LOGIC:-"(Could not extract — function '${FUNC_NAME}' not found in ${HANDLER_FILE})"}
\`\`\`
EOF

if [[ -n "$CONFIG_CONTEXT" ]]; then
  cat <<EOF

### Related Configuration
\`\`\`
${CONFIG_CONTEXT}
\`\`\`
EOF
fi

cat <<EOF

## 5. Recent Git Changes (7d)

### Agent files (${AGENT_DIR}/)
\`\`\`
${GIT_CHANGES:-"(no changes in last 7 days)"}
\`\`\`

### Convention handler (convention-check.ts)
\`\`\`
${HANDLER_CHANGES:-"(no changes in last 7 days)"}
\`\`\`

### Shared files (agents/shared/)
\`\`\`
${SHARED_CHANGES:-"(no changes in last 7 days)"}
\`\`\`
EOF

if [[ -n "$CONTEXT_MENTIONS" ]]; then
  cat <<EOF

## 6. Convention Mentions in Agent Config
${CONTEXT_MENTIONS}
EOF
fi

cat <<EOF

---
*Investigation complete. Use session IDs above to drill into specific transcripts if needed.*
*Transcript path: .state/sessions/history/<sessionId>/session.jsonl*
EOF
