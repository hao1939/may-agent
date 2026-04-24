# Context Patch for structured-plan-writing skill (EXP-5)

## Change Description
Apply the structured-plan-writing skill to coder to test on plan-once-amend scenario.

## Rationale
plan-once-amend is NON-CEILING at 7/8. The structured-plan-writing skill teaches
DECOMPOSE → ORDER → RISK → CHECKPOINT → WRITE IT DOWN planning methodology.
This should improve plan quality and amendment discipline.

## Test Scenario
- Primary: plan-once-amend (baseline 7/8, target 8/8)
- Regression: 2 ceiling scenarios TBD

## Fork Type
Skill injection — behavioral patch loaded in system prompt
