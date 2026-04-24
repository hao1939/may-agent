# Finding: Dead Handler Files in agents/may/handlers/

**Date**: 2026-04-18  
**Lens**: C (Dead Weight)  
**Severity**: Low

## Summary

3 of 34 handler files in `agents/may/handlers/` are not wired into `cron.json` and are never imported anywhere in `src/` or `agents/`. They are dead code.

## Dead Handlers

| File | Purpose (from header comment) | Status |
|------|------|--------|
| `common-sense-audit.ts:1` | "Replaces the LLM-based common-sense-verify cron" — but `common-sense-verify` still uses `run-agent-task` handler (`cron.json:line ~170`) | Never wired |
| `priority-drift.ts:1` | Sensor+Judge pattern for priority drift detection | Never wired |
| `project-resume.ts:1` | Project health monitor, 5-stage pipeline | Never wired |

## Reverse Check: Phantom Cron Entries

All 22 unique `handler` values in `cron.json` resolve to existing `.ts` files in `agents/may/handlers/`. No phantom entries.

## Evidence

- `cron.json` has 44 entries; `handler` field appears in job-type entries only (heartbeats use `agent` field instead)
- `grep -r` for the three dead handler names across `src/` and `agents/` (excluding handler files themselves) returns zero matches
- `common-sense-audit.ts:4` says it replaces `common-sense-verify`, but `common-sense-verify` cron entry still points to `run-agent-task` handler — suggests the migration was written but never switched over

## Recommended Action

- Delete `priority-drift.ts` and `project-resume.ts` (never used, no cron entry references them)
- For `common-sense-audit.ts`: either wire it into cron.json (replacing `common-sense-verify`'s `run-agent-task` handler) or delete it — the migration was started but not completed
- **Do not fix in this session** — separate task
