# Brief: Implement Socratic Verification (Growth Cycle)

## Context
Our current `growth-cycle` skill verifies a new skill by checking if it exists and passes a basic test. Socratic-Zero research (analyzed in `2026-03-30-ace-socratic-validation.md`) suggests a more robust approach: **Adversarial Verification**. The Coach should not just check *if* the skill works, but try to *break* it.

## Objective
Update the `growth-cycle` skill (`agents/coach/skills/growth-cycle.md`) to include a "Socratic Verification" step.

## Changes
1. **Current Verification**: "Run the skill and check for success."
2. **New Verification**: "Run the skill with an *edge case* or *adversarial input* relevant to the failure mode."
   - If the original failure was "Empty File", test with an empty file.
   - If the failure was "Infinite Loop", test with a repetitive task.
   - If the failure was "Injection", test with a mocked injection.

## Implementation
Delegate to Coach:
1. Read `agents/coach/skills/growth-cycle.md`.
2. Update the "Verification" section to explicitly require generating a **Corner Case** test, not just a Happy Path test.
3. Reference the **Socratic-Zero** concept (proactive weakness targeting).

## Why
This prevents "fragile fixes" where a skill works for the exact previous error but fails on slight variations. It moves us from **Regression Testing** to **Robustness Testing**.
