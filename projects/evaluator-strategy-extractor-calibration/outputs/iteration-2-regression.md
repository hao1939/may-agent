# Iteration 2 regression — strategy extractor calibration

## Goal
Freeze the iteration-1 strategy-extraction improvement so evaluator periodic task #7 can keep surfacing reusable positive tactics from modern verified-success sessions, then refresh the downstream artifacts that still described the old all-zero behavior.

## Regression harness added
Added `agents/evaluator/skills/extract-strategy.test.cjs`.

The harness checks four cases:
1. a fixed minimal fixture extracted from a now-positive modern session
2. the fresh May verified-good live sample `s_1778701694150_268`
3. the fresh Dev verified-good live sample `s_1778701694563_272`
4. the compact scout verified-good sample `s_1778701694460_271` as a documented known gap (informational only)

## Fixed fixture
Fixture path:
- `agents/shared/projects/evaluator-strategy-extractor-calibration/outputs/fixtures/strategy-positive-modern-session/session.jsonl`

Fixture composition:
- planning frame with `GOAL` / `PLAN` / `DONE WHEN`
- a schema-guided `query_db` recovery sequence
- a concrete `message` action
- a successful `finish()` with verification evidence

This keeps the regression narrow and stable while still exercising the modern `assistant.content[].toolCall` transcript shape that caused the original false negatives.

## Harness assertions
The regression harness now asserts that the fixed fixture:
- emits at least one `type: "strategy"` lesson
- preserves the planning-frame trigger
- preserves the schema-hint recovery trigger
- preserves the evidence-to-action trigger
- stays focused on positive strategy lessons only

It also asserts that the two fresh live good samples still emit at least one strategy lesson, and that the Dev sample still preserves the read-before/edit/read-after verification-loop tactic.

## Verification run
Command:
- `node agents/evaluator/skills/extract-strategy.test.cjs`

Observed result:
- `Passed: 8`
- `Failed: 0`

Observed live sample summary:
- `s_1778701694150_268` → 3 strategy lessons
- `s_1778701694563_272` → 4 strategy lessons
- `s_1778701694460_271` → 0 strategy lessons (known compact-session gap)
- fixed fixture → 3 strategy lessons, all positive `strategy` type

## Extracted positive triggers now locked in
Across the positive fixture/live samples, the extractor reliably preserves these reusable tactics:
- `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`
- `Uses DB schema/error hints to recover into a successful follow-up query`
- `Turns evidence gathering into one concrete action before finishing`
- `Brackets edit on ... with read-before and read-after verification` (Dev live sample)

## Remaining caveat
This regression closes the durability gap for modern positive extraction, but it does **not** solve the remaining compact scout miss. The short `s_1778701694460_271` sample still yields zero strategy lessons, so compact-success coverage remains improved but not universal.
