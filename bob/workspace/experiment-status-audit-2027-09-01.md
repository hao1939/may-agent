# Experiment Status Audit — 2027-09-01

## Active Experiments Needing Measurement

### EXP-297: Session-State Disambiguation Guard
- **Status**: DEPLOYED (commit 966faecb4, timestamp 1777576664)
- **Measurement window**: 7 days post-deploy (until ~1778181464)
- **Current time**: 1777580203 (~1 hour post-deploy)
- **Action needed**: Measure at day 7 (~2027-09-08)
- **Baseline**: 4 ghost completions in ~12 days (0.33/day)
- **Success criteria**: ≤1 ghost completion in 7-day post window
- **Deployment confirmed**: `master-worker.ts` contains "FRESH session" text

### EXP-296: Ghost Completion Detection & Circuit Breaker  
- **Status**: PARTIALLY_VALIDATED → ready to CLOSE
- **Layer 1 (prompt guard)**: Now subsumed by EXP-297's deployment
- **Layer 2 (circuit breaker)**: Already in code (MAX_ZERO_OUTPUT = 3, terminate at 6)
- **Evidence**: All 4 baseline ghost completions pre-date EXP-297 deployment
- **Recommendation**: Close as VALIDATED once EXP-297 post-measurement confirms reduction

## Recently Closed / Validated

- EXP-290: Anti-shallow rule — deployed to bob, working (enforced via prompt)
- EXP-295: Anti-shallow to scout/qa/may — deployed

## Open Question: Optimizer/Coach Coverage Gap

The original ghost completion offenders were **optimizer** and **coach** (not bob/scout/qa/may who have anti-shallow). The EXP-297 session contract targets the worker workflow which ALL agents go through. If it works, this closes the gap without needing per-agent anti-shallow rules for optimizer/coach.

## Hypothesis Backlog (Unvalidated)

| ID | Hypothesis | Age | Worth Testing? |
|----|-----------|-----|---------------|
| H297 | Session-state primer reduces ghost completions >50% | Just deployed | Yes — measuring now |
| H296-remaining | Anti-shallow for optimizer/coach directly | ~30 days | Deferred pending EXP-297 results |

## Next Heartbeat Actions

1. ~7 days from now: Run post-measurement for EXP-297
2. If EXP-297 succeeds: Close both EXP-296 and EXP-297, write KE
3. If EXP-297 fails: Deploy anti-shallow to optimizer/coach as fallback (H296-remaining)
