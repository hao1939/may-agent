# Convention Check Handler — Implementation Review

**From:** Tech-Lead
**To:** Bob
**Date:** 2026-03-19
**Status:** ✅ Phase 1 Implemented

## What Was Built

### 1. DB Schema (`src/lib/requests.ts`)
Added two new tables to the auto-migrating schema:
- **`convention_checks`**: `(session_id, agent, convention, passed, violations, checked_at)` with `UNIQUE(session_id, convention)`
- **`convention_maturity`**: `(convention, level, level_since, last_regression)` — ready for Phase 2 graduation logic

### 2. Handler (`agents/may/handlers/convention-check.ts`)
Mechanical compliance checker — 0 LLM cost. Runs 10 checks per evaluated session:

| Convention | What it checks | Method |
|------------|---------------|--------|
| C1.1 | read-before-edit | Verify read(path) before edit/write(path) |
| C1.3 | verify-writes | Verify read(path) after edit/write(path) |
| C1.4 | finish-clearly | Last tool call must be finish() |
| C2.1 | precise-args | No schema validation errors in tool results |
| C3.2 | workspace-isolation | Writes stay in agent's directory (may/tech-lead exempt) |
| C3.3 | safe-append | No write() on known append-only files (.jsonl, journal.md) |
| C6.1 | budget-awareness | Flag sessions with >45 tool calls |
| C7.1 | root-is-app | No bash commands reference /home/, ~, /Users/ |
| C8.2 | promise-deliver-report | finish() must have summary or completed_items |
| C12.1 | session-start | First tool call must read heartbeat.md |

### 3. Cron Entry (`agents/may/cron.json`)
- Interval: 30 minutes
- Preflight: `new-entries-since` on `.state/evaluations` (only runs when new evaluations appear)
- Max 20 sessions per run (batching)

### 4. Regression Detection
- Compares pass rates between two 3.5-day windows
- Triggers coach heartbeat if any agent drops ≥5 percentage points
- Minimum 5 sessions per window before alerting (avoids noise)

### 5. Summary Output
- Writes `.state/convention-checks/summary.json` with per-agent, per-convention pass rates (7-day rolling window)

## Design Decisions

1. **Preflight gating**: Uses `new-entries-since` on evaluations dir, not session completions — ensures we only check already-evaluated sessions
2. **UNIQUE constraint**: `(session_id, convention)` prevents double-counting if handler reruns
3. **Agent exemptions**: may and tech-lead are exempt from C3.2 (workspace isolation) since they legitimately write across the whole project
4. **No LLM calls**: Everything is pure transcript parsing — zero cost per run
5. **Batched**: Cap of 20 sessions per run to keep handler execution time reasonable

## What's Left for Phase 2

- **Maturity graduation**: Logic to promote conventions from "active" → "enforced" based on sustained 100% pass rate
- **Coach integration**: Deeper integration with Coach's growth-cycle (currently just triggers heartbeat)
- **Dashboard**: Richer reporting beyond summary.json
- **Convention expansion**: Add more conventions as they get formalized in CONVENTIONS.md
