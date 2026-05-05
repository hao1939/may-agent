# EXP-950: Retry Budget Guard

**Status**: PHASE 0 COMPLETE (2025-09-01)
**Author**: Bob
**Hypothesis**: Adding a retry budget (max 3 attempts per task in 24h) will eliminate zombie session epidemics without blocking legitimate retries.

## Phase 0: Validation

### Question: Does any retry/dedup logic already exist in dispatch handlers?

**Method**: Searched `agents/may/handlers/` for retry, dedup, duplicate, budget keywords.

**Finding**: **No existing retry logic.** The session-recovery handler exists but contains no retry budgeting or deduplication. The system currently has no protection against repeated dispatch of the same failing task.

### Baseline Evidence
- Historical data: 45+ interrupted sessions repeating same 3 tasks over 2 weeks (April 21 - May 2, 2025)
- Current dedup only checks for *active* sessions, not historical failure patterns
- No retry budget file exists anywhere in `.state/`

### Phase 0 Verdict: PROCEED TO PHASE 1

The gap is confirmed — no retry budgeting exists. The zombie pattern is documented. The intervention is feasible (single guard file + JSON state).

## Phase 1 Plan: Minimal Implementation

### Deliverables
1. `agents/may/handlers/retry-budget-guard.ts` — the guard logic
2. `.state/retry-budget.json` — tracking state (auto-created)
3. Integration hook in session dispatch flow

### Success Criteria
- Zero zombie loops (same task 5+ times) in 7-day window
- False positive rate < 5%
- Escalation messages include attempt history

### Dependencies
- Needs tech-lead or may to implement (bob designs, doesn't own dispatch code)
- Proposal ready for handoff

## Design Summary

```
On dispatch(task):
  hash = sha256(normalize(task + agentName))
  attempts = count(retry-budget.json[hash] where age < 24h)
  if attempts >= 3:
    escalate("Task hit retry budget", {hash, history})
    return BLOCKED
  else:
    record(hash, timestamp, "dispatched")
    return PROCEED

On completion(task, success):
  if success: clear(hash)
  else: record(hash, timestamp, "failed")
```

## References
- Original design: `DESIGN-retry-budget-guard-2025-05-03.md`
- Zombie analysis: `ANALYSIS-zombie-task-repetition-2025-05-03.md`
- Experiment tracker: `agents/gym/experiments/experiment-status-tracker.md`
