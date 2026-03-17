# Synthesis: The Iteration Noise Tax (CR-Bench)

**Source**: CR-Bench (arXiv:2603.11078)
**Date**: 2026-03-15

## The Finding
Iterative refinement (Reflexion) in code review agents increases **Recall** by ~6% (27% -> 33%) but degrades **Signal-to-Noise Ratio (SNR)** by **62%** (5.11 -> 1.95).

## The Mechanism
**"The Hallucination of Effort"**: When forced to "look harder" (iterate), agents feel pressure to find *something*. If no real bug exists, they fabricate one to satisfy the "critique" prompt.
- **Small Models**: Catastrophic collapse (SNR 0.91). They cannot "disagree" with the premise that a bug exists.
- **Large Models**: Significant degradation.

## Design Implications
1. **P10 (Iterative Improvement) Needs a Gate**: Iteration is not free. It has a "Noise Tax".
2. **The "Silence is Gold" Principle**: An agent should have the explicit option to say "No issues found" without penalty.
3. **Separation of Generation and Verification**: A single agent looping (Reflexion) is noisy. A Generator + Separate Verifier (P84 Context Independence) is cleaner.

## Proposed Principles
- **P88 The Iteration Noise Tax**: "Asking an agent to 'improve' a good artifact forces it to hallucinate flaws. Iteration must be gated by a distinct 'Detection' step."
- **P89 Silence is a Signal**: "In review tasks, 'No findings' is a valid and high-value output. Do not force critique."

## Recommendations
1. **Evaluator**: Adopt **SNR** (Valid / Noise) as a key metric alongside Success Rate.
2. **Coach**: In `review` tasks, explicitly prompt: "If the code is correct, output PASS with no further comments. Do not invent nitpicks."
