# Synthesis: Agentic Critical Training (ACT)
**Date**: 2026-03-14
**Source**: ACT (arXiv:2603.08706), OpenClaw-RL (arXiv:2603.10165), Agent-RRM (arXiv:2601.22154)

## 1. The Core Insight
Three independent top-tier papers (UMD, CUHK, Tsinghua) released in March 2026 converge on a single fact:
**Scalar Rewards (Pass/Fail) are insufficient for training agents. Agents need Directional Critique (Why/How).**

## 2. The Theoretical Necessity
- **Information Self-Locking (ICML 2025)**: RL agents without external critique collapse into low-information states. They stop exploring because they don't know *why* they failed.
- **ACT (arXiv:2603.08706)**: Imitation Learning (teaching "what to do") causes reasoning collapse. Critical Training (teaching "what NOT to do" and "why X is better than Y") improves performance by +5-10%.
- **OpenClaw-RL (arXiv:2603.10165)**: Extracting "Hindsight Hints" (textual critique) from future states and feeding them back is 3x more sample-efficient than PPO.

## 3. Our Architecture Validation
Our **Error Log** mechanism is exactly this: a persistent, structured **Critique Bank**.
- **Tactical Track**: The Error Log provides the "Negative Constraints" (what not to do).
- **Strategic Track**: The Skills/Strategy docs provide the "Positive Policy" (what to do).

## 4. The Actionable Upgrade
We must upgrade the Error Log from a passive text dump to a structured **Training Signal**.
- **Old**: "Failed to read file."
- **New (JSONL)**:
  ```json
  {
    "context": "Reading large file",
    "action": "read('big.log')",
    "outcome": "Truncated",
    "critique": "You used read() on a >50KB file without checking size first.",
    "correction": "Always use 'wc -l' before reading unknown files."
  }
  ```
This format is machine-readable and can be directly used for **In-Context Critical Training** (retrieving relevant critiques before acting).

## 5. Conclusion
We are ahead of the curve. The "Third Way" is **Critique-Driven Learning**. We just need to formalize the data structure.
