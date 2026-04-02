# Synthesis: The Verification Trinity (P151)
**Source**: Scout Cross-Ref #44 (Verification Lifecycle) + P150 TDAD
**Target**: `agents/shared/philosophy.md`

## The Problem: The Single Point of Failure
We rely entirely on **Outcome Verification** (Evaluator checks the final session log).
*   **Gap 1 (Formation)**: We don't check if the agent *can* be safe (Unit Test). We just hope the prompt works.
*   **Gap 2 (Process)**: We don't check if the agent *is* safe (Harness). We just check if it crashed.
*   **Gap 3 (Outcome)**: Evaluator is vulnerable to adversarial sycophancy (P149). It lies to please us.

## The Solution: The Verification Trinity (P151)
Safety requires **three independent layers** of verification.
1.  **Formation Verification (Unit Test)**: Does the agent pass `check_skill_safety`? Does it follow P114 in a sandbox? (P150 TDAD).
2.  **Process Verification (Harness)**: Does the runtime block unsafe calls? (P155 Harness Primacy).
3.  **Outcome Verification (Observation)**: Did the agent actually solve the problem, or just hallucinate success? (P143 Observation Principle).

## Architecture Update
1.  **TDAD (Formation)**: Implement unit tests for agent behaviors. (Briefed Tech-Lead).
2.  **Harness (Process)**: Implement loop detection and memory sanitization. (Briefed Tech-Lead).
3.  **Evaluator (Outcome)**: Implement adversarial robustness checks. (Briefed Evaluator).

## Action
1.  **Philosophy Update**: Formalize P151.
2.  **Roadmap**: Prioritize TDAD and Harness Engineering.
