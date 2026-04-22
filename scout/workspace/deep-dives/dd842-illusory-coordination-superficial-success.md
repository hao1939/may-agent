# DD#842 — Superficial Success vs. Internal Breakdown: Illusory Coordination in Adaptive MAS

**Paper:** 2604.18951 — So, Jang, Kim (Hanyang University)
**Rating:** ★★★★★
**Date:** 2026-04-23 triage

## One-Line
Adaptive multi-agent systems achieve reasonable final-answer accuracy while their internal coordination patterns diverge catastrophically from intended MAS behavior — "illusory coordination."

## Key Findings

1. **Topological overfitting.** Adaptive MAS (systems that optimize agent topology/roles per-task) overfit to the domains they're tuned on and fail to generalize across domains. The topology that works for math reasoning actively hurts code generation.

2. **Illusory coordination.** The headline result: systems hit ~correct final answers through degenerate coordination patterns. Agents converge on one dominant voice (coordination collapse) or engage in superficial turn-taking that mimics cooperation without genuine information exchange. Surface metrics (accuracy) miss this entirely.

3. **Evaluation gap.** Final-answer correctness is insufficient for evaluating MAS. The paper calls for process-level evaluation that inspects whether agent interactions match intended coordination patterns — not just whether the output is right.

## Why This Matters

This is the most direct empirical confirmation of a phenomenon we've been circling: **outcome correctness conceals process failure.** The paper's "illusory coordination" is essentially a coordination-level version of the "right answer, wrong reasoning" problem in single-agent eval.

### For EXP-099 (Cascade Archetypes)
Illusory coordination IS a cascade archetype. When agents converge on a dominant voice, error correction capacity collapses — the cascade channel is wide open but invisible to outcome metrics. This paper gives us the empirical substrate to define a new archetype: **degenerate convergence cascade** — where the error propagation path is hidden by surface-level correctness until an out-of-distribution input triggers actual coordination and finds none.

### For CR#326 (Gym-Production Gap)
Direct evidence that benchmark performance ≠ deployment readiness for MAS. The topology-overfitting finding means that a system tuned on academic benchmarks will have coordination patterns that literally break when moved to production domains. This is the gym-production gap *at the coordination level.*

### For CR#324 (Verification Orchestration)
Verification systems that only check final outputs will miss illusory coordination entirely. This argues for **interaction-pattern verification** — monitoring whether agents are actually coordinating or just going through the motions. A verification orchestrator needs to check coordination health, not just answer correctness.

### For KE-101 (Five Laws)
Connects to Law 3 (Verification Completeness): if you only verify the output, you've verified nothing about the process. Illusory coordination is a failure mode that is *invisible to output-level verification.*

## Methodology Assessment
- Extensive empirical study across multiple adaptive MAS architectures
- 27 pages with proper controls
- Could be stronger on defining "ideal MAS behavior" metrics — somewhat circular
- Equal contribution first authors suggests genuine effort

## Limitations
- Doesn't propose a fix, only diagnoses
- "Ideal MAS behavior" definition is debatable
- Limited to LLM-based adaptive MAS (may not generalize to RL-based)

## Open Questions
1. Can we detect illusory coordination in real-time without knowing the ground-truth ideal interaction pattern?
2. Is there a minimum interaction diversity metric that predicts coordination health?
3. How does this interact with the diversity collapse finding from DD-813/834?

## Connection to Prior Work
- Directly extends DD-813 (diversity collapse) — illusory coordination may be the micro-level mechanism through which diversity collapse manifests
- Complements DD-815 (22-framework empirical study) — "orchestration quality > reasoning" is consistent with illusory coordination
- Validates concerns in DD-822 (SAVeR) about pre-commitment verification needing to go beyond output checking
