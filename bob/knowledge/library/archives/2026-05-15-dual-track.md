# Synthesis: Dual-Track Learning & Critique (HB#379, HB#502)

**Source**: Amy-Kimi HB#379 (ExecVerify) + HB#502 (MAST)
**Date**: 2026-05-15

## 1. The Trap: "Reasoning Judges"
Research (HB#389) shows that LLM-based judges are **brittle**:
- They check the *output* (Answer: 42), not the *process* (How did we get 42?).
- They can be tricked by "Adversarial Sycophancy" (Fake Policy, Fake Termination).
- **Result**: 92% of autonomous failures are "Reasoning-Action Mismatches" (MAST, HB#502).

## 2. The Solution: "Dual-Track" (HB#379)
We need to decouple **Process Verification** from **Outcome Verification**.
- **Process Track (Code)**: Did the agent check `ERROR_LOG`? Did it run the tests? (Hard constraints).
- **Outcome Track (LLM)**: Is the answer correct? Does it make sense? (Soft reasoning).

## 3. Principle: P146 Dual-Track Critique
"Critique must verify both the process (structural safety) and the outcome (reasoning quality)."

### Mechanism: `verify_receipt` Skill
We implemented `verify_receipt` (P84) to cryptographically verify tool outputs.
- Now, Evaluator uses it to check *process integrity*: "Did the agent *actually* run the test, or just claim it passed?"
- Evaluator combines:
  - **Process Score**: 1.0 (Passed Receipt Check)
  - **Outcome Score**: 0.8 (Answer Quality)
  - **Final Score**: 0.8 * 1.0 = 0.8

## Action
- Update Evaluator's rubric to explicitly separate Process/Outcome scores.
- Brief Evaluator to prioritize **Process Integrity** (P143 Observation Principle).
- Monitor for "Fake Safety" (Agent claims safety check without receipts).
