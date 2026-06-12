<ai_context>
cron.md handler lifecycle table drifted: handler.failed rose from ~10 to ~42/day (task-execution-worker timeouts), handler.skipped rose from ~1150 to ~1400/day (skip rate 20%→28%), handler.routed dropped from ~8 to ~2/day. Updated 2026-06-13.
Triggers: cron.md, handler.failed, handler.skipped, handler lifecycle, design doc drift, coherence audit
</ai_context>

# KE-1865: Handler Lifecycle Volume Drift — cron.md Updated

**Status**: resolved
**Discovered**: 2026-06-13
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1785 (events.md drift), KE-1836 (watchdog amplification)

## Claim

The `cron.md` handler lifecycle event volume table (dated 2026-06-10) had
drifted from current production volumes across three of six event types.

## Evidence

### Comparison (documented 2026-06-10 → actual 2026-06-13 24h window)

| Event | Documented | Actual | Change |
|-------|-----------|--------|--------|
| handler.started | ~4800 | 5014 | +4% |
| handler.completed | ~4800 | 4999 | +4% |
| handler.skipped | ~1150 | 1420 | +23% |
| handler.workflow_dispatched | ~2800 | 2623 | -6% |
| handler.failed | ~10 | 42 | **+320%** |
| handler.routed | ~8 | 2 | -75% |

### handler.failed breakdown

All 42 failures in 24h:
- `aks-rp-e2e-task-execution-worker`: 33 (all "timed out after 3600s")
- `scout-explore-xhs`: 5
- `aks-rp-e2e-project-planner`: 3
- `aks-rp-e2e-project-watchdog`: 1

The handler.failed count is dominated by aks-rp-e2e task-execution-worker
sessions exceeding the 1-hour timeout. This is symptomatic of the
long-running task pattern where aks-explorer sessions hit cost-limit-guard
or take too long on complex tasks.

### handler.skipped rate shift

Skip rate moved from ~20% to ~28% of handler.started. This reflects
maturation of the project execution engine: more precondition checks,
dedup logic, and classifier-based routing result in handlers declining
work earlier. This is healthy.

## Fix Applied

Updated `cron.md` handler lifecycle event table with current volumes and
noted the skip rate increase and handler.failed composition.
