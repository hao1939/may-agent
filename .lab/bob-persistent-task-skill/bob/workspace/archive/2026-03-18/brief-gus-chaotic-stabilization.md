# Brief: Law 126 — The Stabilization of Chaos
**Date:** 2026-03-16
**Source:** arXiv:2603.09127 (Chaotic Dynamics in Multi-LLM Deliberation)
**Author:** Bob

## 1. The Discovery
Multi-agent systems are random dynamical systems that exhibit **chaos** (positive Lyapunov exponent λ > 0) even at temperature T=0.
- **Route A Instability**: Role differentiation creates chaos in homogeneous committees (λ=0.054).
- **Route B Instability**: Model heterogeneity creates chaos in role-less committees (λ=0.095).
- **Non-Additivity**: Roles *stabilize* heterogeneous committees (λ=0.052 < 0.095).
- **Amplification**: The synthesis/coordination role (Chair) is the dominant chaos amplifier.
- **Mechanism**: Memory window depth is the feedback loop that drives divergence.

## 2. The New Law

### Law 126: The Stabilization of Chaos
> Multi-agent deliberation is inherently chaotic (λ > 0), even at zero temperature. Stability is not a property of the model, but a dynamical equilibrium maintained by role structure and memory constraints. Role differentiation dampens heterogeneity-induced chaos, while synthesis roles amplify it.

### Principle 169: The Role Attractor
> In a heterogeneous agent system, roles act as topological attractors that constrain chaotic divergence. We assign strict roles (Input Type Signatures) not just for clarity, but to dampen the inherent instability of diverse models.

## 3. Implications
1.  **May is the Amplifier**: As the coordinator/synthesizer, May is the primary source of system-wide instability. Her prompts must be the most deterministic.
2.  **Roles are Security**: Our strict role system (Scout/Coder/QA) is a stability feature, not just an organizational one. It prevents the maximal chaos of "flat" collaboration.
3.  **Memory Tuning**: For stability-critical tasks (e.g., security audits), we should use shorter memory windows or summarized context to break the feedback loop.

## 4. Immediate Action
1.  **Add Law 126** to `philosophy.md`.
2.  **Audit May's Synthesis**: Review May's "handoff" prompts to ensure they don't hallucinate new constraints (amplification).
3.  **Stability Test**: Create a tool `test-stability` that runs a delegation 5 times and computes the divergence (Levenshtein distance of outputs).

## 5. Tool Brief: `test-stability`
A new dev-tool for the Evaluator.
- **Input**: A task description + agent name.
- **Process**: Run the task 5 times in parallel (isolated sessions).
- **Output**:
    - `divergence_score`: 0.0 to 1.0 (normalized edit distance).
    - `verdict`: STABLE / UNSTABLE / CHAOTIC.
- **Use**: Run this on critical prompts (like the "Brief" prompt) to harden them.
