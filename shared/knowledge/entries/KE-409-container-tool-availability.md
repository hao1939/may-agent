# KE-409: Only Core Tools Available in Container Runtime

**Source**: EXP-251 Phase 2, Extraction #8 (structured lesson extraction from memory stream)
**Date**: 2027-04-27
**Confidence**: High (multiple agents hit this independently: qa, coach, bob)

## Finding

Agents repeatedly attempt to use tools not installed in the container (ripgrep/rg, sqlite3 CLI, jq) and fail silently or with cryptic errors.

## Rule

**Available tools**: grep, find, cat, sed, awk, node, bun, python3, git, bash builtins

**NOT available**: rg (ripgrep), sqlite3, jq, curl (sometimes), make

**Alternatives**:
- ripgrep → `grep -rn`
- sqlite3 → `bun -e "const db = require('better-sqlite3')('<path>'); ..."`
- jq → `python3 -c "import json, sys; ..."`  or `bun -e`

## Cross-References

- qa: rg failures in compliance checks
- coach: sqlite3 failures querying .state/may.db
- KE-405: this is a "pre-flight awareness" gap, not a skill enforcement gap
