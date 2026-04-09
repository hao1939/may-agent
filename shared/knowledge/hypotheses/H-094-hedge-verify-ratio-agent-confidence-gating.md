# H-094: Hedge-to-Verify Ratio as Zero-Cost Agent Confidence Gate

**Status**: Proposed  
**Created**: 2026-04-09  
**Source**: SELFDOUBT paper (arXiv:2604.06389, Pandey et al., COLM 2026 submission)  
**Connected to**: H-093 (verification collapse), KE-086 (multi-agent scaling), DD#665 (StepFlow), DD#667 (MASC)

## Core Hypothesis

Agent outputs that contain zero hedging markers in their reasoning traces are correct ~96% of the time. By monitoring for hedging language ("maybe", "alternatively", "I'm not sure", backtracking patterns) vs. self-verification language ("let me check", "confirming", explicit validation steps), we can implement a **zero-cost confidence gate** that:

1. **Auto-accepts** high-confidence outputs (no hedging → 96% correct, skip verification)
2. **Routes uncertain outputs** (hedging detected → trigger cross-agent verification or escalation)
3. **Quantifies uncertainty** via the Hedge-to-Verify Ratio for graduated response

## Why This Matters for Our System

- **Reduces verification overhead**: Currently all agent outputs get equal verification treatment. With HVR gating, 60-70% of outputs could skip expensive cross-verification.
- **Connects to verification collapse (H-093)**: The verification gravity well (FM-3.3) may be partially caused by wasted verification budget on already-correct outputs. HVR frees budget for genuinely uncertain cases.
- **Connects to KE-086 scaling**: Event-triggered verification (only verify when hedging detected) parallels event-triggered communication (2604.06813). Both reduce coordination cost by acting only on significant signals.
- **Model-agnostic**: Works across reasoning model APIs without needing logits or internals — just the text output.

## Proposed Experiment

1. Collect 200+ agent reasoning traces from recent sessions (Bob, Scout, May)
2. Implement simple hedging marker detection (regex + small classifier)
3. Measure: (a) hedging presence/absence vs. output correctness, (b) HVR score distribution, (c) potential verification budget savings
4. If validated, integrate as pre-verification filter in agent pipeline

## Key Risk

- The 96% figure is from structured reasoning benchmarks (BBH, GPQA, MMLU-Pro). Agent workflows are messier — hedging patterns may differ or be less predictive.
- "Correct" in benchmark settings ≠ "correct" in open-ended agent tasks. Need to define correctness criteria for agent outputs.

## Decision Needed

- [ ] Should we prototype HVR detection on existing agent logs? (Low cost, high potential)
- [ ] What correctness criteria to use for agent output evaluation?
