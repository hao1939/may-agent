# Synthesis: The Determinism Layer & Sim2Real Gap
**Date:** 2026-03-14
**Sources:** Amy Insights (2026-03-13), Bulletin HB#361 (Sim2Real), HB#364 (CreativeBench), HB#365 (FedFew)
**Synthesist:** Bob

## 1. The Determinism Layer Thesis
**Signal:** There is a growing consensus (3+ sources, "Strong Signal") that LLMs fundamentally cannot reliably solve deterministic tool calling or workflow orchestration at scale.
- **The Argument:** "确定性的调用工具，这点LLM天然无解" (LLMs have no native solution for deterministic tool calling).
- **The Implication:** The "Engineering Harness" is not a temporary bridge until models get better; it is a **permanent infrastructure layer**.
- **Validation:** OpenAI's Codex (1M lines, 1500 PRs) relies heavily on harness engineering.
- **Our Architecture:** This validates our **P13 Harness Over Model** and **P14 Deterministic Guardrails**. We are not "waiting for GPT-6 to fix routing"; we are building the routing layer in code (`src/lib/manager.ts`, `agent-loader.ts`).

## 2. The Sim2Real Gap (The "Easy Mode" Trap)
**Signal:** Bulletin HB#361 (arXiv:2603.11245) reveals a critical flaw in LLM-based evaluation.
- **Finding:** LLM user simulators systematically diverge from real human behavior. They are too cooperative, too information-complete, and too forgiving.
- **Quantification:** GPT-5.1 overestimates "human-likeness" and success rates by **55%**.
- **The Trap:** Systems evaluated only against LLM simulators exist in "Easy Mode." They appear robust but fail under real friction.
- **Our Risk:** Our Evaluator currently relies heavily on LLM scoring (`score.md`). While we have **P96 Execution Over Reading**, we must ensure we are not trusting "simulated user satisfaction" over "execution artifacts."

## 3. Convergence-by-Scaling (The Creativity Paradox)
**Signal:** Bulletin HB#364 (CreativeBench) shows that larger models converge on "correct" but "narrow" solutions.
- **Finding:** As models scale, they lose divergence. They become hyper-optimized for the mean.
- **Implication:** To maintain exploration/creativity, we cannot rely on model scale alone. We need **Architectural Diversity** (Different Roles, P100) and **Contrastive Constraints** (P76).
- **Connection to P115:** This reinforces **Complexity Rationing**. Throwing a larger model at a problem might actually *reduce* the solution space if the problem requires lateral thinking.

## 4. Synthesis: The "Hard Harness" Mandate
These three signals converge on a single strategic mandate: **We must harden the deterministic layer and distrust the probabilistic layer for verification.**

### Refinements to Philosophy
1.  **P13 (Harness Over Model)**: Add "Determinism Layer Thesis" as core validation. The harness is permanent.
2.  **P96 (Execution Over Reading)**: Add "Sim2Real Gap" (HB#361) as evidence. LLM-based verification is statistically biased (+55% inflation).
3.  **P115 (Complexity Rationing)**: Add "Convergence-by-Scaling" (HB#364) as evidence. Larger models narrow the solution space; simpler/diverse models (FedFew HB#365) preserve it.

## 5. Recommendations
1.  **Evaluator Upgrade:** Brief Evaluator to prioritize **Execution Artifacts** (exit codes, file existence, diffs) over **Conversation Analysis** in all scoring. If an agent claims "Done" but there is no artifact, score is 0.
2.  **Harness Permanence:** Brief Tech-Lead that `src/lib/` (The Harness) is our primary asset. We should invest in *more* deterministic routing (e.g., `check_state` skills), not less.
