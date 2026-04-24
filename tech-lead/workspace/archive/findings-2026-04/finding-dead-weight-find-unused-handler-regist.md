# Dead Weight Audit: Unused Handler Registrations

**Date**: 2026-04-16  
**Scope**: `agents/may/handlers/*.ts` vs `agents/may/cron.json`

## Summary

31 handler files exist. 30 are referenced in cron.json. **1 is completely dead** (never registered). 2 more are deprecated but retained for rollback.

## Findings

### 🔴 Dead Handler: `priority-drift.ts`

- **File**: `agents/may/handlers/priority-drift.ts`
- **Status**: No entry in `cron.json` — never scheduled, never runs
- **What it does**: Sensor+judge pattern for detecting when agent work drifts from human priorities. Designed for 2h interval.
- **Evidence**: `grep -r 'priority-drift' agents/may/cron.json` → no matches. File exists only as an unregistered implementation.
- **Severity**: Low (no runtime cost since it never runs, but adds confusion)
- **Recommendation**: Either add a cron entry to activate it, or delete the file. It was likely written as a prototype during the sensor-judge migration (referenced in `agents/may/workspace/DESIGN-sensor-judge-migration.md`) and never wired up.

### 🟡 Deprecated (retained for rollback)

| Handler | Cron Entry | Notes |
|---------|-----------|-------|
| `error-log-scanner.ts` | `enabled: false` | Replaced by `error-scan` workflow |
| `coaching-feedback.ts` | `enabled: false` | Replaced by `coaching-feedback-wf` workflow |

These are intentionally kept. No action needed unless rollback window has passed.

## Follow-up

- Decide: activate or delete `priority-drift.ts`
- Consider: if sensor-judge migration is stable, remove the two deprecated handlers + their cron entries
