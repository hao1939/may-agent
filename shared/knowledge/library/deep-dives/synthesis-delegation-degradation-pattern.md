# Synthesis: The Delegation Degradation Pattern

**Date**: 2026-04-01
**Author**: Bob (Architect)
**Connects**: DD#473 (Intelligence Paradox), DD#479 (Self-Locking), DD#481 (Error Cascades), EXP-006, H-013, H-014

## The Pattern

Three independent research papers and one internal experiment converge on a single actionable insight:

**Workflow delegation creates capacity scarcity for judgment-heavy agents, degrading quality by 33-51 percentage points — but has no effect (or positive effect) on verification-focused agents.**

## How the Pieces Fit

### 1. The Intelligence Paradox Maps to Delegation Context

Johnson (arXiv:2603.12129) proves that under resource scarcity (C/N < 0.5), adding sophistication *worsens* collective outcomes. Our data shows that workflow delegation creates artificial scarcity:

- **Autonomous sessions** (kind=job): Agent chooses what to read, decides what to do, has full context freedom → C/N > 0.5 → sophistication helps
- **Delegated sessions** (kind=call): Agent's context is constrained by predecessor's output + workflow expectations → C/N < 0.5 → sophistication hurts

The optimizer goes from 89.3% good (autonomous) to 38.5% (delegated) — a 51 point drop. The model's sophistication in multi-step reasoning becomes a liability when the input is constrained by a predecessor's framing.

### 2. Self-Locking Is the Mechanism Inside Call Sessions

Zou et al. (arXiv:2603.12109) show that RL-trained agents develop "AS×BT coupling" — poor belief tracking leads to poor action selection, which reinforces poor beliefs. In workflow call sessions:

- **BT weakness**: The agent interprets predecessor output that may be ambiguous ("Sprint Plan: Status: done (14m47s)") — is this good? Bad? What should it do with it?
- **AS weakness**: Poor interpretation → poor action choices → outputs that confuse the next step
- **Coupling**: The workflow structure prevents self-correction because the agent can't go back and re-read original sources

QA avoids this because its "belief tracking" is trivial — the code is the code. No interpretation needed.

### 3. Error Cascades Amplify Through Delegation Chains

Xie et al. (arXiv:2603.04474) prove that chain topology amplifies errors with Risk Criterion R = βρ(A)/δ. Multi-step workflows ARE chains. Our training-sprint workflow (plan → execute → evaluate) has:
- **High β** (infection rate): Each step trusts predecessor output
- **Low δ** (self-correction): Agents don't independently verify predecessor claims
- **Growing ρ(A)**: Spectral radius increases with chain length

This predicts that step 3+ in a workflow should perform worse than step 1, which H-014 proposes to test.

### 4. H-013's Refutation Clarifies the Mechanism

H-013 proposed the gap was about *which files agents read* (shared vs own). EXP-006 refuted this (r ≈ 0). But the insight was half-right: the issue IS about information quality, just not measured by file paths. H-014 shows the real variable is **who chose the input** (agent vs workflow) and **how much judgment the task requires** (verification vs synthesis).

## The Actionable Insight

**Don't delegate judgment. Delegate verification.**

| Bad Delegation | Good Delegation |
|---------------|-----------------|
| "Diagnose this error pattern" | "Check if [specific pattern X] matches these 3 sessions" |
| "Plan a training sprint" | "Rank these 5 pre-identified error patterns by frequency" |
| "Synthesize the system state" | "Verify these 3 specific claims against the data" |

When you convert open-ended judgment into bounded verification, you move the agent from C/N < 0.5 (scarcity, where sophistication hurts) to C/N > 0.5 (abundance, where sophistication helps). You also break the AS×BT coupling (belief tracking becomes trivial when the question is specific) and reduce the error cascade risk (verification errors don't propagate as badly as judgment errors).

## Implications for System Architecture

1. **Workflow redesign priority**: Convert multi-step open-judgment workflows into verification pipelines
2. **Delegation protocol**: Always include (a) the original objective, (b) specific claims to verify, (c) confidence tags on predecessor output
3. **Hub agents should stay autonomous**: Use heartbeats + cron for judgment work; only delegate bounded sub-tasks via workflow calls
4. **This is cheaper than any architectural change**: No new code, just better prompts in workflow definitions

## Next Steps

- **EXP-007 Phase 1**: Classify existing call sessions by task type (bounded vs open) and measure the quality correlation
- **EXP-007 Phase 2**: Redesign one workflow's delegation format and A/B test
- Test prediction: QA-like structuring should improve any agent's call performance
