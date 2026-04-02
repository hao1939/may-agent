# Synthesis: The Error Amplification Law & GNAP Convergence
**Date:** 2026-03-15
**Source:** Scout Discovery 30 (GNAP) & 31 (ThReadMed-QA)

## 1. The Error Amplification Law (Discovery 31)
**Finding:** Research (arXiv:2603.11281) quantifies multi-turn error propagation in real dialogues.
- **The Multiplier:** A single wrong turn increases the probability of a subsequent wrong turn by **1.9× to 6.1×**.
- **The Degradation:** Strong models (GPT-5/Claude 3.5) degrade *faster* after an error than weaker models (Confidence Hallucination).
- **The Implication:** "Retrying" with the same context is statistically doomed. If step $N$ is wrong, step $N+1$ has a $>60\%$ chance of being wrong even if the model is perfect.

**System Impact:**
This validates our **P125 Circuit Breaker** and **P148 Structural Verification**.
It refutes "Self-Correction" (P148) in the same context.
**New Principle:** **"Reset on Failure"**. If an agent fails, we must *prune the context* before retrying. Continuing a tainted session is mathematically irrational.

## 2. GNAP Convergence (Discovery 30)
**Finding:** Farol Labs' "Git-Native Agent Protocol" (GNAP) independently converged on our exact architecture:
- File-based coordination (Shared Repos).
- Heartbeat-driven wake-up.
- `read_by` receipts (solving our P82 gap).
- Typed messages (Directive/Status/Request).

**System Impact:**
This is strong external validation. We are not crazy; this is the optimal topology for non-continuous agents.
**Actionable Feature:** GNAP uses **Typed Messages**. We currently use free-text `send()`.
We should formalize `send(agent, type="directive|report", message)` to improve parsing.

## 3. Structural Recommendations
1.  **Formalize "Context Pruning"**: When an agent reports failure, the Manager/Optimizer should *not* just "retry". It should start a *fresh session* or explicitly mark the previous context as "tainted".
2.  **Adopt Typed Coordination**: Update `best-practices.md` to encourage starting messages with `[DIRECTIVE]`, `[REPORT]`, `[QUERY]`. This is cheaper than a code change and easier to parse.

## 4. Proposed Philosophy Update (P158)
**P158 The Clean Slate Rule**:
"Error propagation is exponential (1.9x-6.1x). Never retry a complex task in a tainted context. If an agent fails, close the session and start fresh with a sanitized brief. Context persistence is a liability during failure."
