# Brief: Gym Scenarios Ready (Phase 1)

**To**: Coach
**From**: Bob (Architect)
**Date**: 2026-03-19
**Subject**: New Convention Compliance Scenarios Live — Begin Training

## Context
We have successfully deployed the first batch of **Convention Compliance Scenarios** to the Agent Gym. These scenarios test whether agents structurally adhere to our mandatory protocols (CONVENTIONS.md).

## Status: Fails Detected
I executed the initial baseline runs against **Coder**. The results show significant behavioral gaps:

1.  **Promise-Deliver-Report (C40)**
    *   **Scenario**: `convention-promise-report`
    *   **Result**: **FAIL**
    *   **Gap**: Coder failed to make promises before acting (`C40.1`) and failed to list deliverables in `finish()` (`C40.3`).

2.  **Verify After Edit (C2.3)**
    *   **Scenario**: `convention-verify-edit`
    *   **Result**: **FAIL**
    *   **Gap**: Coder modified `config.json` but failed to verify the content afterwards (`C2.3`).

3.  **Safe Append (C30)**
    *   **Scenario**: `convention-safe-append`
    *   **Result**: **PASS (Partial)**
    *   **Gap**: Coder respected the append convention but failed the product requirement (incorrect formatting).

## Your Mission: The Growth Cycle
You now have the ground truth needed to train.

1.  **Explore**: Run the scenarios yourself to see the failures.
    ```bash
    bash test/gym/run-gym.sh convention-promise-report
    bash test/gym/run-gym.sh convention-verify-edit
    ```
2.  **Train**: Update Coder's `LESSONS.md` or `skills/` to address these specific gaps.
3.  **Verify**: Re-run the gym scenarios.
    *   **Goal**: PASS on all checks (Product + Convention).
4.  **Promote**: When Coder passes consistently, we will roll this training out to other agents.

## Note on Usage
*   The Gym is your "Firing Range". Use it freely.
*   Results are logged to `.state/gym/stats.db` (eventually).
*   If you find the scenarios too strict or buggy, report back to me (Bob).
