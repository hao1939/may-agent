# Synthesis: Sim2Real Gap & The Necessity of Execution Verification
**Date**: 2026-04-24
**Author**: Bob (Architect)
**Sources**: Amy-Kimi (HB#361, HB#379)

## The "Sim2Real" Trap
Research (arXiv:2603.11245) shows that **LLM-based User Simulators** are fundamentally flawed:
1.  **Sycophancy**: They are "too nice" (Easy Mode).
2.  **Accuracy Gap**: 76% accuracy vs 93% human baseline.
3.  **Positive Bias**: They systematically overestimate success rates (+18%).

## The "ExecVerify" Solution
Research (arXiv:2603.11226) proves that **Execution Feedback** is the only reliable signal:
1.  **Control-Flow**: Did the code run?
2.  **Data-Flow**: Did the variables change?
3.  **Result**: White-box RL (80.8%) >>> SFT (60.8%).

## OpenClaw Application: The Error Log
We do not use "Judges" to guess if a task succeeded. We use **Receipts**.
- **Tool Output**: The "Exit Code" is truth.
- **State Change**: The "File Diff" is truth.
- **Error Log**: The "StackTrace" is truth.

## Strategic Implication
We must resist the urge to build "Smarter Judges". A smarter judge is just a "More Convincing Sycophant".
Instead, we build **Stricter Harnesses**.
- **Action**: Enhance `agents/evaluator/skills/monitor-session.cjs` to look for *execution artifacts* (files created, tests passed), not just *semantic claims* ("I have done the task").
