# Convention Check Handler — Specification

## Overview
A mechanical compliance checker that runs on every evaluated session. It parses the transcript against the registry in `agents/shared/CONVENTIONS.md` and writes results to `may.db`.

## Integration
- **File:** `agents/may/handlers/convention-check.ts`
- **Trigger:** Reactive (via `evaluate-sessions`) + Cron (30m fallback)
- **Output:** `may.db` (convention_checks, convention_maturity) + `.state/convention-checks/summary.json`

## Database Schema
```sql
CREATE TABLE IF NOT EXISTS convention_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  convention TEXT NOT NULL, -- e.g., "C1.1"
  passed INTEGER NOT NULL,  -- 1 or 0
  violations TEXT,          -- JSON array of strings
  checked_at INTEGER NOT NULL,
  UNIQUE(session_id, convention)
);

CREATE TABLE IF NOT EXISTS convention_maturity (
  convention TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'active', -- proposed, active, stable, graduated
  level_since INTEGER,
  last_regression INTEGER
);
```

## Checks to Implement (Phase 1)
All checks must be robust to missing data. If transcript is unparseable, skip.

1. **C1.1 read-before-edit**:
   - Logic: Scan for `edit()` or `write()` calls.
   - Pass if: For every target path, there is a preceding `read()` call in the session.
   - Fail if: Any `edit()`/`write()` occurs without a prior `read()`.

2. **C1.3 verify-writes**:
   - Logic: Scan for `edit()` or `write()` calls.
   - Pass if: For every target path, there is a subsequent `read()` call (or a `cat` in bash).
   - Fail if: Any `edit()`/`write()` is the last interaction with that file.

3. **C1.4 finish-clearly**:
   - Logic: Check the very last tool call.
   - Pass if: It is `finish()`.
   - Fail if: It is anything else (or no tool calls).

4. **C2.1 precise-args**:
   - Logic: check `tool_output` for "Error: Invalid arguments" or schema validation errors.
   - Pass if: 0 schema errors.
   - Fail if: >0 schema errors.

5. **C3.2 workspace-isolation**:
   - Logic: Check all `write()`/`edit()` paths.
   - Pass if: All paths start with `agents/[agentName]/workspace/` OR are in allowed list (`.state/`, `tmp/`).
   - Fail if: Any write outside workspace (unless agent is `may` or `tech-lead`).

6. **C3.3 safe-append**:
   - Logic: Check `write()` calls.
   - Pass if: Target file did not exist before (hard to check without history? Approximate by checking if `read()` returned content before).
   - *Refinement*: Check if `write()` is used on known append-only files (`journal.md`, `history.md`, `*.jsonl`).
   - Fail if: `write()` called on a known append-only file.

7. **C6.1 budget-awareness**:
   - Logic: Calculate `total_ops / budget`.
   - Pass if: Ratio < 0.9 (didn't hit limit).
   - Fail if: Ratio >= 1.0 (hit limit).

8. **C7.1 root-is-app**:
   - Logic: Scan `bash` commands.
   - Pass if: No command contains `/home/`, `~`, `/Users/`.
   - Fail if: Found forbidden path prefixes.

9. **C8.2 promise-deliver-report**:
   - Logic:
     - Check first assistant message for "Promise" or numbered list.
     - Check `finish()` args for `completed_items` or `summary`.
   - Pass if: Both exist.
   - Fail if: Missing plan or missing report.

10. **C12.1 session-start**:
    - Logic: Check first tool call.
    - Pass if: `read("agents/[name]/heartbeat.md")` (or similar).
    - Fail if: First action is not reading heartbeat.

## Logic Flow
1. **Preflight**: Get last checked ID from `.state/evaluations` or DB.
2. **Fetch**: specific sessions from `evaluations` table (completed sessions).
3. **Loop**:
   - Load transcript from `.state/sessions/[id].json`.
   - Run all check functions.
   - Insert rows into `convention_checks`.
4. **Aggregate**:
   - Calculate pass rates per agent/convention (7d window).
   - Detect regressions (>5pp drop).
   - Update `convention_maturity`.
5. **Output**:
   - Write `summary.json`.
   - If regression: write to `agents/[agent]/ERROR_LOG.jsonl` and trigger coach.

## Deliverable
Write this to `agents/bob/workspace/spec-convention-handler.md` for Tech-Lead.
