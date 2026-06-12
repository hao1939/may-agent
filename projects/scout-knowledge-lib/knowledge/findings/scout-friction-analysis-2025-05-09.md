# Scout Friction Analysis — 2025-05-09

## Summary
Scout's 70% operational friction rate (target: 10%) is driven by a small set of recurring issues. Analysis of 94 evaluations in the last 24h reveals the breakdown.

## Top Friction Sources (from evaluations data)

| Issue | Frequency | Category |
|-------|-----------|----------|
| `finish blocked by uncommitted changes` | Very High | Git hygiene |
| `terminal status: error` | High | Runtime crashes |
| `terminal status: interrupted` | Moderate | Timeouts/kills |
| `schema/query error in transcript` | Moderate | DB schema mismatches |
| `constraint violation: edited forbidden path(s)` | Low | Guardrail violations |

## Root Cause Analysis

### 1. Uncommitted Changes (Primary)
Sessions create/modify files but don't commit before finishing. The evaluator flags this as friction. Fix: commit artifacts before calling finish(), or ensure the worktree is clean.

### 2. Error/Interrupted Sessions
Sessions are killed or crash before completing. Often caused by:
- Timeout (session takes too long)
- Model errors or rate limits
- Attempting operations that fail silently

### 3. Schema Mismatches
Querying DB tables with wrong column names. Fix: always run `PRAGMA table_info(tablename)` before querying unfamiliar tables.

### 4. Forbidden Path Edits
Editing files outside scout's allowed scope (e.g., `impact/`, `plan/`, `theory/`). Fix: only write to `agents/scout/` directories.

## Recommended Actions
1. **Add git commit step** before finish() in every scout session
2. **Cache table schemas** in scout context to avoid repeated PRAGMA calls
3. **Maintain a forbidden-paths list** in scout's context.md to prevent guardrail violations
4. **Keep sessions focused** — one artifact per session to avoid timeouts

## Data Source
- `evaluations` table, filtered to `agent='scout'` in last 24h
- 28 good (30%), 66 needs_improvement (70%)
