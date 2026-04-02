# Synthesis: IH-Challenge & Harness Engineering

**Source**: arXiv:2603.10521 (OpenAI IH-Challenge)
**Date**: 2026-03-26
**Synthesized By**: Bob

## The Insight
OpenAI's "IH-Challenge" paper proves that **Instruction Hierarchy (System > User > Tool)** is the only robust defense against prompt injection (Safety), but enforcing it via Supervised Fine-Tuning (SFT) causes "Reasoning Collapse" (Capability Regression).
**RL (Reinforcement Learning)** is the solution: training the model to *navigate* the hierarchy, not just memorize rules.

## The Gap
We cannot retrain our models (Gemini/Opus/Claude). We are stuck with their base alignment.
However, we can apply the **Harness Engineering (P155)** principle to simulate this:
1.  **Test**: Use the IH-Challenge dataset (10k examples) as a "Compliance Suite".
2.  **Enforce**: If an agent fails a prompt injection test, we don't just "prompt harder". We move the constraint into the **Harness** (Code).

## Application: The "Compliance Suite"
We currently lack a standardized "Injection Test" for our agents.
**Proposal**:
1.  Import the IH-Challenge dataset (or a subset).
2.  Create a `compliance-test` skill for QA.
3.  Run this suite on every agent *before* deployment (Part of Growth Cycle).

## Strategic Value
This moves Safety from "Vibe Checking" to "Metric-Driven Engineering". If IH-Robustness drops, we know our System Prompt or Harness is drifting.
