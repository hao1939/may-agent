#!/bin/bash
# Doc-Drift Detection Guard — Phase 1 Pilot
# EXP-PROPOSAL-doc-drift-detection-guard implementation
# Author: bob | Date: 2025-05-05
# 
# Checks documentation claims in may-agent-docs/ against actual repo state.
# Reports drifts as structured findings.
#
# Usage: bash agents/bob/workspace/tools/doc-drift-checker.sh [doc-dir]

DOC_DIR="${1:-agents/shared/may-agent-docs}"
FINDINGS=0
CHECKS=0
REPORT=""

report() {
  local severity="$1" doc="$2" claim="$3" evidence="$4"
  FINDINGS=$((FINDINGS + 1))
  REPORT="${REPORT}\n## DRIFT #${FINDINGS} [${severity}]\n- **Doc:** ${doc}\n- **Claim:** ${claim}\n- **Evidence:** ${evidence}\n"
}

check() {
  CHECKS=$((CHECKS + 1))
}

echo "=== Doc-Drift Detection Guard ==="
echo "Scanning: ${DOC_DIR}"
echo ""

# --- Check 1: File paths mentioned in docs actually exist ---
echo "Phase 1: Checking file path references..."
for doc in "${DOC_DIR}"/*.md; do
  # Extract paths like src/lib/foo.ts, agents/bar/handlers/baz.ts
  paths=$(grep -oE '(src|agents)/[a-zA-Z0-9_./-]+\.(ts|js|json|md)' "$doc" 2>/dev/null | sort -u)
  for path in $paths; do
    check
    # Check if any file matches (allow for workspace restructuring)
    if ! find . -path "*/${path}" -not -path "*/node_modules/*" -not -path "*/gym/scenarios/*" 2>/dev/null | grep -q .; then
      report "MEDIUM" "$(basename $doc)" "References file: ${path}" "File not found in repo"
    fi
  done
done

# --- Check 2: Handler files referenced in cron.md ---
echo "Phase 2: Checking handler references..."
handlers=$(grep -oE 'agents/[a-z]+/handlers/[a-z-]+\.ts' "${DOC_DIR}/cron.md" 2>/dev/null)
for handler in $handlers; do
  check
  if ! find . -path "*/${handler}" -not -path "*/node_modules/*" -not -path "*/gym/scenarios/*" 2>/dev/null | grep -q .; then
    report "HIGH" "cron.md" "References handler: ${handler}" "Handler file not found"
  fi
done

# --- Check 3: SQL schema claims vs actual table definitions ---
echo "Phase 3: Checking SQL schema claims..."
# Extract CREATE TABLE names from docs
for doc in "${DOC_DIR}"/*.md; do
  tables=$(grep -oE 'CREATE TABLE [a-z_]+' "$doc" 2>/dev/null | awk '{print $3}' | sort -u)
  for table in $tables; do
    check
    # Verify table is referenced in source code
    if ! grep -r "\"${table}\"" . --include="*.ts" --include="*.js" \
      -l 2>/dev/null | grep -v node_modules | grep -v gym/scenarios | grep -q .; then
      # Also check with single quotes and backticks
      if ! grep -r "'${table}'" . --include="*.ts" --include="*.js" \
        -l 2>/dev/null | grep -v node_modules | grep -v gym/scenarios | grep -q .; then
        report "LOW" "$(basename $doc)" "Defines table: ${table}" "Table name not found in source (may be in compiled code)"
      fi
    fi
  done
done

# --- Check 4: Cross-reference doc INDEX against actual files ---
echo "Phase 4: Checking INDEX completeness..."
if [ -f "${DOC_DIR}/INDEX.md" ]; then
  # Check all .md files in dir are mentioned in INDEX
  for doc in "${DOC_DIR}"/*.md; do
    basename_doc=$(basename "$doc")
    if [ "$basename_doc" != "INDEX.md" ]; then
      check
      if ! grep -q "$basename_doc" "${DOC_DIR}/INDEX.md" 2>/dev/null; then
        report "LOW" "INDEX.md" "Should list all docs" "${basename_doc} not mentioned in INDEX"
      fi
    fi
  done
fi

# --- Check 5: Metric names in docs vs any runtime evidence ---
echo "Phase 5: Checking metric definitions..."
metrics=$(grep -oE '`[a-z]+\.[a-z-]+`' "${DOC_DIR}/metrics.md" 2>/dev/null | tr -d '`' | sort -u)
for metric in $metrics; do
  check
  # Check if metric appears in handler code or config
  if ! grep -r "${metric}" . --include="*.ts" --include="*.json" \
    2>/dev/null | grep -v node_modules | grep -v gym/scenarios | grep -v "may-agent-docs" | grep -q .; then
    report "MEDIUM" "metrics.md" "Documents metric: ${metric}" "Metric ID not found in source/config files"
  fi
done

# --- Check 6: Agent names mentioned vs actual agent directories ---
echo "Phase 6: Checking agent references..."
if [ -f "${DOC_DIR}/agents.md" ]; then
  agent_names=$(grep -oE '\*\*[a-z]+\*\*' "${DOC_DIR}/agents.md" 2>/dev/null | tr -d '*' | sort -u)
  for agent in $agent_names; do
    check
    if [ ! -d "agents/${agent}" ]; then
      report "HIGH" "agents.md" "Documents agent: ${agent}" "No agents/${agent}/ directory found"
    fi
  done
fi

# --- Summary ---
echo ""
echo "=== RESULTS ==="
echo "Checks performed: ${CHECKS}"
echo "Drifts found: ${FINDINGS}"
echo ""
if [ $FINDINGS -gt 0 ]; then
  echo -e "$REPORT"
fi
echo "False positive rate estimate: review findings above manually."
echo "Run completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
