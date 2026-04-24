# Context Patch for verify-after-edit skill on read-before-edit (EXP-020)

## Change Description
Apply the existing verify-after-edit skill to coder, test on read-before-edit scenario.

## Rationale
read-before-edit baseline is 10/11 — fails only C2.3 (verify-after-edit). The verify-after-edit
skill already exists in production (promoted 2026-03-28). This experiment tests whether the skill
actually fixes the specific criterion it was designed for in this scenario.

## Test Scenario
- Primary: read-before-edit (baseline 10/11, target 11/11)
- Regression: hasty-fix or scope-creep-trap

## Fork Type
Skill injection — reuse of existing promoted skill

## Hypothesis
The verify-after-edit skill should fix C2.3 convention failure, bringing score to 11/11.
