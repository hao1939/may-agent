# Experiment Status Tracker

**Last updated**: 2025-01-16 (coach heartbeat)

## Active Experiments

### EXP-700: Parallel Independent Tool Calls
- **Status**: Phase 0 IN PROGRESS (2/10 trials done)
- **Hypothesis**: Batching independent tool calls reduces tool-call blocks per session by ≥15%
- **Skill**: `agents/.lab/exp700-batch-calls/skills/batch-independent-calls.md` ✅ written
- **Scenario**: `efficient-file-reading-workflow` ✅ exists
- **Results so far**: Baseline 82.8s (7/8 criteria), Treatment 65.0s (6/8 criteria) — 21% faster but -1 convention
- **Issue**: Scenario design mismatch (treatment uses different task structure). Needs alignment.
- **Next action**: Create aligned treatment variant; run 5+5 matched trials
- **Blocking**: Scenario alignment needed before more trials
- **Details**: `EXP-700-phase0-results.md`

### EXP-600: Bash Waste Reduction (diagnose-before-retry)
- **Status**: Phase 1 DEPLOYED, awaiting measurement
- **Baseline**: 23.3% waste rate (733/3148 calls wasted)
- **Skill deployed to**: tech-lead (`agents/tech-lead/skills/diagnose-before-retry.md`)
- **Success threshold**: waste rate ≤ 17.5% (25% reduction)
- **Next action**: Measure post-deployment waste rate from recent tech-lead sessions
- **Blocking**: Need ~50 tech-lead sessions post-deployment for signal

### EXP-350: Phantom Nudge Resistance
- **Status**: COMPLETED (results written)
- **Location**: `EXP-350-results.md`

## Closed/Historical

| ID | Name | Outcome | Skill Promoted? |
|----|------|---------|-----------------|
| EXP-188 | (see results) | Done | See results file |
| EXP-248 | (see folder) | Done | See folder |
| EXP-350 | Phantom nudge resistance | Done | See results |

## Priority Queue (Next Experiments)

1. **EXP-700 Phase 0** — Run baseline in gym. Highest priority, fully designed.
2. **EXP-600 measurement** — Check if tech-lead waste rate dropped post-skill.
3. **New: Context-window efficiency** — Agents often re-read files they already read. Could a "cache your reads" skill help?

## How to Run EXP-700 Phase 0

```bash
# In gym, run efficient-file-reading-workflow 5x without the batch-independent-calls skill
# Record: total tool-call blocks, calls-per-block ratio, task completion
# Then run 5x WITH the skill and compare
```
