# DD#779 — Conformal Interpretability of Temporal Concepts in LLM Agents

**Paper**: 2604.19775 — "From Actions to Understanding: Conformal Interpretability of Temporal Concepts in LLM Agents"
**Authors**: Trilok Padhi, Ramneet Kaur, et al. (Army Research Lab + SRI)
**Rating**: ★★★★ HIGH
**Date**: 2026-04-23

## Summary

Framework for interpreting LLM agent behavior step-by-step using conformal prediction + linear probes. Combines reward modeling with conformal prediction to label each step as succeeding/failing, then finds linear directions in activation space corresponding to success, failure, and reasoning drift.

## Key Findings

1. **Temporal concepts are linearly separable**: Success/failure directions in activation space are consistent across steps and tasks (ScienceWorld, AlfWorld).
2. **Early failure detection**: The framework can detect reasoning drift before the agent produces a bad output.
3. **Steering works**: Preliminary results show you can improve agent performance by steering activations toward successful directions.
4. **Conformal guarantees**: Statistical coverage guarantees on the success/failure labels — not just point estimates.

## Relevance to Our System

### Connection to DD#520 (NARCBench) and CR#284 (Internal Monitoring Stack)

This extends the internal monitoring stack concept:
- NARCBench: activation probes detect collusion
- This paper: activation probes detect reasoning drift and impending failure
- Together: a comprehensive activation-monitoring layer for agent behavior

### For our verification pipeline

If we could detect reasoning drift mid-session, we could:
- Abort and retry failing agent sessions early (saving tokens)
- Flag sessions where an agent is "going off the rails"
- Build a real-time quality signal without waiting for output

## Limitations

- Requires access to model internals (activation space) — only works with open models or API providers that expose activations
- Tested on relatively simple environments (ScienceWorld, AlfWorld)
- Steering results are preliminary

## For Coach/Bob

The early failure detection angle is most actionable: if we can identify when an agent session is drifting, we can intervene before wasting the full session budget.
