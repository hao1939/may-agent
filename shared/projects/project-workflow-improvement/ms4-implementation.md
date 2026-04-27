# MS4: Implementation — Evaluator Auto-Advance Cap

## Change Summary
Modified `agents/shared/workflows/project.ts` `handleWaitingDecision()` to add a **2-attempt evaluator auto-advance cap**.

## Problem
The evaluator-gate could reject (score <7) indefinitely, sending the project back to CONTINUE each time. In pwi-smart-context, this happened 3 times despite the reviewer marking DONE — stalling the project for multiple iterations.

## Solution
When the evaluator scores <7, we now count previous `**Evaluator**: FAIL` entries in the journal. After 2 total rejections, instead of returning `{ outcome: "continue" }`, we fall through to normal WAITING handling — letting the human/May review decide.

### Behavior Change
| Scenario | Before | After |
|----------|--------|-------|
| 1st eval FAIL | Override to CONTINUE | Override to CONTINUE (unchanged) |
| 2nd eval FAIL | Override to CONTINUE | **Auto-advance to WAITING** |
| 3rd+ eval FAIL | Override to CONTINUE | Auto-advance to WAITING |

## Code Change
File: `agents/shared/workflows/project.ts`, lines ~552-564

The `if (score < 7)` block now:
1. Counts `**Evaluator**: FAIL` occurrences in journal
2. If count + 1 >= 2 (cap), logs auto-advance and falls through to WAITING
3. Otherwise, behaves as before (override to CONTINUE)

## Testing
- Module compiles successfully (`npx tsx --eval` no errors)
- Logic is straightforward: regex count + threshold comparison
- Will validate on next 2 projects that use `evaluator-gate` feature flag

## Remaining for MS4
- [ ] Observe on 2+ real projects to confirm reduced stall rate
