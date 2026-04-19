# Context Patch for root-cause-diagnosis skill on wrong-fix-recovery (EXP-021)

## Change Description
New skill: root-cause-diagnosis. Teaches the agent to trace from test failures to root cause
before editing, avoiding red-herring error messages.

## Rationale
wrong-fix-recovery baseline is 2/6 — agent chases the misleading "Invalid discount format"
warning instead of tracing the actual Math.trunc rounding bug. This skill teaches explicit
diagnosis discipline: run tests → trace failures → confirm hypothesis → fix root cause only.

## Test Scenario
- Primary: wrong-fix-recovery (baseline 2/6, target ≥4/6)
- Regression: hasty-fix

## Fork Type
Skill injection — new skill for diagnosis patterns

## Hypothesis
A skill teaching "trace the actual error path before editing" will prevent the red-herring trap.
Tests whether skills can work for diagnosis (not just tool-choice habits).

## Comparison
This is the SKILL arm. EXP-022 is the WORKFLOW arm for the same scenario.
Head-to-head comparison determines where the skill/workflow boundary lies.
