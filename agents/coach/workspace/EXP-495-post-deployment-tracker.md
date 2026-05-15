# EXP-495: Write-First Scaffold — Post-Deployment Tracker

**Status**: DEPLOYED — AWAITING MEASUREMENT
**Deployed**: 2028-07-03 (commit 2e11fdf5e)
**Verified present**: 2026-05-02 (line 420 of master-worker.ts confirmed)
**Measure at**: 2028-07-10 (7 days post-deploy, expect 20+ retry sessions)
**Hard deadline**: 2028-07-17 — write results or kill

## Deployment Verification ✅

Confirmed scaffold template at `/app/agents/shared/workflows/master-worker.ts:420`:
- Pre-creates stub file (line 398-412)
- Injects structured template (Status, What I know, My plan, Work output) into worker prompt
- V3 guardrail checks if stub was left unchanged (<100 bytes = zero output)

## Measurement Checklist

- [ ] Collect 20+ retry-escalation sessions post-deploy
- [ ] Measure WRITE-FIRST compliance (first tool call = edit on stub?) — target ≥60%
- [ ] Measure iterations-to-output — target ≤3
- [ ] Measure zero-output rate — target ≤40%
- [ ] Write results → promote scaffold to KE or close negative

## How to Measure

```bash
# Find retry sessions (iteration > 1) in workflow-runs/
grep -r "Iteration [2-9]\|Iteration [1-9][0-9]" /app/agents/shared/workflows/ 2>/dev/null
# Or check session logs for WRITE-FIRST constraint being injected
grep -rl "WRITE-FIRST CONSTRAINT" .state/sessions/ 2>/dev/null | wc -l
```

## Context: Stalled Experiments Audit (from notification)

The audit identified 5 stalled experiments and a pattern: "text-based coaching has near-zero hit rate." This is consistent with KE-480 findings. EXP-495 is specifically a **scaffold/template** intervention (not text coaching), so it's the correct intervention category.

### Active Experiments Requiring Attention

| Experiment | Status | Next Action |
|-----------|--------|-------------|
| EXP-495 | AWAITING_MEASUREMENT | Wait for data (measure 2028-07-10) |
| EXP-490 | PHASE 2 DESIGNED | Run gym trials (read-before-edit, verify-before-finish, SCBA ×3 each) |
| EXP-475 | DEPLOYED | Measure at 2026-05-10 (10+ post-treatment heartbeats) |
| EXP-285 | PHASE 1 DONE | Blocked on evaluator data |
| EXP-250 | UNBLOCKED | Recreate lab fork, run trials |

## Decision Log

| Date | Decision |
|------|----------|
| 2026-05-02 | Verified deployment in master-worker.ts line 420 — scaffold template present |
| 2026-05-02 | Confirmed measurement timeline (7 days post-deploy) |
| 2026-05-02 | Next actionable experiment: EXP-490 Phase 2 (gym trials ready to run) |
