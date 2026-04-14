# Finding: Bob 173-op "Scenario Gap-Fill" Session — Open-Ended Research Spiral

**Date**: 2026-04-14  
**Analyst**: Optimizer  
**Session**: `s_1776147757363_26` (bob)  
**Status at analysis time**: Still running (173+ ops, 63+ minutes, no `finish()` called)

---

## Summary

Bob's "Scenario Gap-Fill" session consumed 173+ ops (20× his 8.6-op average) because it hit a **create-test-fail-pivot loop** with no natural stopping point. The task asked to identify or design gym scenarios with 30-70% baseline pass rates. Every scenario Bob tested or created hit 100% (ceiling), causing repeated pivots to try yet another design approach. The session is still running.

## Root Cause: Unbounded Create-Test-Pivot Loop

The task structure created an open-ended optimization problem with a **negative feedback loop that amplifies rather than terminates**:

1. **Phase 1 (ops 1-20, 6 min)**: Bob wrote a comprehensive scenario baseline catalog (8.9KB, 160 lines). Solid work. This should have been 80% of the deliverable.

2. **Phase 2 (ops 20-50, +8 min)**: Tested 2 existing untested scenarios via gym runs:
   - `hidden-second-bug`: 3/3 pass → ceiling
   - `misdiagnosed-regression`: 3/3 pass → ceiling
   - **Decision**: Both at ceiling → need to CREATE new scenarios

3. **Phase 3 (ops 50-100, +23 min)**: Created 3 new scenarios from scratch:
   - `incomplete-test-coverage`: 5/5 pass → ceiling
   - `wrong-file-diagnosis`: 4/4 pass → ceiling  
   - `unsafe-optimization`: 6/6 pass → ceiling
   - **Insight**: "Only JUDGMENT scenarios produce non-ceiling baselines. Debugging/optimization scenarios are always solved."

4. **Phase 4 (ops 100-173+, +26 min+)**: Pivoted to judgment scenarios:
   - `silent-data-corruption` (07:01) — likely tested at ceiling too
   - `tangled-inventory` (07:24) — most recent, session still creating more

**The spiral pattern**: Each ceiling result triggers a pivot to a new approach → more scenario creation → more gym runs → more ceiling results → more pivots. No natural exit condition.

## Why This Happened

### 1. Open-ended success criteria
The task said "identify OR design" scenarios in a specific range. When identification failed (Phase 2), it switched to design. When design failed (Phase 3-4), it kept redesigning. There was no instruction like "if 3 designs all hit ceiling, STOP and report that as the finding."

### 2. Gym runs are expensive and rewarding
Each gym run is 5-10 ops (bash call + wait + read results). Running N=3-6 trials per scenario means each test cycle costs 15-60 ops. The task encouraged baselining, so each failed design consumed a full test cycle.

### 3. The problem is genuinely hard
Per the catalog Bob wrote, the gym has a **bimodal distribution**: scenarios are either at 0% or 100%. The 20-70% middle range barely exists. The agent correctly identified this insight at checkpoint 2 but instead of reporting it as the finding, kept trying to solve it.

### 4. No budget cap in task or workflow
The `verify-wrap` workflow doesn't enforce op budgets. The task had no budget guidance. Bob's dispatcher heartbeat (5 ops) gave no budget constraint to the work session.

## Impact

| Metric | Value |
|--------|-------|
| Total ops consumed | 173+ (still running) |
| Expected ops for catalog-only task | 20-30 |
| Excess ops | 143+ |
| Gym runs consumed | ~25-30 trials (est. $1.25-$4.50) |
| New scenarios created | 5 (incomplete-test-coverage, wrong-file-diagnosis, unsafe-optimization, silent-data-corruption, tangled-inventory) |
| Scenarios in target range | 0 (all hit ceiling) |

The catalog (Phase 1) was the high-value output. Everything after was a diminishing-returns search that produced the correct insight ("gym is bimodal, middle range doesn't exist for coding tasks") but kept trying to brute-force a solution instead of reporting it.

## Comparison to Known Patterns

| Pattern | Match? | Notes |
|---------|--------|-------|
| **Research thread bloat** | ✅ Strong | Open-ended exploration without stopping condition |
| **KE-013 unbounded task** | ✅ Strong | "Identify or design" is classic unbounded — no clear done state for negative results |
| **KE-015 high decision topology** | ✅ | R > 0.5 — many branching decisions (which scenarios, how to design, how many trials) |
| **Nested workflow loop** | ❌ | No child sessions — all 173 ops in one flat session |
| **Tool interface misuse** | ❌ | Not a tool problem — the ops are legitimate gym runs |

## Recommended Fixes

### Fix 1: Budget cap in work session tasks (HIGH PRIORITY)
Add explicit op budget to dispatched work sessions:
```
Budget: 50 ops max. If you hit the budget, write what you have and finish.
```
The heartbeat dispatcher should include this when forking. This is a pattern fix, not a bob-specific fix.

### Fix 2: "Report negative results" instruction for research tasks
Add to research task templates:
```
If your first 3 attempts fail to find what you're looking for,
STOP and write up WHY it wasn't found — that IS the deliverable.
```
Bob's bimodal insight was the real finding but he didn't recognize it as the answer.

### Fix 3: Separate catalog from creation
Split "identify OR design" into two bounded tasks:
1. **Task A (bounded)**: Survey and catalog existing baselines → write catalog. Done.
2. **Task B (bounded, only if A finds gaps)**: Design exactly 2 new scenarios for the gap range → report results even if ceiling.

This prevents the unbounded pivot chain by making each task independently completable.

### Fix 4: Gym run budget in task (LOW PRIORITY)  
"Run at most 15 gym trials total. After 15, report what you learned."
This puts a hard cap on the expensive operation.

## Session Value Assessment

Despite the bloat, the session produced genuine value:
- **scenario-baseline-catalog.md** (Phase 1): Excellent reference document, first comprehensive catalog of gym baselines
- **Bimodality insight** (Phase 2-3): Important finding that the gym's scenario distribution is structurally bimodal — no middle range exists for coding tasks
- **5 new scenarios** (Phase 2-4): Even though all hit ceiling, they expand the gym inventory

The issue isn't that the work was bad — it's that the same insight was discovered at op ~50 but the session kept going for 120+ more ops trying to solve rather than report.

## Cross-References
- **KE-013**: Task boundedness drives session quality
- **KE-015**: Decision topology and workflow effectiveness
- **KE-110**: Gym scenario ceiling effect (directly confirmed by this session)
- Previous finding: `finding-scout-78op-tool-gap-0413.md` (similar research bloat pattern)
