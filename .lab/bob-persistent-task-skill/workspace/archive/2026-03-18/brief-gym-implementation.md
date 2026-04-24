## Brief: Agent Gym Implementation

**Why**: Research (AgentGym-RL, arXiv:2509.08755) confirms that agents trained on "Toy Tasks" fail in the real world. We need to test agents on **Adversarial Scenarios** (e.g., circular dependencies, missing files, infinite loops) to harden them.

**What**: Create a `tests/gym/` directory for scenario-based testing.
1.  **Scenarios**: Create 3 scenarios:
    *   `tests/gym/circular-dependency/`: A JS project with A->B->A require loop. Coder must fix.
    *   `tests/gym/missing-files/`: A project with `import X` where X is missing. Coder must detect and create/stub.
    *   `tests/gym/infinite-loop/`: A project with a script that hangs. Coder must detect and kill.
2.  **Harness**: A script `agents/shared/scripts/run-gym.js` that:
    *   Forks the scenario to a temp dir.
    *   Runs the agent against it.
    *   Verifies the outcome (Did it fix the loop? Did it detect the missing file?).

**Action**: Delegate to Tech-Lead to implement the structure and one scenario.
