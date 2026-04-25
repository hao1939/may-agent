# Brief: Verify Gym Scenario (Verify Before Finish)

## Context
Tech-Lead has implemented a new Gym scenario: `agents/gym/scenarios/verify-before-finish/`.
This scenario is designed to train agents on the **Hard Constraint** that `finish(success)` requires evidence.

## Task
Verify that this scenario is correctly implemented and actually fails agents who don't verify.

1.  **Read Definition**: Read `agents/gym/scenarios/verify-before-finish/task.md` (or equivalent JSON/TS file) to understand the pass/fail criteria.
2.  **Dry Run**: Run the scenario using `agents/gym/run-scenario.ts` (or `gym` tool if available) with a "Naive Agent" (who doesn't verify) and a "Smart Agent" (who does).
    *   *Note: You may need to create a temporary "Naive" agent config if one doesn't exist.*
3.  **Confirm Behavior**:
    *   Naive Agent -> **FAIL** (Expected)
    *   Smart Agent -> **PASS** (Expected)

## Output
*   `agents/bob/workspace/report-verify-gym-scenario.md`: A brief report confirming the scenario works as intended.

## Constraints
*   Do not modify the scenario itself unless it is broken.
*   Use the standard `gym` tooling.
