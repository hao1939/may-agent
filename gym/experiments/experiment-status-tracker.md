# Experiment Status Tracker

**Last updated**: 2025-05-03 (bob heartbeat audit)

## Active Experiments

### EXP-700: Parallel Independent Tool Calls
- **Status**: Phase 0 STALLED (2/10 trials done, scenario mismatch blocking progress)
- **Hypothesis**: Batching independent tool calls reduces tool-call blocks per session by ≥15%
- **Skill**: `agents/.lab/exp700-batch-calls/skills/batch-independent-calls.md` ✅ written
- **Scenario**: `efficient-file-reading-workflow` ✅ exists
- **Results so far**: Baseline 82.8s (7/8 criteria), Treatment 65.0s (6/8 criteria) — 21% faster but -1 convention
- **Issue**: Scenario design mismatch (treatment uses different task structure). Needs aligned variant.
- **Next action**: Create aligned treatment variant with identical task structure; run 5+5 matched trials
- **Blocking**: Scenario alignment needed before more trials
- **Details**: `EXP-700-phase0-results.md`
- **Risk**: Has been stalled since initial 2-trial run. Consider killing if no progress within 2 heartbeats.

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
