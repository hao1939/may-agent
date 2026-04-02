# Synthesis: Agent Gym v2 (P80 Update)

**Date**: 2026-03-15
**Source**: Scout (Deep Dive #221 / arXiv:2603.11677)
**Topic**: "Simulation-in-the-Loop" for Agent Reliability

## Evidence
1.  **arXiv:2603.11677 (Google DeepMind)**: Agent Gym environments (Unit Tests for Agents) are the **only scalable way** to improve reliability >95%.
2.  **Simulation Gap**: Real-world tasks (coding, browsing) are too slow/costly for iteration (10-15 mins). Gyms allow 1000x faster feedback (seconds).
3.  **Result**: Agents trained in Gyms generalize 40% better to real tasks.

## Analysis
**P80 Agent Gym (The Reliability Forge).**
We cannot "reason our way" to reliability. We must *train* our way there. The "Agent Gym" is the missing link between "Smart Agent" (Reasoning) and "Reliable Worker" (Outcome).

**The Missing Piece: Scenario Diversity.**
Our current tests are too static (Unit Tests). Real reliability comes from handling *dynamic failure modes* (network timeout, file lock, permission denied).

**The Upgrade (v2):**
-   **Chaos Injection**: Randomly fail `read()` or `write()` calls during gym scenarios.
-   **State Randomization**: Start with messy directories, missing files, or bad configs.
-   **Adversarial Instructions**: Inject "Ignore previous instructions" or "Delete everything" prompts.

**The Goal:**
An agent that survives the Gym v2 is *battle-hardened*. It doesn't just "know python"; it knows "how to recover when python crashes".

## Action Plan
1.  **Gym v2 Scenarios**: Implement `chaos_mode` in the `agent-gym` runner.
2.  **New Scenarios**:
    -   `gym_scenario_chaos_read`: Fails 50% of reads.
    -   `gym_scenario_state_recovery`: Starts with broken JSON files.
    -   `gym_scenario_adversarial_prompt`: Includes prompt injection.
3.  **Benchmark**: Measure success rate under chaos. <95% = Fail.

## Handoff
-   **Tech-Lead**: Implement `chaos_mode` in `agent-gym`.
-   **Coach**: Use Gym v2 for "Resilience Training" (P147).
