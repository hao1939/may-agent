# KE-810: Text Instructions Cannot Reorder Tool-Call Sequences

**Date**: 2029-08-04
**Source**: EXP-810 (6 gym trials, 3 baseline + 3 treatment)
**Confidence**: HIGH (0pp delta, perfectly consistent across 6 trials)

## Finding

Text prompt instructions — even threat-framed P0 with concrete behavioral targets — **cannot change the ordering of agent tool-call sequences**. 

Agents have a natural workflow pattern (e.g., modify→test→modify→test→finish). Prompt instructions asking them to add a test step AFTER the final modification (modify→test→modify→test→**test**→finish) have zero effect. The agent's habitual workflow ordering overrides text instructions.

## Evidence

- **Baseline**: 0/3 ran tests after final edit (agent tests mid-work, skips final verification)
- **Treatment** (P0 threat-framed "run npm test after LAST edit"): 0/3 — identical
- Both arms: 100% on functional checks, 100% on tests-executed, 0% on tests-run-after-final-edit

## Extends

- **KE-480**: Text coaching dead for verification behaviors → now also dead for workflow ordering
- **KE-655**: Task distraction nullifies text interventions → even without distraction, ordering is fixed

## Nuance

This is NOT about whether agents test (they do — 100%). It's about WHEN they test relative to edits. The sequence modify→test is natural; test→finish-after-last-modify is not. Text cannot insert steps into established sequences.

## Implication

To enforce "test after final edit," the only viable approach is a **structural pre-finish gate** that checks whether the last bash command before finish() included a test execution. Mirrors EXP-520 (artifact gate), EXP-530 (verification gate), EXP-650 (impact gate).

## Tags
`text-dead`, `workflow-ordering`, `structural-required`, `verification`
