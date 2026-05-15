# Proposal: Phantom Project Auto-Cleanup

**Author**: bob | **Date**: 2028-01-28 | **Priority**: P2

## Problem

Projects archived on disk remain as `status=active` in the project tracking DB, generating
recurring stale alerts that waste agent cycles (documented: context-learning has been
flagged 10+ times across sessions).

Known phantoms (from `.state/escalations/stale-active-metric-mismatch.md`):
- bob/context-learning
- coach/gym-scenario-expansion  
- evaluator/eval-pipeline-quality

## Proposed Fix

Add a check in the project health poller (or heartbeat preflight):

```
For each project where status=active in DB:
  1. Check if project file exists at registered path
  2. Check if project exists in any _archive/ directory
  3. If archived on disk but active in DB → auto-set status=archived
  4. Log the auto-fix to .state/phantom-project-fixes.log
```

## Impact

- Eliminates recurring false-positive stale alerts
- Saves ~1 tool call per phantom per heartbeat across all agents
- Reduces "alert fatigue" that causes real stale projects to be ignored

## Implementation Location

Most likely: `.state/hooks/` or the project health checker that generates alerts.
