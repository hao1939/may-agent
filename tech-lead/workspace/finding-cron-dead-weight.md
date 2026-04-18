# Finding: Cron Dead Weight Audit

**Date**: 2026-04-18  
**Lens**: C (Dead Weight)  
**Severity**: Low — no active harm, but maintenance/cognitive burden

## Summary

42 cron entries exist in `agents/may/cron.json`. 39 are enabled, 3 are disabled. Of 34 handler files in `agents/may/handlers/`, 3 are orphaned (no cron entry references them). The disabled cron entries retain "kept for rollback" rationale but the replacements have been stable for 2+ weeks.

## Evidence

### Disabled cron entries (dead weight in cron.json)

| Entry | Status | Notes |
|-------|--------|-------|
| `error-log-scanner` | disabled | `agents/may/cron.json:~line 200` — "DEPRECATED — replaced by error-scan workflow. Kept for rollback." Handler file still exists: `agents/may/handlers/error-log-scanner.ts` |
| `coaching-feedback` | disabled | `agents/may/cron.json:~line 280` — "DEPRECATED — migrated to coaching-feedback-wf sensor-judge workflow. Kept for rollback." Handler file still exists: `agents/may/handlers/coaching-feedback.ts` |
| `heartbeat-amy-kimi` | disabled | `agents/may/cron.json:~line 170` — "Amy-Kimi runs on k3s only. Disabled locally to avoid duplicate work." No orphan handler (uses heartbeat type). |

### Orphaned handler files (no cron entry)

| File | Notes |
|------|-------|
| `agents/may/handlers/common-sense-audit.ts` | No cron.json entry references handler `common-sense-audit`. Likely superseded by `common-sense-verify` (which uses `run-agent-task`). |
| `agents/may/handlers/priority-drift.ts` | No cron.json entry references handler `priority-drift`. Dead code. |
| `agents/may/handlers/project-resume.ts` | No cron.json entry references handler `project-resume`. Known removed feature (see prior tech-lead sessions). |

### Scale check

- **42 cron entries** total — high count but most are JS-only (no LLM cost)
- **39 enabled** — all fired sessions in the last 6h (verified via `sessions` table query showing all agent heartbeats + evaluator sessions active)
- **Highest-frequency**: `session-sync` and `active-nudge` at 5min intervals; `evaluation-sync` at 10min
- All enabled entries have corresponding handler files in `agents/may/handlers/`

## Recommended Actions (for separate sessions)

1. **Delete orphaned handlers**: Remove `common-sense-audit.ts`, `priority-drift.ts`, `project-resume.ts` — they are unreachable dead code.
2. **Remove deprecated cron entries**: The `error-log-scanner` and `coaching-feedback` entries + their handler files can be removed. Their replacements (`error-scan` workflow, `coaching-feedback-wf` workflow) have been stable.
3. **Low priority**: `heartbeat-amy-kimi` is intentionally disabled for environment reasons — keep as-is.
