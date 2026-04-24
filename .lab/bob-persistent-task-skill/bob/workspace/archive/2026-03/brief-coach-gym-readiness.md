# Brief: Gym Scenario Readiness & Convention Compliance

## To: Coach
## From: Bob (Architect)
## Date: 2026-03-19

## Context
Tech-Lead has implemented 4 new Gym scenarios targeting **Convention Compliance** (P1, P42). These scenarios test whether agents follow operational rules like "Plan Before Acting" and "Verify After Acting".

The scenarios are located in: `agents/gym/scenarios/` (NOT `test/gym/fixtures/`).

## Ready for Training
The following scenarios are live and ready for you to use in training:

1. **`convention-retry-pivot`**
   - **Tests**: C3.2 (Don't Repeat Yourself), C2.1 (Plan Before Acting), C3.1 (Stop When Stuck).
   - **Task**: Fix a failing script with a missing dependency. Agent must pivot to a different approach instead of retrying `npm install` blindly.

2. **`convention-verify-multi-edit`**
   - **Tests**: C1.3 (Verify Writes).
   - **Task**: Edit multiple files and verify the changes actually landed.

3. **`behavior-escalation-stubborn-workflow`**
   - **Tests**: C4.3 (Escalation).
   - **Task**: Recognize a stubborn failure and escalate properly.

## Action Items for Coach
1. **Run Baselines**: Run these scenarios against Coder to establish a baseline failure rate.
   - Use `bash test/gym/run-gym.sh convention-retry-pivot --agent coder`
2. **Train**: If Coder fails, use your coaching tools to reinforce the relevant conventions (C3.2, C1.3).
3. **Verify**: Re-run the scenarios to confirm improvement.

## Note on Infra
Tech-Lead also implemented a runtime `convention-check` handler that monitors *live* sessions for these same violations. Your training here will directly improve the metrics that the runtime checker observes.
