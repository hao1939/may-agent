# Experiment Design: Retry Budget Guard (EXP-XXX)

**Date**: 2025-05-03  
**Author**: Bob  
**Status**: PROPOSED  
**Hypothesis**: H-XXX — Adding a retry budget (max 3 attempts per task in 24h) will eliminate zombie session epidemics without blocking legitimate retries.

## Problem Statement

Historical data shows 45+ interrupted sessions repeating the same 3 tasks over a 2-week period (April 21 - May 2, 2025). The existing deduplication guard checks for *active* sessions but not for *repeatedly-interrupted-same-task* patterns. This wastes compute and blocks useful work.

## Hypothesis

**If** we add a retry budget that tracks interrupted task attempts and escalates (rather than re-dispatches) after 3 failures in 24h, **then** zombie session loops will be eliminated while legitimate transient failures still get retried.

## Design

### Mechanism
1. **Tracking**: On task dispatch, record `{taskHash, timestamp, outcome}` in `.state/retry-budget.json`
2. **Check**: Before dispatching, count interrupted/failed attempts for same taskHash in last 24h
3. **Guard logic**:
   - attempts < 3 → dispatch normally
   - attempts >= 3 → log warning + escalate to human/may instead of dispatching
4. **Reset**: On success, clear the retry counter for that taskHash
5. **TaskHash**: SHA-256 of normalized task description (lowercase, strip timestamps)

### Integration Points
- Hook into `agents/may/handlers/` dispatch logic (where fork/call decisions happen)
- Log to `.state/retry-budget.json` (simple append-only with 7-day TTL cleanup)

### Success Criteria
- Zero zombie loops (same task interrupted 5+ times) in a 7-day observation window
- No legitimate tasks blocked (false positive rate < 5%)
- Escalation messages are actionable (include attempt history)

### Measurement
- **Before**: Count zombie patterns in historical session data (baseline: 45+ in 2 weeks)
- **After**: Monitor retry-budget escalation events over 7 days
- **Control**: Track tasks that hit budget=2 but succeed on retry (proves the guard isn't too aggressive)

## Risk Assessment
- **Too aggressive (budget too low)**: Transient network issues could exhaust budget. Mitigation: start at budget=3, increase if false positives > 5%
- **Hash collisions**: Similar but different tasks could share a hash. Mitigation: include agent name + first 100 chars in hash input
- **State file growth**: 7-day TTL cleanup prevents unbounded growth

## Dependencies
- Requires write access to dispatch logic (may/tech-lead territory)
- No external dependencies

## Next Steps
1. Validate: Check if current `may/handlers/` already has any retry logic
2. Propose to tech-lead for implementation
3. If approved, implement as a guard in the dispatch pipeline
