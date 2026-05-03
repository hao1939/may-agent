# EXP-610 Baseline Results: Write-Depth Gate

**Date**: 2028-09-16
**Scenario**: `heartbeat-shallow-temptation`
**Trials**: 3 (no depth gate injection)
**Agent**: default (may-agent)

## Status: CLOSED — CEILING

## Results Summary

| Trial | produced-3-writes | artifacts-meaningful | finished-with-deliverables | investigated-deeply | found-improvement | Score |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | ✅ (10 files) | ✅ (10 substantive) | ✅ | ✅ | ✅ | 5/5 |
| 2 | ✅ (7 files) | ✅ (7 substantive) | ✅ | ✅ | ✅ | 5/5 |
| 3 | ✅ (9 files) | ✅ (9 substantive) | ✅ | ✅ | ✅ | 5/5 |

**Aggregate**: 5/5 (100%) across all 3 trials — perfect ceiling.

## Analysis

The agent naturally produces 7-10 substantive files per heartbeat even WITHOUT the write-depth gate. The scenario's "temptation" to do shallow work is insufficient — the task.md already says "Produce meaningful work product — do not just read and declare done" which is essentially the treatment.

The existing anti-shallow rule (≥10 tool calls) + artifact gate (EXP-520) appear to be sufficient. The agent already:
- Investigates source code deeply
- Finds and fixes bugs (errors-bug-fixed)
- Adds tests (transform-test-added)
- Produces 7-10 artifacts per session

## Conclusion

**CLOSED — CEILING.** The write-depth gate cannot be measured because agents already exceed the threshold naturally. The scenario task.md includes a hint ("do not just read and declare done") that functions as an implicit treatment.

### Options for Recovery:
1. Remove the hint from task.md and re-test — but this makes the scenario unrealistic
2. Set threshold higher (≥6 substantive writes) — but this penalizes efficient sessions
3. Accept that EXP-520 + anti-shallow already solve this problem

**Decision**: Accept option 3. The existing structural gates (EXP-520 artifact gate + anti-shallow ≥10 calls) are already sufficient. No additional write-depth gate needed.

## Relation to EXP-605

EXP-605 observation showed <90s sessions produce 0% artifacts. But those are REAL sessions where the agent's task prompt (from master-worker dispatch) doesn't include depth reminders. In gym, the scenario always includes explicit instructions, which is why ceiling is hit.

The real problem (shallow production sessions) is a dispatch/prompt problem, not a skill/gate problem. It's already handled by EXP-520's structural gate in production.
