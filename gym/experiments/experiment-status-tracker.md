# Experiment Status Tracker

**Last updated**: 2029-07-03 (coach heartbeat — designed EXP-800)

## Active Experiments

### EXP-580: SOUL.md Placement — Verify-After-Write
- **Status**: DEPLOYED-PARTIAL (coach SOUL.md done; optimizer needs May approval)
- **Hypothesis**: Moving VAW nudge to SOUL.md will increase compliance from ~5% to ≥30%
- **Deployed**: coach SOUL.md (2026-06-01)
- **Next**: Request May to deploy to optimizer SOUL.md; measure after 20 sessions each
- **Details**: `.state/experiments/EXP-580-soul-placement-vaw.md`

### EXP-700: Parallel Independent Tool Calls
- **Status**: KILLED (2026-06-01 — stalled >3 months, scenario mismatch unresolved)
- **Hypothesis**: Batching independent tool calls reduces tool-call blocks per session by ≥15%
- **Outcome**: Promising signal (21% faster) but confounded by scenario mismatch. Killed per staleness policy.
- **Details**: `EXP-700-phase0-results.md`

### EXP-800: Threshold Rescue — Concrete Rules for Verify-After-Edit
- **Status**: READY (2029-07-03 — scenario `multi-file-refactor` built with 4 arms)
- **Hypothesis**: Reformulating VAE as concrete-threshold P0 rule achieves ≥60% compliance even with distraction
- **Resolves**: KE-715 vs KE-655 contradiction (concrete thresholds vs distraction nullification)
- **Next**: Create `multi-file-refactor` gym scenario, run 4-arm experiment (20 sessions)
- **Details**: `agents/shared/knowledge/experiments/EXP-800/design.md`

### EXP-745: Few-Shot Pattern Coverage Expansion
- **Status**: PHASE 2 COMPLETE (2029-07-03)
- **Hypothesis**: Broadening trigger patterns to match implementation/refactoring tasks achieves ≥25% match rate
- **Outcome**: Match rate 45% → 80% (+35pp). Two new examples: incremental-implementation, safe-refactoring.
- **Next**: Phase 3 gym validation or production monitoring
- **Details**: `agents/coach/workspace/EXP-745-phase2-results.md`

## Closed Experiments

| ID | Name | Outcome | Skill Promoted? | Key Finding |
|----|------|---------|-----------------|-------------|
| EXP-600 | Bash waste reduction (diagnose-before-retry) | **CLOSED — NEGATIVE** | Skill deployed to tech-lead but no measured impact | 23.3% baseline waste → intervention did not achieve ≥25% reduction target |
| EXP-350 | Phantom nudge resistance | **COMPLETE — POSITIVE** | `verify-notification-targets` skill validated | Baseline 34/100 → Treatment 80/100 (+46pp). Skill works. |
| EXP-188 | Recognition Intervention Dose-Response | **COMPLETE** | See results file | Coach ran extensive trials; see `EXP-188-results.md` |
| EXP-248 | Belief Externalization | **COMPLETE** | See folder | See `EXP-248/` |

## Observations from Audit (2025-05-03)

### Pattern: Experiment Stall & Abandonment
- EXP-700 has been in "Phase 0" with only 2 trials for an extended period
- EXP-600 was listed as "awaiting measurement" in the tracker but the actual file says CLOSED — NEGATIVE
- **Gap**: Tracker was last updated 2025-01-16 — 4 months stale. Experiment statuses diverged from tracker.

### Pattern: Zombie Experiment Dispatch
- EXP-188 was dispatched 15+ times by coach (visible in system_status) before completing
- This mirrors the broader zombie-task pattern (see `ANALYSIS-zombie-task-repetition-2025-05-03.md`)

### Recommendation
1. **Kill or redesign EXP-700** — stalled experiments waste cognitive overhead each heartbeat
2. **Add "staleness check" to experiment protocol** — if no progress in 3 heartbeats, auto-flag for review
3. **Sync tracker with source-of-truth files** — results files should be canonical, tracker should aggregate

## Priority Queue (Next Experiments)

1. **EXP-700 Decision**: Kill, redesign, or unblock within 1 heartbeat
2. **New: Retry-Budget Guard** (from `DESIGN-retry-budget-guard-2025-05-03.md`): Cap retries per task to prevent zombie dispatch loops
3. **New: Context-window efficiency**: Agents re-read files they already processed. Could a "read-cache" skill help?
4. **H-096 test**: Evaluation Architecture Determines Quality Ceiling — needs experiment design

## How to Use This Tracker

- **Before starting an experiment**: Check here for conflicts and dependencies
- **After completing a phase**: Update status, results summary, and next action
- **Every 3 heartbeats**: Audit for stale entries (>3 heartbeats without progress = flag for review)
